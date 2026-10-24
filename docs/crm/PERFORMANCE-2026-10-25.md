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
- A production warm-up exposed a real V8 heap exhaustion at the previous 512 MB limit. The web process receives a bounded 1,536 MB heap and 2 GB RSS restart threshold on the 16 GB VPS; the worker configuration is unchanged. This is capacity headroom, not proof that every possible memory leak is eliminated.
- Deployment preserves or provisions the shared WordPress webhook replay directory. The previous production environment omitted it, causing authenticated CMS callbacks to repeatedly fail with `WORDPRESS_REPLAY_DIR_REQUIRED`. The existing signature, timestamp and atomic replay checks remain enforced.

## Evidence and limits

Production baseline: loopback requests generally completed in 25–95 ms; document workspace API median was 22 ms and its uncompressed payload was 36,655 bytes. The browser baseline observed multiple background React requests per navigation. The production transfer probe confirmed that this JSON was not compressed before tuning; immediately after nginx tuning it transferred as 4,038 gzip bytes while decoding to the same response.

`.ecc/benchmarks/cohamy-crm-before.json` records the browser baseline. It uses an actual authenticated Microsoft Edge session with HTTPS transported through a temporary SSH SOCKS tunnel: direct HTTPS from this workstation times out before connecting. Timings include that tunnel/network path and are not a promise about every user's network. Payload sizes and request counts are the stronger comparisons. Production after-measurements are recorded separately after rollout.

Verification covers Next build/TypeScript and trace checks, document-flow and reservation services, the bulk product browser workflow, and the focused performance browser checks. The focused checks assert correct tab navigation, one refresh after save, warehouse isolation and genuine HTTP 404/401 responses. Retired feature URLs remain real 404s; no streaming fallback is added ahead of access/not-found checks.

The existing warehouse-transfer-scope suite fails its destination-location assertion before reaching the changed workspace code. The transfer destination implementation is unchanged in this work. That suite is not counted as a pass; the relevant document/stock read boundaries are independently checked by the service and browser suites.

No production stock, payments, customer records, document confirmations or mail settings are modified by these optimizations. Deployment and production benchmark writes are limited to release/configuration files, verified backups, and authentication sessions.

## Production measurements

Measured performance source: `afa6cef8de795b7f53f408a96d3927ebc764cc1b`. Production was subsequently verified at the coordinated successor `4c7f658c8a4db1e6eed214d603aaba3bb7f6b98a`, which contains both optimization commits alongside the other chat's additional module removals and inline email settings. The measurements below precede those additional UI changes. Both sources retain the bulk product grids from `2e7d1f1`; the primary checkout's independent drafts are preserved. The preceding application-only release `59b7529` inherited the 512 MB heap limit and restarted once after a confirmed V8 out-of-memory failure. The final source includes the runtime and shared replay-directory corrections.

| Same measured operation | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Document workspace JSON, decoded | 36,655 B | 5,286 B | 85.6% |
| Document workspace JSON over HTTPS, best negotiated encoding | 36,655 B, identity | 1,306 B, gzip | 96.4% |
| Workspace database reads with no visible workflow documents | 12 | 8 | 33.3% |
| React server requests across five sidebar clicks | 35 | 9 | 74.3% |
| Font bytes on a cold CRM page | 301,168 B | 233,352 B | 22.5% |
| Resource requests on a cold CRM page | 48 | 38 | 20.8% |
| Draft save workspace refreshes, isolated browser fixture | 3 | 1 | 66.7% |

The final loopback sample records median factory/accounting page responses of 26/23 ms, against 42/39 ms before. Dashboard median is 71 ms against 94 ms before. Other routes do not uniformly improve: the workspace API median is 30 ms against 22 ms before, and cold browser load is 1,788 ms against 1,378 ms before through the tunnel. These are five loopback samples per route and one browser sequence per release, with variable network and warm-up effects. Do not report the byte savings as an equivalent reduction in every page's load time.

The gzip proof verifies identical decoded response bodies, `private, no-store`, and `Vary: Accept-Encoding`. Nginx configuration validation and backup hashes pass. Production browser checks pass 7/7, including correct tab selection, the private document catalogue, actual 404s for the eight retired modules, mobile overflow, logout, and all four fully paid HCM historical invoices with each original image checksum verified.

The bounded production stability run completed 150 read requests in 431 seconds, concurrency 2, with no failed requests, no new heap/replay errors and no web/worker restart or PID change. Sampled web RSS stayed below 615 MiB. This validates that workload and time window; it does not establish unlimited-load or long-term leak freedom. The subsequent coordinated release is healthy, retains the 1,536 MB heap, private delivery projection, and all four paid historical invoices; its source ancestry and live processes were independently checked after cutover. The temporary browser SOCKS tunnel and local QA server have been stopped.

Release backups are `/root/cohamy-backups/20261024T212547Z-afa6cef8de79` and `/root/cohamy-backups/20261024T210500Z-crm-transfer` (nginx). Both database backup restores and source hash verification passed. No new migration was applied; the existing 44 migrations are retained. See `test-results/performance/production.json` for the bounded runtime stability run and detailed measurements; `.ecc/benchmarks/cohamy-crm-before.json` and `cohamy-crm-after.json` preserve browser evidence.
