# Online order service peer review

Review scope: the new online-order dispatch/acceptance service, its routes and migrations, website-order notification enqueue, and MCP input contract changes. Review method: read-only source inspection. No runtime or provider calls and no production writes were performed by this reviewer.

## Original finding

**P2: Warehouse acceptance did not retain its granting warehouse authorization through commit.**

Before the fix, `lib/crm/online-orders.ts` checked `warehouseScope` through an unlocked `warehouses()` query (then lines 102-103). Its final warehouse check (then line 105) locked only the warehouse and owning organization and did not reapply `warehouseScope`. `lib/crm/work.ts:74` permits assignment administration to delete `warehouse_assignments` rows without acquiring either of those locks. A generic `WAREHOUSE` user's assignment could therefore be deleted after the scope read while the acceptance continued to commit.

The requested correction was to lock the generic user's granting assignment row through commit and revalidate the regional scope in the final warehouse row lock.

## Source resolution

**Resolved at source on 2026-11-05.**

- `lib/crm/online-orders.ts:98-101` now selects the generic `WAREHOUSE` user's exact granting `warehouse_assignments` row `FOR SHARE`, after reading the scoped order and before replay or mutation. Missing or concurrently deleted grants cause `FORBIDDEN`.
- The grant lock remains inside the same `database().transaction(...)` as the acceptance and is retained until commit or rollback. A concurrent assignment deletion must wait if acceptance acquired the grant lock first.
- `lib/crm/online-orders.ts:112-114` now applies `warehouseScope(user,'w',2)` to the final `FOR SHARE OF w,owner` query, including the regional restriction and current active owner/warehouse checks.

No remaining source issue was found for this specific authorization finding. This follow-up was limited to verifying its correction; it was not a new general review.

## Runtime evidence status

At the source-resolution review, `docs/crm/test-results/online-orders/auth-scope-race-staging.json` was not yet present. Runtime confirmation remains pending the controlled PostgreSQL schedules covering (1) deletion wins and acceptance is denied, and (2) acceptance wins and deletion blocks until acceptance commits. Source resolution does not by itself establish that those runtime cases passed.

### Release-owner runtime follow-up

The subsequently completed `auth-scope-race-staging.json` records **2/2 PASS** against the restricted PostgreSQL staging role and corrected service SHA256 `aeee5380b58f2802ebd821fb2bfac539f28968d9813d1f7f3f0309bc04c584d5`. Acceptance-first observed the grant's `55P03` NOWAIT conflict and revocation waiting until acceptance committed. Revocation-first observed acceptance waiting for the granting-row transaction, then HTTP 403 with unchanged order/history after revocation committed. The original grant was restored. These are release-owner runtime results, not an additional independent peer runtime review; regional scope changes were not independently raced.
