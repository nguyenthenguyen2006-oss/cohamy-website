import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {FlowSnapshot} from '../../lib/crm/document-flow-model';

const databaseUrl = process.env.CRM_QA_FACTORY_EXTRA_DATABASE_URL;
const localDataDir = '.local/crm-qa-factory-extra-' + randomUUID();
if (databaseUrl) {
  const target = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && target.port === '55432');
  assert.match(target.pathname, /^\/cohamy_qa_factory_extra_[a-z0-9_]+$/u);
}
process.env.CRM_DATABASE_MODE = databaseUrl ? 'postgres' : 'pglite';
process.env.CRM_ENVIRONMENT = databaseUrl ? 'STAGING' : 'LOCAL';
process.env.CRM_DATABASE_URL = databaseUrl ?? '';
process.env.CRM_LOCAL_DATA_DIR = localDataDir;
process.env.CRM_PUBLIC_ORIGIN = 'https://factory-extra-qa.invalid';
process.env.CRM_EMAIL_ENABLED = 'false';
process.env.CRM_QA_DOCUMENT_MAIL = 'false';

const reports: {name: string; status: 'PASS'}[] = [];
const jsonOnly = process.argv.includes('--json');

async function check(name: string, action: () => Promise<void>) {
  await action();
  reports.push({name, status: 'PASS'});
  if (!jsonOnly) console.log('PASS ' + name);
}

