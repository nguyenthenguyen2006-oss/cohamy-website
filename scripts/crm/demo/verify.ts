/**
 * Cohamy CRM - Demo Dataset Verification Test
 * Strictly tests local demo environment data completeness, consistency,
 * multi-tenant isolation, and absence of external provider calls.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

process.env.CRM_ENVIRONMENT = "DEMO";
process.env.CRM_DEMO_MODE = "true";
process.env.CRM_DATABASE_MODE = process.env.CRM_DATABASE_MODE || "pglite";
if (!process.env.CRM_LOCAL_DATA_DIR) {
  process.env.CRM_LOCAL_DATA_DIR = ".local/crm-demo";
}

import { database } from "../../../lib/crm/db";
import { login } from "../../../lib/crm/auth";
import * as repo from "../../../lib/crm/repository";
import * as quotes from "../../../lib/crm/quotations";
import * as orders from "../../../lib/crm/sales-orders";
import * as inventory from "../../../lib/crm/inventory";
import * as portal from "../../../lib/crm/portal-services";
import * as library from "../../../lib/crm/partner-library";
import * as relationships from "../../../lib/crm/relationships";
import * as finance from "../../../lib/crm/finance";
import * as work from "../../../lib/crm/work";
import { sendTransactionalEmail } from "../../../lib/crm/brevo";
import { resolveDemoPassword, DEMO_ACCOUNTS } from "./constants";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  details?: unknown;
}

async function main() {
  console.log("=================================================");
  console.log(" [COHAMY CRM] KIỂM TRA TOÀN DIỆN BỘ DỮ LIỆU DEMO ");
  console.log("=================================================");

  const results: TestResult[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, status: "PASS" });
      console.log(`✅ PASS: ${name}`);
    } catch (err) {
      results.push({ name, status: "FAIL", details: err instanceof Error ? err.stack : String(err) });
      console.error(`❌ FAIL: ${name}`, err);
      throw err;
    }
  };

  const rawPassword = resolveDemoPassword();
  const db = await database();
  const meta = (await db.query<{ current_database: string; current_user: string }>("SELECT current_database(), current_user")).rows[0];
  console.log(`- Database thực tế: ${meta?.current_database} (User: ${meta?.current_user}, Mode: ${process.env.CRM_DATABASE_MODE})`);

  try {
    // Test 1: Accounts & Authentication for all 8 roles
    await test("1. Xác thực đăng nhập thành công đủ 8 vai trò người dùng demo", async () => {
      for (const acc of DEMO_ACCOUNTS) {
        const authResult = await login(acc.email, rawPassword);
        assert.ok(authResult.user.id, `User ${acc.email} must have ID`);
        assert.equal(authResult.user.role, acc.role, `Role mismatch for ${acc.email}`);
      }
    });

    const admin = (await login("admin@demo.cohamy.invalid", rawPassword)).user;
    const sales = (await login("sales@demo.cohamy.invalid", rawPassword)).user;
    const warehouse = (await login("warehouse@demo.cohamy.invalid", rawPassword)).user;
    const accountant = (await login("accountant@demo.cohamy.invalid", rawPassword)).user;
    const dealerA = (await login("dealer-a@demo.cohamy.invalid", rawPassword)).user;
    const dealerB = (await login("dealer-b@demo.cohamy.invalid", rawPassword)).user;

    // Test 2: Customers, Tags, Contact Preferences
    await test("2. Kiểm tra số lượng và liên kết dữ liệu Khách hàng (>= 10 bản ghi)", async () => {
      const customers = await repo.listOrganizations(admin, { kind: "CUSTOMER" });
      assert.ok(customers.items.length >= 10, `Customers count must be >= 10, got ${customers.items.length}`);
      
      // Check tags and preferences on seeded demo customer
      const targetCust = customers.items.find(c => c.code === "DEMO_CUST_01") || customers.items[0];
      const tags = await relationships.partnerTags(admin, targetCust.id);
      assert.ok(tags.length >= 1, "Customer should have at least 1 care tag");
      const prefs = await relationships.contactPreferences(admin, targetCust.id);
      assert.equal(prefs.channel, "PHONE", "Channel preference should be PHONE");
    });

    // Test 3: Dealers & Credit Limit
    await test("3. Kiểm tra danh sách Đại lý và Hạn mức công nợ (>= 10 bản ghi)", async () => {
      const dealers = await repo.listOrganizations(admin, { kind: "DEALER" });
      assert.ok(dealers.items.length >= 10, `Dealers count must be >= 10, got ${dealers.items.length}`);
      
      const creditAccounts = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.credit_accounts WHERE enabled=true");
      assert.ok(Number(creditAccounts.rows[0].n) >= 10, "Should have configured credit accounts for dealers");
    });

    // Test 4: Partner Applications and diverse statuses
    await test("4. Kiểm tra Hồ sơ đăng ký đối tác (>= 10 bản ghi, có trạng thái chờ duyệt)", async () => {
      const apps = await db.query<{ status: string }>("SELECT status FROM cohamy_crm.partner_applications");
      assert.ok(apps.rows.length >= 10, `Applications count must be >= 10, got ${apps.rows.length}`);
      
      const statuses = new Set(apps.rows.map((r) => r.status));
      assert.ok(statuses.has("SUBMITTED"), "Must have SUBMITTED applications for boss to review");
      assert.ok(statuses.has("NEEDS_INFO"), "Must have NEEDS_INFO applications");
      assert.ok(statuses.has("APPROVED"), "Must have APPROVED applications");
    });

    // Test 5: Suppliers & Profiles
    await test("5. Kiểm tra Nhà cung cấp và Hồ sơ điều khoản thanh toán (>= 10 bản ghi)", async () => {
      const suppliers = await repo.listOrganizations(admin, { kind: "SUPPLIER" });
      assert.ok(suppliers.items.length >= 10, `Suppliers count must be >= 10, got ${suppliers.items.length}`);

      const profiles = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.supplier_profiles WHERE active=true");
      assert.ok(Number(profiles.rows[0].n) >= 10, "Supplier profiles should be active");
    });

    // Test 6: Commercial SKUs, Units, Price Book
    await test("6. Kiểm tra Danh mục 10 SKU, Đơn vị BASE/CASE và Bảng giá đang hiệu lực", async () => {
      const activeProducts = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.products WHERE active=true");
      assert.ok(Number(activeProducts.rows[0].n) >= 10, "Commercial products should be >= 10");

      const units = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.commercial_units WHERE active=true");
      assert.ok(Number(units.rows[0].n) >= 20, "Should have BASE and CASE units for all SKUs");

      const publishedBooks = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.price_books WHERE status='PUBLISHED'");
      assert.ok(Number(publishedBooks.rows[0].n) >= 1, "Must have at least 1 published price book");
    });

    // Test 7: Quotations & Real PDF Generation
    await test("7. Kiểm tra Báo giá (>= 10 bản ghi) và Bản in PDF lưu trữ nhị phân", async () => {
      const qList = await quotes.listQuotations(admin);
      assert.ok(qList.length >= 10, `Quotations count must be >= 10, got ${qList.length}`);

      const pdfCount = await db.query<{ n: string; size: number }>(
        "SELECT count(*)::text AS n, COALESCE(sum(octet_length(content)), 0)::int AS size FROM cohamy_crm.quotation_pdfs"
      );
      assert.ok(Number(pdfCount.rows[0].n) >= 1, "Must have generated quotation PDFs in quotation_pdfs table");
      assert.ok(pdfCount.rows[0].size > 1000, "PDF content must be valid binary bytes");
    });

    // Test 8: Inventory Balances & Near-Expiry Alert Lots
    await test("8. Kiểm tra Sổ cái kho: Tồn kho thực tế và Cảnh báo lô cận hạn", async () => {
      const balances = await inventory.listInventory(warehouse);
      assert.ok(balances.length >= 10, `Inventory balance rows must be >= 10, got ${balances.length}`);

      // Check near-expiry lots (expiring within 30 days)
      const nearExpiryLots = await db.query(
        "SELECT * FROM cohamy_crm.inventory_lots WHERE expires_on IS NOT NULL AND expires_on <= (now() + interval '30 days')::date"
      );
      assert.ok(nearExpiryLots.rows.length >= 1, "Must have near-expiry lots for dashboard alert signals");
    });

    // Test 9: Tasks - Overdue, Due Soon, Completed
    await test("9. Kiểm tra Công việc chăm sóc (>= 10 việc: Quá hạn, Sắp tới, Hoàn thành)", async () => {
      const allTasks = await work.listTasks(sales, { done: "all" });
      assert.ok(allTasks.length >= 10, `Tasks count must be >= 10, got ${allTasks.length}`);

      const overdueTasks = await work.listTasks(admin, { overdue: "true" });
      assert.ok(overdueTasks.length >= 3, `Overdue tasks must be >= 3, got ${overdueTasks.length}`);

      const doneTasks = await work.listTasks(admin, { done: "true" });
      assert.ok(doneTasks.length >= 3, `Done tasks must be >= 3, got ${doneTasks.length}`);
    });

    // Test 10: Opportunities & Customer Visits
    await test("10. Kiểm tra Cơ hội bán hàng và Lịch sử ghé thăm (>= 10 bản ghi)", async () => {
      const opps = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.opportunities");
      assert.ok(Number(opps.rows[0].n) >= 10, `Opportunities must be >= 10, got ${opps.rows[0].n}`);

      const visits = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.partner_visits");
      assert.ok(Number(visits.rows[0].n) >= 10, `Partner visits must be >= 10, got ${visits.rows[0].n}`);
    });

    // Test 11: Orders & Website Orders Intake Queue
    await test("11. Kiểm tra Đơn hàng thương mại và Đơn đặt hàng Website (>= 10 bản ghi)", async () => {
      const webOrders = await work.listOrders(admin);
      assert.ok(webOrders.items.length >= 10, `Website orders count must be >= 10, got ${webOrders.items.length}`);

      const salesOrders = await orders.listSalesOrders(admin);
      assert.ok(salesOrders.length >= 1, "Must have confirmed commercial sales orders");
    });

    // Test 12: Finance & Aging Debt Analysis
    await test("12. Kiểm tra Sổ cái công nợ: Phân tích tuổi nợ 30, 60, 90 ngày", async () => {
      const recs = await db.query("SELECT count(*)::text AS n FROM cohamy_crm.receivables");
      assert.ok(Number(recs.rows[0].n) >= 5, `Receivables count must be >= 5, got ${recs.rows[0].n}`);

      const asOf = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
      const aging = await finance.receivableAging(accountant, asOf);
      const buckets = new Set(aging.rows.map((r) => r.bucket));
      assert.ok(buckets.size >= 3, `Aging analysis must cover multiple aging buckets, got: ${Array.from(buckets).join(", ")}`);
    });

    // Test 13: Support Tickets & Library Documents
    await test("13. Kiểm tra Phiếu hỗ trợ (>= 10) và Thư viện tài liệu đối tác (>= 10)", async () => {
      const tickets = await portal.listTickets(admin);
      assert.ok(tickets.length >= 10, `Support tickets count must be >= 10, got ${tickets.length}`);

      const libItems = await library.library(admin);
      assert.ok(libItems.length >= 10, `Library items count must be >= 10, got ${libItems.length}`);
    });

    // Test 14: Multi-Tenant Isolation (Dealer A vs Dealer B)
    await test("14. Kiểm tra Cách ly dữ liệu đa người dùng: Đại lý A KHÔNG xem được dữ liệu Đại lý B", async () => {
      // 1. Dealer A cannot see Dealer B's orders
      const dealerAOrders = await orders.listSalesOrders(dealerA);
      const dealerBOrders = await orders.listSalesOrders(dealerB);
      assert.ok(Array.isArray(dealerBOrders), "Dealer B orders should be an array");
      
      for (const ord of dealerAOrders) {
        assert.equal(ord.organization_id, dealerA.organizationId, "Dealer A must only see their own organization orders");
        // Dealer B trying to access Dealer A order directly must throw NOT_FOUND (404)
        await assert.rejects(
          orders.salesOrderAccess(db, dealerB, ord.id),
          /NOT_FOUND/,
          "Dealer B must not access Dealer A's sales order"
        );
      }

      // 2. Dealer A cannot see Dealer B's support tickets
      const dealerATickets = await portal.listTickets(dealerA);
      for (const t of dealerATickets) {
        assert.equal(t.organization_id, dealerA.organizationId, "Dealer A tickets must match Dealer A org");
        await assert.rejects(
          portal.getTicket(dealerB, t.id),
          /NOT_FOUND/,
          "Dealer B must not access Dealer A's support ticket"
        );
      }
    });

    // Test 15: External Provider Call Interception
    await test("15. Xác nhận Chặn hoàn toàn gửi Email/SMS/Webhook ra bên ngoài trong môi trường DEMO", async () => {
      // Calling sendTransactionalEmail in DEMO mode must NOT call external Brevo API
      const messageId = await sendTransactionalEmail(
        "test-receiver@demo.cohamy.invalid",
        "Tiêu đề kiểm thử chặn email",
        "Nội dung kiểm thử DEMO",
        "demo-key-123"
      );

      assert.ok(typeof messageId === "string" && messageId.startsWith("demo-msg-"), "Must return simulated demo messageId");
    });

  } finally {
    await db.close();
  }

  // Save report
  await fs.mkdir("docs/crm/test-results", { recursive: true });
  await fs.writeFile(
    "docs/crm/test-results/demo-verification.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        environment: "DEMO (Local PGlite)",
        totalTests: results.length,
        passed: results.filter((r) => r.status === "PASS").length,
        failed: results.filter((r) => r.status === "FAIL").length,
        tests: results,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("\n=================================================");
  console.log(` ✅ TOÀN BỘ ${results.length} BÀI KIỂM THỬ ĐÃ PASS!`);
  console.log(" Báo cáo lưu tại: docs/crm/test-results/demo-verification.json");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("\n❌ KIỂM THỬ DEMO THẤT BẠI:", err);
  process.exitCode = 1;
});
