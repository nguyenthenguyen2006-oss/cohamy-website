# Online order service verification

`scripts/crm/verify-online-orders.ts` runs only against a newly created LOCAL PGlite directory or an explicitly guarded STAGING PostgreSQL database named `cohamy_qa_online_*` on loopback port 55432. It never targets the production CRM database.

LOCAL result: **13 cases PASS**. `services-local.json` records the actual execution. The base STAGING run passed **14 cases** on the restricted PostgreSQL role. Its executed main-script SHA256 was `31c43c145dc60483001ae9baf27a91463ec8a64c7b2065f6ff13fd44d30579aa`; the release owner records that source identity with the base proof.

Two late assertions were verified without resetting or rerunning the fixture: `verify-online-orders-pg-races.ts` passed **4 targeted groups** against the existing isolated database. It checked complete/unique paginated history, created two fresh QA requests using the current quote, raced a single idempotency UUID across those different orders, and proved one success/one HTTP-409-equivalent error, an unchanged losing row/history and a mutation-free winner replay. See `pg-races-staging.json` and the read-only exact database/role/path guard in `pg-race-runtime-guard.json`. The extension's actual executed SHA256 is `52b0b413d5000954a629acf1f7c617daa2d6c6f04d5c5e3a8d81352f589e85f3`.

The final main script includes those added history/cross-order assertions and has SHA256 `448c89ab26fbf348e6a00cb444c2845837e1c792289725c11f3e243d991fee8f`. This does not retroactively label the earlier base STAGING run as executing that revision. The separate targeted proof closes the late-assertion coverage gap. No application source changed between the base and extension runs.

## Controlled warehouse authorization race

A later peer review identified a generic-warehouse grant revocation race. After the service added a shared lock on the granting `warehouse_assignments` row, `verify-online-orders-pg-auth-race.ts` passed **2 controlled PostgreSQL schedules** on the existing isolated database. It uses separate restricted-role connections, transaction gates, `pg_stat_activity` lock observations and a `FOR UPDATE NOWAIT` probe; timing is not inferred from a sleep alone.

- Acceptance-first: acceptance waits for a deliberately locked warehouse row while already holding the exact grant. The independent NOWAIT grant probe returns PostgreSQL `55P03`; a deletion transaction is observed waiting. Acceptance commits before revocation proceeds. Subsequent generic-warehouse reads and acceptance attempts are denied.
- Revocation-first: an uncommitted deletion blocks the service's grant `FOR SHARE` check. Once revocation commits, acceptance is denied, the complete order row remains unchanged and no acceptance action receipt is inserted.

`auth-scope-race-staging.json` records both passes and the actual corrected service SHA256 `aeee5380b58f2802ebd821fb2bfac539f28968d9813d1f7f3f0309bc04c584d5`. The helper's executed SHA256 is `8ebb4875536a88a7153580cf48337af1f4e56dae9690e2ed12ea34926882f1ee`. The original granting row was restored in cleanup. Only two new fictitious QA orders were used; no fixture reset, owner connection, worker, external email or production write occurred. This helper does not independently race regional warehouse changes; that limitation is explicit in the proof.

The suite exercises:

- Fresh checkout, frozen contact/lines/net/VAT/gross amounts, original-receipt replay and exactly one new-order outbox job addressed to the two configured recipients.
- Notification-only worker execution through an injected fake provider, one call and no duplicate acceptance. `CRM_EMAIL_ENABLED=false` throughout; this does not prove real Brevo delivery or mailbox receipt.
- Admin-only dispatch, current identity validation, explicit/region warehouse scope, warehouse and Admin acceptance, reassignment, stale versions, conflicting retries and append-only action history.
- Legacy unknown product visibility, cancelled/converted order guards and strict input validation.
- Orders, dispatch history and notification history beyond 20 records. The notification-history fixture creates explicit QA resend jobs without running a live provider.
- Native MCP catalog discovery and invocation of the same read/dispatch services on isolated data. Production connector/OAuth coverage is verified separately by the release owner.
- Twenty-five stock, reservation, finance, organization and commercial-table fingerprints remain unchanged. Fixtures include a nonzero stock balance and a pending payment. Routing creates no sale, customer organization, stock movement, debt or paid receipt.

All customer contacts, warehouses, memberships and commercial records in these reports are fictitious QA fixtures. No orders are shipped, no external emails are sent and no production data is changed. Each report distinguishes the adapter/environment and fake provider from production proof.
