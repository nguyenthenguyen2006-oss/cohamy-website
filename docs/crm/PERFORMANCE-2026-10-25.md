# CRM performance — 25 October 2026

## Changes

- CRM sidebar, hub, dashboard and record links prefetch a complete destination only on pointer/focus intent. Merely displaying many private links no longer starts a request for each one. The clicked link provides an immediate pending indicator, including reduced-motion support.
- Switching document-workspace routes remounts the selected tab. The previous tab no longer remains selected after the URL changes.
- Saving a document draft performs one write and one workspace refresh, then opens the newly returned snapshot. It previously fetched the workspace three times.
- Independent dashboard and document-workspace reads run concurrently through the existing bounded database pool. Related document/VAT/history queries are skipped when there are no visible document IDs.
- The workspace projects only delivery fields from source quote snapshots; server-side financial calculations and immutable source lines remain authoritative and unchanged. Movement aggregation uses the same warehouse scope as the outer stock query.
- Layout/page identity lookup is deduplicated with React `cache` within one server render. API authentication and transactional identity/permission checks remain fresh. No private response receives a shared cache or longer-lived identity cache.
- Operations pages retain all five Vietnamese font weights, with the Latin and Vietnamese subsets. Duplicate service-worker registration in the CRM shell is removed; the operations layout still registers it.
- The historical invoice table keeps dates and monetary figures on one line.
- Cohamy-only nginx tuning adds JSON/React-stream MIME types to gzip, compression level 5 and `Vary: Accept-Encoding`. It changes neither proxy destinations nor private cache headers. The operator script validates the configuration, keeps a source backup and rolls back on failure.

## Evidence and limits

Production baseline: loopback requests generally completed in 25–95 ms; document workspace API median was 22 ms and its uncompressed payload was 36,655 bytes. The browser baseline observed multiple background React requests per navigation. The production transfer probe confirmed that this JSON was not compressed before tuning; immediately after nginx tuning it transferred as 4,038 gzip bytes while decoding to the same response.

`.ecc/benchmarks/cohamy-crm-before.json` records the browser baseline. It uses an actual authenticated Microsoft Edge session with HTTPS transported through a temporary SSH SOCKS tunnel: direct HTTPS from this workstation times out before connecting. Timings include that tunnel/network path and are not a promise about every user's network. Payload sizes and request counts are the stronger comparisons. Production after-measurements are recorded separately after rollout.

Verification covers Next build/TypeScript and trace checks, document-flow and reservation services, the bulk product browser workflow, and the focused performance browser checks. The focused checks assert correct tab navigation, one refresh after save, warehouse isolation and genuine HTTP 404/401 responses. Retired feature URLs remain real 404s; no streaming fallback is added ahead of access/not-found checks.

The existing warehouse-transfer-scope suite fails its destination-location assertion before reaching the changed workspace code. The transfer destination implementation is unchanged in this work. That suite is not counted as a pass; the relevant document/stock read boundaries are independently checked by the service and browser suites.

No production stock, payments, customer records, document confirmations or mail settings are modified by these optimizations. Deployment and production benchmark writes are limited to release/configuration files, verified backups, and authentication sessions.
