# Cohamy - migration and rollback

New migrations 005-012 are additive, preserving 001-004 checksums. Independent PostgreSQL QA database migrated through 011; production migrated through011 at 9ca064d5a2487c50edb19958962cd9ebb1cf6318;012 is the newer care cohort pending release. Run explicit crm:init on a backed-up staging copy first. Registry uses checksum and an exclusive lock; rerun verified on isolated QA.

1. Record deployed/source SHA/runtime/cwd and DB migration registry; capture counts and verify backups on a separate database.
2. Apply 005 workspace/docs/care, 006 applicant identities, 007 jobs/import origins, 008 portal drafts/addresses/support, 009 partner library/reviewer/membership versions, 010 relationship care; 011 governance fields/bulk/notification/session/default-filter constraints. No backfill creates price, stock, debt, cost or revenue.
3. Validate existing users/organizations/catalog/intake/tasks counts, sessions/role checks, A/B access, private file contents and migration retry.
4. Start supervised worker, keep email disabled until authorized test delivery, then verify candidate public locales, login, registration, portal and no-store/private downloads.
5. Rollback source to prior release and disable new writes/worker/email; retain new tables/history for roll-forward. Never drop tables or delete business data to roll back code.
6. Restore PostgreSQL custom dump into an independent DB with separately configured credentials; document versions include bytes, metadata, checksums and acknowledgement links. Compare row counts/source links/checksums and run A/B access tests.

Independent PostgreSQL STAGING restore and restored ACL/file bytes PASS; actual production9ca064d deployment, HTTPS8/8 and timer activation plus independent scheduled restore PASS. Daily 02:30 Vietnam time, 30-day retention with at least seven verified copies is the configurable operations default, not an agreed business RPO/RTO. Existing Node 22/PM2 deployment history is not evidence for this candidate.
