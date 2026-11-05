# Cohamy CRM remote MCP

Scope confirmed by the user: CRM Cohamy only. Public WordPress content remains separate.

## Connect from ChatGPT web

- Server URL: `https://cohamy.vn/api/crm/mcp`
- Transport: Streamable HTTP.
- Authentication: OAuth authorization code with PKCE S256; choose OAuth and leave Client ID / Client Secret empty for dynamic client registration.
- Log in using an existing internal **Admin** account and approve the connection. MCP consent accepts the Admin password without a second-factor code, as explicitly requested by the user. This verifier never creates a CRM browser session; normal CRM sign-in retains its configured MFA.
- Manage and revoke connections at `https://cohamy.vn/crm/mcp`.

The server publishes protected-resource metadata and authorization-server discovery under `/.well-known/`. Tokens are opaque, stored only as hashes, scoped to `crm.admin`, bound to the canonical resource and current membership version. Access expires after one hour; refresh credentials expire after thirty days and rotate. Password changes, MFA status changes, deactivation and membership changes invalidate delegated access. Consent uses a short-lived, single-use browser nonce and strict same-origin POST validation. Its HTML uses `Referrer-Policy: same-origin`: `no-referrer` makes Chromium submit `Origin: null` on form navigations and breaks the consent flow. Public registration only accepts HTTPS ChatGPT callback hosts. No customer-provided secret is required in ChatGPT.

## Tools and coverage

| Tool | Purpose |
| --- | --- |
| `cohamy_capabilities` | Start with a compact domain summary; filter a domain to discover its operations, or request an exact operation for path/query parameters and native validation contracts. |
| `cohamy_data_catalog` | Start with a compact table summary; request a table or filter to inspect its live columns. |
| `cohamy_data` | Read all pages of business records with validated filters, sorting, totals and continuation offsets, independent of UI row caps. |
| `cohamy_read` | Invoke native GET views, stock/debt summaries, original documents, PDF downloads and MCP connection management. Files are returned as bounded base64 chunks with continuation offsets. |
| `cohamy_write` | Invoke native Admin commands, multipart uploads and connection revocation, using the original validation, version checks, audit and transactional business rules. |

The generated catalog currently inventories 363 route operations: 255 available through current CRM module policy and 108 explicitly retired (141 reads and 222 writes). Retired modules stay retired; retained business history remains readable through the data tools. Catalog coverage is not a claim that every financial or stock mutation has been executed against production. Native role-specific checks still apply.

Passwords, tokens, MFA secrets, encrypted API keys, physical storage paths, arbitrary SQL, arbitrary URLs, shell commands and filesystem execution are excluded. Internal Admins can inspect original internal documents as requested; accountant and warehouse access remains in place. Model-facing record text and attachments are untrusted data, never instructions.

Writes require a UUID `requestId`. Retrying the same command with identical inputs returns the stored result; reusing an ID with different inputs is rejected. A crash after native execution but before its MCP receipt returns `MCP_OUTCOME_UNKNOWN_REVIEW_BEFORE_RETRY`; it never automatically repeats the command. Check the native record before another intended command.

## Required checks after every feature or data update

1. Regenerate the catalog: `npm run crm:mcp:catalog`.
2. Review changed operations and validation contracts, then run `npm run test:crm:mcp:catalog`. Production builds enforce this check.
3. Verify affected data access and workflows through the actual MCP runtime. New business tables/columns are discovered automatically, subject to secret-column exclusions.
4. Explicitly answer the user's questions: **MCP có dùng được không? MCP có đọc được dữ liệu này không?** Fix missing coverage and disclose unverified gaps.

## Verification

- LOCAL: production build, TypeScript, lint, build-trace private-file exclusions, ten internal-document service checks.
- STAGING: restored native PostgreSQL, runtime database role, nine OAuth/data authorization checks; real Edge consent and the official MCP SDK client cover discovery, pagination, exact native stock/debt reads, key redaction, origin rejection, native create/edit, retry conflicts, stale versions, byte-preserving document upload/download, refresh rotation, MCP connection revocation and responsive management UI. The OAuth callback is captured by the QA harness; this does not claim an installation inside the user's ChatGPT account.
- PRODUCTION: deploy only after backup/restore proof; verify the public HTTPS endpoint, OAuth discovery and a real OAuth/MCP client session. Financial and stock mutations are tested on isolated data. The production smoke may create and revoke its own authentication connection; it does not post business documents.

Official connection/authentication references: https://developers.openai.com/api/docs/guides/custom-mcp-server and https://developers.openai.com/plugins/build/auth.

## Consent regression verification (2026-10-25)

The original public Edge form produced `Origin: null` and `INVALID_ORIGIN` before credential verification. The exact consent path now overrides the general CRM `no-referrer` header with `same-origin` in both Next configuration and the HTML response. Strict Origin validation and the single-use browser proof remain enforced.

