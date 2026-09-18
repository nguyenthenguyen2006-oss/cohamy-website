# Cohamy - test report

Updated 2026-09-18T21:12:41.865Z.

| Group | Result | Environment | Evidence | Time |
|---|---|---|---|---|
| Access/intake baseline | 21/21 PASS | LOCAL | test-results/access-local.json | 2026-09-18T18:59:45.481Z |
| Work baseline | 21/21 PASS | LOCAL | test-results/work-local.json | 2026-09-18T21:10:33.169Z |
| Registration/workspace/care | 18/18 PASS | LOCAL | test-results/upgrade-local.json | 2026-09-18T21:10:36.299Z |
| Portal services | 5/5 PASS | LOCAL | test-results/portal-services-local.json | 2026-09-18T18:59:47.125Z |
| Partner library/checklist/staff | 6/6 PASS | LOCAL | test-results/partner-library-local.json | 2026-09-18T19:15:05.560Z |
| Opportunities/tags/preferences/visits | 6/6 PASS | LOCAL | test-results/relationships-local.json | 2026-09-18T18:56:26.174Z |
| Actual local worker interruption/restart | 3/3 PASS | LOCAL | test-results/worker-restart-local.json | 2026-09-18T18:57:56.023Z |
| Actual PM2/PostgreSQL interruption and unmodified lease recovery | 4/4 PASS | STAGING | test-results/worker-postgres-staging.json | 2026-09-18T20:10:07.838Z |
| XLSX jobs | 8/8 PASS | LOCAL | test-results/data-jobs-local.json | 2026-09-18T18:56:28.034Z |
| Real UI / mocked Brevo | 15/15 PASS | LOCAL | test-results/upgrade-browser-local.json | 2026-09-18T19:16:15.916Z |
| Governance negative/version tests | 12/12 PASS | LOCAL | test-results/governance-local.json | none |
| Governance real Edge UI | 9/9 PASS | LOCAL | test-results/governance-browser-local.json | 2026-09-18T19:53:25.257Z |
| Governance PostgreSQL contention | 5/5 PASS | STAGING | test-results/governance-postgres-staging.json | 2026-09-18T19:49:19.932Z |
| Backup corruption/retention guards | 3/3 PASS | LOCAL | test-results/backup-guards-local.json | 2026-09-18T19:58:21.954Z |
| Public-file backup guards | 3/3 PASS | LOCAL | test-results/public-files-backup-local.json | 2026-09-18T20:00:27.296Z |
| Restored private files and A/B access | 4/4 PASS | STAGING | test-results/restored-access-staging.json | 2026-09-18T19:57:01.224Z |
| Care backend/negative cases | 14/14 PASS | LOCAL | test-results/care-automation-local.json | 2026-09-18T21:10:34.492Z |
| Care real Edge UI | 9/9 PASS | LOCAL | test-results/care-browser-local.json | 2026-09-18T21:02:55.036Z |
| Care PostgreSQL contention | 7/7 PASS | STAGING | test-results/care-automation-postgres.json | 2026-09-18T21:11:15.274Z |
| Actual PM2 care worker kill/recovery | 4/4 PASS | STAGING | test-results/care-worker-postgres.json | 2026-09-18T20:51:13.962Z |
| Managed candidate runtime | 3/3 PASS | STAGING | test-results/managed-runtime-staging.json | 2026-09-18T20:31:57.232Z |
| Live read-only HTTPS smoke | 8/8 PASS | PRODUCTION | test-results/public-smoke-production.json | 2026-09-18T20:38:14.773Z |
| Live source/process/migration/timer state | 6/6 PASS | PRODUCTION | test-results/release-production.json | 2026-09-18T20:58:37.526Z |

- E01: backend mocked mailbox verification / supplementation / approval tested. UI report is separate. True Brevo delivery BLOCKED by configuration/test-recipient gate.
- E02: same-decision retry and simultaneous PostgreSQL approvals PASS on isolated STAGING.
- E03/E15: scoped search/bookmarks/files/notifications/export download and revoked assignment tests; commercial reports/stock domains not implemented.
- E04: invitation ceiling only; staff commercial order/owner approval NOT_STARTED.
- E05-E13/E16: commercial price/stock/delivery/money/consignment/procurement/report ledgers NOT_STARTED.
- E14: atomic import failure, unique origins, duplicate confirmation and expired job-lease recovery tested. Actual Node claim/interruption/restart passed under isolated QA with fixture-expired lease; supervised PostgreSQL kill/automatic restart, real two-minute lease expiry and second restart PASS in worker-postgres-staging.json, without clock/lease fixture manipulation.
- E17: independent PostgreSQL restore of all 49 tables plus bytea/source links PASS; restored A/B access and exact bytes PASS (backup-restore-staging.json; restored-access-staging.json).
- E18: actual production cutover PASS at 9ca064d5a2487c50edb19958962cd9ebb1cf6318; prior normal-startup RSS guard caused source rollback and preserved additive DB history (RELEASE-HISTORY-140.md).

PGlite sequential/local retry is not PostgreSQL concurrency proof. governance-postgres-staging.json separately proves four multi-connection contention scenarios. No performance dataset or p50/p95 thresholds agreed, no load claim. Dependency audit originally 36; scoped ExcelJS uuid 11.1.1 override returns install audit to 34 existing advisories (29 moderate, 5 high); full remediation is not claimed. Build/typecheck/lint logs and packaging results are recorded in PROGRESS-140 after final runs.
