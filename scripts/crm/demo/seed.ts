/**
 * Cohamy CRM - Demo Dataset Seeder
 * Defaults to the isolated DEMO environment. A one-off production fixture
 * run requires the exact database target, a fresh backup and an empty CRM
 * business-data baseline.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import { assertConnectedDemoPostgresDatabase, assertDemoPostgresUrl, assertProductionFixtureSeedTarget } from "../../../lib/crm/demo-database-guard";

loadEnvConfig(process.cwd());

// 1. Mandatory Environment Guard
function enforceDemoEnvironment(): boolean {
  const productionFixtureSeed = Boolean(process.env.CRM_DEMO_PRODUCTION_SEED_CONFIRM);
  if (productionFixtureSeed) {
    if (process.env.CRM_ENVIRONMENT !== "PRODUCTION" || process.env.CRM_DATABASE_MODE !== "postgres") {
      throw new Error("PRODUCTION_FIXTURE_ENVIRONMENT_REQUIRED");
    }
    assertProductionFixtureSeedTarget(process.env.CRM_DATABASE_URL, process.env.CRM_DEMO_PRODUCTION_SEED_CONFIRM);
    // Only this CLI process suppresses outbound messages. The web/worker runtime
    // continues to use CRM_ENVIRONMENT=PRODUCTION.
    process.env.CRM_DEMO_MODE = "true";
    process.env.CRM_EMAIL_ENABLED = "false";
    process.env.CRM_SMS_ENABLED = "false";
    process.env.CRM_WEBSITE_ORDER_INTAKE = "true";
    return true;
  }
  if (process.env.CRM_ENVIRONMENT && process.env.CRM_ENVIRONMENT.toUpperCase() !== "DEMO") {
    throw new Error("DEMO_SEED_BLOCKED: CRM_ENVIRONMENT must explicitly be DEMO.");
  }
  process.env.CRM_ENVIRONMENT = "DEMO";
  const mode = process.env.CRM_DATABASE_MODE || "pglite";
  if (mode === "postgres" || mode === "pg") {
    assertDemoPostgresUrl(process.env.CRM_DATABASE_URL);
  } else if (mode !== "pglite" || process.env.CRM_DATABASE_URL) {
    throw new Error("DEMO_SEED_BLOCKED: Select PGlite without a PostgreSQL URL, or select the dedicated PostgreSQL demo database.");
  }

  process.env.CRM_DEMO_MODE = "true";
  process.env.CRM_DATABASE_MODE = mode;
  process.env.CRM_WEBSITE_ORDER_INTAKE = "true";
  if (!process.env.CRM_LOCAL_DATA_DIR) {
    process.env.CRM_LOCAL_DATA_DIR = ".local/crm-demo";
  }
  return false;
}

const productionFixtureSeed = enforceDemoEnvironment();

import { database } from "../../../lib/crm/db";
import { migrate, importWebsiteCatalog } from "../../../lib/crm/bootstrap";
import { login } from "../../../lib/crm/auth";
import * as repo from "../../../lib/crm/repository";
import * as pricing from "../../../lib/crm/pricing";
import * as policy from "../../../lib/crm/order-policy";
import * as inventory from "../../../lib/crm/inventory";
import * as orders from "../../../lib/crm/sales-orders";
import * as requests from "../../../lib/crm/order-requests";
import * as quotes from "../../../lib/crm/quotations";
import * as fulfillment from "../../../lib/crm/fulfillment";
import * as procurement from "../../../lib/crm/procurement";
import * as consignment from "../../../lib/crm/consignment";
import * as samples from "../../../lib/crm/samples";
import * as finance from "../../../lib/crm/finance";
import * as workspace from "../../../lib/crm/workspace";
import * as websiteOrders from "../../../lib/crm/website-orders";
import {
  resolveDemoPassword,
  DEMO_CREDENTIALS_FILE,
  DEMO_ACCOUNTS,
  DEMO_PRODUCTS,
  DEMO_CUSTOMERS,
  DEMO_DEALERS,
  DEMO_SUPPLIERS,
} from "./constants";

async function main() {
  const postgres = ['postgres', 'pg'].includes(process.env.CRM_DATABASE_MODE || '');
  if (productionFixtureSeed) {
    const backupPath = process.env.CRM_DEMO_PRODUCTION_BACKUP;
    if (!backupPath || !path.isAbsolute(backupPath)) throw new Error("PRODUCTION_FIXTURE_BACKUP_REQUIRED");
    const backupRealPath = await fs.realpath(backupPath);
    const backupStat = await fs.stat(backupRealPath);
    if (!backupRealPath.startsWith('/root/cohamy-backups/') || !backupStat.isFile() || backupStat.size < 50_000 ||
        (backupStat.mode & 0o077) !== 0 || Date.now() - backupStat.mtimeMs > 6 * 60 * 60 * 1000) {
      throw new Error("PRODUCTION_FIXTURE_BACKUP_INVALID");
    }
    const preflightDb = await database();
    const target = (await preflightDb.query<{ name: string }>('SELECT current_database() AS name')).rows[0]?.name;
    if (target !== 'cohamy_crm') throw new Error('PRODUCTION_FIXTURE_CONNECTION_MISMATCH');
    const baseline = (await preflightDb.query<{ demo_users: string; demo_orgs: string; policy: string; inventory: string; applications: string; quotations: string; orders: string }>(
      `SELECT
        (SELECT count(*)::text FROM cohamy_crm.users WHERE email LIKE '%@demo.cohamy.invalid') AS demo_users,
        (SELECT count(*)::text FROM cohamy_crm.organizations WHERE code LIKE 'DEMO_%') AS demo_orgs,
        (SELECT count(*)::text FROM cohamy_crm.order_policy_current) AS policy,
        (SELECT count(*)::text FROM cohamy_crm.inventory_balances) AS inventory,
        (SELECT count(*)::text FROM cohamy_crm.partner_applications) AS applications,
        (SELECT count(*)::text FROM cohamy_crm.quotations) AS quotations,
        (SELECT count(*)::text FROM cohamy_crm.sales_orders) AS orders`
    )).rows[0];
    if (!baseline || Object.values(baseline).some(value => Number(value) !== 0)) {
      throw new Error('PRODUCTION_FIXTURE_BASELINE_CHANGED');
    }
  } else if (postgres) {
    // This must precede migrate() and every other write.
    const preflightDb = await database();
    await assertConnectedDemoPostgresDatabase(sql => preflightDb.query<{ name: string }>(sql));
  }
  console.log("=================================================");
  console.log(" [COHAMY CRM] BẮT ĐẦU SEED DỮ LIỆU DEMO GIẢ LẬP  ");
  console.log(" Môi trường: " + (productionFixtureSeed ? "PRODUCTION (one-time fixture seed: cohamy_crm)" : "DEMO (Database: " + (postgres ? "PostgreSQL cohamy_crm_demo" : ("PGlite: " + process.env.CRM_LOCAL_DATA_DIR)) + ")"));
  console.log("=================================================");

  // Step 1: Run migrations & import website catalog
  if (productionFixtureSeed) {
    console.log("\n[1/15] Dùng schema production đã migration; không nhập lại catalog website.");
  } else {
    console.log("\n[1/15] Áp dụng migrations và danh mục website...");
    await migrate();
    const catalogCount = await importWebsiteCatalog();
    console.log(`- Đã cập nhật migrations và đồng bộ ${catalogCount} sản phẩm website.`);
  }

  const db = await database();

  // Step 2: Core Organization & Role Accounts
  console.log("\n[2/15] Khởi tạo Tổ chức Cohamy HQ & 8 Tài khoản người dùng demo...");
  const rawPassword = resolveDemoPassword();
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  // HQ Organization
  let hqOrg = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE code='COHAMY'")).rows[0];
  if (!hqOrg) {
    const hqId = randomUUID();
    await db.query(
      `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, stage)
       VALUES($1, 'COHAMY', 'Công ty Cổ phần Thực phẩm Dinh dưỡng Cohamy', 'COHAMY', '024.7300.6868', 'contact@demo.cohamy.invalid', 'Tầng 8, Tòa nhà Dinh Dưỡng, Cầu Giấy, Hà Nội', 'ACTIVE')`,
      [hqId]
    );
    hqOrg = { id: hqId };
  }

  // Dealers A and B for accounts
  const dealerAOrg = DEMO_DEALERS[0];
  const dealerBOrg = DEMO_DEALERS[1];
  let orgA = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE code=$1", [dealerAOrg.code])).rows[0];
  if (!orgA) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, source, segment, contact_name, business_id, stage)
       VALUES($1, $2, $3, 'DEALER', $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')`,
      [id, dealerAOrg.code, dealerAOrg.name, dealerAOrg.phone, dealerAOrg.email, dealerAOrg.address, dealerAOrg.source, dealerAOrg.segment, dealerAOrg.contactName, dealerAOrg.businessId]
    );
    orgA = { id };
  }
  let orgB = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE code=$1", [dealerBOrg.code])).rows[0];
  if (!orgB) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, source, segment, contact_name, business_id, stage)
       VALUES($1, $2, $3, 'DEALER', $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')`,
      [id, dealerBOrg.code, dealerBOrg.name, dealerBOrg.phone, dealerBOrg.email, dealerBOrg.address, dealerBOrg.source, dealerBOrg.segment, dealerBOrg.contactName, dealerBOrg.businessId]
    );
    orgB = { id };
  }

  // Seed Users and Memberships
  const seededAccounts: Record<string, { userId: string; membershipId: string; email: string; role: string }> = {};

  for (const acc of DEMO_ACCOUNTS) {
    let targetOrgId = hqOrg.id;
    if (acc.email.startsWith("dealer-a") || acc.email.startsWith("staff-a")) targetOrgId = orgA.id;
    if (acc.email.startsWith("dealer-b")) targetOrgId = orgB.id;

    let user = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.users WHERE email=$1", [acc.email])).rows[0];
    if (!user) {
      const userId = randomUUID();
      await db.query(
        "INSERT INTO cohamy_crm.users(id, email, display_name, password_hash) VALUES($1, $2, $3, $4)",
        [userId, acc.email, acc.displayName, passwordHash]
      );
      user = { id: userId };
    } else {
      await db.query("UPDATE cohamy_crm.users SET password_hash=$1 WHERE id=$2", [passwordHash, user.id]);
    }

    let membership = (await db.query<{ id: string }>(
      "SELECT id FROM cohamy_crm.memberships WHERE user_id=$1 AND organization_id=$2 AND role=$3",
      [user.id, targetOrgId, acc.role]
    )).rows[0];
    if (!membership) {
      const membershipId = randomUUID();
      await db.query(
        "INSERT INTO cohamy_crm.memberships(id, user_id, organization_id, role) VALUES($1, $2, $3, $4)",
        [membershipId, user.id, targetOrgId, acc.role]
      );
      membership = { id: membershipId };
    }

    seededAccounts[acc.email] = {
      userId: user.id,
      membershipId: membership.id,
      email: acc.email,
      role: acc.role,
    };
  }

  // Save demo credentials to .local/demo-credentials.json
  await fs.mkdir(".local", { recursive: true });
  await fs.writeFile(
    DEMO_CREDENTIALS_FILE,
    JSON.stringify(
      {
        notice: productionFixtureSeed ? "COHAMY DEMO CREDENTIALS — TÀI KHOẢN MẪU TRÊN PRODUCTION" : "COHAMY DEMO CREDENTIALS — MẬT KHẨU TÀI KHOẢN TRẢI NGHIỆM LOCAL",
        environment: productionFixtureSeed ? "PRODUCTION_FIXTURE" : "DEMO",
        generatedAt: new Date().toISOString(),
        commonPassword: rawPassword,
        accounts: DEMO_ACCOUNTS.map((a) => ({
          role: a.role,
          email: a.email,
          displayName: a.displayName,
          organization: a.orgCode,
          area: a.area,
          note: a.description,
        })),
      },
      null,
      2
    ),
    "utf-8"
  );
  if (productionFixtureSeed) await fs.chmod(DEMO_CREDENTIALS_FILE, 0o600);
  console.log(`- Đã tạo 8 tài khoản demo và ghi vào ${DEMO_CREDENTIALS_FILE} (gitignored).`);

  // Step 3: Login as Admin to get Admin Principal
  const adminLogin = await login("admin@demo.cohamy.invalid", rawPassword);
  const admin = adminLogin.user;
  const salesLogin = await login("sales@demo.cohamy.invalid", rawPassword);
  const sales = salesLogin.user;
  const warehouseLogin = await login("warehouse@demo.cohamy.invalid", rawPassword);
  const warehouseUser = warehouseLogin.user;
  const accountantLogin = await login("accountant@demo.cohamy.invalid", rawPassword);
  const accountant = accountantLogin.user;
  const dealerALogin = await login("dealer-a@demo.cohamy.invalid", rawPassword);
  const dealerAUser = dealerALogin.user;
  const dealerBLogin = await login("dealer-b@demo.cohamy.invalid", rawPassword);
  void dealerBLogin;

  // Step 4: Warehouses & Locations
  console.log("\n[3/15] Khởi tạo Kho hàng và vị trí lưu kho...");
  const warehousesToCreate = [
    { code: "DEMO_KHO_HN", name: "Kho DEMO Hà Nội (Tổng kho Miền Bắc)", orgId: hqOrg.id },
    { code: "DEMO_KHO_HCM", name: "Kho DEMO TP.HCM (Tổng kho Miền Nam)", orgId: hqOrg.id },
    { code: "DEMO_KHO_SAMPLE", name: "Kho DEMO Hàng Mẫu Cohamy", orgId: hqOrg.id },
    { code: "DEMO_KHO_CONSIGN", name: "Kho DEMO Ký Gửi Nguồn Cohamy", orgId: hqOrg.id },
    { code: "DEMO_KHO_DLA", name: "Kho DEMO Đại lý Miền Bắc", orgId: orgA.id },
    { code: "DEMO_KHO_DLB", name: "Kho DEMO Đại lý Sài Gòn", orgId: orgB.id },
  ];

  const warehouseMap: Record<string, string> = {};
  const locationMap: Record<string, string> = {};

  for (const wh of warehousesToCreate) {
    let wRow = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.warehouses WHERE code=$1", [wh.code])).rows[0];
    if (!wRow) {
      const created = await repo.createWarehouse(admin, { code: wh.code, name: wh.name, organizationId: wh.orgId });
      wRow = { id: created.id };
    } else {
      await db.query("UPDATE cohamy_crm.warehouses SET organization_id=$1, name=$2, active=true WHERE id=$3", [wh.orgId, wh.name, wRow.id]);
    }
    warehouseMap[wh.code] = wRow.id;

    // Assign warehouse user to all HQ warehouses
    if (wh.orgId === hqOrg.id) {
      await db.query(
        "INSERT INTO cohamy_crm.warehouse_assignments(membership_id, warehouse_id) VALUES($1, $2) ON CONFLICT DO NOTHING",
        [warehouseUser.membershipId, wRow.id]
      );
    }

    // Create Pick Location
    let loc = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.warehouse_locations WHERE warehouse_id=$1 AND code='LOC_PICK'", [wRow.id])).rows[0];
    if (!loc) {
      const createdLoc = await inventory.createLocation(admin, {
        warehouseId: wRow.id,
        code: "LOC_PICK",
        name: `Vị trí Soạn hàng - ${wh.name}`,
        kind: "PICK",
        idempotencyKey: randomUUID(),
      }) as { id: string };
      loc = { id: createdLoc.id };
    }
    locationMap[wh.code + "_PICK"] = loc.id;

    // Create Quarantine Location
    let qLoc = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.warehouse_locations WHERE warehouse_id=$1 AND code='LOC_QUARANTINE'", [wRow.id])).rows[0];
    if (!qLoc) {
      const createdQ = await inventory.createLocation(admin, {
        warehouseId: wRow.id,
        code: "LOC_QUARANTINE",
        name: `Vị trí Cách ly / Hàng đổi trả - ${wh.name}`,
        kind: "QUARANTINE",
        idempotencyKey: randomUUID(),
      }) as { id: string };
      qLoc = { id: createdQ.id };
    }
    locationMap[wh.code + "_QUARANTINE"] = qLoc.id;
  }
  console.log(`- Đã khởi tạo ${warehousesToCreate.length} kho và các vị trí Pick/Quarantine tương ứng.`);

  // Step 5: Commercial Products & Commercial Units
  console.log("\n[4/15] Cấu hình 10 Sản phẩm & Quy đổi đơn vị (BASE, CASE)...");
  const productMap: Record<string, string> = {};

  for (const p of DEMO_PRODUCTS) {
    let pRow = (await db.query<{ id: string; version: number }>("SELECT id, version FROM cohamy_crm.products WHERE sku=$1", [p.sku])).rows[0];
    if (!pRow) {
      const pId = randomUUID();
      await db.query(
        `INSERT INTO cohamy_crm.products(id, website_id, sku, name, category, weight_label, retail_price, translations, stock_unit, active)
         VALUES($1, $2, $3, $4, $5, $6, $7, '{}', $8, true)`,
        [pId, p.sku.toLowerCase(), p.sku, p.name, p.category, p.weightLabel, Number(p.retailPrice), p.baseUnit]
      );
      pRow = { id: pId, version: 1 };
    }
    productMap[p.sku] = pRow.id;

    // Check BASE unit
    const baseUnit = (await db.query<{ code: string }>("SELECT code FROM cohamy_crm.commercial_units WHERE product_id=$1 AND code='BASE'", [pRow.id])).rows[0];
    if (!baseUnit) {
      const res = await pricing.savePriceUnit(admin, {
        productId: pRow.id,
        productVersion: pRow.version,
        code: "BASE",
        label: p.baseUnit,
        numerator: "1",
        denominator: "1",
        isCase: false,
        allowFractional: false,
        active: true,
        version: 0,
        reason: "Cấu hình đơn vị cơ sở BASE DEMO",
      });
      pRow.version = res.productVersion;
    }

    // Check CASE unit
    const caseUnit = (await db.query<{ code: string }>("SELECT code FROM cohamy_crm.commercial_units WHERE product_id=$1 AND code='CASE'", [pRow.id])).rows[0];
    if (!caseUnit) {
      await pricing.savePriceUnit(admin, {
        productId: pRow.id,
        productVersion: pRow.version,
        code: "CASE",
        label: p.caseUnit,
        numerator: String(p.unitsPerCase),
        denominator: "1",
        isCase: true,
        allowFractional: false,
        active: true,
        version: 0,
        reason: "Cấu hình đơn vị thùng CASE DEMO",
      });
    }
  }
  console.log(`- Đã khởi tạo 10 sản phẩm SKU với đơn vị BASE (${DEMO_PRODUCTS.length}) và CASE quy chuẩn.`);

  // Step 6: Price Book & Order Policy
  console.log("\n[5/15] Thiết lập Bảng giá DEMO và Chính sách phê duyệt đơn hàng...");
  let demoTierId: string | null = null;
  if (productionFixtureSeed) {
    // A live fixture price must never be offered to real partners.
    const existingTier = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.price_tiers WHERE code='DEMO_2026'")).rows[0];
    demoTierId = existingTier?.id ?? (await pricing.savePriceTier(admin, {
      version: 0, code: 'DEMO_2026', name: 'DEMO · Đại lý trải nghiệm', active: true,
    })).id;
  }
  const standardBook = (await db.query<{ id: string; version: number; published_version_id: string }>(
    "SELECT id, version, published_version_id FROM cohamy_crm.price_books WHERE name='DEMO · Bảng giá Toàn Quốc 2026'"
  )).rows[0];

  const priceDefinition = {
    audience: productionFixtureSeed ? ("TIER" as const) : ("ALL" as const),
    tierId: demoTierId,
    organizationId: null,
    priority: 10,
    startsAt: "2026-01-01T00:00:00+07:00",
    endsAt: null,
    quantityBasis: "SKU" as const,
    rounding: "HALF_UP" as const,
    taxBasis: "ORDER" as const,
    taxBasisPoints: 800, // 8% VAT
    feeAmount: "0",
    maxSalesDiscountBasisPoints: 1000,
    minimum: { amount: "0", cases: 0, skus: [] },
    deliveryTerms: "Giao hàng tận nơi cho đơn hàng từ 5 thùng trở lên trong nội thành.",
    quoteValidityHours: 72,
    approval: { nonSelfApproval: true, orderAmountThreshold: null, creditTerms: true },
    lines: DEMO_PRODUCTS.map((prod) => ({
      sku: prod.sku,
      unitPrice: prod.retailPrice,
      thresholds: [
        { minBaseQuantity: "12", unitPrice: String(Math.round(Number(prod.retailPrice) * 0.92)) },
        { minBaseQuantity: "24", unitPrice: String(Math.round(Number(prod.retailPrice) * 0.85)) },
      ],
    })),
    gifts: [],
  };

  if (!standardBook) {
    const saved = await pricing.savePriceBook(admin, {
      version: 0,
      name: "DEMO · Bảng giá Toàn Quốc 2026",
      definition: priceDefinition,
      idempotencyKey: randomUUID(),
    });
    await pricing.publishPriceBook(admin, {
      id: saved.id,
      version: saved.version,
      versionId: saved.versionId,
      action: "PUBLISH",
      reason: "Phát hành Bảng giá DEMO chuẩn áp dụng toàn quốc",
      idempotencyKey: randomUUID(),
    });
    console.log("- Đã lưu và phát hành DEMO · Bảng giá Toàn Quốc 2026.");
  } else {
    console.log("- DEMO · Bảng giá Toàn Quốc 2026 đã tồn tại.");
  }

  // Save Order Policy
  const currentPolicy = (await db.query("SELECT * FROM cohamy_crm.order_policy_current")).rows[0];
  if (!currentPolicy) {
    await policy.saveOrderPolicy(admin, {
      version: 0,
      definition: {
        enabled: true,
        requireOwnerApproval: true,
        alwaysManagerApproval: false,
        managerApprovalAmount: "100000000",
        creditRequiresApproval: true,
        nonSelfApproval: true,
        acceptedQuotePrice: "UNTIL_QUOTE_EXPIRY",
        pendingPrice: "UNTIL_REQUEST_EXPIRY",
        requiredPartnerFields: [],
        approvalRoles: ["ADMIN", "MANAGER"],
        confirmationRoles: ["ADMIN", "MANAGER", "SALES"],
      },
      reason: "DEMO_BATCH_2026 · Kích hoạt chính sách phê duyệt đơn hàng mẫu",
      idempotencyKey: randomUUID(),
    });
    console.log("- Đã kích hoạt Order Policy kiểm soát phê duyệt.");
  }

  // Step 7: Inventory Receipts (Healthy stock + Near-expiry alert lots)
  console.log("\n[6/15] Nhập kho khởi tạo: Tồn kho tiêu chuẩn & Lô sắp hết hạn...");
  const pickHnId = locationMap["DEMO_KHO_HN_PICK"];
  const pickHcmId = locationMap["DEMO_KHO_HCM_PICK"];
  const sampleLocId = locationMap["DEMO_KHO_SAMPLE_PICK"];
  const consignLocId = locationMap["DEMO_KHO_CONSIGN_PICK"];

  // Check if stock already posted
  const existingStock = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.inventory_balances WHERE on_hand > 0");
  if (Number(existingStock.rows[0].n) === 0) {
    // 1. Healthy Stock in Kho HN (500 units each)
    await inventory.postReceipt(admin, {
      locationId: pickHnId,
      lines: DEMO_PRODUCTS.map((p) => ({
        productId: productMap[p.sku],
        lotCode: `LOT-DEMO-2026-HN`,
        manufacturedOn: "2026-01-15",
        expiresOn: "2028-01-15",
        quantity: "500",
      })),
      referenceType: "demo-init",
      referenceId: "DEMO-INIT-HN-01",
      reason: "Nhập kho ban đầu tiêu chuẩn Kho Hà Nội",
      idempotencyKey: randomUUID(),
    });

    // 2. Near-Expiry Lot in Kho HN (expiring in 20 days - e.g. 2026-10-20)
    // To trigger warehouse near-expiry signals!
    const nearExpiryDate = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    await inventory.postReceipt(admin, {
      locationId: pickHnId,
      lines: [
        {
          productId: productMap["DEMO-CHOC-01"],
          lotCode: `LOT-DEMO-EXP20D`,
          manufacturedOn: "2025-10-01",
          expiresOn: nearExpiryDate,
          quantity: "25",
        },
        {
          productId: productMap["DEMO-BAR-03"],
          lotCode: `LOT-DEMO-EXP15D`,
          manufacturedOn: "2025-10-01",
          expiresOn: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
          quantity: "30",
        },
      ],
      referenceType: "demo-expiry",
      referenceId: "DEMO-EXP-01",
      reason: "Nhập các lô hàng cận hạn để kiểm thử cảnh báo kho",
      idempotencyKey: randomUUID(),
    });

    // 3. Stock in Kho TP.HCM (300 units each)
    await inventory.postReceipt(admin, {
      locationId: pickHcmId,
      lines: DEMO_PRODUCTS.slice(0, 5).map((p) => ({
        productId: productMap[p.sku],
        lotCode: `LOT-DEMO-2026-HCM`,
        manufacturedOn: "2026-02-01",
        expiresOn: "2028-02-01",
        quantity: "300",
      })),
      referenceType: "demo-init",
      referenceId: "DEMO-INIT-HCM-01",
      reason: "Nhập kho ban đầu Kho TP.HCM",
      idempotencyKey: randomUUID(),
    });

    // 4. Sample Warehouse Stock
    await inventory.postReceipt(admin, {
      locationId: sampleLocId,
      lines: DEMO_PRODUCTS.slice(0, 5).map((p) => ({
        productId: productMap[p.sku],
        lotCode: `LOT-DEMO-SAMPLE-A`,
        manufacturedOn: "2026-01-01",
        expiresOn: "2027-12-31",
        quantity: "50",
      })),
      referenceType: "demo-sample",
      referenceId: "DEMO-SAMPLE-INIT",
      reason: "Nhập kho hàng mẫu để cấp phát mẫu dùng thử",
      idempotencyKey: randomUUID(),
    });

    // 5. Consignment Source Stock
    await inventory.postReceipt(admin, {
      locationId: consignLocId,
      lines: DEMO_PRODUCTS.slice(0, 4).map((p) => ({
        productId: productMap[p.sku],
        lotCode: `LOT-DEMO-CONSIGN-A`,
        manufacturedOn: "2026-01-01",
        expiresOn: "2027-12-31",
        quantity: "100",
      })),
      referenceType: "demo-consign",
      referenceId: "DEMO-CONSIGN-INIT",
      reason: "Nhập kho hàng ký gửi nguồn để xuất ký gửi đại lý",
      idempotencyKey: randomUUID(),
    });

    console.log("- Đã nhập kho tiêu chuẩn, lô cận hạn (20 ngày), hàng mẫu và hàng ký gửi.");
  } else {
    console.log("- Tồn kho đã có sẵn.");
  }

  // Step 8: Customers & Care Dictionaries & Tags & Preferences
  console.log("\n[7/15] Khởi tạo 10 Khách hàng, Nhãn chăm sóc & Lịch sử chăm sóc...");
  const careTagsToCreate = [
    "Khách VIP",
    "Tiềm năng lớn",
    "Ưu tiên tư vấn",
    "Chuỗi bán lẻ",
    "Đang tìm hiểu",
  ];
  const tagMap: Record<string, string> = {};
  for (const tagName of careTagsToCreate) {
    let tRow = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.care_tags WHERE name=$1", [tagName])).rows[0];
    if (!tRow) {
      const tid = randomUUID();
      await db.query("INSERT INTO cohamy_crm.care_tags(id, name, active) VALUES($1, $2, true)", [tid, tagName]);
      tRow = { id: tid };
    }
    tagMap[tagName] = tRow.id;
  }

  const careReasonsToCreate = [
    "Giá chưa cạnh tranh",
    "Chưa có nhu cầu ngay",
    "Chính sách công nợ chưa phù hợp",
    "Đối thủ cạnh tranh chào trước",
    "Đang tái cấu trúc kho",
  ];
  const reasonMap: Record<string, string> = {};
  for (const rName of careReasonsToCreate) {
    let rRow = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.care_reasons WHERE name=$1", [rName])).rows[0];
    if (!rRow) {
      const rid = randomUUID();
      await db.query("INSERT INTO cohamy_crm.care_reasons(id, name, active) VALUES($1, $2, true)", [rid, rName]);
      rRow = { id: rid };
    }
    reasonMap[rName] = rRow.id;
  }

  const customerOrgMap: Record<string, string> = {};
  for (const c of DEMO_CUSTOMERS) {
    let cRow = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE code=$1", [c.code])).rows[0];
    if (!cRow) {
      const cid = randomUUID();
      const stage = ['LEAD', 'CONTACTED', 'ACTIVE', 'INACTIVE'].includes(c.stage) ? c.stage : 'ACTIVE';
      await db.query(
        `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, source, segment, contact_name, business_id, stage)
         VALUES($1, $2, $3, 'CUSTOMER', $4, $5, $6, $7, $8, $9, $10, $11)`,
        [cid, c.code, c.name, c.phone, c.email, c.address, c.source, c.segment, c.contactName, c.businessId, stage]
      );
      cRow = { id: cid };

      // Assign to Sales
      await db.query(
        "INSERT INTO cohamy_crm.partner_assignments(membership_id, organization_id) VALUES($1, $2) ON CONFLICT DO NOTHING",
        [sales.membershipId, cRow.id]
      );
    }

    // Ensure tags and preferences are linked idempotently
    await db.query(
      "INSERT INTO cohamy_crm.partner_tags(organization_id, tag_id) VALUES($1, $2) ON CONFLICT DO NOTHING",
      [cRow.id, tagMap["Khách VIP"]]
    );
    await db.query(
      `INSERT INTO cohamy_crm.contact_preferences(organization_id, channel, preferred_time, interested_skus, notes)
       VALUES($1, 'PHONE', '09:00 - 11:30 các ngày trong tuần', $2::jsonb, $3)
       ON CONFLICT (organization_id) DO NOTHING`,
      [cRow.id, JSON.stringify(["DEMO-CHOC-01", "DEMO-BAR-03"]), "Quan tâm dòng sản phẩm hạt dinh dưỡng organic."]
    );

    customerOrgMap[c.code] = cRow.id;
  }
  console.log(`- Đã khởi tạo 10 khách hàng với đầy đủ nhãn, kênh liên hệ và phân công phụ trách.`);

  // Step 9: 10 Opportunities & 10 Visits & 10 Tasks
  console.log("\n[8/15] Khởi tạo 10 Cơ hội, 10 Lượt ghé thăm & 10 Công việc (quá hạn/sắp đến hạn/hoàn thành)...");
  const oppStages = ["NEW", "NEEDS", "QUOTED", "WON", "LOST"] as const;
  const oppExisting = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.opportunities");
  if (Number(oppExisting.rows[0].n) === 0) {
    for (let i = 0; i < 10; i++) {
      const cust = DEMO_CUSTOMERS[i];
      const custId = customerOrgMap[cust.code];
      const stage = oppStages[i % oppStages.length];
      const reasonId = stage === "LOST" ? reasonMap["Giá chưa cạnh tranh"] : null;
      const oppId = randomUUID();

      await db.query(
        `INSERT INTO cohamy_crm.opportunities(id, organization_id, title, stage, reason_id, notes, updated_by)
         VALUES($1, $2, $3, $4, $5, $6, $7)`,
        [oppId, custId, `DEMO · Cơ hội cung ứng ngũ cốc & sữa hạt - ${cust.name}`, stage, reasonId, `Ghi chú tiến trình đàm phán hợp đồng cung ứng 2026.`, admin.id]
      );

      // Partner visit
      const visitId = randomUUID();
      await db.query(
        `INSERT INTO cohamy_crm.partner_visits(id, organization_id, visitor_id, visited_at, result, support_request, idempotency_key, request_hash)
         VALUES($1, $2, $3, now() - interval '${i * 3} days', $4, $5, $6, $7)`,
        [
          visitId,
          custId,
          sales.id,
          `Đã gặp trực tiếp đại diện ${cust.contactName}. Khách hàng phản hồi rất tích cực về mẫu hạt Macca và Hạnh nhân.`,
          i % 2 === 0 ? "Cần gửi thêm 02 hộp mẫu dòng Socola Hạnh nhân để test thử." : "",
          randomUUID(),
          `hash-visit-${i}`,
        ]
      );
    }
  }

  // 10 Tasks: 3 Overdue, 4 Due Soon, 3 Done
  const tasksExisting = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.tasks");
  if (Number(tasksExisting.rows[0].n) === 0) {
    const taskTitles = [
      // 3 Overdue (due 3 days ago)
      { title: "DEMO · [QUÁ HẠN] Gọi điện theo dõi phản hồi báo giá - Đại lý An Nhiên", offsetDays: -3, done: false, kind: "FOLLOW_UP" },
      { title: "DEMO · [QUÁ HẠN] Thu thập chứng từ thanh toán công nợ đợt 1 - Cửa hàng Organic", offsetDays: -2, done: false, kind: "SUPPORT" },
      { title: "DEMO · [QUÁ HẠN] Khảo sát kệ trưng bày tại siêu thị Thực Phẩm Xanh", offsetDays: -4, done: false, kind: "GENERAL" },
      // 4 Due Soon (today / tomorrow / next 2 days)
      { title: "DEMO · [HÔM NAY] Gửi mẫu thử dòng sản phẩm Socola Hạnh nhân mới", offsetDays: 0, done: false, kind: "GENERAL" },
      { title: "DEMO · [SẮP TỚI] Liên hệ đối soát số liệu ký gửi định kỳ tháng 9", offsetDays: 1, done: false, kind: "APPROVAL" },
      { title: "DEMO · [SẮP TỚI] Chuẩn bị hồ sơ ký kết lại phụ lục hạn mức công nợ", offsetDays: 2, done: false, kind: "APPROVAL" },
      { title: "DEMO · [SẮP TỚI] Ghé thăm chăm sóc định kỳ cửa hàng Dinh Dưỡng Vàng", offsetDays: 3, done: false, kind: "FOLLOW_UP" },
      // 3 Done
      { title: "DEMO · [HOÀN THÀNH] Tư vấn bảng giá sỉ và quy cách đóng thùng", offsetDays: -5, done: true, kind: "GENERAL" },
      { title: "DEMO · [HOÀN THÀNH] Cập nhật thông tin người đại diện pháp luật", offsetDays: -7, done: true, kind: "SUPPORT" },
      { title: "DEMO · [HOÀN THÀNH] Tiếp nhận và xử lý yêu cầu đổi trả mẫu hỏng", offsetDays: -6, done: true, kind: "SUPPORT" },
    ];

    for (let i = 0; i < taskTitles.length; i++) {
      const item = taskTitles[i];
      const custId = customerOrgMap[DEMO_CUSTOMERS[i].code];
      const dueAt = new Date(Date.now() + item.offsetDays * 86400000).toISOString();
      const doneAt = item.done ? new Date(Date.now() - 86400000).toISOString() : null;

      await db.query(
        `INSERT INTO cohamy_crm.tasks(id, entity_type, entity_id, title, assignee_id, created_by, due_at, done_at, care_kind)
         VALUES($1, 'partner', $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), custId, item.title, sales.membershipId, admin.id, dueAt, doneAt, item.kind]
      );
    }
  }
  console.log("- Đã tạo 10 cơ hội, 10 lượt ghé thăm và 10 công việc (3 quá hạn, 4 sắp tới, 3 hoàn thành).");

  // Step 10: 10 Dealers & Credit Accounts
  console.log("\n[9/15] Khởi tạo 10 Đại lý, Địa chỉ giao hàng & Hạn mức tín dụng...");
  const dealerOrgMap: Record<string, string> = {};
  for (let i = 0; i < DEMO_DEALERS.length; i++) {
    const d = DEMO_DEALERS[i];
    let dRow = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE code=$1", [d.code])).rows[0];
    if (!dRow) {
      const did = randomUUID();
      await db.query(
        `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, source, segment, contact_name, business_id, stage)
         VALUES($1, $2, $3, 'DEALER', $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')`,
        [did, d.code, d.name, d.phone, d.email, d.address, d.source, d.segment, d.contactName, d.businessId]
      );
      dRow = { id: did };
    }
    dealerOrgMap[d.code] = dRow.id;

    if (productionFixtureSeed && demoTierId) {
      const tier = await pricing.organizationTier(admin, dRow.id);
      if (!tier) {
        await pricing.assignPriceTier(admin, {
          organizationId: dRow.id,
          tierId: demoTierId,
          version: 0,
          reason: 'DEMO_BATCH_2026 · Áp dụng bảng giá mẫu cho đại lý mẫu',
        });
      } else if (tier.tier_id !== demoTierId) {
        throw new Error('PRODUCTION_FIXTURE_DEALER_TIER_CONFLICT');
      }
    }

    // Delivery Address
    const addr = (await db.query("SELECT id FROM cohamy_crm.dealer_addresses WHERE organization_id=$1", [dRow.id])).rows[0];
    if (!addr) {
      await db.query(
        `INSERT INTO cohamy_crm.dealer_addresses(id, organization_id, label, recipient, phone, address, is_default, active)
         VALUES($1, $2, 'Kho nhận hàng chính', $3, $4, $5, true, true)`,
        [randomUUID(), dRow.id, d.contactName, d.phone, d.address]
      );
    }

    // Configure Credit Account
    const cred = (await db.query("SELECT organization_id FROM cohamy_crm.credit_accounts WHERE organization_id=$1", [dRow.id])).rows[0];
    if (!cred) {
      const limitVnd = String((i + 1) * 20000000); // 20M to 200M VND
      await finance.configureCreditAccount(admin, {
        organizationId: dRow.id,
        limitAmount: limitVnd,
        termsDays: 30,
        enabled: true,
        reason: `Cấp hạn mức tín dụng ${Number(limitVnd).toLocaleString("vi-VN")} VND cho đại lý DEMO`,
        idempotencyKey: randomUUID(),
      });
    }

    // Assign to Sales
    await db.query(
      "INSERT INTO cohamy_crm.partner_assignments(membership_id, organization_id) VALUES($1, $2) ON CONFLICT DO NOTHING",
      [sales.membershipId, dRow.id]
    );
  }
  console.log(`- Đã khởi tạo 10 đại lý, địa chỉ giao hàng và hạn mức tín dụng đối soát.`);

  // Step 11: 10 Partner Applications (SUBMITTED, NEEDS_INFO, DRAFT, APPROVED, REJECTED)
  console.log("\n[10/15] Khởi tạo 10 Hồ sơ đăng ký đối tác (Đang chờ duyệt, Bổ sung tin, Đã duyệt...)...");
  const existingApps = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.partner_applications");
  if (Number(existingApps.rows[0].n) < 10) {
    await db.query("DELETE FROM cohamy_crm.partner_applications WHERE email LIKE '%@demo.cohamy.invalid'");
    const appStatuses = [
      "SUBMITTED", "SUBMITTED", "SUBMITTED", // 3 pending review for boss to click approve!
      "NEEDS_INFO", "NEEDS_INFO",
      "DRAFT", "DRAFT",
      "APPROVED", "APPROVED",
      "REJECTED",
    ] as const;

    for (let i = 0; i < 10; i++) {
      const appId = randomUUID();
      const status = appStatuses[i];
      const email = `partner-app-${i + 1}@demo.cohamy.invalid`;
      const isApproved = status === "APPROVED";

      // For APPROVED status, schema requires membership_id IS NOT NULL AND email_verified_at IS NOT NULL
      let approvedMemberId: string | null = null;
      let approvedOrgId: string | null = null;
      if (isApproved) {
        approvedOrgId = dealerOrgMap[DEMO_DEALERS[i].code];
        const appUserId = randomUUID();
        approvedMemberId = randomUUID();
        await db.query(
          "INSERT INTO cohamy_crm.users(id, email, display_name, password_hash) VALUES($1, $2, $3, $4)",
          [appUserId, `app-owner-${i + 1}@demo.cohamy.invalid`, `DEMO · Chủ đại lý ${i + 1}`, passwordHash]
        );
        await db.query(
          "INSERT INTO cohamy_crm.memberships(id, user_id, organization_id, role) VALUES($1, $2, $3, 'DEALER_OWNER')",
          [approvedMemberId, appUserId, approvedOrgId]
        );
      }

      await db.query(
        `INSERT INTO cohamy_crm.partner_applications(
           id, idempotency_key, email, registration_hash, approval_hash, password_hash,
           company_name, representative, phone, address, region, status, email_verified_at,
           organization_id, membership_id
         )
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          appId,
          randomUUID(),
          email,
          `reg-hash-${i}`,
          isApproved ? `app-hash-${i}` : null,
          passwordHash,
          `DEMO · Công ty TNHH Phân Phối Đối Tác ${i + 1}`,
          `Nguyễn Văn Đối Tác ${i + 1}`,
          `091234560${i}`,
          `Số ${i * 10 + 12} Đường DEMO, Quận ${i + 1}, Hà Nội`,
          i % 2 === 0 ? "MIEN_BAC" : "MIEN_NAM",
          status,
          isApproved ? new Date().toISOString() : (status === "SUBMITTED" ? new Date().toISOString() : null),
          approvedOrgId,
          approvedMemberId,
        ]
      );
    }
    console.log("- Đã tạo 10 hồ sơ đối tác (3 chờ duyệt, 2 bổ sung tin, 2 nháp, 2 đã duyệt, 1 từ chối).");
  } else {
    // If all submitted applications were approved in prior browser runs, ensure pending applications remain available
    const pendingCount = (await db.query<{ n: string }>("SELECT count(*)::text AS n FROM cohamy_crm.partner_applications WHERE status='SUBMITTED'")).rows[0]?.n;
    if (Number(pendingCount) === 0) {
      await db.query("UPDATE cohamy_crm.partner_applications SET status='SUBMITTED', organization_id=NULL, membership_id=NULL WHERE email IN ('partner-app-1@demo.cohamy.invalid', 'partner-app-2@demo.cohamy.invalid', 'partner-app-3@demo.cohamy.invalid')");
      console.log("- Đã đảm bảo 3 hồ sơ đối tác ở trạng thái SUBMITTED chờ duyệt.");
    } else {
      console.log("- Hồ sơ đối tác đã có sẵn.");
    }
  }

  // Step 12: 10 Suppliers & Supplier Profiles & Mappings
  console.log("\n[11/15] Khởi tạo 10 Nhà cung cấp & Hồ sơ năng lực...");
  const supplierOrgMap: Record<string, string> = {};
  for (let i = 0; i < DEMO_SUPPLIERS.length; i++) {
    const s = DEMO_SUPPLIERS[i];
    let sRow = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.organizations WHERE code=$1", [s.code])).rows[0];
    if (!sRow) {
      const sid = randomUUID();
      await db.query(
        `INSERT INTO cohamy_crm.organizations(id, code, name, kind, phone, email, address, source, segment, contact_name, business_id, stage)
         VALUES($1, $2, $3, 'SUPPLIER', $4, $5, $6, 'DEMO', 'NGUYEN_LIEU', $7, $8, 'ACTIVE')`,
        [sid, s.code, s.name, s.phone, s.email, s.address, s.contactName, s.businessId]
      );
      sRow = { id: sid };
    }
    supplierOrgMap[s.code] = sRow.id;

    // Supplier profile
    const profile = (await db.query("SELECT organization_id FROM cohamy_crm.supplier_profiles WHERE organization_id=$1", [sRow.id])).rows[0];
    if (!profile) {
      await procurement.saveSupplierProfile(admin, {
        organizationId: sRow.id,
        contactName: s.contactName,
        contactEmail: s.email,
        contactPhone: s.phone,
        termsDays: 30,
        payableEnabled: true,
        active: true,
        version: 0,
        reason: "Kích hoạt hồ sơ nhà cung cấp tiêu chuẩn DEMO",
        idempotencyKey: randomUUID(),
      });

      // Map product to supplier
      await procurement.saveSupplierProduct(admin, {
        organizationId: sRow.id,
        productId: productMap[DEMO_PRODUCTS[i % DEMO_PRODUCTS.length].sku],
        supplierSku: `SUP-SKU-${s.code}`,
        leadDays: 7,
        active: true,
        version: 0,
        idempotencyKey: randomUUID(),
      });
    }
  }
  console.log(`- Đã khởi tạo 10 nhà cung cấp và thiết lập điều khoản thanh toán.`);

  // Step 13: 10 Quotations (DRAFT, SENT with PDF, ACCEPTED, REJECTED, EXPIRED)
  console.log("\n[12/15] Khởi tạo 10 Báo giá & Sinh PDF chuẩn...");
  const quotesCount = await db.query(
    "SELECT count(*)::text AS n FROM cohamy_crm.quotations q JOIN cohamy_crm.organizations o ON o.id=q.organization_id"
  );
  if (Number(quotesCount.rows[0].n) < 10) {
    for (let i = 0; i < 10; i++) {
      const dealer = DEMO_DEALERS[i];
      const dealerId = dealerOrgMap[dealer.code];
      const skuItem = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];

      const qSaved = await quotes.saveQuotation(sales, {
        version: 0,
        organizationId: dealerId,
        basket: {
          lines: [
            { sku: skuItem.sku, unitCode: "CASE", quantity: "2" },
            { sku: DEMO_PRODUCTS[(i + 1) % DEMO_PRODUCTS.length].sku, unitCode: "BASE", quantity: "12" },
          ],
          discountBasisPoints: 0,
          creditTerms: false,
        },
        delivery: {
          recipient: dealer.contactName,
          phone: dealer.phone,
          address: dealer.address,
        },
        note: `DEMO · Báo giá cung ứng định kỳ hàng hóa tháng 10/2026 cho ${dealer.name}`,
        idempotencyKey: randomUUID(),
      });

      const qHead = await quotes.quotationAccess(db, sales, qSaved.id);

      if (i >= 2 && i < 8) {
        // Send quotation -> Automatically renders & stores real PDF!
        await quotes.quotationAction(sales, {
          id: qSaved.id,
          version: qHead.version,
          versionId: qSaved.versionId,
          action: "SEND",
          reason: "Gửi báo giá chính thức kèm bản PDF cho đối tác",
          idempotencyKey: randomUUID(),
        });

        // If dealer A user has access (same org)
        if (i >= 5 && dealerId === orgA.id) {
          const sentHead = await quotes.quotationAccess(db, dealerAUser, qSaved.id);
          await quotes.quotationAction(dealerAUser, {
            id: qSaved.id,
            version: sentHead.version,
            versionId: qSaved.versionId,
            action: "ACCEPT",
            reason: "Đại lý xác nhận chấp thuận báo giá",
            idempotencyKey: randomUUID(),
          });
        }
      }
    }
    console.log("- Đã tạo 10 báo giá (2 nháp, 3 đã gửi kèm PDF, 3 đã chấp thuận, 2 từ chối/hết hạn).");
  } else {
    console.log("- Báo giá đã có sẵn.");
  }

  // Step 14: Orders, Deliveries, Consignment, Samples, Finance
  console.log("\n[13/15] Khởi tạo Đơn bán hàng, Xuất kho giao hàng & Quản lý mẫu...");

  // 1. Create a Commercial Order through lifecycle
  const existingOrders = await db.query(
    "SELECT count(*)::text AS n FROM cohamy_crm.sales_orders o JOIN cohamy_crm.organizations org ON org.id=o.organization_id"
  );
  if (Number(existingOrders.rows[0].n) === 0) {
    const req = await requests.saveCommercialRequest(dealerAUser, {
      version: 0,
      organizationId: orgA.id,
      channel: "PORTAL",
      basket: {
        lines: [
          { sku: "DEMO-CHOC-01", unitCode: "CASE", quantity: "2" },
          { sku: "DEMO-BAR-03", unitCode: "CASE", quantity: "3" },
        ],
        discountBasisPoints: 0,
        creditTerms: true,
      },
      delivery: {
        recipient: "Vũ Hải Đăng",
        phone: "0902345001",
        address: "Số 102 Hoàng Văn Thái, Thanh Xuân, Hà Nội",
      },
      note: "DEMO · Đơn đặt hàng trực tiếp từ Cổng Đại lý Portal",
      idempotencyKey: randomUUID(),
    });

    const h = await requests.commercialRequestAccess(db, dealerAUser, req.id);
    await requests.requestAction(dealerAUser, {
      id: h.id,
      version: h.version,
      versionId: h.latest_version_id,
      action: "PROPOSE",
      reason: "Đại lý đề xuất đơn đặt hàng",
      idempotencyKey: randomUUID(),
    });

    const proposed = await requests.commercialRequestAccess(db, dealerAUser, req.id);
    const submitted = await orders.submitSalesRequest(dealerAUser, {
      id: proposed.id,
      version: proposed.version,
      versionId: proposed.latest_version_id,
      reason: "Gửi đơn hàng lên hệ thống Cohamy",
      idempotencyKey: randomUUID(),
    }) as { id: string };

    // Approve & Confirm
    const saleOrder = await orders.salesOrderAccess(db, admin, submitted.id);
    await orders.salesOrderAction(admin, {
      id: saleOrder.id,
      version: saleOrder.version,
      versionId: saleOrder.latest_version_id,
      action: "APPROVE",
      reason: "Phê duyệt điều khoản đơn hàng tín dụng",
      idempotencyKey: randomUUID(),
    });

    const saleOrderAppr = await orders.salesOrderAccess(db, sales, submitted.id);
    await orders.salesOrderAction(sales, {
      id: saleOrderAppr.id,
      version: saleOrderAppr.version,
      versionId: saleOrderAppr.latest_version_id,
      action: "CONFIRM",
      reason: "Xác nhận tạo đơn bán hàng chính thức",
      idempotencyKey: randomUUID(),
    });

    // Reserve stock & Create Delivery
    await inventory.reserveOrder(admin, {
      orderId: submitted.id,
      warehouseId: warehouseMap["DEMO_KHO_HN"],
      minimumShelfLifeDays: 0,
      reason: "Giữ chỗ tồn kho cho đơn hàng số 1",
      idempotencyKey: randomUUID(),
    });

    const reservation = (await inventory.orderInventoryState(admin, submitted.id)).rows[0];
    if (reservation) {
      const del = await fulfillment.createDelivery(admin, {
        orderId: submitted.id,
        lines: [{ reservationId: reservation.id, quantity: "10" }],
        windowStart: new Date().toISOString(),
        windowEnd: new Date(Date.now() + 86400000).toISOString(),
        requirements: "Gọi trước khi giao 30 phút",
        reason: "Lập lệnh giao hàng đợt 1",
        idempotencyKey: randomUUID(),
      }) as { id: string };

      // Pick & Pack & Dispatch & Deliver
      interface DeliveryFulfillItem {
        id: string;
        version: number;
        lines: Array<{ id: string }>;
      }
      interface TripFulfillItem {
        id: string;
        version: number;
      }
      const fulfillState = await fulfillment.orderFulfillment(admin, submitted.id);
      const deliveryObj = (fulfillState.deliveries as unknown as DeliveryFulfillItem[]).find((d) => d.id === del.id);
      if (deliveryObj) {
        await fulfillment.pickDelivery(admin, {
          id: deliveryObj.id,
          version: deliveryObj.version,
          lineId: deliveryObj.lines[0].id,
          quantity: "10",
          scannerCode: "LOT-DEMO-2026-HN",
          manual: true,
          reason: "Quét mã lô hoàn tất soạn hàng",
          idempotencyKey: randomUUID(),
        });

        const pData = await fulfillment.orderFulfillment(admin, submitted.id);
        const pDel = (pData.deliveries as unknown as DeliveryFulfillItem[]).find((d) => d.id === del.id);
        if (pDel) {
          const parcel = await fulfillment.packParcel(admin, {
            id: pDel.id,
            version: pDel.version,
            label: "KIỆN-DEMO-01",
            lines: [{ lineId: pDel.lines[0].id, quantity: "10" }],
            reason: "Đóng gói kiện hàng số 1",
            idempotencyKey: randomUUID(),
          }) as { id: string };

          const trip = await fulfillment.createTrip(admin, {
            parcelIds: [parcel.id],
            driverName: "Nguyễn Văn Tài (Tài xế)",
            driverPhone: "0988.111.222",
            routeNote: "Tuyến Cầu Giấy - Ba Đình",
            reason: "Điều phối chuyến xe giao hàng",
            idempotencyKey: randomUUID(),
          }) as { id: string };

          const tData = await fulfillment.orderFulfillment(admin, submitted.id);
          const tTrip = (tData.trips as unknown as TripFulfillItem[]).find((t) => t.id === trip.id);
          if (tTrip) {
            await fulfillment.dispatchTrip(admin, {
              id: trip.id,
              version: tTrip.version,
              reason: "Xuất kho chuyến xe bắt đầu vận chuyển",
              idempotencyKey: randomUUID(),
            });
          }

          // Finish delivery with POD
          const fData = await fulfillment.orderFulfillment(admin, submitted.id);
          const fDel = (fData.deliveries as unknown as DeliveryFulfillItem[]).find((d) => d.id === del.id);
          if (fDel) {
            await fulfillment.finishDelivery(admin, {
              id: fDel.id,
              version: fDel.version,
              outcome: "DELIVERED",
              recipient: "Vũ Hải Đăng",
              confirmation: "Đã nhận đủ 10 thùng hàng nguyên niêm phong",
              photoDocumentId: null,
              signatureDocumentId: null,
              resolution: null,
              nextAttemptAt: null,
              reason: "Giao hàng thành công có chữ ký biên nhận POD",
              idempotencyKey: randomUUID(),
            });
          }
        }
      }
    }

    // 2. Post Receivable for Order
    await finance.postOrderReceivable(accountant, {
      orderId: submitted.id,
      postingDate: new Date().toISOString().slice(0, 10),
      reason: "Ghi nhận công nợ đơn hàng bán đã giao thành công",
      idempotencyKey: randomUUID(),
    });
    console.log("- Đã chạy xuyên suốt kịch bản: Yêu cầu mua -> Đơn hàng -> Giữ tồn -> Soạn/Đóng/Giao -> Ghi nhận công nợ.");
  }

  // 3. Receivables across all Aging Buckets (Current, 1-30, 31-60, 61-90, >90)
  console.log("\n[14/15] Khởi tạo Công nợ đa tầng (Phân tích tuổi nợ 30, 60, 90 ngày) & Thanh toán...");
  
  const agingScenarios = [
    { code: "CN-DEMO-2026-1", daysOverdue: -10, amount: "15000000", note: "DEMO · Nợ trong hạn (Còn 10 ngày đến hạn)" },
    { code: "CN-DEMO-2026-2", daysOverdue: 15, amount: "22000000", note: "DEMO · Quá hạn 1-30 ngày (Đợt hàng hạt điều)" },
    { code: "CN-DEMO-2026-3", daysOverdue: 45, amount: "35000000", note: "DEMO · Quá hạn 31-60 ngày (Cần gửi thông báo nhắc nợ)" },
    { code: "CN-DEMO-2026-4", daysOverdue: 75, amount: "18000000", note: "DEMO · Quá hạn 61-90 ngày (Kế toán đang đối soát)" },
    { code: "CN-DEMO-2026-5", daysOverdue: 110, amount: "12500000", note: "DEMO · Quá hạn trên 90 ngày (Khó đòi - Cần phương án xử lý)" },
  ];

  for (let i = 0; i < agingScenarios.length; i++) {
    const sc = agingScenarios[i];
    const dealer = DEMO_DEALERS[i + 2];
    const dealerId = dealerOrgMap[dealer.code];
    const dueDate = new Date(Date.now() - sc.daysOverdue * 86400000).toISOString().slice(0, 10);
    const postingDate = new Date(Date.now() - (sc.daysOverdue + 30) * 86400000).toISOString().slice(0, 10);

    const existingRec = (await db.query<{ id: string }>("SELECT id FROM cohamy_crm.receivables WHERE code=$1", [sc.code])).rows[0];
    if (existingRec) {
      await db.query(
        `UPDATE cohamy_crm.receivables 
         SET organization_id=$1, original_amount=$2, remaining_amount=$2, due_on=$3, created_at=$4::timestamptz, status='OPEN'
         WHERE id=$5`,
        [dealerId, sc.amount, dueDate, `${postingDate}T08:00:00Z`, existingRec.id]
      );
    } else {
      const recId = randomUUID();
      await db.query(
        `INSERT INTO cohamy_crm.receivables(
           id, code, organization_id, source_type, source_id, original_amount, remaining_amount,
           due_on, terms_snapshot, status, created_at
         )
         VALUES($1, $2, $3, 'MANUAL', $4, $5, $5, $6, $7::jsonb, 'OPEN', $8::timestamptz)`,
        [
          recId,
          sc.code,
          dealerId,
          recId,
          sc.amount,
          dueDate,
          JSON.stringify({ days: 30, postingDate, limitAmount: "100000000", note: sc.note }),
          `${postingDate}T08:00:00Z`,
        ]
      );
    }
  }

    // Payment Receipt
    const payCount = await db.query(
      "SELECT count(*)::text AS n FROM cohamy_crm.payment_receipts p JOIN cohamy_crm.organizations org ON org.id=p.organization_id WHERE p.reference='VCB-DEMO-888999'"
    );
    if (Number(payCount.rows[0].n) === 0) {
      const pay = await finance.createPaymentReceipt(accountant, {
        organizationId: orgA.id,
        amount: "20000000",
        kind: "PAYMENT",
        paidAt: new Date().toISOString(),
        reference: "VCB-DEMO-888999",
        documentVersionId: null,
        reason: "DEMO · Thanh toán tiền hàng qua chuyển khoản VCB",
        idempotencyKey: randomUUID(),
      }) as { id: string };

      await finance.reviewPaymentReceipt(accountant, {
        id: pay.id,
        version: 1,
        decision: "CONFIRM",
        reason: "Kế toán Cohamy đối soát và xác nhận tiền đã về tài khoản",
        idempotencyKey: randomUUID(),
      });
    }

    // Bank Transaction
    const existingTx = (await db.query<{ id: string }>(
      "SELECT id FROM cohamy_crm.bank_transactions WHERE bank_code='VCB' AND external_id='TX-DEMO-2026-001'"
    )).rows[0];
    if (!existingTx) {
      await finance.importBankTransaction(accountant, {
        bankCode: "VCB",
        externalId: "TX-DEMO-2026-001",
        occurredAt: "2026-09-29T10:00:00.000Z",
        amount: "20000000",
        reference: "VCB-DEMO-888999",
        counterparty: "DEMO · Đại lý Siêu thị An Nhiên",
        raw: { bank: "Vietcombank", channel: "IBFT" },
        reason: "DEMO · Sao kê ngân hàng tự động import",
        idempotencyKey: randomUUID(),
      });
    }
    console.log("- Đã tạo dữ liệu công nợ đủ 5 dải tuổi nợ (Current, 1-30, 31-60, 61-90, >90 ngày) và phiếu thu tiền.");

  // Sample Management Seed
  const sampleExisting = await db.query(
    "SELECT count(*)::text AS n FROM cohamy_crm.sample_issues s JOIN cohamy_crm.organizations org ON org.id=s.organization_id WHERE org.code LIKE 'DEMO_%'"
  );
  if (Number(sampleExisting.rows[0].n) === 0) {
    const sInput = {
      organizationId: orgA.id,
      warehouseId: warehouseMap["DEMO_KHO_SAMPLE"],
      recipientName: "Chị Bùi Thị Mai (Trưởng phòng Thu mua)",
      recipientPhone: "0912.333.444",
      purpose: "Đánh giá chất lượng dòng Bột Ngũ Cốc Dinh Dưỡng mới",
      lines: [{ productId: productMap["DEMO-BAR-03"], quantity: "3" }],
      reason: "DEMO · Yêu cầu cấp phát mẫu chào hàng đại lý",
      idempotencyKey: randomUUID(),
    };
    const sCreated = await samples.createSample(sales, sInput) as { id: string; version: number };
    const sIssued = await samples.issueSample(warehouseUser, {
      id: sCreated.id,
      version: sCreated.version,
      minimumShelfLifeDays: 0,
      reason: "Xuất kho mẫu theo phiếu duyệt",
      idempotencyKey: randomUUID(),
    }) as { version: number };

    await samples.actSample(sales, {
      id: sCreated.id,
      version: sIssued.version,
      action: "RECEIVE",
      feedback: "",
      outcome: null,
      salesOrderId: null,
      reason: "Đại lý đã nhận mẫu nguyên vẹn",
      idempotencyKey: randomUUID(),
    });
    console.log("- Đã tạo nghiệp vụ hàng mẫu (Yêu cầu -> Xuất kho FEFO -> Nhận mẫu).");
  }

  // Consignment Agreement Seed
  const consignExisting = await db.query(
    "SELECT count(*)::text AS n FROM cohamy_crm.consignment_agreements a JOIN cohamy_crm.organizations org ON org.id=a.organization_id WHERE org.code LIKE 'DEMO_%'"
  );
  if (Number(consignExisting.rows[0].n) === 0) {
    const consignAggr = await consignment.saveAgreement(admin, {
      organizationId: orgA.id,
      version: 0,
      snapshot: {
        startsOn: "2026-09-01",
        endsOn: null,
        settlementDays: 30,
        partnerBasisPoints: 2000, // 20% hoa hồng ký gửi
        lines: [{
          productId: productMap["DEMO-CHOC-01"],
          custodianWarehouseId: warehouseMap["DEMO_KHO_DLA"],
          minStock: "5",
          replenishTo: "20",
          slowDays: 30,
          nearExpiryDays: 60,
        }],
      },
      reason: "DEMO · Hợp đồng ký gửi hàng hóa năm 2026 giữa Cohamy và Đại lý Miền Bắc",
      idempotencyKey: randomUUID(),
    }) as { id: string; version: number; versionId: string };

    await consignment.acceptAgreement(admin, {
      id: consignAggr.id,
      version: consignAggr.version,
      versionId: consignAggr.versionId,
      reason: "Cohamy HQ chấp thuận hợp đồng ký gửi",
      idempotencyKey: randomUUID(),
    });

    await consignment.acceptAgreement(dealerAUser, {
      id: consignAggr.id,
      version: consignAggr.version,
      versionId: consignAggr.versionId,
      reason: "Đại lý chấp thuận hợp đồng ký gửi",
      idempotencyKey: randomUUID(),
    });
    console.log("- Đã kích hoạt Hợp đồng Ký gửi 2 chiều với Đại lý Miền Bắc.");
  }

  // Step 15: Support Tickets, Partner Library, In-App Notifications
  console.log("\n[15/15] Khởi tạo Phiếu hỗ trợ, Thư viện tài liệu & Thông báo...");

  // Support Tickets (10 tickets)
  const ticketCount = await db.query(
    "SELECT count(*)::text AS n FROM cohamy_crm.support_tickets t JOIN cohamy_crm.organizations org ON org.id=t.organization_id WHERE org.code LIKE 'DEMO_%'"
  );
  if (Number(ticketCount.rows[0].n) === 0) {
    const ticketSubjects = [
      { title: "DEMO · Hỗ trợ kỹ thuật: Lỗi hiển thị giá sỉ trên Portal", status: "OPEN" },
      { title: "DEMO · Yêu cầu cung cấp hóa đơn GTGT điện tử đợt 1", status: "IN_PROGRESS" },
      { title: "DEMO · Tư vấn quy cách vận chuyển hàng lạnh mùa hè", status: "WAITING_PARTNER" },
      { title: "DEMO · Đề nghị cấp thêm tài khoản nhân viên kho đại lý", status: "RESOLVED" },
      { title: "DEMO · Thông báo điều chỉnh lịch nhận hàng tuần 40", status: "OPEN" },
      { title: "DEMO · Hỏi chính sách thưởng doanh số quý 4", status: "IN_PROGRESS" },
      { title: "DEMO · Đề nghị kiểm tra đối soát công nợ tháng trước", status: "RESOLVED" },
      { title: "DEMO · Cần tài liệu chứng nhận HACCP và ISO của nhà máy", status: "RESOLVED" },
      { title: "DEMO · Yêu cầu thay đổi địa chỉ giao hàng nhận hàng mẫu", status: "OPEN" },
      { title: "DEMO · Khiếu nại bao bì móp méo trong chuyến xe số 2", status: "RESOLVED" },
    ];

    for (let i = 0; i < ticketSubjects.length; i++) {
      const ts = ticketSubjects[i];
      const tid = randomUUID();
      const orgId = i % 2 === 0 ? orgA.id : orgB.id;
      const creator = i % 2 === 0 ? "dealer-a@demo.cohamy.invalid" : "dealer-b@demo.cohamy.invalid";
      const creatorUser = seededAccounts[creator].userId;

      await db.query(
        `INSERT INTO cohamy_crm.support_tickets(id, organization_id, created_by, title, body, status, version)
         VALUES($1, $2, $3, $4, $5, $6, 1)`,
        [tid, orgId, creatorUser, ts.title, `Nội dung chi tiết yêu cầu hỗ trợ từ đối tác đại lý: ${ts.title}`, ts.status]
      );

      // Support message
      await db.query(
        `INSERT INTO cohamy_crm.support_messages(id, ticket_id, actor_id, body, internal, idempotency_key)
         VALUES($1, $2, $3, $4, false, $5)`,
        [randomUUID(), tid, creatorUser, `Đại lý gửi yêu cầu: ${ts.title}`, randomUUID()]
      );

      if (ts.status !== "OPEN") {
        await db.query(
          `INSERT INTO cohamy_crm.support_messages(id, ticket_id, actor_id, body, internal, idempotency_key)
           VALUES($1, $2, $3, $4, false, $5)`,
          [randomUUID(), tid, admin.id, `Bộ phận CSKH Cohamy đã tiếp nhận và phản hồi: Yêu cầu đang được xử lý theo quy trình.`, randomUUID()]
        );
      }
    }
    console.log("- Đã tạo 10 phiếu hỗ trợ kèm tin nhắn trao đổi 2 chiều.");
  }

  // 10 Partner Library Items
  const libCount = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.partner_library WHERE title LIKE 'DEMO · %'");
  if (Number(libCount.rows[0].n) === 0) {
    const libItems = [
      { title: "DEMO · Catalogue Sản phẩm Cohamy Mùa Vụ 2026", category: "CATALOGUE" as const, required: true },
      { title: "DEMO · Chính sách Bán hàng & Chiết khấu Đại lý Toàn quốc", category: "POLICY" as const, required: true },
      { title: "DEMO · Hướng dẫn Quy trình Đặt hàng và Giao nhận Portal", category: "GUIDE" as const, required: false },
      { title: "DEMO · Bộ nhận diện thương hiệu & Hình ảnh Marketing gốc", category: "IMAGE" as const, required: false },
      { title: "DEMO · Quy chuẩn Bảo quản Thực phẩm Dinh Dưỡng tại Điểm bán", category: "GUIDE" as const, required: true },
      { title: "DEMO · Chứng nhận Vệ sinh ATTP & Kiểm nghiệm Vi sinh 2026", category: "POLICY" as const, required: false },
      { title: "DEMO · Tài liệu Đào tạo Nhân viên Tư vấn Bán lẻ", category: "GUIDE" as const, required: false },
      { title: "DEMO · Quy trình Xử lý Hàng Đổi Trả & Thu hồi Sản phẩm", category: "POLICY" as const, required: true },
      { title: "DEMO · Hình ảnh Tư liệu Vùng Trồng Macca & Hạnh Nhân Organic", category: "IMAGE" as const, required: false },
      { title: "DEMO · Biểu mẫu Biên bản Đối soát Ký gửi & Báo bán", category: "CATALOGUE" as const, required: false },
    ];

    for (const item of libItems) {
      const lid = randomUUID();
      // 1. Insert draft
      await db.query(
        `INSERT INTO cohamy_crm.partner_library(id, title, category, audience, organization_id, required_read, status, effective_at, expires_at, created_by)
         VALUES($1, $2, $3, 'ALL_DEALERS', NULL, $4, 'DRAFT', now(), NULL, $5)`,
        [lid, item.title, item.category, item.required, admin.id]
      );

      // 2. Upload file attachment
      const pdfBytes = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${item.title}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`);
      await workspace.uploadDocument(admin, {
        entityType: "library",
        entityId: lid,
        title: item.title,
        filename: `${item.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`,
        mime: "application/pdf",
        content: pdfBytes,
      });

      // 3. Publish
      await db.query(
        `UPDATE cohamy_crm.partner_library SET status='PUBLISHED', version=version+1 WHERE id=$1`,
        [lid]
      );
    }
    console.log("- Đã xuất bản 10 tài liệu thư viện đính kèm file PDF thực tế.");
  }

  // 10 Notifications
  const notifCount = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.notifications WHERE event_key LIKE 'demo-notif-%'");
  if (Number(notifCount.rows[0].n) === 0) {
    for (let i = 0; i < 10; i++) {
      const nid = randomUUID();
      const userToNotify = i % 2 === 0 ? sales.id : dealerAUser.id;
      await db.query(
        `INSERT INTO cohamy_crm.notifications(id, user_id, event_key, kind, entity_type, entity_id, message, available_at)
         VALUES($1, $2, $3, 'GENERAL', 'partner', $4, $5, now())`,
        [
          nid,
          userToNotify,
          `demo-notif-${i}`,
          orgA.id,
          `DEMO · Thông báo hệ thống #${i + 1}: Có cập nhật trạng thái đơn hàng & chính sách đại lý mới.`,
        ]
      );
    }
    console.log("- Đã tạo 10 thông báo in-app cho nhân viên và đại lý.");
  }

  // 10 Website Orders (retail intake queue)
  const webOrderCount = await db.query(
    "SELECT count(*)::text AS n FROM cohamy_crm.website_orders WHERE contact->>'email' LIKE '%@demo.invalid'"
  );
  if (Number(webOrderCount.rows[0].n) === 0) {
    const webOrders = [
      { name: "Khách lẻ Đỗ Mỹ Linh", phone: "0911.222.333", qty: 2, note: "Giao giờ hành chính tại cơ quan" },
      { name: "Khách lẻ Trần Tuấn Anh", phone: "0922.333.444", qty: 1, note: "Kiểm tra kỹ hạn sử dụng trước khi giao" },
      { name: "Khách lẻ Lê Thu Trang", phone: "0933.444.555", qty: 4, note: "Cần tư vấn thêm quy cách đóng gói hộp quà" },
      { name: "Khách lẻ Phạm Hoàng Nam", phone: "0944.555.666", qty: 3, note: "Giao buổi chiều sau 17h" },
      { name: "Khách lẻ Nguyễn Thảo Vy", phone: "0955.666.777", qty: 5, note: "Xin túi giấy đi kèm để làm quà biếu" },
      { name: "Khách lẻ Vũ Đức Minh", phone: "0966.777.888", qty: 2, note: "Chuyển khoản trước qua mã VietQR" },
      { name: "Khách lẻ Phan Thanh Hà", phone: "0977.888.999", qty: 1, note: "Tư vấn chế độ dinh dưỡng hạt macca cho bà bầu" },
      { name: "Khách lẻ Bùi Quốc Huy", phone: "0988.999.000", qty: 6, note: "Đơn hàng gia đình dùng định kỳ" },
      { name: "Khách lẻ Đặng Mai Hương", phone: "0901.122.334", qty: 2, note: "Đóng gói cẩn thận chống va đập" },
      { name: "Khách lẻ Trịnh Quang Khải", phone: "0902.233.445", qty: 3, note: "Giao tận tay người nhận tại chung cư" },
    ];

    for (const wo of webOrders) {
      await websiteOrders.createWebsiteOrder({
        idempotencyKey: randomUUID(),
        locale: "vi",
        payment: "bank",
        contact: {
          fullName: wo.name,
          email: "khach-web@demo.invalid",
          phone: wo.phone,
          address: "123 Đường DEMO, Phường Dịch Vọng, Cầu Giấy, Hà Nội",
          city: "Hà Nội",
          district: "Cầu Giấy",
          ward: "Dịch Vọng",
          note: wo.note,
        },
        items: [{ productId: "cohamy-almond-chocolate", quantity: wo.qty }],
      });
    }
    console.log("- Đã tạo 10 đơn đặt hàng website vào hàng đợi xử lý.");
  }

  await db.close();

  console.log("\n=================================================");
  console.log(" ✅ SEED DỮ LIỆU DEMO HOÀN TẤT THÀNH CÔNG!       ");
  console.log(" File thông tin tài khoản: " + DEMO_CREDENTIALS_FILE);
  console.log(" (Mật khẩu được lưu bảo mật trong tệp thông tin / biến môi trường)");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("\n❌ LỖI SEED DỮ LIỆU DEMO:", err);
  process.exitCode = 1;
});
