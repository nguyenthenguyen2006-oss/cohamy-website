# Cohamy - migration and rollback

New migrations005-017 are additive, preserving deployed001-016 checksums. Independent DML-only commercial PostgreSQL QA migrated through017; production verified through016 at 0bcf4c761b04defbbcb9238aeae093ac372b144b. Run explicit crm:init on a backed-up staging copy first. Registry uses checksum and an exclusive lock; rerun verified on isolated QA.

1. Record deployed/source SHA/runtime/cwd and DB migration registry; capture counts and verify backups on a separate database.
2. Apply 005 workspace/docs/care, 006 applicant identities, 007 jobs/import origins, 008 portal drafts/addresses/support, 009 partner library/reviewer/membership versions, 010 relationship care; 011 governance fields/bulk/notification/session/default-filter constraints;012 care automation;013 generated identifier keys;014 merge previews/history and bounded lock helper;015 explicit versioned commercial units/prices;016 immutable quotation snapshots/events/PDF;017 order policies, commercial requests, sales orders, exact previews and immutable events. No backfill creates a live policy, price, stock, debt, cost or revenue.
3. Validate existing users/organizations/catalog/intake/tasks counts, sessions/role checks, A/B access, private file contents and migration retry.
4. Start supervised worker, keep email disabled until authorized test delivery, then verify candidate public locales, login, registration, portal and no-store/private downloads.
5. Rollback source to prior release and disable new writes/worker/email; retain new tables/history for roll-forward. Never drop tables or delete business data to roll back code.
6. Restore PostgreSQL custom dump into an independent DB with separately configured credentials; document versions include bytes, metadata, checksums and acknowledgement links. Compare row counts/source links/checksums and run A/B access tests.

Independent PostgreSQL STAGING restore and restored ACL/file bytes PASS; actual production deployment0bcf4c761b04defbbcb9238aeae093ac372b144b, HTTPS8/8 and timer activation plus independent scheduled restore PASS. Daily 02:30 Vietnam time, 30-day retention with at least seven verified copies is the configurable operations default, not an agreed business RPO/RTO. Existing Node 22/PM2 deployment history is not evidence for this candidate.
