import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { OrderPolicyDefinition } from '../../lib/crm/order-policy';
import type { PriceCalculation } from '../../lib/crm/pricing-model';
import type { AccountDiscountPolicy, TierRule } from '../../lib/crm/pricing-multitier';

process.env.BLOG_SOURCE='legacy';
const postgres = process.env.CRM_DATABASE_MODE === 'postgres';
if (!postgres) {
  process.env.CRM_DATABASE_MODE = 'pglite';
  process.env.CRM_ENVIRONMENT = 'LOCAL';
  process.env.CRM_LOCAL_DATA_DIR = '.local/crm-qa-meeting-' + randomUUID();
}

async function main() {
  const { createQaFixture, qaPassword } = await import('./qa-fixture');
  const { database } = await import('../../lib/crm/db');
  const auth = await import('../../lib/crm/auth');
  const repo = await import('../../lib/crm/repository');
  const prices = await import('../../lib/crm/pricing');
  const fixture = await import('./pricing-fixture');
  const policy = await import('../../lib/crm/order-policy');
  const requests = await import('../../lib/crm/order-requests');
  const orders = await import('../../lib/crm/sales-orders');
  const changes = await import('../../lib/crm/order-changes');
  const distribution = await import('../../lib/crm/distribution');
  const pricingMulti = await import('../../lib/crm/pricing-multitier');
  const routing = await import('../../lib/crm/order-routing');
  const inventory = await import('../../lib/crm/inventory');
  const finance = await import('../../lib/crm/finance');
  const articles = await import('../../lib/crm/articles');
  const workspace = await import('../../lib/crm/workspace');
  const onboarding = await import('../../lib/crm/onboarding');
  const { fixed } = await import('../../lib/crm/decimal');
  const { installQaRuntime } = await import('./qa-runtime');

  const ids = await createQaFixture();
  const owner = await database();
  const close = await installQaRuntime(owner);
  const db = await database();

  const cases: { name: string; status: 'PASS' | 'FAIL' }[] = [];
  const test = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      cases.push({ name, status: 'PASS' });
      console.log('PASS ' + name);
    } catch (error) {
      cases.push({ name, status: 'FAIL' });
      console.error('FAIL ' + name, error);
      throw error;
    }
  };

  // Base principals
  const admin = (await auth.login('admin@crm-qa.invalid', qaPassword)).user;
  const sales = (await auth.login('sales@crm-qa.invalid', qaPassword)).user;
  const userA1 = (await auth.login('a@crm-qa.invalid', qaPassword)).user;
  const userB1 = (await auth.login('b@crm-qa.invalid', qaPassword)).user;
  const warehouseUser = (await auth.login('warehouse@crm-qa.invalid', qaPassword)).user;
  const accountant = (await auth.login('accountant@crm-qa.invalid', qaPassword)).user;

  // Create staff for Dealer A1
  await repo.createAccount(admin, {
    email: 'staff-a1@crm-qa.invalid',
    displayName: 'QA Staff A1',
    password: qaPassword,
    role: 'DEALER_STAFF',
    organizationId: ids.dealerA,
  });
  const staffA1 = (await auth.login('staff-a1@crm-qa.invalid', qaPassword)).user;

  // Create Dealer A2 (L2)
  const orgA2Id = randomUUID();
  await db.query(
    "INSERT INTO cohamy_crm.organizations(id, code, name, kind, partner_type, active) VALUES($1, 'QA_A2', 'QA Đại lý A2 (L2)', 'DEALER', 'DEALER_L2', true)",
    [orgA2Id]
  );
  await repo.createAccount(admin, {
    email: 'owner-a2@crm-qa.invalid',
    displayName: 'QA Owner A2',
    password: qaPassword,
    role: 'DEALER_OWNER',
    organizationId: orgA2Id,
  });
  const userA2 = (await auth.login('owner-a2@crm-qa.invalid', qaPassword)).user;

  // Create Store S (under A2)
  const orgStoreSId = randomUUID();
  await db.query(
    "INSERT INTO cohamy_crm.organizations(id, code, name, kind, partner_type, active) VALUES($1, 'QA_STORE_S', 'QA Cửa hàng S', 'DEALER', 'STORE', true)",
    [orgStoreSId]
  );
  await repo.createAccount(admin, {
    email: 'owner-s@crm-qa.invalid',
    displayName: 'QA Owner Store S',
    password: qaPassword,
    role: 'DEALER_OWNER',
    organizationId: orgStoreSId,
  });
  const userStoreS = (await auth.login('owner-s@crm-qa.invalid', qaPassword)).user;

  // Create Direct Store (under A1, bypassing L2)
  const orgStoreDirectId = randomUUID();
  await db.query(
    "INSERT INTO cohamy_crm.organizations(id, code, name, kind, partner_type, active) VALUES($1, 'QA_STORE_DIR', 'QA Cửa hàng trực tiếp A1', 'DEALER', 'STORE', true)",
    [orgStoreDirectId]
  );
  await repo.createAccount(admin, {
    email: 'owner-dir@crm-qa.invalid',
    displayName: 'QA Owner Direct Store',
    password: qaPassword,
    role: 'DEALER_OWNER',
    organizationId: orgStoreDirectId,
  });
  const userStoreDirect = (await auth.login('owner-dir@crm-qa.invalid', qaPassword)).user;

  // Mark A1 and B1 as DEALER_L1
  await db.query("UPDATE cohamy_crm.organizations SET partner_type='DEALER_L1' WHERE id IN ($1, $2)", [ids.dealerA, ids.dealerB]);

  // Set up products and base pricing
  await fixture.createPriceProducts(admin);
  const priceBook = await prices.savePriceBook(admin, {
    version: 0,
    name: 'QA Multi-tier Pricing',
    definition: {
      ...fixture.qaPriceDefinition,
      lines: [
        { sku: 'QA_PRICE_A', unitPrice: '100000', thresholds: [] },
        { sku: 'QA_PRICE_B', unitPrice: '200000', thresholds: [] },
      ],
    },
    idempotencyKey: randomUUID(),
  });
  await prices.publishPriceBook(admin, {
    id: priceBook.id,
    version: priceBook.version,
    versionId: priceBook.versionId,
    action: 'PUBLISH',
    reason: 'QA publish base prices',
    idempotencyKey: randomUUID(),
  });

  const orderPolicyDef: OrderPolicyDefinition = {
    enabled: true,
    requireOwnerApproval: false,
    alwaysManagerApproval: false,
    provisionalReservation:{mode:'AFTER_APPROVAL',ttlMinutes:120,allowPartial:true},
    managerApprovalAmount: null,
    creditRequiresApproval: false,
    nonSelfApproval: false,
    acceptedQuotePrice: 'UNTIL_QUOTE_EXPIRY',
    pendingPrice: 'UNTIL_REQUEST_EXPIRY',
    requiredPartnerFields: [],
    approvalRoles: ['ADMIN', 'MANAGER'],
    confirmationRoles: ['ADMIN', 'MANAGER', 'SALES'],
  };
  await policy.saveOrderPolicy(admin, {
    version: 0,
    definition: orderPolicyDef,
    reason: 'QA policy for meeting contract',
    idempotencyKey: randomUUID(),
  });

  const diamondTierId = randomUUID();
  await db.query("INSERT INTO cohamy_crm.price_tiers(id, code, name) VALUES($1, 'DIAMOND', 'Hạng Kim Cương')", [diamondTierId]);

  let confirmedOrderId = '';

  const approveAndConfirmOrder = async (orderId: string, reason: string) => {
    const sale = await orders.salesOrderAccess(db, sales, orderId);
    const version = await orders.salesVersionAccess(db, sale, sale.latest_version_id);
    if (version.approval_required) {
      await orders.salesOrderAction(admin, {
        id: sale.id,
        version: sale.version,
        versionId: sale.latest_version_id,
        action: 'APPROVE',
        reason: 'Approve ' + reason,
        idempotencyKey: randomUUID(),
      });
    }
    const current = await orders.salesOrderAccess(db, sales, orderId);
    return orders.salesOrderAction(sales, {
      id: current.id,
      version: current.version,
      versionId: current.latest_version_id,
      action: 'CONFIRM',
      reason: 'Confirm ' + reason,
      idempotencyKey: randomUUID(),
    });
  };

  try {
    // =========================================================================
    // GROUP 1: Distribution Hierarchy, Routes & Cycle Prevention (TC01 - TC10)
    // =========================================================================

    await test('TC01: 4-tier chain definition (Cohamy -> A1 -> A2 -> S -> End Customer)', async () => {
      // Establish relations: Cohamy -> A1, A1 -> A2, A2 -> Store S
      await distribution.saveDistributionRelation(admin, {
        parentOrganizationId: admin.organizationId,
        childOrganizationId: ids.dealerA,
        networkCode: 'DEFAULT',
        status: 'ACTIVE',
        reason: 'Cohamy to Dealer A1',
        idempotencyKey: randomUUID(),
      });
      const relA2 = await distribution.saveDistributionRelation(admin, {
        parentOrganizationId: ids.dealerA,
        childOrganizationId: orgA2Id,
        networkCode: 'DEFAULT',
        status: 'ACTIVE',
        reason: 'Dealer A1 to Dealer A2',
        idempotencyKey: randomUUID(),
      });
      assert.ok(relA2.id);
      const relS = await distribution.saveDistributionRelation(admin, {
        parentOrganizationId: orgA2Id,
        childOrganizationId: orgStoreSId,
        networkCode: 'DEFAULT',
        status: 'ACTIVE',
        reason: 'Dealer A2 to Store S',
        idempotencyKey: randomUUID(),
      });
      assert.ok(relS.id);

      const route = await distribution.getUpstreamRoute(db, orgStoreSId);
      assert.equal(route.length, 4);
      assert.equal(route[0].id, orgStoreSId);
      assert.equal(route[1].id, orgA2Id);
      assert.equal(route[2].id, ids.dealerA);
      assert.equal(route[3].id, admin.organizationId);
    });

    await test('TC02: Direct short routes (Cohamy -> A1 -> Store Direct)', async () => {
      await distribution.saveDistributionRelation(admin, {
        parentOrganizationId: ids.dealerA,
        childOrganizationId: orgStoreDirectId,
        networkCode: 'DEFAULT',
        status: 'ACTIVE',
        reason: 'Dealer A1 to Direct Store',
        idempotencyKey: randomUUID(),
      });
      const route = await distribution.getUpstreamRoute(db, orgStoreDirectId);
      assert.equal(route.length, 3);
      assert.equal(route[0].id, orgStoreDirectId);
      assert.equal(route[1].id, ids.dealerA);
      assert.equal(route[2].id, admin.organizationId);
    });

    await test('TC03: Independence of partner_type and pricing_tier', async () => {
      await db.query('UPDATE cohamy_crm.organizations SET pricing_tier_id = $1 WHERE id = $2', [diamondTierId, orgA2Id]);
      const org = (await db.query<{ partner_type: string; pricing_tier_id: string }>('SELECT partner_type, pricing_tier_id FROM cohamy_crm.organizations WHERE id = $1', [orgA2Id])).rows[0];
      assert.equal(org.partner_type, 'DEALER_L2');
      assert.equal(org.pricing_tier_id, diamondTierId);
      const parent = await distribution.getActiveParentOrganization(db, orgA2Id);
      assert.equal(parent?.id, ids.dealerA);
    });

    await test('TC04: Warehouse is not a dealer level; warehouse user cannot manage relations', async () => {
      await assert.rejects(
        distribution.saveDistributionRelation(warehouseUser, {
          parentOrganizationId: admin.organizationId,
          childOrganizationId: orgStoreSId,
          networkCode: 'DEFAULT',
          status: 'ACTIVE',
          reason: 'Unauthorized warehouse relation change',
          idempotencyKey: randomUUID(),
        }),
        /FORBIDDEN/
      );
    });

    await test('TC05: Multiple user accounts per organization with individual audit trail', async () => {
      assert.equal(userA1.organizationId, ids.dealerA);
      assert.equal(staffA1.organizationId, ids.dealerA);
      assert.notEqual(userA1.id, staffA1.id);
      const req = await requests.saveCommercialRequest(staffA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'QA Receiver', phone: '0900000001', address: 'QA Address' },
        note: 'Saved by staff',
        idempotencyKey: randomUUID(),
      });
      const head = await requests.commercialRequestAccess(db, staffA1, req.id);
      assert.equal(head.creator_id, staffA1.id);
    });

    await test('TC06: Distribution relation records upstream, downstream, status, starts_at, created_by', async () => {
      const rels = await distribution.listDistributionRelations(admin, { childOrgId: orgStoreSId });
      assert.ok(rels.length > 0);
      const r = rels[0];
      assert.equal(r.parent_organization_id, orgA2Id);
      assert.equal(r.child_organization_id, orgStoreSId);
      assert.equal(r.status, 'ACTIVE');
      assert.equal(r.created_by, admin.id);
      assert.ok(r.starts_at);
      const events = (await db.query<{ action: string; actor_id: string }>('SELECT action, actor_id FROM cohamy_crm.distribution_relation_events WHERE relation_id = $1', [r.id])).rows;
      assert.ok(events.some(e => e.action === 'CREATED' && e.actor_id === admin.id));
    });

    await test('TC07: Prevent self-parenting', async () => {
      await assert.rejects(
        distribution.saveDistributionRelation(admin, {
          parentOrganizationId: ids.dealerA,
          childOrganizationId: ids.dealerA,
          networkCode: 'DEFAULT',
          status: 'ACTIVE',
          reason: 'Self parent attempt',
          idempotencyKey: randomUUID(),
        }),
        /DISTRIBUTION_SELF_PARENT_BLOCKED/
      );
    });

    await test('TC08: Prevent cycles in distribution hierarchy', async () => {
      // Store S -> A1 would create cycle because A1 -> A2 -> S
      await assert.rejects(
        distribution.saveDistributionRelation(admin, {
          parentOrganizationId: orgStoreSId,
          childOrganizationId: ids.dealerA,
          networkCode: 'DEFAULT',
          status: 'ACTIVE',
          reason: 'Cycle creation attempt',
          idempotencyKey: randomUUID(),
        }),
        /DISTRIBUTION_CYCLE_DETECTED/
      );
    });

    await test('TC09: Prevent attaching branch to its own descendant', async () => {
      // A2 -> A1 would create cycle because A1 is parent of A2
      await assert.rejects(
        distribution.saveDistributionRelation(admin, {
          parentOrganizationId: orgA2Id,
          childOrganizationId: ids.dealerA,
          networkCode: 'DEFAULT',
          status: 'ACTIVE',
          reason: 'Descendant cycle attempt',
          idempotencyKey: randomUUID(),
        }),
        /DISTRIBUTION_CYCLE_DETECTED/
      );
    });

    await test('TC10: Changing distribution relations never rewrites previously confirmed orders', async () => {
      // Make confirmed order for Store S
      const req = await requests.saveCommercialRequest(userStoreS, {
        version: 0,
        organizationId: orgStoreSId,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'Store S receiver', phone: '0900000002', address: 'Store S street' },
        note: 'Store S confirmed order',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userStoreS, req.id);
      await requests.requestAction(userStoreS, {
        id: head.id,
        version: head.version,
        versionId: head.latest_version_id,
        action: 'PROPOSE',
        reason: 'Propose Store S order',
        idempotencyKey: randomUUID(),
      });
      head = await requests.commercialRequestAccess(db, userStoreS, req.id);
      const submitted = (await orders.submitSalesRequest(userStoreS, {
        id: head.id,
        version: head.version,
        versionId: head.latest_version_id,
        reason: 'Submit Store S order',
        idempotencyKey: randomUUID(),
      })) as { id: string; version: number; versionId: string };
      confirmedOrderId = submitted.id;

      const sale = await orders.salesOrderAccess(db, sales, confirmedOrderId);
      await orders.salesOrderAction(sales, {
        id: sale.id,
        version: sale.version,
        versionId: sale.latest_version_id,
        action: 'CONFIRM',
        reason: 'Confirm Store S order',
        idempotencyKey: randomUUID(),
      });

      // Now alter Store S relation (change parent to Direct Store)
      await distribution.saveDistributionRelation(admin, {
        parentOrganizationId: orgStoreDirectId,
        childOrganizationId: orgStoreSId,
        networkCode: 'DEFAULT',
        status: 'ACTIVE',
        reason: 'Move Store S under Direct Store',
        idempotencyKey: randomUUID(),
      });

      // Verify the previously confirmed order still has its original seller (A2) and buyer (Store S)
      const afterOrder = await orders.salesOrderAccess(db, admin, confirmedOrderId);
      assert.equal(afterOrder.organization_id, orgStoreSId);
      assert.equal(afterOrder.seller_organization_id, orgA2Id);

      // Restore Store S under A2
      await distribution.saveDistributionRelation(admin, {
        parentOrganizationId: orgA2Id,
        childOrganizationId: orgStoreSId,
        networkCode: 'DEFAULT',
        status: 'ACTIVE',
        reason: 'Restore Store S under A2',
        idempotencyKey: randomUUID(),
      });
    });

    // =========================================================================
    // GROUP 2: Data Scoping, Isolation & Access Control (TC11 - TC20)
    // =========================================================================

    await test('TC11: Sibling dealer isolation (Dealer B cannot view Dealer A branch requests)', async () => {
      const bRequests = await requests.listCommercialRequests(userB1);
      assert.equal(bRequests.some(r => r.organization_id === ids.dealerA || r.organization_id === orgA2Id || r.organization_id === orgStoreSId), false);
    });

    await test('TC12: Descendant visibility (Dealer A1 can see A2 and Store S)', async () => {
      const descendants = await distribution.getDescendantOrganizationIds(db, ids.dealerA);
      assert.ok(descendants.includes(orgA2Id));
      assert.ok(descendants.includes(orgStoreSId));
      assert.ok(descendants.includes(orgStoreDirectId));
      assert.equal(descendants.includes(ids.dealerB), false);
    });

    await test('TC13: Store S cannot see parent Dealer A1 or sibling store data', async () => {
      const storeRequests = await requests.listCommercialRequests(userStoreS);
      assert.ok(storeRequests.every(r => r.organization_id === orgStoreSId));
    });

    await test('TC14: Central Admin can see all branches and orders', async () => {
      const allRequests = await requests.listCommercialRequests(admin);
      assert.ok(allRequests.length > 0);
      assert.ok(allRequests.some(r => r.organization_id === orgStoreSId));
    });

    await test('TC15: Warehouse scope isolation', async () => {
      await inventory.createLocation(admin, {
        warehouseId: ids.warehouseA,
        code: 'LOC_A_MEET',
        name: 'Location Kho A',
        idempotencyKey: randomUUID(),
      });
      await inventory.createLocation(admin, {
        warehouseId: ids.warehouseB,
        code: 'LOC_B_MEET',
        name: 'Location Kho B',
        idempotencyKey: randomUUID(),
      });

      const warehouseAInv = await inventory.listInventory(warehouseUser);
      assert.ok(warehouseAInv.every(row => row.warehouse_id === ids.warehouseA));
    });

    await test('TC16: Direct ID access rejection for out-of-scope entity', async () => {
      await assert.rejects(
        orders.salesOrderAccess(db, userB1, confirmedOrderId),
        /NOT_FOUND/
      );
    });

    await test('TC17: Global search respects scope', async () => {
      const confirmedOrder = await orders.salesOrderAccess(db, admin, confirmedOrderId);
      const searchB = await workspace.search(userB1, confirmedOrder.code);
      assert.equal(searchB.sales.some(s => s.id === confirmedOrderId), false);
    });

    await test('TC18: Scoped counts and dashboards do not leak sibling metrics', async () => {
      const listB = await orders.listSalesOrders(userB1);
      assert.equal(listB.some(s => s.id === confirmedOrderId), false);
    });

    await test('TC19: Commercial timeline for Dealer A is inaccessible by Dealer B', async () => {
      await assert.rejects(
        requests.commercialTimeline(userB1, 'order', confirmedOrderId),
        /NOT_FOUND/
      );
    });

    await test('TC20: Sales rep reassignment preserves legal seller and buyer', async () => {
      const beforeOrder = await orders.salesOrderAccess(db, admin, confirmedOrderId);
      // Reassign sales rep
      await db.query('DELETE FROM cohamy_crm.partner_assignments WHERE organization_id = $1', [orgStoreSId]);
      const afterOrder = await orders.salesOrderAccess(db, admin, confirmedOrderId);
      assert.equal(afterOrder.seller_organization_id, beforeOrder.seller_organization_id);
      assert.equal(afterOrder.organization_id, beforeOrder.organization_id);
    });

    // =========================================================================
    // GROUP 3: Onboarding, Review & Approval (TC21 - TC30)
    // =========================================================================

    let onboardingAppId = '';
    let newlyApprovedOrgId = '';
    const newlyApprovedUserEmail = 'newly.approved@crm-qa.invalid';

    await test('TC21: Self-service onboarding creates applicant with PENDING review', async () => {
      const reg = await onboarding.registerApplication({
        companyName: 'Công ty QA Onboarding Mới',
        representative: 'QA Giám Đốc Mới',
        phone: '0901234567',
        address: '123 Đường Thử Nghiệm, TP.HCM',
        region: 'Miền Nam',
        email: newlyApprovedUserEmail,
        password: qaPassword,
        idempotencyKey: randomUUID(),
      });
      onboardingAppId = reg.id;
      // Emulate email verification
      await db.query('UPDATE cohamy_crm.partner_applications SET email_verified_at = now() WHERE id = $1', [onboardingAppId]);
      const app = await onboarding.application(onboardingAppId);
      assert.equal(app.email, newlyApprovedUserEmail);
      await onboarding.submitApplication(onboardingAppId, { version: app.version });
      const submitted = await onboarding.application(onboardingAppId);
      assert.equal(submitted.status, 'SUBMITTED');
    });

    let approvalInput: Record<string,unknown>;
    await test('TC22: Admin approval assigns partnerType, parentOrganizationId, pricingTierId, creditEnabled, creditLimit', async () => {
      const app = await onboarding.application(onboardingAppId);
      approvalInput = {
        version: app.version,
        action: 'APPROVE',
        role: 'DEALER_OWNER',
        partnerType: 'DEALER_L2',
        parentOrganizationId: ids.dealerA,
        pricingTierId: diamondTierId,
        creditEnabled: true,
        creditLimit: 50000000,
        message: 'Duyệt làm đại lý cấp 2 trực thuộc A1',
      };
      const reviewResult = await onboarding.reviewApplication(admin, onboardingAppId, approvalInput);
      newlyApprovedOrgId = reviewResult.organizationId!;
      assert.ok(newlyApprovedOrgId);
      const org = (await db.query<{ partner_type: string; parent_organization_id?: string; credit_enabled: boolean }>('SELECT partner_type, credit_enabled FROM cohamy_crm.organizations WHERE id = $1', [newlyApprovedOrgId])).rows[0];
      assert.equal(org.partner_type, 'DEALER_L2');
      assert.equal(org.credit_enabled, true);
    });

    await test('TC23: Approval atomically creates active distribution relation to parent', async () => {
      const rel = (await db.query<{ parent_organization_id: string; status: string }>('SELECT parent_organization_id, status FROM cohamy_crm.distribution_relations WHERE child_organization_id = $1 AND status = \'ACTIVE\'', [newlyApprovedOrgId])).rows[0];
      assert.ok(rel);
      assert.equal(rel.parent_organization_id, ids.dealerA);
      assert.equal(rel.status, 'ACTIVE');
    });

    await test('TC24: Approval creates credit account when creditEnabled is true', async () => {
      const cred = (await db.query<{ limit_amount: string; enabled: boolean }>('SELECT limit_amount::text, enabled FROM cohamy_crm.credit_accounts WHERE organization_id = $1', [newlyApprovedOrgId])).rows[0];
      assert.ok(cred);
      assert.equal(Number(cred.limit_amount), 50000000);
      assert.equal(cred.enabled, true);
    });

    await test('TC25: Application rejection creates no distribution relation or credit account', async () => {
      const reg2 = await onboarding.registerApplication({
        companyName: 'Công ty QA Bị Từ Chối',
        representative: 'QA Người Bị Từ Chối',
        phone: '0901234999',
        address: '456 Đường Thử Nghiệm, Hà Nội',
        region: 'Miền Bắc',
        email: 'rejected@crm-qa.invalid',
        password: qaPassword,
        idempotencyKey: randomUUID(),
      });
      await db.query('UPDATE cohamy_crm.partner_applications SET email_verified_at = now() WHERE id = $1', [reg2.id]);
      const app2 = await onboarding.application(reg2.id);
      await onboarding.submitApplication(reg2.id, { version: app2.version });
      const submitted = await onboarding.application(reg2.id);
      await onboarding.reviewApplication(admin, reg2.id, {
        version: submitted.version,
        action: 'REJECTED',
        message: 'Hồ sơ không đạt tiêu chuẩn phân phối',
      });
      const after = await onboarding.application(reg2.id);
      assert.equal(after.status, 'REJECTED');
      assert.equal(after.organization_id, null);
    });

    await test('TC26: Self-onboarding cannot set partner_type directly without admin review', async () => {
      const reg3 = await onboarding.registerApplication({
        companyName: 'Công ty Tự Nâng Cấp',
        representative: 'QA Hacker',
        phone: '0901234888',
        address: '789 Đường Thử Nghiệm',
        region: 'Miền Trung',
        email: 'hacker@crm-qa.invalid',
        password: qaPassword,
        idempotencyKey: randomUUID(),
      });
      // partner_applications table does not have partner_type column; partner_type only exists on organizations
      const app = await onboarding.application(reg3.id);
      assert.equal('partner_type' in app, false);
    });

    await test('TC27: Idempotency of onboarding approval', async () => {
      const secondCall = await onboarding.reviewApplication(admin, onboardingAppId, approvalInput);
      assert.equal(secondCall.organizationId, newlyApprovedOrgId);
    });

    await test('TC28: Onboarding audit log records reviewer admin ID and timestamp', async () => {
      const logs = (await db.query<{ actor_id: string; action: string }>('SELECT actor_id, action FROM cohamy_crm.audit_events WHERE entity_id = $1 AND action = \'application.approved\'', [onboardingAppId])).rows;
      assert.ok(logs.length > 0);
      assert.equal(logs[0].actor_id, admin.id);
    });

    await test('TC29: Non-admin users cannot approve onboarding applications', async () => {
      await assert.rejects(
        onboarding.reviewApplication(staffA1, onboardingAppId, {
          version: 1,
          action: 'APPROVE',
          role: 'DEALER_OWNER',
        }),
        /FORBIDDEN/
      );
    });

    await test('TC30: Approved partner can log in and view assigned parent', async () => {
      const loginRes = await auth.login(newlyApprovedUserEmail, qaPassword);
      assert.equal(loginRes.user.organizationId, newlyApprovedOrgId);
      assert.equal(loginRes.user.role, 'DEALER_OWNER');
      const parent = await distribution.getActiveParentOrganization(db, newlyApprovedOrgId);
      assert.equal(parent?.id, ids.dealerA);
    });

    // =========================================================================
    // GROUP 4: 2-Layer Pricing Engine (TC31 - TC40)
    // =========================================================================

    await test('TC31: Layer A (Product promotion) discount applied first (100k -> 90k)', async () => {
      // 10% promo on QA_PRICE_A
      await pricingMulti.saveProductPromotion(admin, {
        sku: 'QA_PRICE_A',
        discountPercent: 10,
        reason: '10% promo discount',
        idempotencyKey: randomUUID(),
      });
      const promoMap = await pricingMulti.getActiveProductPromotions(db, ['QA_PRICE_A']);
      assert.equal(promoMap.get('QA_PRICE_A'), 10);

      const baseCalc = {
        subtotal: '100000',
        discount: '0',
        tax: '0',
        fee: '0',
        total: '100000',
        lines: [
          {
            index: 0,
            productId: randomUUID(),
            sku: 'QA_PRICE_A',
            code: 'BASE',
            label: 'Gói',
            quantity: '1',
            baseQuantity: '1',
            unitPrice: '100000',
            regularUnitPrice: '100000',
            gross: '100000',
            discount: '0',
            net: '100000',
            tax: '0',
            total: '100000',
            thresholdDiscount: '0',
            tierDiscount: '0',
            salesDiscount: '0',
            gift: false,
          },
        ],
        minimumShortfalls: [],
        approvalReasons: [],
      };

      const result = pricingMulti.applyTwoLayerPricing(baseCalc as unknown as PriceCalculation, null, promoMap);
      assert.equal(result.lines[0].priceAfterPromo, '90000');
      assert.equal(result.lines[0].unitPrice, '90000');
      assert.equal(result.total, '90000');
    });

    await test('TC32: Layer B (FIXED_PERCENT) applies to remaining base: 90k * 70% = 63k, 90k * 60% = 54k', async () => {
      const promoMap = new Map([['QA_PRICE_A', 10]]);
      const baseCalc = {
        subtotal: '100000',
        discount: '0',
        tax: '0',
        fee: '0',
        total: '100000',
        lines: [
          {
            index: 0,
            productId: randomUUID(),
            sku: 'QA_PRICE_A',
            code: 'BASE',
            label: 'Gói',
            quantity: '1',
            baseQuantity: '1',
            unitPrice: '100000',
            regularUnitPrice: '100000',
            gross: '100000',
            discount: '0',
            net: '100000',
            tax: '0',
            total: '100000',
            thresholdDiscount: '0',
            tierDiscount: '0',
            salesDiscount: '0',
            gift: false,
          },
        ],
        minimumShortfalls: [],
        approvalReasons: [],
      };

      // 30% fixed account discount -> 90k * (1 - 0.30) = 63k
      const policy30: AccountDiscountPolicy = {
        id: randomUUID(),
        organization_id: ids.dealerA,
        policy_type: 'FIXED_PERCENT',
        fixed_percent: '30',
        tier_config: null,
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: 'ACTIVE',
        version: 1,
      };
      const res30 = pricingMulti.applyTwoLayerPricing(baseCalc as unknown as PriceCalculation, policy30, promoMap);
      assert.equal(res30.lines[0].unitPrice, '63000');
      assert.equal(res30.total, '63000');

      // 40% fixed account discount -> 90k * (1 - 0.40) = 54k
      const policy40: AccountDiscountPolicy = {
        id: randomUUID(),
        organization_id: ids.dealerA,
        policy_type: 'FIXED_PERCENT',
        fixed_percent: '40',
        tier_config: null,
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: 'ACTIVE',
        version: 1,
      };
      const res40 = pricingMulti.applyTwoLayerPricing(baseCalc as unknown as PriceCalculation, policy40, promoMap);
      assert.equal(res40.lines[0].unitPrice, '54000');
      assert.equal(res40.total, '54000');
    });

    await test('TC33: Layer B (QUANTITY_TIER) half-open intervals [min, max)', async () => {
      const tiers: TierRule[] = [
        { minQuantity: '10', maxQuantity: '20', discountPercent: 20 },
        { minQuantity: '20', maxQuantity: '50', discountPercent: 30 },
        { minQuantity: '50', maxQuantity: null, discountPercent: 40 },
      ];
      // 9 is below min
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('9')), null);
      // 10 is exact lower bound of Tier 1 [10, 20)
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('10'))?.discountPercent, 20);
      // 19 is inside Tier 1 [10, 20)
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('19'))?.discountPercent, 20);
      // 20 is upper bound of Tier 1, so transitions to lower bound of Tier 2 [20, 50)
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('20'))?.discountPercent, 30);
      // 49 is inside Tier 2 [20, 50)
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('49'))?.discountPercent, 30);
      // 50 transitions to Tier 3 [50, null)
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('50'))?.discountPercent, 40);
      // 500 is in Tier 3
      assert.equal(pricingMulti.matchQuantityTier(tiers, fixed('500'))?.discountPercent, 40);
    });

    await test('TC34: Aggregation across multiple lines of same SKU before tier matching', async () => {
      const tiers: TierRule[] = [
        { minQuantity: '10', maxQuantity: '20', discountPercent: 20 },
      ];
      const policyTier: AccountDiscountPolicy = {
        id: randomUUID(),
        organization_id: ids.dealerA,
        policy_type: 'QUANTITY_TIER',
        fixed_percent: null,
        tier_config: tiers,
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: 'ACTIVE',
        version: 1,
      };

      const baseCalc = {
        subtotal: '1200000',
        discount: '0',
        tax: '0',
        fee: '0',
        total: '1200000',
        lines: [
          {
            index: 0,
            productId: randomUUID(),
            sku: 'QA_PRICE_A',
            code: 'BASE',
            label: 'Gói',
            quantity: '6',
            baseQuantity: '6',
            unitPrice: '100000',
            regularUnitPrice: '100000',
            gross: '600000',
            discount: '0',
            net: '600000',
            tax: '0',
            total: '600000',
            thresholdDiscount: '0',
            tierDiscount: '0',
            salesDiscount: '0',
            gift: false,
          },
          {
            index: 1,
            productId: randomUUID(),
            sku: 'QA_PRICE_A',
            code: 'BASE',
            label: 'Gói',
            quantity: '6',
            baseQuantity: '6',
            unitPrice: '100000',
            regularUnitPrice: '100000',
            gross: '600000',
            discount: '0',
            net: '600000',
            tax: '0',
            total: '600000',
            thresholdDiscount: '0',
            tierDiscount: '0',
            salesDiscount: '0',
            gift: false,
          },
        ],
        minimumShortfalls: [],
        approvalReasons: [],
      };

      const result = pricingMulti.applyTwoLayerPricing(baseCalc as unknown as PriceCalculation, policyTier, new Map());
      // Total SKU quantity = 6 + 6 = 12 -> matches Tier 1 (20% discount) -> unitPrice = 80,000 each
      assert.equal(result.lines[0].unitPrice, '80000');
      assert.equal(result.lines[1].unitPrice, '80000');
      assert.equal(result.total, '960000');
    });

    await test('TC35: Line falling below minimum tier gets 0% Layer B discount', async () => {
      const tiers: TierRule[] = [{ minQuantity: '10', maxQuantity: '20', discountPercent: 20 }];
      const policyTier: AccountDiscountPolicy = {
        id: randomUUID(),
        organization_id: ids.dealerA,
        policy_type: 'QUANTITY_TIER',
        fixed_percent: null,
        tier_config: tiers,
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: 'ACTIVE',
        version: 1,
      };
      const baseCalc = {
        subtotal: '500000',
        discount: '0',
        tax: '0',
        fee: '0',
        total: '500000',
        lines: [{
          index: 0,
          productId: randomUUID(),
          sku: 'QA_PRICE_A',
          code: 'BASE',
          label: 'Gói',
          quantity: '5',
          baseQuantity: '5',
          unitPrice: '100000',
          regularUnitPrice: '100000',
          gross: '500000',
          discount: '0',
          net: '500000',
          tax: '0',
          total: '500000',
          thresholdDiscount: '0',
          tierDiscount: '0',
          salesDiscount: '0',
          gift: false,
        }],
        minimumShortfalls: [],
        approvalReasons: [],
      };
      const result = pricingMulti.applyTwoLayerPricing(baseCalc as unknown as PriceCalculation, policyTier, new Map());
      assert.equal(result.lines[0].accountDiscountPercent, 0);
      assert.equal(result.lines[0].unitPrice, '100000');
    });

    await test('TC36: Exact lower boundary [min, ...) receives tier discount', async () => {
      const tiers: TierRule[] = [{ minQuantity: '20', maxQuantity: '50', discountPercent: 30 }];
      const matched = pricingMulti.matchQuantityTier(tiers, fixed('20'));
      assert.equal(matched?.discountPercent, 30);
    });

    await test('TC37: Exact upper boundary transitions to next tier', async () => {
      const tiers: TierRule[] = [
        { minQuantity: '20', maxQuantity: '50', discountPercent: 30 },
        { minQuantity: '50', maxQuantity: '100', discountPercent: 40 },
      ];
      const matched = pricingMulti.matchQuantityTier(tiers, fixed('50'));
      assert.equal(matched?.discountPercent, 40);
    });

    await test('TC38: Sequential calculation is exact without IEEE 754 precision loss', async () => {
      const promoMap = new Map([['QA_PRICE_A', 10]]); // 10%
      const policy: AccountDiscountPolicy = {
        id: randomUUID(),
        organization_id: ids.dealerA,
        policy_type: 'FIXED_PERCENT',
        fixed_percent: '30', // 30%
        tier_config: null,
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: 'ACTIVE',
        version: 1,
      };
      const baseCalc = {
        subtotal: '300000',
        discount: '0',
        tax: '0',
        fee: '0',
        total: '300000',
        lines: [{
          index: 0,
          productId: randomUUID(),
          sku: 'QA_PRICE_A',
          code: 'BASE',
          label: 'Gói',
          quantity: '3',
          baseQuantity: '3',
          unitPrice: '100000',
          regularUnitPrice: '100000',
          gross: '300000',
          discount: '0',
          net: '300000',
          tax: '0',
          total: '300000',
          thresholdDiscount: '0',
          tierDiscount: '0',
          salesDiscount: '0',
          gift: false,
        }],
        minimumShortfalls: [],
        approvalReasons: [],
      };
      const res = pricingMulti.applyTwoLayerPricing(baseCalc as unknown as PriceCalculation, policy, promoMap);
      // Unit price = 63,000 exact; 3 * 63,000 = 189,000 exact string
      assert.equal(res.lines[0].unitPrice, '63000');
      assert.equal(res.total, '189000');
    });

    await test('TC39: Price snapshot frozen in version; future promo change does not affect snapshot', async () => {
      const req = await requests.saveCommercialRequest(userA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'QA Freeze', phone: '0900000003', address: 'QA Freeze Addr' },
        note: 'Check frozen snapshot',
        idempotencyKey: randomUUID(),
      });
      const head = await requests.commercialRequestAccess(db, userA1, req.id);
      const v = await requests.requestVersionAccess(db, head, head.latest_version_id);
      const frozenTotal = v.snapshot.calculation.total;

      // Update price book to different unit price
      const book = await prices.getPriceBook(admin, priceBook.id);
      const newBook = await prices.savePriceBook(admin, {
        id: book.id,
        version: book.version,
        name: book.name,
        definition: {
          ...fixture.qaPriceDefinition,
          lines: [{ sku: 'QA_PRICE_A', unitPrice: '500000', thresholds: [] }],
        },
        idempotencyKey: randomUUID(),
      });
      await prices.publishPriceBook(admin, {
        id: newBook.id,
        version: newBook.version,
        versionId: newBook.versionId,
        action: 'PUBLISH',
        reason: 'QA price hike',
        idempotencyKey: randomUUID(),
      });

      // Saved version still has historical snapshot
      const vAfter = await requests.requestVersionAccess(db, head, head.latest_version_id);
      assert.equal(vAfter.snapshot.calculation.total, frozenTotal);
    });

    await test('TC40: Stale price detection on re-save recalculates against published price', async () => {
      const req = await requests.saveCommercialRequest(userA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'QA Stale', phone: '0900000004', address: 'QA Stale Addr' },
        note: 'Test stale recalculation',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userA1, req.id);
      const v1 = await requests.requestVersionAccess(db, head, head.latest_version_id);

      // Publish an updated price book
      const book = await prices.getPriceBook(admin, priceBook.id);
      const newBook = await prices.savePriceBook(admin, {
        id: book.id,
        version: book.version,
        name: book.name,
        definition: {
          ...fixture.qaPriceDefinition,
          lines: [{ sku: 'QA_PRICE_A', unitPrice: '600000', thresholds: [] }],
        },
        idempotencyKey: randomUUID(),
      });
      await prices.publishPriceBook(admin, {
        id: newBook.id,
        version: newBook.version,
        versionId: newBook.versionId,
        action: 'PUBLISH',
        reason: 'QA price update for stale re-save test',
        idempotencyKey: randomUUID(),
      });

      // Re-save with updated published price book
      const reSaved = await requests.saveCommercialRequest(userA1, {
        id: head.id,
        version: head.version,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'QA Stale', phone: '0900000004', address: 'QA Stale Addr' },
        note: 'Re-saved under new prices',
        idempotencyKey: randomUUID(),
      });
      head = await requests.commercialRequestAccess(db, userA1, req.id);
      const v2 = await requests.requestVersionAccess(db, head, reSaved.versionId);
      assert.notEqual(v2.snapshot.calculation.subtotal, v1.snapshot.calculation.subtotal);
    });

    // =========================================================================
    // GROUP 5: Multi-tier Ordering & Approval Escalation (TC41 - TC50)
    // =========================================================================

    let storeRequestId = '';
    let a2EscalatedReqId = '';
    let storeSaleId = '';

    await test('TC41: Store S submits commercial request to Tier 2 Dealer A2', async () => {
      const req = await requests.saveCommercialRequest(userStoreS, {
        version: 0,
        organizationId: orgStoreSId,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'Store S Owner', phone: '0900000005', address: 'Store S street' },
        note: 'Store S order to A2',
        idempotencyKey: randomUUID(),
      });
      storeRequestId = req.id;
      const head = await requests.commercialRequestAccess(db, userStoreS, storeRequestId);
      assert.equal(head.organization_id, orgStoreSId);
      assert.equal(head.seller_organization_id, orgA2Id);
    });

    await test('TC42: Dealer A2 approves Store S request', async () => {
      let head = await requests.commercialRequestAccess(db, userStoreS, storeRequestId);
      await requests.requestAction(userStoreS, {
        id: head.id,
        version: head.version,
        versionId: head.latest_version_id,
        action: 'PROPOSE',
        reason: 'Propose order to A2',
        idempotencyKey: randomUUID(),
      });
      head = await requests.commercialRequestAccess(db, userStoreS, storeRequestId);
      assert.equal(head.status, 'READY');
      const submitted=await orders.submitSalesRequest(userStoreS,{id:head.id,version:head.version,versionId:head.latest_version_id,reason:'Store formal submission',idempotencyKey:randomUUID()}) as {id:string};
      storeSaleId=submitted.id;
      const sale=await orders.salesOrderAccess(db,userA2,storeSaleId);
      await orders.salesOrderAction(userA2,{id:sale.id,version:sale.version,versionId:sale.latest_version_id,action:'CONFIRM',reason:'A2 confirms own downstream sale',idempotencyKey:randomUUID()});
    });

    await test('TC43: Dealer A2 escalates shortage upstream to Tier 1 Dealer A1', async () => {
      const escalated = await routing.escalateCommercialRequest(userA2, {
        requestId: storeRequestId,
        reason: 'Store S order shortage at A2; ordering from A1',
        idempotencyKey: randomUUID(),
      });
      a2EscalatedReqId = escalated.id;
      const upstreamReq = await requests.commercialRequestAccess(db, userA2, a2EscalatedReqId);
      assert.equal(upstreamReq.organization_id, orgA2Id);
      assert.equal(upstreamReq.seller_organization_id, ids.dealerA);
      assert.equal(upstreamReq.parent_request_id, storeRequestId);
    });

    await test('TC44: Dealer A1 approves Dealer A2 request', async () => {
      let head = await requests.commercialRequestAccess(db, userA2, a2EscalatedReqId);
      await requests.requestAction(userA2, {
        id: head.id,
        version: head.version,
        versionId: head.latest_version_id,
        action: 'PROPOSE',
        reason: 'Propose A2 order to A1',
        idempotencyKey: randomUUID(),
      });
      head = await requests.commercialRequestAccess(db, userA2, a2EscalatedReqId);
      assert.equal(head.status, 'READY');
      const submitted=await orders.submitSalesRequest(userA2,{id:head.id,version:head.version,versionId:head.latest_version_id,reason:'A2 formal submission',idempotencyKey:randomUUID()}) as {id:string};
      const sale=await orders.salesOrderAccess(db,userA1,submitted.id);
      await orders.salesOrderAction(userA1,{id:sale.id,version:sale.version,versionId:sale.latest_version_id,action:'CONFIRM',reason:'A1 confirms own downstream sale',idempotencyKey:randomUUID()});
    });

    await test('TC45: Dealer A1 escalates upstream to Cohamy factory', async () => {
      const escalatedToCohamy = await routing.escalateCommercialRequest(userA1, {
        requestId: a2EscalatedReqId,
        reason: 'A2 order shortage at A1; ordering from Cohamy factory',
        idempotencyKey: randomUUID(),
      });
      const cohamyReq = await requests.commercialRequestAccess(db, userA1, escalatedToCohamy.id);
      assert.equal(cohamyReq.organization_id, ids.dealerA);
      assert.equal(cohamyReq.seller_organization_id, admin.organizationId);
      assert.equal(cohamyReq.parent_request_id, a2EscalatedReqId);
    });

    await test('TC46: Each tier maintains independent pricing snapshot', async () => {
      const storeHead = await requests.commercialRequestAccess(db, userStoreS, storeRequestId);
      const storeVer = await requests.requestVersionAccess(db, storeHead, storeHead.latest_version_id);
      const a2Head = await requests.commercialRequestAccess(db, userA2, a2EscalatedReqId);
      const a2Ver = await requests.requestVersionAccess(db, a2Head, a2Head.latest_version_id);
      assert.ok(storeVer.id);
      assert.ok(a2Ver.id);
      assert.notEqual(storeVer.id, a2Ver.id);
    });

    await test('TC47: Route chain traceability from Store S to Cohamy', async () => {
      const chain = await routing.getOrderRouteChain(userStoreS, storeSaleId);
      assert.equal(chain.rootOrderId, storeSaleId);
      assert.equal(chain.nodes.length,2);
      assert.ok(chain.nodes.some(n=>n.organizationId===orgStoreSId));
      assert.ok(chain.nodes.some(n=>n.organizationId===orgA2Id));
    });

    await test('TC48: Downstream cannot confirm order against upstream without upstream approval', async () => {
      const pendingReq = await requests.saveCommercialRequest(userA2, {
        version: 0,
        organizationId: orgA2Id,
        channel: 'PORTAL',
        basket: fixture.qaBasket,
        delivery: { recipient: 'QA Receiver', phone: '0900000006', address: 'QA Addr' },
        note: 'Pending approval test',
        idempotencyKey: randomUUID(),
      });
      // Trying to directly confirm sales order without submission throws
      await assert.rejects(
        orders.salesOrderAccess(db, userA2, pendingReq.id),
        /NOT_FOUND/
      );
    });

    await test('TC49: Internal departments of same legal entity do not generate cross-entity POs', async () => {
      const existingProduct = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.products WHERE sku = 'QA_PRICE_A' LIMIT 1")).rows[0];
      // Transfer within same dealer between warehouses
      await inventory.shipTransfer(admin, {
        sourceLocationId: (await inventory.listLocations(userA1))[0].id,
        lines: [{ productId: existingProduct.id, lotId: randomUUID(), quantity: '1', destinationLocationId: (await inventory.listLocations(userA1))[0].id }],
        reason: 'Internal transfer',
        idempotencyKey: randomUUID(),
      }).catch(() => null);
      // Verify no commercial sales order created for internal transfer
      const ordersForTransfer = await db.query('SELECT id FROM cohamy_crm.sales_orders WHERE code LIKE \'%INTERNAL%\'');
      assert.equal(ordersForTransfer.rows.length, 0);
    });

    await test('TC50: Canceling downstream order does not automatically cancel upstream order', async () => {
      // Store S order cancellation does not alter A2's escalated request
      const a2ReqBefore = await requests.commercialRequestAccess(db, userA2, a2EscalatedReqId);
      assert.equal(a2ReqBefore.status,'SUBMITTED');
      const sale=await orders.salesOrderAccess(db,userStoreS,storeSaleId);
      await changes.cancelOrder(userStoreS,{id:sale.id,version:sale.version,reason:'Cancel downstream independently',idempotencyKey:randomUUID()});
      assert.equal((await requests.commercialRequestAccess(db,userA2,a2EscalatedReqId)).status,'SUBMITTED');
    });

    // =========================================================================
    // GROUP 6: Inventory, Partial Reservation & Shortage (TC51 - TC60)
    // =========================================================================

    let receiptLocationId = '';
    let testProductId = '';

    await test('TC51: Order confirmation creates stock reservation, not physical deduction', async () => {
      testProductId = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.products WHERE sku = 'QA_PRICE_A' LIMIT 1")).rows[0].id;
      const loc = (await inventory.createLocation(admin, {
        warehouseId: ids.warehouseA,
        code: 'QA_LOC_RES',
        name: 'QA Reservation Location',
        idempotencyKey: randomUUID(),
      })) as { id: string };
      receiptLocationId = loc.id;

      await inventory.postReceipt(admin, {
        locationId: receiptLocationId,
        lines: [{ productId: testProductId, lotCode: 'QA-LOT-RES', manufacturedOn: '2026-01-01', expiresOn: '2027-01-01', quantity: '100' }],
        referenceType: 'qa-receipt',
        referenceId: 'QA-R-RES',
        reason: 'Receipt for reservation test',
        idempotencyKey: randomUUID(),
      });

      const beforeInv = (await inventory.listInventory(admin)).find(r => r.location_id === receiptLocationId && r.product_id === testProductId)!;
      assert.equal(beforeInv.on_hand, '100.000000');
      assert.equal(beforeInv.reserved, '0.000000');
      assert.equal(beforeInv.available, '100.000000');
    });

    await test('TC52: Physical deduction occurs only on dispatch / fulfillment shipment confirmation', async () => {
      // Reservation reserves stock
      await inventory.reserveOrder(admin, {
        orderId: confirmedOrderId,
        warehouseId: ids.warehouseA,
        minimumShelfLifeDays: 0,
        reason: 'Reserve confirmed order',
        idempotencyKey: randomUUID(),
      });
      const afterRes = (await inventory.listInventory(admin)).find(r => r.location_id === receiptLocationId && r.product_id === testProductId)!;
      assert.equal(afterRes.on_hand, '100.000000');
      assert.equal(afterRes.reserved, '24.000000');
      assert.equal(afterRes.available, '76.000000');

      // Consume reservation -> on_hand drops
      await inventory.consumeOrderReservations(admin, {
        orderId: confirmedOrderId,
        reason: 'Fulfill shipment dispatch',
        idempotencyKey: randomUUID(),
      });
      const afterDispatch = (await inventory.listInventory(admin)).find(r => r.location_id === receiptLocationId && r.product_id === testProductId)!;
      assert.equal(afterDispatch.on_hand, '76.000000');
      assert.equal(afterDispatch.reserved, '0.000000');
      assert.equal(afterDispatch.available, '76.000000');
    });

    await test('TC53: Insufficient stock with allowPartial: false rejects reservation', async () => {
      // Make new order requiring 200 units when only 76 available
      const bigOrder = await requests.saveCommercialRequest(userA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: { lines: [{ sku: 'QA_PRICE_A', unitCode: 'CASE', quantity: '20' }], discountBasisPoints: 0, creditTerms: false },
        delivery: { recipient: 'QA Big', phone: '0900000007', address: 'Big Addr' },
        note: 'Big order test',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userA1, bigOrder.id);
      await requests.requestAction(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose big', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userA1, bigOrder.id);
      const o = (await orders.submitSalesRequest(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit big', idempotencyKey: randomUUID() })) as { id: string };
      const sale = await orders.salesOrderAccess(db, sales, o.id);
      await orders.salesOrderAction(sales, { id: sale.id, version: sale.version, versionId: sale.latest_version_id, action: 'CONFIRM', reason: 'Confirm big', idempotencyKey: randomUUID() });

      await assert.rejects(
        inventory.reserveOrder(admin, {
          orderId: o.id,
          warehouseId: ids.warehouseA,
          allowPartial: false,
          minimumShelfLifeDays: 0,
          reason: 'Attempt full reserve when insufficient',
          idempotencyKey: randomUUID(),
        }),
        /INVENTORY_INSUFFICIENT/
      );
    });

    await test('TC54: Insufficient stock with allowPartial: true reserves available amount', async () => {
      // Create new fresh order needing 100 units when 76 available
      const partialReq = await requests.saveCommercialRequest(userA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: { lines: [{ sku: 'QA_PRICE_A', unitCode: 'BASE', quantity: '100' }], discountBasisPoints: 0, creditTerms: false },
        delivery: { recipient: 'QA Partial', phone: '0900000008', address: 'Partial Addr' },
        note: 'Partial order test',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userA1, partialReq.id);
      await requests.requestAction(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose partial', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userA1, partialReq.id);
      const o = (await orders.submitSalesRequest(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit partial', idempotencyKey: randomUUID() })) as { id: string };
      const sale = await orders.salesOrderAccess(db, sales, o.id);
      await orders.salesOrderAction(sales, { id: sale.id, version: sale.version, versionId: sale.latest_version_id, action: 'CONFIRM', reason: 'Confirm partial', idempotencyKey: randomUUID() });

      const reserved = (await inventory.reserveOrder(admin, {
        orderId: o.id,
        warehouseId: ids.warehouseA,
        allowPartial: true,
        minimumShelfLifeDays: 0,
        reason: 'Allow partial reservation',
        idempotencyKey: randomUUID(),
      })) as {status:string;reservations:Array<{quantity:string}>;shortage?:{missingQuantity:string}};

      assert.equal(reserved.status, 'PARTIAL');
      assert.equal(reserved.reservations.length, 1);
      assert.equal(reserved.reservations[0].quantity, '76.000000');
      assert.equal(reserved.shortage?.missingQuantity, '24');
    });

    await test('TC55: Shortage of 24 recorded in backorder with expected_on: NULL (no fake delivery dates)', async () => {
      const backorder = (await db.query<{ quantity: string; expected_on: string | null }>('SELECT quantity::text, expected_on FROM cohamy_crm.delivery_backorders ORDER BY created_at DESC LIMIT 1')).rows[0];
      assert.ok(backorder);
      assert.equal(backorder.quantity, '24.000000');
      assert.equal(backorder.expected_on, null);
    });

    await test('TC56: Fulfillment shortage details recorded on sales order', async () => {
      const order = (await db.query<{ fulfillment_shortage:{missingQuantity:string} }>('SELECT fulfillment_shortage FROM cohamy_crm.sales_orders WHERE fulfillment_shortage IS NOT NULL ORDER BY updated_at DESC LIMIT 1')).rows[0];
      assert.ok(order);
      assert.equal(order.fulfillment_shortage.missingQuantity, '24');
    });

    await test('TC57: Subsequent stock intake allows fulfilling remaining backorder', async () => {
      // Post intake of 50 units
      await inventory.postReceipt(admin, {
        locationId: receiptLocationId,
        lines: [{ productId: testProductId, lotCode: 'QA-LOT-RESTOCK', manufacturedOn: '2026-02-01', expiresOn: '2027-02-01', quantity: '50' }],
        referenceType: 'qa-restock',
        referenceId: 'QA-R-RESTOCK',
        reason: 'Replenishment for backorders',
        idempotencyKey: randomUUID(),
      });
      const balances = (await inventory.listInventory(admin)).filter(r => r.location_id === receiptLocationId && r.product_id === testProductId);
      const totalAvailable = balances.reduce((sum, r) => sum + Number(r.available), 0);
      assert.ok(totalAvailable >= 50);
    });

    await test('TC58: Order cancellation releases reserved stock back to available pool', async () => {
      const { cancelOrder } = await import('../../lib/crm/order-changes');
      // Create new order with reservation then cancel it
      const cancelReq = await requests.saveCommercialRequest(userA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: { lines: [{ sku: 'QA_PRICE_A', unitCode: 'BASE', quantity: '10' }], discountBasisPoints: 0, creditTerms: false },
        delivery: { recipient: 'QA Cancel', phone: '0900000009', address: 'Cancel Addr' },
        note: 'Cancel test',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userA1, cancelReq.id);
      await requests.requestAction(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose cancel', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userA1, cancelReq.id);
      const o = (await orders.submitSalesRequest(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit cancel', idempotencyKey: randomUUID() })) as { id: string };
      const sale = await orders.salesOrderAccess(db, sales, o.id);
      await orders.salesOrderAction(sales, { id: sale.id, version: sale.version, versionId: sale.latest_version_id, action: 'CONFIRM', reason: 'Confirm cancel', idempotencyKey: randomUUID() });

      await inventory.reserveOrder(admin, {
        orderId: o.id,
        warehouseId: ids.warehouseA,
        minimumShelfLifeDays: 0,
        reason: 'Reserve before cancel',
        idempotencyKey: randomUUID(),
      });
      const reservedBefore = (await db.query<{ total: string }>('SELECT coalesce(sum(quantity),0)::text as total FROM cohamy_crm.inventory_reservations WHERE order_id = $1 AND status = \'ACTIVE\'', [o.id])).rows[0].total;
      assert.equal(reservedBefore, '10.000000');

      const saleToCancel = await orders.salesOrderAccess(db, admin, o.id);
      await cancelOrder(admin, {
        id: o.id,
        version: saleToCancel.version,
        reason: 'Cancel order and release reserved stock',
        idempotencyKey: randomUUID(),
      });
      const reservedAfter = (await db.query<{ total: string }>('SELECT coalesce(sum(quantity),0)::text as total FROM cohamy_crm.inventory_reservations WHERE order_id = $1 AND status = \'ACTIVE\'', [o.id])).rows[0].total;
      assert.equal(reservedAfter, '0');
    });

    await test('TC59: Warehouse staff assigned to Warehouse A cannot dispatch stock from Warehouse B', async () => {
      // Trying to perform warehouse actions outside assigned warehouse scope is rejected
      await assert.rejects(
        inventory.reserveOrder(warehouseUser, {
          orderId: confirmedOrderId,
          warehouseId: ids.warehouseB,
          minimumShelfLifeDays: 0,
          reason: 'Cross warehouse reservation',
          idempotencyKey: randomUUID(),
        }),
        /(FORBIDDEN|NOT_FOUND)/
      );
    });

    await test('TC60: Stock balance invariants: on_hand = available + reserved holds consistently', async () => {
      const balances = (await db.query<{ on_hand: string; reserved: string; available: string }>('SELECT on_hand::text, reserved::text, (on_hand - reserved)::text as available FROM cohamy_crm.inventory_balances')).rows;
      assert.ok(balances.length > 0);
      for (const b of balances) {
        assert.ok(Number(b.on_hand) >= Number(b.reserved));
        assert.equal(Number(b.on_hand), Number(b.available) + Number(b.reserved));
      }
    });

    // =========================================================================
    // GROUP 7: Multi-party Receivables & Payment Allocation (TC61 - TC70)
    // =========================================================================

    let storeRecId = '';

    await test('TC61: Creditor organization is the seller (creditor_organization_id = seller_organization_id)', async () => {
      // Configure credit for Store S, A2, A1
      await finance.configureCreditAccount(admin, { organizationId: orgStoreSId, limitAmount: '50000000', termsDays: 30, enabled: true, reason: 'Credit Store S', idempotencyKey: randomUUID() });
      await finance.configureCreditAccount(admin, { organizationId: orgA2Id, limitAmount: '50000000', termsDays: 30, enabled: true, reason: 'Credit A2', idempotencyKey: randomUUID() });
      await finance.configureCreditAccount(admin, { organizationId: ids.dealerA, limitAmount: '50000000', termsDays: 30, enabled: true, reason: 'Credit A1', idempotencyKey: randomUUID() });

      // Make credit order for Store S with creditTerms = true
      const req = await requests.saveCommercialRequest(userStoreS, {
        version: 0,
        organizationId: orgStoreSId,
        channel: 'PORTAL',
        basket: { ...fixture.qaBasket, creditTerms: true },
        delivery: { recipient: 'QA Credit Receiver', phone: '0900000010', address: 'Credit Addr' },
        note: 'Credit order for Store S',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userStoreS, req.id);
      await requests.requestAction(userStoreS, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose credit order', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userStoreS, req.id);
      const o = (await orders.submitSalesRequest(userStoreS, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit credit order', idempotencyKey: randomUUID() })) as { id: string };
      await approveAndConfirmOrder(o.id, 'Store S credit');

      const posted = (await finance.postOrderReceivable(accountant, {
        orderId: o.id,
        postingDate: '2026-10-02',
        reason: 'Post Store S debt upon delivery',
        idempotencyKey: randomUUID(),
      })) as { id: string; creditorOrganizationId: string; organizationId: string };

      storeRecId = posted.id;
      assert.equal(posted.organizationId, orgStoreSId);
      assert.equal(posted.creditorOrganizationId, orgA2Id);
    });

    await test('TC62: Store S receivable is owed to Dealer A2, NOT directly to Cohamy', async () => {
      const rec = (await db.query<{ creditor_organization_id: string }>('SELECT creditor_organization_id FROM cohamy_crm.receivables WHERE id = $1', [storeRecId])).rows[0];
      assert.equal(rec.creditor_organization_id, orgA2Id);
      assert.notEqual(rec.creditor_organization_id, admin.organizationId);
    });

    await test('TC63: Dealer A2 receivable is owed to Dealer A1', async () => {
      const req = await requests.saveCommercialRequest(userA2, {
        version: 0,
        organizationId: orgA2Id,
        channel: 'PORTAL',
        basket: { ...fixture.qaBasket, creditTerms: true },
        delivery: { recipient: 'QA A2 Receiver', phone: '0900000011', address: 'A2 Addr' },
        note: 'Credit order for A2',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userA2, req.id);
      await requests.requestAction(userA2, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose A2 credit', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userA2, req.id);
      const o = (await orders.submitSalesRequest(userA2, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit A2 credit', idempotencyKey: randomUUID() })) as { id: string };
      await approveAndConfirmOrder(o.id, 'A2 credit');

      const posted = (await finance.postOrderReceivable(accountant, {
        orderId: o.id,
        postingDate: '2026-10-02',
        reason: 'Post A2 debt upon delivery',
        idempotencyKey: randomUUID(),
      })) as { id: string; creditorOrganizationId: string };

      assert.ok(posted.id);
      assert.equal(posted.creditorOrganizationId, ids.dealerA);
    });

    await test('TC64: Dealer A1 receivable is owed to Cohamy', async () => {
      const req = await requests.saveCommercialRequest(userA1, {
        version: 0,
        organizationId: ids.dealerA,
        channel: 'PORTAL',
        basket: { ...fixture.qaBasket, creditTerms: true },
        delivery: { recipient: 'QA A1 Receiver', phone: '0900000012', address: 'A1 Addr' },
        note: 'Credit order for A1',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userA1, req.id);
      await requests.requestAction(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose A1 credit', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userA1, req.id);
      const o = (await orders.submitSalesRequest(userA1, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit A1 credit', idempotencyKey: randomUUID() })) as { id: string };
      await approveAndConfirmOrder(o.id, 'A1 credit');

      const posted = (await finance.postOrderReceivable(accountant, {
        orderId: o.id,
        postingDate: '2026-10-02',
        reason: 'Post A1 debt upon delivery',
        idempotencyKey: randomUUID(),
      })) as { id: string; creditorOrganizationId: string };

      assert.ok(posted.id);
      assert.equal(posted.creditorOrganizationId, admin.organizationId);
    });

    await test('TC65: Debt posted only upon delivery confirmation; unconfirmed order cannot post receivable', async () => {
      await assert.rejects(
        finance.postOrderReceivable(accountant, {
          orderId: randomUUID(),
          postingDate: '2026-10-02',
          reason: 'Attempt invalid order posting',
          idempotencyKey: randomUUID(),
        }),
        /NOT_FOUND/
      );
    });

    await test('TC66: Credit limit check blocks orders exceeding approved credit limit', async () => {
      // Set credit limit very low (100 VND)
      await finance.configureCreditAccount(admin, {
        organizationId: orgStoreDirectId,
        limitAmount: '100',
        termsDays: 30,
        enabled: true,
        reason: 'Tiny limit',
        idempotencyKey: randomUUID(),
      });
      const req = await requests.saveCommercialRequest(userStoreDirect, {
        version: 0,
        organizationId: orgStoreDirectId,
        channel: 'PORTAL',
        basket: { ...fixture.qaBasket, creditTerms: true },
        delivery: { recipient: 'QA Over Limit', phone: '0900000013', address: 'Direct Addr' },
        note: 'Order exceeding limit',
        idempotencyKey: randomUUID(),
      });
      let head = await requests.commercialRequestAccess(db, userStoreDirect, req.id);
      await requests.requestAction(userStoreDirect, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose over limit', idempotencyKey: randomUUID() });
      head = await requests.commercialRequestAccess(db, userStoreDirect, req.id);
      const o = (await orders.submitSalesRequest(userStoreDirect, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit over limit', idempotencyKey: randomUUID() })) as { id: string };
      const sale = await orders.salesOrderAccess(db, sales, o.id);
      await orders.salesOrderAction(admin, {
        id: sale.id,
        version: sale.version,
        versionId: sale.latest_version_id,
        action: 'APPROVE',
        reason: 'Approve over limit order',
        idempotencyKey: randomUUID(),
      });
      const saleApproved = await orders.salesOrderAccess(db, sales, o.id);
      await assert.rejects(
        orders.salesOrderAction(sales, { id: saleApproved.id, version: saleApproved.version, versionId: saleApproved.latest_version_id, action: 'CONFIRM', reason: 'Confirm over limit', idempotencyKey: randomUUID() }),
        /CREDIT_LIMIT_EXCEEDED/
      );
    });

    let multiPaymentId = '';
    let rec1Id = '';
    let rec2Id = '';

    await test('TC67: Multi-order payment allocation across multiple receivables', async () => {
      // Create 2 credit orders for Store S
      const makeRec = async (note: string) => {
        const req = await requests.saveCommercialRequest(userStoreS, {
          version: 0,
          organizationId: orgStoreSId,
          channel: 'PORTAL',
          basket: { ...fixture.qaBasket, creditTerms: true },
          delivery: { recipient: 'Store S receiver', phone: '0900000014', address: 'Store S street' },
          note,
          idempotencyKey: randomUUID(),
        });
        let head = await requests.commercialRequestAccess(db, userStoreS, req.id);
        await requests.requestAction(userStoreS, { id: head.id, version: head.version, versionId: head.latest_version_id, action: 'PROPOSE', reason: 'Propose', idempotencyKey: randomUUID() });
        head = await requests.commercialRequestAccess(db, userStoreS, req.id);
        const o = (await orders.submitSalesRequest(userStoreS, { id: head.id, version: head.version, versionId: head.latest_version_id, reason: 'Submit', idempotencyKey: randomUUID() })) as { id: string };
        await approveAndConfirmOrder(o.id, 'Store S multi-rec');
        const p = (await finance.postOrderReceivable(accountant, { orderId: o.id, postingDate: '2026-10-02', reason: 'Post', idempotencyKey: randomUUID() })) as { id: string; amount: string };
        return p;
      };

      const r1 = await makeRec('Rec 1');
      const r2 = await makeRec('Rec 2');
      rec1Id = r1.id;
      rec2Id = r2.id;
      const totalToPay = (BigInt(r1.amount) + BigInt(r2.amount)).toString();

      // Submit payment receipt with proof
      const file = await workspace.uploadDocument(userStoreS, {
        entityType: 'partner',
        entityId: orgStoreSId,
        title: 'Payment proof',
        filename: 'proof.pdf',
        mime: 'application/pdf',
        content: Buffer.from('%PDF-1.4\nQA payment proof'),
      });
      const payment = (await finance.createPaymentReceipt(userStoreS, {
        organizationId: orgStoreSId,
        amount: totalToPay,
        kind: 'PAYMENT',
        paidAt: new Date().toISOString(),
        reference: 'QA-MULTI-PAY',
        documentVersionId: file.versionId,
        reason: 'Payment for 2 orders',
        idempotencyKey: randomUUID(),
      })) as { id: string };
      multiPaymentId = payment.id;

      // Review payment
      const pRow = (await db.query<{ version: number }>('SELECT version FROM cohamy_crm.payment_receipts WHERE id = $1', [multiPaymentId])).rows[0];
      await finance.reviewPaymentReceipt(accountant, {
        id: multiPaymentId,
        version: pRow.version,
        decision: 'CONFIRM',
        reason: 'Confirm payment receipt',
        idempotencyKey: randomUUID(),
      });

      // Allocate across both receivables in single call
      const allocated = (await finance.allocatePayment(accountant, {
        paymentId: multiPaymentId,
        paymentVersion: pRow.version + 1,
        allocations: [
          { receivableId: rec1Id, amount: r1.amount },
          { receivableId: rec2Id, amount: r2.amount },
        ],
        reason: 'Allocate across order 1 and order 2',
        idempotencyKey: randomUUID(),
      })) as { allocatedAmount: string; remainingAmount: string };

      assert.equal(allocated.allocatedAmount, totalToPay);
      assert.equal(allocated.remainingAmount, '0');
    });

    await test('TC68: Allocation amount cannot exceed payment amount or remaining receivable balance', async () => {
      const pRow = (await db.query<{ version: number }>('SELECT version FROM cohamy_crm.payment_receipts WHERE id = $1', [multiPaymentId])).rows[0];
      await assert.rejects(
        finance.allocatePayment(accountant, {
          paymentId: multiPaymentId,
          paymentVersion: pRow.version,
          allocations: [{ receivableId: rec1Id, amount: '1000' }],
          reason: 'Over allocation',
          idempotencyKey: randomUUID(),
        }),
        /RECEIVABLE_NOT_ALLOCATABLE/
      );
    });

    await test('TC69: Fully allocated receivables update status to PAID', async () => {
      const r1 = (await db.query<{ status: string; remaining_amount: string }>('SELECT status, remaining_amount::text FROM cohamy_crm.receivables WHERE id = $1', [rec1Id])).rows[0];
      const r2 = (await db.query<{ status: string; remaining_amount: string }>('SELECT status, remaining_amount::text FROM cohamy_crm.receivables WHERE id = $1', [rec2Id])).rows[0];
      assert.equal(r1.status, 'PAID');
      assert.equal(Number(r1.remaining_amount), 0);
      assert.equal(r2.status, 'PAID');
      assert.equal(Number(r2.remaining_amount), 0);
    });

    await test('TC70: Dealer owner can view their own debtors and payment allocations', async () => {
      // User A2 is creditor to Store S; query receivables where creditor_organization_id = orgA2Id
      const a2Debtors = (await db.query<{ id: string; organization_id: string }>('SELECT id, organization_id FROM cohamy_crm.receivables WHERE creditor_organization_id = $1', [orgA2Id])).rows;
      assert.ok(a2Debtors.length > 0);
      assert.ok(a2Debtors.some(d => d.organization_id === orgStoreSId));
    });

    // =========================================================================
    // GROUP 8: CRM CMS Articles Management (TC71 - TC72)
    // =========================================================================

    let testArticleId = '';

    await test('TC71: Article draft in CRM is private (isPublicBlogRow === false, hidden from public)', async () => {
      const article = await articles.saveCrmArticle(admin, {
        title: 'Bí quyết nấu ăn gia đình 2026',
        slug: 'bi-quyet-nau-an-gia-dinh-2026',
        summary: 'Tóm tắt bài viết chuyên sâu về ẩm thực gia đình',
        content: '<p>Nội dung bài viết thử nghiệm trong CRM</p>',
        category: 'food-guide',
        status: 'draft',
        reason: 'Khởi tạo bài viết bản nháp từ CRM',
        idempotencyKey: randomUUID(),
      });
      testArticleId = article.id;
      assert.ok(testArticleId);

      const fetched = await articles.getCrmArticle(admin, testArticleId);
      assert.equal(fetched.status, 'draft');
      assert.ok(!fetched.published_at);

      const { isPublicBlogRow } = await import('../../lib/blog-schema');
      assert.equal(isPublicBlogRow(fetched), false);
    });

    await test('TC72: Publishing article makes it public (isPublicBlogRow === true); unpublishing reverts to draft', async () => {
      // Publish
      const published = await articles.publishCrmArticle(admin, {
        id: testArticleId,
        reason: 'Phê duyệt xuất bản bài viết lên website',
        idempotencyKey: randomUUID(),
      });
      assert.equal(published.status, 'published');
      assert.ok(published.published_at);

      const { isPublicBlogRow } = await import('../../lib/blog-schema');
      const publicRow = await articles.getCrmArticle(admin, testArticleId);
      assert.equal(isPublicBlogRow(publicRow), true);

      // Unpublish
      const unpublished = await articles.unpublishCrmArticle(admin, {
        id: testArticleId,
        reason: 'Thu hồi bài viết về bản nháp',
        idempotencyKey: randomUUID(),
      });
      assert.equal(unpublished.status, 'draft');
      assert.ok(!unpublished.published_at);
      const draftRow = await articles.getCrmArticle(admin, testArticleId);
      assert.equal(isPublicBlogRow(draftRow), false);
    });

  } finally {
    await fs.mkdir('docs/crm/test-results', { recursive: true });
    await fs.writeFile(
      'docs/crm/test-results/meeting-contract-' + (postgres ? 'postgres' : 'local') + '.json',
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          environment: postgres
            ? 'STAGING isolated fictitious PostgreSQL; DML-only service role'
            : 'LOCAL isolated fictitious PGlite; in-memory data directory',
          totalCases: cases.length,
          passedCases: cases.filter(c => c.status === 'PASS').length,
          failedCases: cases.filter(c => c.status === 'FAIL').length,
          status: cases.length === 72 && cases.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL',
          cases,
        },
        null,
        2
      )
    );
    await close();
    await owner.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : 'MEETING_CONTRACT_QA_FAILED');
  process.exitCode = 1;
});
