# Khách hàng bán online

Website checkout requests now have an Admin queue at `/crm/online-customers`. Admins can inspect the original customer, delivery address, products, quantities, proposed payment method and amount, then route the request to an existing active Cohamy warehouse. Warehouse staff use the same route under **Đơn bán online tại kho** and see only requests assigned within their current warehouse scope.

Production deployment passed at application SHA `30f31336b7c3ad7ab5f6127b12d827dfe3fceb96`. The release and read-only production checks are linked below. This application SHA is distinct from the later documentation/proof commit at the branch HEAD.

## Daily workflow

1. A successful new public checkout creates one frozen website request. Exact checkout retries return its original receipt.
2. Admin opens **Khách hàng → Khách hàng bán online**, filters or searches the queue, and opens **Xem đơn**. The list includes the contact, delivery location, products, quantity, original amount, warehouse and dispatch/request states.
3. Admin chooses **Kho nhận đơn**, writes a reason of 5–1,000 characters and selects **Điều phối về kho**. The warehouse must be active, owned by the same active Cohamy organization and permitted for the current actor.
4. The assigned warehouse opens its inbox and selects **Tiếp nhận đơn tại kho**. This records acknowledgement, actor and time. Admin can also acknowledge with its existing full administrative access.
5. Admin may route the request to a different eligible warehouse with a new reason. Reassignment resets acknowledgement; the former warehouse loses visibility and the newly assigned warehouse can acknowledge it.

Dispatch states are `UNASSIGNED`, `ASSIGNED` and `ACCEPTED`. First dispatch also moves a `PENDING_REVIEW` request to `IN_PROGRESS`; it does not mark the request delivered. Rejected, cancelled or already converted requests cannot be routed. Admins retain the original receipt and the append-only handoff history.

## Data and permissions

- Admin can read the queue, assign/reassign and acknowledge. Regional warehouse roles are restricted to their region; generic warehouse staff require their explicit assignment. Other CRM roles and portal users cannot use this inbox.
- The server validates the current principal on each operation. Mutations lock the order, eligible warehouse and organization; generic warehouse acknowledgement also retains a shared lock on the exact granting assignment through commit. Revocation and acceptance therefore have a defined transaction order.
- Actions require the current positive integer `version` and a UUID `idempotencyKey`. An identical retry by the same actor returns its original action receipt; a changed payload or another actor using that UUID is rejected. Stale versions return a conflict and the UI asks the user to reload.
- Customer/contact, product quantities, prices, VAT values when present, amount, proposed payment and paid state remain the original checkout snapshot. A catalog price change does not reprice an existing request. Legacy products without a current image still retain their recorded name and amounts.
- Dispatch and acknowledgement do not create a sale or customer organization, reserve/deduct stock, create debt, collect money or mark an order paid. Shipping, stock and payment posting continue through their existing document workflows.
- List, dispatch-history and Admin mail-history pages contain at most 20 records, with totals and page controls. Warehouse users do not receive the Admin notification-job history.

Migration [056](../../db/crm/056-online-order-dispatch.sql) adds dispatch fields and the indexed, append-only `website_order_dispatch_actions` ledger. Existing website requests remain visible as unassigned; no historical dispatch is fabricated.

## New-order email

Migration [057](../../db/crm/057-website-order-mail.sql) seeds one enabled global `website.order.received` rule with these explicit recipients:

- TO: `kangminamhd@gmail.com`, `nguyenptkthd@gmail.com`.
- CC and BCC: empty.

The seed preserves an existing rule rather than overwriting an Admin's choices. Admin can manage the rule through the existing document-mail settings. There is no automatic recipient fallback, customer copy or historical-order backfill.

Only a successful new order insert enqueues this notification, in the same transaction as intake. Checkout replay never enqueues again. The durable outbox's stable event/rule identity prevents duplicate jobs. The message contains the code, receipt time in `Asia/Ho_Chi_Minh`, and an authenticated Admin detail link; it has no PDF and does not include customer contact/address details.

The existing worker sends the queued notification. `PENDING`, `DEFERRED` and `RETRY` describe processing; `ACCEPTED` means the provider accepted the message, while `DELIVERED` requires delivery-webhook evidence. An ambiguous `UNKNOWN` result is held for review instead of being resent automatically. Sending remains dependent on the server mail switch, configured provider/key, valid sender and the effective rule. Neither the UI nor these tests claim mailbox receipt from a queue or provider-acceptance state.

## MCP access

The CRM remote MCP uses the same native services, scope checks, version checks, audit and retry rules:

