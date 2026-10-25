# Cohamy CRM remote MCP

Scope confirmed by the user: CRM Cohamy only. Public WordPress content remains separate.

## Connect from ChatGPT web

- Server URL: `https://cohamy.vn/api/crm/mcp`
- Transport: Streamable HTTP.
- Authentication: OAuth authorization code with PKCE S256; choose OAuth and leave Client ID / Client Secret empty for dynamic client registration.
- Log in using an existing internal **Admin** account and approve the connection. Existing MFA is enforced.
- Manage and revoke connections at `https://cohamy.vn/crm/mcp`.

The server publishes protected-resource metadata and authorization-server discovery under `/.well-known/`. Tokens are opaque, stored only as hashes, scoped to `crm.admin`, bound to the canonical resource and current membership version. Access expires after one hour; refresh credentials expire after thirty days and rotate. Password changes, MFA status changes, deactivation and membership changes invalidate delegated access. Consent uses a short-lived, single-use browser nonce. Public registration only accepts HTTPS ChatGPT callback hosts. No customer-provided secret is required in ChatGPT.

## Tools and coverage

| Tool | Purpose |
| --- | --- |
| `cohamy_capabilities` | Start with a compact domain summary; filter a domain to discover its operations, or request an exact operation for path/query parameters and native validation contracts. |
| `cohamy_data_catalog` | Start with a compact table summary; request a table or filter to inspect its live columns. |
| `cohamy_data` | Read all pages of business records with validated filters, sorting, totals and continuation offsets, independent of UI row caps. |
| `cohamy_read` | Invoke native GET views, stock/debt summaries, original documents, PDF downloads and MCP connection management. Files are returned as bounded base64 chunks with continuation offsets. |
| `cohamy_write` | Invoke native Admin commands, multipart uploads and connection revocation, using the original validation, version checks, audit and transactional business rules. |

The generated catalog currently inventories 319 route operations: 211 available through current CRM module policy and 108 explicitly retired. Retired modules stay retired; retained business history remains readable through the data tools. Catalog coverage is not a claim that every financial or stock mutation has been executed against production. Native role-specific checks still apply.

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
