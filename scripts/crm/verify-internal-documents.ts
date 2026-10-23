import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createQaFixture, qaPassword } from './qa-fixture';
import { database } from '../../lib/crm/db';
import { login } from '../../lib/crm/auth';
import { createAccount } from '../../lib/crm/repository';
import { can } from '../../lib/crm/permissions';
import { visibleModules } from '../../lib/crm/modules';
import { roles, type Principal } from '../../lib/crm/types';
import { downloadInternalDocument, internalDocumentMetadata, listInternalDocuments, uploadInternalDocument } from '../../lib/crm/internal-documents';
import { INTERNAL_DOCUMENT_MAX_BYTES } from '../../lib/crm/internal-document-model';
import { databaseManifest } from './database-manifest';

const cases: { name: string; status: 'PASS' }[] = [];
const status = (expected: number) => (error: unknown) => (error as { status: number }).status === expected;
async function check(name: string, run: () => Promise<void> | void) { await run(); cases.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
async function pdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(), chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.fontSize(20).text('LOCAL QA - Internal document').fontSize(12).text('Synthetic fixture for upload, preview and download verification.'); doc.end();
  });
}
async function main() {
  process.env.CRM_DATABASE_MODE = 'pglite'; process.env.CRM_ENVIRONMENT = 'LOCAL';
  process.env.CRM_LOCAL_DATA_DIR = '.local/crm-qa-internal-documents-' + randomUUID();
  await fs.mkdir('.local', { recursive: true });
  const ids = await createQaFixture(), db = await database();
  const bytes = await pdf(), checksum = createHash('sha256').update(bytes).digest('hex');
  let admin = (await login('admin@crm-qa.invalid', qaPassword)).user;
  const input = { title: 'LOCAL QA – Quy định nội bộ', description: 'Tài liệu thử trên dữ liệu riêng.', filename: 'Quy định nội bộ.pdf', mime: 'application/pdf', content: bytes, uploadKey: randomUUID() };
  const file = await uploadInternalDocument(admin, input);
  try {
    for (const role of roles.filter(role => ['MANAGER', 'WAREHOUSE_HCM', 'WAREHOUSE_HN', 'DEALER_STAFF', 'FACTORY'].includes(role))) await createAccount(admin, { email: role.toLowerCase() + '@crm-qa.invalid', displayName: 'LOCAL QA ' + role, password: qaPassword, role, organizationId: role === 'DEALER_STAFF' ? ids.dealerA : admin.organizationId });
    const principals = new Map<string, Principal>();
    for (const role of roles.filter(role => !role.startsWith('DEALER_'))) { const user = (await login(role.toLowerCase() + '@crm-qa.invalid', qaPassword)).user; principals.set(role, user); }
    principals.set('DEALER_OWNER', (await login('a@crm-qa.invalid', qaPassword)).user);
    principals.set('DEALER_STAFF', (await login('dealer_staff@crm-qa.invalid', qaPassword)).user);
    await check('Role matrix: admin uploads/manages; only accountants and all warehouse roles read file bytes', async () => {
      for (const role of roles) {
        const user = principals.get(role)!;
        assert.ok(user, role);
        const read = role === 'ACCOUNTANT' || role.startsWith('WAREHOUSE'), access = read || role === 'ADMIN';
        assert.equal(can(user, 'internal-documents.manage'), role === 'ADMIN', role);
        assert.equal(can(user, 'internal-documents.read'), read, role);
        assert.equal(visibleModules(user).some(module => module.id === 'internal-documents'), access, role);
        if (access) { assert.ok((await listInternalDocuments(user)).items.some(row => row.id === file.id)); assert.equal((await internalDocumentMetadata(user, file.id)).id, file.id); }
        else { await assert.rejects(listInternalDocuments(user), status(403)); await assert.rejects(internalDocumentMetadata(user, file.id), status(403)); }
        if (read) assert.deepEqual((await downloadInternalDocument(user, file.id)).content, bytes);
        else await assert.rejects(downloadInternalDocument(user, file.id), status(403));
        if (role !== 'ADMIN') await assert.rejects(uploadInternalDocument(user, { ...input, uploadKey: randomUUID() }), status(403));
      }
      assert.equal(can({ ...admin, role: 'FACTORY' as Principal['role'] }, 'internal-documents.access'), false);
    });
    await check('Retries and concurrent double submits create exactly one document', async () => {
      const results = await Promise.all([uploadInternalDocument(admin, input), uploadInternalDocument(admin, input)]);
      assert.ok(results.every(result => result.id === file.id));
      assert.equal((await db.query('SELECT id FROM cohamy_crm.internal_documents WHERE upload_key=$1', [input.uploadKey])).rows.length, 1);
      await assert.rejects(uploadInternalDocument(admin, { ...input, title: 'Different content with reused key' }), status(409));
    });
    await check('PDF, images and Office containers preserve the original bytes', async () => {
      const reader = principals.get('ACCOUNTANT')!;
      const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#edbe39' } }).png().toBuffer();
      const jpeg = await sharp(png).jpeg().toBuffer();
      const formats: [string, string, Buffer][] = [['test.png', 'image/png', png], ['test.jpg', 'image/jpeg', jpeg]];
      for (const [extension, part, mime] of [['docx', 'word/document.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['xlsx', 'xl/workbook.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['pptx', 'ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']]) {
        const zip = new JSZip(); zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'); zip.file(part, '<?xml version="1.0"?><test/>');
        formats.push(['test.' + extension, mime, await zip.generateAsync({ type: 'nodebuffer' })]);
      }
      for (const [filename, mime, content] of formats) {
        const uploaded = await uploadInternalDocument(admin, { ...input, filename, mime, content, uploadKey: randomUUID() });
        assert.deepEqual((await downloadInternalDocument(reader, uploaded.id)).content, content);
      }
    });
    await check('Executable, HTML/SVG, spoofed MIME/signatures, broken Office archives and traversal filenames are rejected', async () => {
      for (const patch of [
        { filename: 'test.exe' }, { filename: 'test.html' }, { filename: 'test.svg' }, { filename: '../private.pdf' }, { filename: 'bad\r\nHeader.pdf' },
        { mime: 'text/html' }, { content: Buffer.from('<script>alert(1)</script>') }, { filename: 'fake.docx', mime: '', content: bytes },
        { filename: 'fake.png', mime: 'image/png', content: Buffer.from('89504e470d0a1a0a', 'hex') },
      ]) await assert.rejects(uploadInternalDocument(admin, { ...input, ...patch, uploadKey: randomUUID() }), status(400));
      const macro = new JSZip(); macro.file('[Content_Types].xml', 'test'); macro.file('word/document.xml', 'test'); macro.file('word/vbaProject.bin', 'test');
      await assert.rejects(uploadInternalDocument(admin, { ...input, filename: 'macro.docx', mime: '', content: await macro.generateAsync({ type: 'nodebuffer' }), uploadKey: randomUUID() }), status(400));
      await assert.rejects(uploadInternalDocument(admin, { ...input, audience: 'PUBLIC' }), status(400));
    });
    await check('Empty and oversized files are rejected before persistence', async () => {
      await assert.rejects(uploadInternalDocument(admin, { ...input, content: Buffer.alloc(0), uploadKey: randomUUID() }), status(413));
      await assert.rejects(uploadInternalDocument(admin, { ...input, content: Buffer.alloc(INTERNAL_DOCUMENT_MAX_BYTES + 1), uploadKey: randomUUID() }), status(413));
    });
    await check('Account revocation and stale membership versions deny access immediately', async () => {
      const accountant = principals.get('ACCOUNTANT')!;
      await db.query('UPDATE cohamy_crm.memberships SET active=false,version=version+1 WHERE id=$1', [accountant.membershipId]);
      await assert.rejects(downloadInternalDocument(accountant, file.id), status(403));
      await db.query('UPDATE cohamy_crm.memberships SET active=true,version=version+1 WHERE id=$1', [accountant.membershipId]);
      await assert.rejects(downloadInternalDocument(accountant, file.id), status(403));
      const restored = (await login('accountant@crm-qa.invalid', qaPassword)).user;
      assert.deepEqual((await downloadInternalDocument(restored, file.id)).content, bytes);
      await db.query("UPDATE cohamy_crm.memberships SET role='SALES',version=version+1 WHERE id=$1", [admin.membershipId]);
      await assert.rejects(uploadInternalDocument(admin, { ...input, uploadKey: randomUUID() }), status(403));
      await db.query("UPDATE cohamy_crm.memberships SET role='ADMIN',version=version+1 WHERE id=$1", [admin.membershipId]);
      admin = (await login('admin@crm-qa.invalid', qaPassword)).user;
    });
    await check('Portal/forged identities cannot use CRM document privileges', async () => {
      const warehouse = principals.get('WAREHOUSE')!;
      await assert.rejects(downloadInternalDocument({ ...warehouse, area: 'portal' }, file.id), status(403));
      await assert.rejects(downloadInternalDocument({ ...warehouse, id: randomUUID() }, file.id), status(403));
      await assert.rejects(downloadInternalDocument(warehouse, randomUUID()), status(404));
    });
    await check('Search returns metadata only and upload actions are audited', async () => {
      const data = await listInternalDocuments(admin, { q: input.filename });
      assert.equal(data.total, 1); assert.equal(data.items[0].id, file.id);
      assert.equal('content' in data.items[0], false); assert.equal('checksum' in data.items[0], false);
      assert.equal((await db.query("SELECT id FROM cohamy_crm.audit_events WHERE action='internal-document.uploaded' AND entity_id=$1", [file.id])).rows.length, 1);
    });
    await check('Stored file checksums are validated on reads and included in database backup checks', async () => {
      assert.equal((await databaseManifest(db)).fileIntegrityErrors, '0');
      await db.query('UPDATE cohamy_crm.internal_documents SET checksum=$1 WHERE id=$2', ['0'.repeat(64), file.id]);
      try {
        await assert.rejects(downloadInternalDocument((await login('accountant@crm-qa.invalid', qaPassword)).user, file.id), status(503));
        await assert.rejects(databaseManifest(db), /DATABASE_SOURCE_OR_FILE_INTEGRITY_FAILED/);
      } finally { await db.query('UPDATE cohamy_crm.internal_documents SET checksum=$1 WHERE id=$2', [checksum, file.id]); }
    });
    await check('Upload rate limit allows thirty files per admin per hour and rejects the next', async () => {
      await createAccount(admin, { email: 'rate-admin@crm-qa.invalid', displayName: 'LOCAL QA Rate Admin', password: qaPassword, role: 'ADMIN', organizationId: admin.organizationId });
      const rateAdmin = (await login('rate-admin@crm-qa.invalid', qaPassword)).user;
      for (let index = 0; index < 30; index++) await uploadInternalDocument(rateAdmin, { ...input, title: 'LOCAL QA rate file ' + index, uploadKey: randomUUID() });
      await assert.rejects(uploadInternalDocument(rateAdmin, { ...input, uploadKey: randomUUID() }), status(429));
    });
    await fs.writeFile('.local/internal-documents-fixture.pdf', bytes);
    await fs.writeFile('.local/internal-documents-fixture.json', JSON.stringify({ directory: process.env.CRM_LOCAL_DATA_DIR, fileId: file.id, checksum }));
  } finally {
    await fs.mkdir('docs/crm/test-results', { recursive: true });
    await fs.writeFile('docs/crm/test-results/internal-documents-services-local.json', JSON.stringify({ environment: 'LOCAL isolated PGlite', testedAt: new Date().toISOString(), status: cases.length === 10 ? 'PASS' : 'FAIL', cases, production: 'NOT RUN', officeScope: 'Container validation and byte preservation; no Office application rendering claim' }, null, 2) + '\n');
    await db.close();
  }
  console.log(cases.length + ' internal-document service checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