| Operation | Input / result |
| --- | --- |
| `GET /api/crm/online-orders` | Optional `q`, `status`, `dispatchStatus`, `warehouseId`, `from`, `to`, `page`; returns the paginated queue and eligible warehouses. Date filters use Vietnam calendar boundaries. |
| `GET /api/crm/online-orders/[id]` | Path `id`; optional `historyPage`, `mailPage`; returns the frozen order, handoff history and Admin mail jobs. |
| `POST /api/crm/online-orders/[id]/dispatch` | Path `id`; input `version`, `warehouseId`, `reason`, `idempotencyKey`. |
| `POST /api/crm/online-orders/[id]/accept` | Path `id`; input `version`, optional `reason`, `idempotencyKey`. |

Use the literal `[id]` operation identifier in `cohamy_read`/`cohamy_write` and pass the actual UUID in path parameters. For MCP writes, preserve both its outer `requestId` and the native `idempotencyKey` on retry. Discover the exact contract with `cohamy_capabilities` before a command. Business-table data access remains paginated and excludes secret credentials. CRM and WordPress credentials remain separate.

**MCP có dùng được không?** Yes. All four operations are `AVAILABLE` in the production MCP catalog, and the native production list read returned HTTP 200. Dispatch, acknowledgement and retry mutations were exercised on isolated staging; no production test order or handoff was created.

**MCP có đọc được dữ liệu này không?** Yes. Production MCP read the actual empty queue, two eligible warehouses, live table metadata, paginated website-order/action data and the notification rule/configuration. There were zero website requests and action records at verification time. Rich order/contact/line/history reads were therefore exercised on isolated staging rather than fabricated production records.

## Verification evidence

All writes in the following reports use fictitious isolated data. No real email was sent, no production test order was created and no shipment or payment was posted.

| Environment | Actual evidence |
| --- | --- |
| LOCAL | [13 service cases](test-results/online-orders/services-local.json) and [7 mail groups](test-results/online-customers/mail-services-local.json), including rollback, duplicate prevention, injected provider outcomes, synthetic delivery webhooks and the unknown-outcome resend fence. |
| STAGING PostgreSQL | [14 base service cases](test-results/online-orders/services-staging.json) using the restricted runtime role; 25 stock/reservation/finance/commercial/organization table fingerprints stayed unchanged. The baseline contains nonzero stock and a pending payment. |
| STAGING late assertions | [4 targeted groups](test-results/online-orders/pg-races-staging.json) verify complete paginated history and a shared idempotency UUID across two different orders: one winner, one conflict, unchanged loser and safe replay. [The runtime guard](test-results/online-orders/pg-race-runtime-guard.json) identifies the isolated database/role. |
| STAGING authorization race | [2 controlled schedules](test-results/online-orders/auth-scope-race-staging.json) observe grant locks and prove both acceptance-first and revocation-first outcomes. The helper does not independently race regional-scope changes. |
| STAGING browser | [10 workflow cases](test-results/online-orders/browser-staging.json) cover public checkout, one queued notification, Admin dispatch, scoped warehouse acknowledgement, reassignment, stale forms, an actually committed POST with lost response and identical retry, role denial and responsive/keyboard/axe samples. [Neutral warehouse recapture](test-results/online-orders/browser-staging-recapture.json) and [the bounded list-width confirmation](test-results/online-orders/browser-staging-list-confirmation.json) supplement the workflow run. |
| PRODUCTION release | [Release receipt](test-results/online-orders/production-release.json): backup/restore proof covers 240 tables before migration and 241 afterward; 18 candidate cases passed. [Runtime receipt](test-results/online-orders/runtime-production.json): web and worker are online at the application SHA above, both with zero restarts. |
| PRODUCTION read-only | [Browser proof](test-results/online-orders/browser-production.json): 4 cases passed against the actual empty list and desktop/mobile/narrow widths. [MCP proof](test-results/online-orders/mcp-production.json): four operations available, native list HTTP 200, zero requests, two eligible warehouses, live metadata and paginated order/action reads. No production business mutation, test order or test email was performed. |

The base PostgreSQL service run executed main-script SHA256 `31c43c145dc60483001ae9baf27a91463ec8a64c7b2065f6ff13fd44d30579aa`. The final main script adds late history/cross-order assertions and has SHA256 `448c89ab26fbf348e6a00cb444c2845837e1c792289725c11f3e243d991fee8f`; it was not retroactively treated as the executed base revision. The separate four-group extension closes that assertion gap. The authorization-race report records the corrected service hash and the helper bytes actually executed; a subsequent TypeScript narrowing-only statement reorder does not change that report's original hash. See the [verification notes](test-results/online-orders/README.md).

The production notification rule is enabled globally with exactly the two requested TO recipients and empty CC/BCC. The provider is enabled/configured with sender `nguyenthenguyen15hp@gmail.com`; delivery-webhook configuration is absent. The existing 14 mail jobs were unchanged. This confirms configuration and preservation, not delivery of this new event to either mailbox.

The owned staging database/role/tunnel and the release's own production browser session were cleaned up after verification. These browser and axe samples do not constitute exhaustive accessibility proof. Mail-provider acceptance and synthetic webhooks do not prove real Brevo delivery; no production `DELIVERED` result is claimed.