async function main() {
  const {createQaFixture, qaPassword} = await import('./qa-fixture');
  const {installQaRuntime} = await import('./qa-runtime');
  const {database} = await import('../../lib/crm/db');
  const {login} = await import('../../lib/crm/auth');
  const {createAccount, createWarehouse} = await import('../../lib/crm/repository');
  const flow = await import('../../lib/crm/document-flow');
  const {fixed} = await import('../../lib/crm/decimal');
  const {adminInvoiceDetail} = await import('../../lib/crm/invoice-admin-read');
  const {changeAdminInvoice} = await import('../../lib/crm/invoice-admin-write');
  const {handleAccountantWorkflowAction} = await import('../../lib/crm/accountant-workflow');

  await createQaFixture();
  const owner = await database();
  const closeRuntime = await installQaRuntime(owner);
  const db = await database();
  try {
    const {user: admin} = await login('admin@crm-qa.invalid', qaPassword);
    async function actor(alias: string, role: 'FACTORY' | 'WAREHOUSE_HN' | 'WAREHOUSE_HCM') {
      const email = `${alias}@crm-qa.invalid`;
      await createAccount(admin, {email, role, displayName: `QA ${role}`, password: qaPassword, organizationId: admin.organizationId});
      return (await login(email, qaPassword)).user;
    }
    const factory = await actor('factory-extra', 'FACTORY');
    const receiver = await actor('factory-extra-hcm', 'WAREHOUSE_HCM');
    const outside = await actor('factory-extra-hn', 'WAREHOUSE_HN');
    const warehouse = await createWarehouse(admin, {code:'QA-EXTRA-HCM',name:'QA receiving warehouse',organizationId:admin.organizationId,region:'SOUTH'});
    const opposite = await createWarehouse(admin, {code:'QA-EXTRA-HN',name:'QA other warehouse',organizationId:admin.organizationId,region:'NORTH'});
    const products = (await db.query<{id: string; name: string}>('SELECT id,name FROM cohamy_crm.products WHERE active ORDER BY sku LIMIT 4')).rows;
    assert.equal(products.length, 4);
    const [requested, extra, disabled, noUnit] = products;
    await db.query("UPDATE cohamy_crm.products SET stock_unit='Gói' WHERE id=ANY($1::uuid[])", [products.map(p => p.id)]);
    await db.query('UPDATE cohamy_crm.products SET active=false WHERE id=$1', [disabled.id]);
    await db.query("UPDATE cohamy_crm.products SET stock_unit='' WHERE id=$1", [noUnit.id]);

    const makeRequest = () => flow.saveFlowDocument(admin, {
      kind: 'REQUEST', warehouseId: warehouse.id, factoryMembershipId: factory.membershipId,
      lines: [{productId: requested.id, quantity: '10'}], confirm: true, idempotencyKey: randomUUID(),
    });
    const request = await makeRequest();
    const source = await flow.viewFlowDocument(factory, request.id);
    const sourcePdf = await flow.downloadFlowPdf(admin, request.id, request.version);
    const sourceLine = {productId: requested.id, quantity: '6'};
    const extraLine = {productId: extra.id, quantity: '3.5', extra: true};
    const dispatchInput = () => ({kind: 'DISPATCH', parentId: request.id, lines: [sourceLine, extraLine], idempotencyKey: randomUUID()});

    async function stock(productId: string, warehouseId = warehouse.id) {
      const {rows} = await db.query<{qty: string}>(
        'SELECT coalesce(sum(on_hand),0)::text AS qty FROM cohamy_crm.inventory_balances WHERE warehouse_id=$1 AND product_id=$2',
        [warehouseId, productId],
      );
      return fixed(rows[0].qty);
    }
    const assertStock = async (requestedQty: string, extraQty: string) => {
      assert.equal(await stock(requested.id), fixed(requestedQty));
      assert.equal(await stock(extra.id), fixed(extraQty));
      assert.equal(await stock(extra.id, opposite.id), 0n);
    };

    await check('Factory must accept the current request and cannot redirect the shipment to another warehouse', async () => {
      await assert.rejects(flow.saveFlowDocument(factory, dispatchInput()), /FACTORY_ACCEPTANCE_REQUIRED/);
      await flow.acceptFactoryRequest(factory, {id: request.id, idempotencyKey: randomUUID()});
      await assert.rejects(flow.saveFlowDocument(factory, {...dispatchInput(), warehouseId: opposite.id}), /SOURCE_WAREHOUSE_MISMATCH/);
      await assert.rejects(flow.saveFlowDocument(receiver, dispatchInput()), /FORBIDDEN/);
      const workspace = await flow.flowWorkspace(factory);
      assert.ok(workspace.products.some(product => product.id === extra.id && product.stock_unit === 'Gói'));
      assert.ok(!workspace.products.some(product => product.id === disabled.id));
      assert.ok(workspace.products.every(product => product.retailPrice === null && product.vatRate === '0'));
    });

    await check('Only active catalog extras with a stock unit can be marked, with no bypass of parent quantities', async () => {
      const denied = (lines: unknown[], error: RegExp) => assert.rejects(flow.saveFlowDocument(factory, {...dispatchInput(), lines}), error);
      await denied([{productId: extra.id, quantity: '1'}], /PRODUCT_OUTSIDE_REQUEST/);
      await denied([{...sourceLine, extra: true}], /EXTRA_ALREADY_REQUESTED/);
      await denied([{...sourceLine, quantity: '11'}], /REQUEST_QUANTITY_EXCEEDED/);
      await denied([{...extraLine, productId: disabled.id}], /PRODUCT_INVALID/);
      await denied([{...extraLine, productId: randomUUID()}], /PRODUCT_INVALID/);
      await denied([{...extraLine, productId: noUnit.id}], /PRODUCT_STOCK_UNIT_REQUIRED/);
      await denied([extraLine, extraLine], /DUPLICATE_PRODUCT/);
      await denied([{...extraLine, quantity: '0'}], /QUANTITY_REQUIRED/);
      await assert.rejects(flow.saveFlowDocument(admin, {...dispatchInput(), kind: 'REQUEST', warehouseId: warehouse.id}), /EXTRA_ONLY_FACTORY_DISPATCH/);
      await assertStock('0', '0');
    });

    const input = dispatchInput();
    const draft = await flow.saveFlowDocument(factory, input);
    const draftView = await flow.viewFlowDocument(factory, draft.id);
    const edited = await flow.saveFlowDocument(factory, {...dispatchInput(), id: draft.id, version: draft.version, lines: [sourceLine, {...extraLine, quantity: '4.5'}]});
    const confirmation = {id: edited.id, kind:'DISPATCH', version: edited.version, idempotencyKey: randomUUID()};
    const dispatch = await flow.confirmFlowDocument(factory, confirmation);
    const dispatchPdf = await flow.downloadFlowPdf(receiver, dispatch.id, dispatch.version);
    await check('Draft edit, reload, confirmation replay and PDF preserve both lines without posting stock', async () => {
      assert.equal(draftView.lines.find(line => line.productId === extra.id)?.quantity, '3.5');
      assert.deepEqual(await flow.saveFlowDocument(factory, input), draft);
      assert.deepEqual(await flow.confirmFlowDocument(factory, confirmation), dispatch);
      assert.equal(dispatch.state, 'CONFIRMED');
      assert.equal(dispatchPdf.bytes.subarray(0,5).toString(), '%PDF-');
      const sent = (await flow.flowWorkspace(receiver)).documents.find(doc => doc.id === dispatch.id)!;
      const row = sent.lines.find(line => line.productId === extra.id)!;
      assert.equal(row.extra, true);
      assert.equal(row.name, extra.name);
      assert.equal(row.unit, 'Gói');
      assert.equal(row.ordered, '0');
      assert.equal(row.quantity, '4.5');
      assert.equal(row.shipped, '4.5');
      assert.equal(dispatchPdf.snapshot.lines.find(line => line.productId === extra.id)?.extra, true);
      assert.equal(sent.sourceId, request.id);
      assert.equal(sent.sourceRevision, request.version);
      await assert.rejects(flow.downloadFlowPdf(outside, dispatch.id), /NOT_FOUND/);
      await assertStock('0', '0');
    });

    let finalDispatchVersion = dispatch.version;
    await check('Admin can amend an extra line with both correction entry points, with no stock or source change', async () => {
      const amendment = await flow.amendFlowDocument(admin, {
        id: dispatch.id, kind:'DISPATCH', version: dispatch.version,
        lines: [sourceLine, {productId: extra.id, quantity: '5.5'}],
        note:'QA recount', reason:'QA verifies the extra shipment quantity', idempotencyKey: randomUUID(),
      });
      assert.equal((await flow.viewFlowDocument(admin, dispatch.id)).lines.find(line => line.productId === extra.id)?.extra, true);
      const {invoice} = await adminInvoiceDetail(admin, 'FLOW', dispatch.id);
      const content = structuredClone(invoice.content);
      const added = content.lines.find(line => line.productId === extra.id)!;
      added.quantity = '5';
      await changeAdminInvoice(admin, {kind:'FLOW', id:dispatch.id, version:invoice.version, action:'EDIT', content, reason:'QA correction to extra quantity', idempotencyKey:randomUUID()});
      const amended = await flow.viewFlowDocument(admin, dispatch.id);
      finalDispatchVersion = amended.revision;
      assert.ok(amended.revision > amendment.version);
      assert.equal(amended.lines.find(line => line.productId === extra.id)?.quantity, '5');
      assert.equal(amended.lines.find(line => line.productId === extra.id)?.extra, true);
      assert.deepEqual((await flow.downloadFlowPdf(admin, dispatch.id, dispatch.version)).bytes, dispatchPdf.bytes);
      assert.deepEqual((await flow.downloadFlowPdf(admin, request.id, request.version)).bytes, sourcePdf.bytes);
      await assertStock('0', '0');
    });

    await check('Receipt inherits the extra line and posts both products to the destination once', async () => {
      const receive = {
        kind:'RECEIPT', parentId: dispatch.id,
        lines:[sourceLine, {productId: extra.id, quantity:'5'}], confirm:true, idempotencyKey:randomUUID(),
      };
      const rejectReceipt = (lines: unknown[], error: RegExp) => assert.rejects(flow.saveFlowDocument(receiver, {...receive, lines, idempotencyKey:randomUUID()}), error);
      await assert.rejects(flow.saveFlowDocument(outside, receive), /NOT_FOUND/);
      await rejectReceipt([sourceLine], /ALL_RECEIPT_LINES_REQUIRED/);
      await rejectReceipt([sourceLine, {...extraLine, quantity:'5'}], /EXTRA_ONLY_FACTORY_DISPATCH/);
      await rejectReceipt([...receive.lines, {productId:noUnit.id, quantity:'1'}], /PRODUCT_OUTSIDE_REQUEST/);
      await rejectReceipt([sourceLine, {productId:extra.id, quantity:'4'}], /DISCREPANCY_NOTE_REQUIRED/);
      await assertStock('0', '0');
      const completed = await flow.saveFlowDocument(receiver, receive);
      assert.deepEqual(await flow.saveFlowDocument(receiver, receive), completed);
      await assert.rejects(flow.saveFlowDocument(receiver, {...receive, idempotencyKey:randomUUID()}), /ALREADY_RECEIVED/);
      const receipt = await flow.viewFlowDocument(receiver, completed.id);
      assert.equal(receipt.sourceRevision, finalDispatchVersion);
      assert.equal(receipt.lines.find(line => line.productId === extra.id)?.extra, true);
      assert.equal(receipt.lines.find(line => line.productId === extra.id)?.received, '5');
      const {rows} = await db.query<{product_id: string; quantity: string}>(
        'SELECT m.product_id,m.quantity::text FROM cohamy_crm.inventory_movements m JOIN cohamy_crm.factory_invoices f ON f.inventory_document_id=m.document_id WHERE f.id=$1', [completed.id],
      );
      assert.equal(rows.length, 2);
      assert.equal(fixed(rows.find(row => row.product_id === extra.id)!.quantity), fixed('5'));
      await assertStock('6', '5');
      if (process.argv.includes('--pdf')) {
        const directory = `${localDataDir}-evidence`;
        await fs.mkdir(directory, {recursive:true});
        await fs.writeFile(`${directory}/dispatch.pdf`, (await flow.downloadFlowPdf(receiver, dispatch.id)).bytes);
        await fs.writeFile(`${directory}/receipt.pdf`, (await flow.downloadFlowPdf(receiver, completed.id)).bytes);
        console.error(`QA PDFs saved in ${directory}`);
      }
    });

    await check('Parent request is unchanged and only its outstanding 4 count towards the next shipment', async () => {
      const head = await flow.viewFlowDocument(factory, request.id);
      assert.deepEqual(head.lines, source.lines);
      await assert.rejects(flow.saveFlowDocument(factory, {...dispatchInput(), lines:[{...sourceLine,quantity:'5'}], confirm:true}), /REQUEST_QUANTITY_EXCEEDED/);
      const regular = await flow.saveFlowDocument(factory, {...dispatchInput(), lines:[{...sourceLine,quantity:'4'}], confirm:true});
      assert.equal((await flow.viewFlowDocument(factory, regular.id)).lines[0].extra, undefined);
      await assert.rejects(flow.saveFlowDocument(factory, {...dispatchInput(), lines:[{...sourceLine,quantity:'1',extra:true}], confirm:true}), /EXTRA_ALREADY_REQUESTED/);
      await assertStock('6', '5');
    });

    await check('Compatible factory-dispatch endpoint carries an explicit extra line without posting stock', async () => {
      const second = await makeRequest();
      await flow.acceptFactoryRequest(factory, {id:second.id,idempotencyKey:randomUUID()});
      const command = {parentId:second.id, lines:[sourceLine, extraLine], confirm:true, idempotencyKey:randomUUID()};
      await assert.rejects(handleAccountantWorkflowAction(factory, 'create-factory-dispatch', {...command,idempotencyKey:undefined}), /IDEMPOTENCY_KEY_REQUIRED/);
      const reply = await handleAccountantWorkflowAction(factory, 'create-factory-dispatch', command) as {id: string};
      assert.deepEqual(await handleAccountantWorkflowAction(factory, 'create-factory-dispatch', command), reply);
      assert.equal((await flow.viewFlowDocument(factory, reply.id)).lines.find(line => line.productId === extra.id)?.extra, true);
      await assertStock('6', '5');
    });

    await check('Cancelling the parent request reverses stock from both received lines exactly once', async () => {
      const {invoice} = await adminInvoiceDetail(admin, 'FLOW', request.id);
      const cancel = {kind:'FLOW', id:request.id, version:invoice.version, action:'CANCEL', reason:'QA recall of request and linked receipt', idempotencyKey:randomUUID()};
      const result = await changeAdminInvoice(admin, cancel);
      assert.deepEqual(await changeAdminInvoice(admin, cancel), result);
      assert.equal((await flow.viewFlowDocument(admin, request.id)).state, 'CANCELLED');
      assert.equal((await flow.viewFlowDocument(admin, dispatch.id)).state, 'CANCELLED');
      await assertStock('0', '0');
    });

    await check('Native MCP publishes the extra input and returns that line in draft view and PDF', async () => {
      const {invokeOperation, operationCatalog} = await import('../../lib/crm/mcp/bridge');
      const capability = operationCatalog('', 'POST /api/crm/document-flow/save');
      assert.ok('operations' in capability);
      const operation = capability.operations[0];
      assert.ok('inputContract' in operation);
      assert.match(operation.inputContract, /extra:\s*z\.literal\(true\)/u);
      const source = await makeRequest();
      const result = await invokeOperation(admin, {operation:'POST /api/crm/document-flow/save',input:{...dispatchInput(),parentId:source.id}}, true);
      assert.ok(result.ok && 'data' in result);
      const {id} = result.data as {id:string};
      const view = await invokeOperation(admin, {operation:'GET /api/crm/document-flow/view',query:{id}}, false);
      assert.ok(view.ok && 'data' in view);
      assert.equal((view.data as FlowSnapshot).lines.find(line=>line.productId===extra.id)?.extra, true);
      const pdf = await invokeOperation(admin, {operation:'GET /api/crm/document-flow/pdf',query:{id},fileLength:16}, false);
      assert.ok(pdf.ok && 'file' in pdf && pdf.file);
      assert.equal(pdf.file.mime, 'application/pdf');
      assert.equal(Buffer.from(pdf.file.base64,'base64').subarray(0,5).toString(), '%PDF-');
      await assertStock('0', '0');
    });

    if (process.argv.includes('--browser-fixture')) {
      const browserRequest = await makeRequest();
      await flow.acceptFactoryRequest(factory, {id:browserRequest.id,idempotencyKey:randomUUID()});
      const directory = '.local/factory-extra-release';
      await fs.mkdir(directory, {recursive:true});
      await fs.writeFile(`${directory}/browser-fixture.json`, JSON.stringify({
        factoryEmail:'factory-extra@crm-qa.invalid',
        receiverEmail:'factory-extra-hcm@crm-qa.invalid',
        requestCode:browserRequest.code,
        requestId:browserRequest.id,
        sourceProductName:requested.name,
        sourceProductId:requested.id,
        extraProductName:extra.name,
        extraProductId:extra.id,
        warehouseId:warehouse.id,
        localDataDir,
      },null,2)+'\n', {flag:'wx'});
    }
  } finally {
    await closeRuntime();
    await owner.close();
  }
  console.log(JSON.stringify({status:'PASS',environment:databaseUrl?'STAGING isolated PostgreSQL restricted runtime':'LOCAL isolated PGlite', cases:reports},null,2));
}

main().catch(error => {console.error(error);process.exitCode = 1;});
