# Kết quả hợp đồng nghiệp vụ cuộc họp — 02/10/2026

`npm run test:crm:meeting-contract`: **72/72 PASS** trên LOCAL PGlite và STAGING PostgreSQL riêng với quyền runtime DML. Bằng chứng: `test-results/meeting-contract-local.json` và `test-results/meeting-contract-postgres.json`.

Đây là bộ kiểm thử service/hợp đồng dữ liệu; tên ca có thể mô tả rộng hơn assertion cụ thể. Kết quả không tự chứng minh toàn bộ màn hình, mọi kịch bản nghiệp vụ hoặc production đã được nghiệm thu. [Báo cáo sửa lỗi runtime](TEST-REPORT-RUNTIME-FIXES-2026-10-02.md) ghi riêng các luồng Edge thực và triển khai.

TC42/TC44 thực sự gửi đơn trước khi chuyển yêu cầu lên cấp trên. TC47 kiểm tra bên mua/bên bán được đóng băng của đơn, không dựng lại theo cây quản lý hiện tại. TC50 kiểm tra hủy đề nghị riêng không hủy đơn mua phía trên. TC71/TC72 sử dụng CMS bền vững và nguồn public thật.

Suite này chọn chính sách `AFTER_APPROVAL` để giữ hợp đồng của các luồng kho thủ công hiện hữu; luồng `ON_SUBMIT` được kiểm thử trong ADD24–ADD30 và browser runtime.

| Assertion trong script | Kết quả |
|---|---|
| TC01: 4-tier chain definition (Cohamy -> A1 -> A2 -> S -> End Customer) | PASS |
| TC02: Direct short routes (Cohamy -> A1 -> Store Direct) | PASS |
| TC03: Independence of partner_type and pricing_tier | PASS |
| TC04: Warehouse is not a dealer level; warehouse user cannot manage relations | PASS |
| TC05: Multiple user accounts per organization with individual audit trail | PASS |
| TC06: Distribution relation records upstream, downstream, status, starts_at, created_by | PASS |
| TC07: Prevent self-parenting | PASS |
| TC08: Prevent cycles in distribution hierarchy | PASS |
| TC09: Prevent attaching branch to its own descendant | PASS |
| TC10: Changing distribution relations never rewrites previously confirmed orders | PASS |
| TC11: Sibling dealer isolation (Dealer B cannot view Dealer A branch requests) | PASS |
| TC12: Descendant visibility (Dealer A1 can see A2 and Store S) | PASS |
| TC13: Store S cannot see parent Dealer A1 or sibling store data | PASS |
| TC14: Central Admin can see all branches and orders | PASS |
| TC15: Warehouse scope isolation | PASS |
| TC16: Direct ID access rejection for out-of-scope entity | PASS |
| TC17: Global search respects scope | PASS |
| TC18: Scoped counts and dashboards do not leak sibling metrics | PASS |
| TC19: Commercial timeline for Dealer A is inaccessible by Dealer B | PASS |
| TC20: Sales rep reassignment preserves legal seller and buyer | PASS |
| TC21: Self-service onboarding creates applicant with PENDING review | PASS |
| TC22: Admin approval assigns partnerType, parentOrganizationId, pricingTierId, creditEnabled, creditLimit | PASS |
| TC23: Approval atomically creates active distribution relation to parent | PASS |
| TC24: Approval creates credit account when creditEnabled is true | PASS |
| TC25: Application rejection creates no distribution relation or credit account | PASS |
| TC26: Self-onboarding cannot set partner_type directly without admin review | PASS |
| TC27: Idempotency of onboarding approval | PASS |
| TC28: Onboarding audit log records reviewer admin ID and timestamp | PASS |
| TC29: Non-admin users cannot approve onboarding applications | PASS |
| TC30: Approved partner can log in and view assigned parent | PASS |
| TC31: Layer A (Product promotion) discount applied first (100k -> 90k) | PASS |
| TC32: Layer B (FIXED_PERCENT) applies to remaining base: 90k * 70% = 63k, 90k * 60% = 54k | PASS |
| TC33: Layer B (QUANTITY_TIER) half-open intervals [min, max) | PASS |
| TC34: Aggregation across multiple lines of same SKU before tier matching | PASS |
| TC35: Line falling below minimum tier gets 0% Layer B discount | PASS |
| TC36: Exact lower boundary [min, ...) receives tier discount | PASS |
| TC37: Exact upper boundary transitions to next tier | PASS |
| TC38: Sequential calculation is exact without IEEE 754 precision loss | PASS |
| TC39: Price snapshot frozen in version; future promo change does not affect snapshot | PASS |
| TC40: Stale price detection on re-save recalculates against published price | PASS |
| TC41: Store S submits commercial request to Tier 2 Dealer A2 | PASS |
| TC42: Dealer A2 approves Store S request | PASS |
| TC43: Dealer A2 escalates shortage upstream to Tier 1 Dealer A1 | PASS |
| TC44: Dealer A1 approves Dealer A2 request | PASS |
| TC45: Dealer A1 escalates upstream to Cohamy factory | PASS |
| TC46: Each tier maintains independent pricing snapshot | PASS |
| TC47: Route chain traceability from Store S to Cohamy | PASS |
| TC48: Downstream cannot confirm order against upstream without upstream approval | PASS |
| TC49: Internal departments of same legal entity do not generate cross-entity POs | PASS |
| TC50: Canceling downstream order does not automatically cancel upstream order | PASS |
| TC51: Order confirmation creates stock reservation, not physical deduction | PASS |
| TC52: Physical deduction occurs only on dispatch / fulfillment shipment confirmation | PASS |
| TC53: Insufficient stock with allowPartial: false rejects reservation | PASS |
| TC54: Insufficient stock with allowPartial: true reserves available amount | PASS |
| TC55: Shortage of 24 recorded in backorder with expected_on: NULL (no fake delivery dates) | PASS |
| TC56: Fulfillment shortage details recorded on sales order | PASS |
| TC57: Subsequent stock intake allows fulfilling remaining backorder | PASS |
| TC58: Order cancellation releases reserved stock back to available pool | PASS |
| TC59: Warehouse staff assigned to Warehouse A cannot dispatch stock from Warehouse B | PASS |
| TC60: Stock balance invariants: on_hand = available + reserved holds consistently | PASS |
| TC61: Creditor organization is the seller (creditor_organization_id = seller_organization_id) | PASS |
| TC62: Store S receivable is owed to Dealer A2, NOT directly to Cohamy | PASS |
| TC63: Dealer A2 receivable is owed to Dealer A1 | PASS |
| TC64: Dealer A1 receivable is owed to Cohamy | PASS |
| TC65: Debt posted only upon delivery confirmation; unconfirmed order cannot post receivable | PASS |
| TC66: Credit limit check blocks orders exceeding approved credit limit | PASS |
| TC67: Multi-order payment allocation across multiple receivables | PASS |
| TC68: Allocation amount cannot exceed payment amount or remaining receivable balance | PASS |
| TC69: Fully allocated receivables update status to PAID | PASS |
| TC70: Dealer owner can view their own debtors and payment allocations | PASS |
| TC71: Article draft in CRM is private (isPublicBlogRow === false, hidden from public) | PASS |
| TC72: Publishing article makes it public (isPublicBlogRow === true); unpublishing reverts to draft | PASS |