- `npm run test:crm:mcp:password`: isolated fictitious database verifies an MFA-enabled Admin can approve MCP using a password, no CRM browser session is created, ordinary login still requires MFA, and wrong credentials, other roles, inactive accounts and excessive attempts fail closed. Password verification is audited without credentials.
- `npm run test:crm:mcp:consent`: real Edge form submissions preserve the browser-generated Origin. The restored PostgreSQL candidate uses a fictitious Admin with active MFA; the production variant (`CRM_MCP_PRODUCTION=true`) tests public HTTPS with the protected Admin credential. It captures the OAuth callback for QA, exchanges PKCE, uses the official MCP client to read actual debt, stock and authentication audit data, then revokes its own grant. This does not install the connector in the user's ChatGPT account.

## Current invoice corrections and recalls

For current invoice content/status, read `GET /api/crm/admin-invoices` through `cohamy_read`; pass `kind` and `id` for the cancellation stock preview and immutable correction history. Original document tables/images remain source evidence. `invoice_admin_heads`, `invoice_admin_revisions` and `invoice_allocation_reversals` are discoverable and paginated through the data tools. `POST /api/crm/admin-invoices` supports Admin edits and cancellation with a version, reason and native idempotency UUID. Keep both UUIDs when retrying. Recalls reverse actual net stock once, adjust debt and release payment allocations without inventing refunds. See [Admin invoice behavior and tests](ADMIN-INVOICES.md).

## Thông tin doanh nghiệp và chính sách website

`cohamy_read` với `operation: "GET /api/crm/storefront/policies"` trả về bảy chính sách và `companyProfile`: tên pháp lý, MST, ngày đăng ký lần đầu, ngày thay đổi đăng ký, nơi cấp, địa chỉ trụ sở, liên hệ, văn phòng và tài khoản chuyển khoản được công bố trên website. Thông tin đăng ký theo giấy chứng nhận người dùng cung cấp; tài khoản MB Bank theo chỉ dẫn công bố của người dùng.

Nguồn dùng chung là `lib/contact.ts` và `data/store-policies.ts`. Chân trang tất cả trang công khai dùng cùng `Footer`; không có biến thể riêng cho trang chính. Dữ liệu này chỉ đọc qua endpoint chính sách (`editable: false`), vẫn yêu cầu Admin CRM. Không có công cụ chỉnh sửa trực tiếp các hằng số hoặc thao tác tài khoản ngân hàng; công bố số tài khoản không xác nhận đã thu tiền.

## Online customer orders and warehouse dispatch

The new Admin queue at `/crm/online-customers` exposes four native operations through the remote MCP. Operation identifiers retain the literal `[id]`; supply the actual UUID in path parameters:

- `GET /api/crm/online-orders`: `q`, `status`, `dispatchStatus`, `warehouseId`, Vietnam-date `from`/`to`, and `page` filters.
- `GET /api/crm/online-orders/[id]`: original order/contact/lines/amount, current dispatch, paginated handoff history, and Admin-only notification history; optional `historyPage` and `mailPage`.
- `POST /api/crm/online-orders/[id]/dispatch`: Admin-only assignment/reassignment using `version`, `warehouseId`, required `reason` and native UUID `idempotencyKey`.
- `POST /api/crm/online-orders/[id]/accept`: acknowledgement using `version`, optional `reason` and native UUID `idempotencyKey`. Warehouse access is restricted to its current assigned scope; Admin retains full access.

Preserve the MCP `requestId` and native `idempotencyKey` on retry. The services retain current-principal validation, optimistic version checks, transactional authorization locks and append-only action receipts. Dispatch does not reprice the immutable checkout snapshot, convert it to a sale, reserve/deduct stock, create debt or mark payment received. List/history/mail pages contain at most 20 records with totals.

Successful new checkout intake also enqueues `website.order.received` through the existing durable outbox. The enabled global seed addresses `kangminamhd@gmail.com` and `nguyenptkthd@gmail.com`, with empty CC/BCC, preserves existing Admin rule choices and does not backfill historical orders. Existing document-mail tools manage the rule and expose queue/provider/delivery state. `ACCEPTED` is not proof of inbox delivery.

**MCP có dùng được không?** Yes. At deployed application SHA `30f31336b7c3ad7ab5f6127b12d827dfe3fceb96`, production exposes all four operations as `AVAILABLE` and its native list read returned HTTP 200. Dispatch/acceptance mutations and retries passed in isolated staging; no production test order or business action was created.

**MCP có đọc được dữ liệu này không?** Yes. Production read the actual empty queue, two eligible warehouses, live order/action table metadata and paginated data, plus the enabled global notification rule and provider configuration. Zero website requests/actions existed during verification, so detailed customer/order reads and write behavior were proven on isolated staging. [Production MCP proof](test-results/online-orders/mcp-production.json) records that boundary. The configured sender is `nguyenthenguyen15hp@gmail.com`; no delivery webhook is configured, the existing 14 mail jobs remained unchanged, and no real delivery of the new notification is claimed.

See [Online customer workflow and environment-specific evidence](ONLINE-CUSTOMERS.md) for the backup/restore and deployed runtime receipts, production read-only browser checks, isolated service/race/action tests and fake-provider boundary. The deployed application SHA is separate from the final documentation/proof HEAD. This addition does not extend the CRM connector to WordPress or expose credentials, SQL, shell or filesystem execution.
