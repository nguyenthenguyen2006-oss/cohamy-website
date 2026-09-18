# Cohamy - test report

Updated 2026-09-18T21:51:36.478Z.

| Group | Result | Environment | Evidence | Time |
|---|---|---|---|---|
| Access/intake baseline | UNKNOWN: 21/21 cases passed | LOCAL | test-results/access-local.json | 2026-09-18T18:59:45.481Z |
| Work baseline | UNKNOWN: 21/21 cases passed | LOCAL | test-results/work-local.json | 2026-09-18T21:33:16.584Z |
| Registration/workspace/care | PASS: 18/18 cases passed | LOCAL | test-results/upgrade-local.json | 2026-09-18T21:10:36.299Z |
| Portal services | UNKNOWN: 5/5 cases passed | LOCAL | test-results/portal-services-local.json | 2026-09-18T21:33:11.356Z |
| Partner library/checklist/staff | UNKNOWN: 6/6 cases passed | LOCAL | test-results/partner-library-local.json | 2026-09-18T19:15:05.560Z |
| Opportunities/tags/preferences/visits | UNKNOWN: 6/6 cases passed | LOCAL | test-results/relationships-local.json | 2026-09-18T21:33:14.544Z |
| Actual local worker interruption/restart | UNKNOWN: 3/3 cases passed | LOCAL | test-results/worker-restart-local.json | 2026-09-18T18:57:56.023Z |
| Actual PM2/PostgreSQL interruption and unmodified lease recovery | PASS: 4/4 cases passed | STAGING | test-results/worker-postgres-staging.json | 2026-09-18T20:10:07.838Z |
| XLSX jobs | UNKNOWN: 8/8 cases passed | LOCAL | test-results/data-jobs-local.json | 2026-09-18T21:36:44.688Z |
| Real UI / mocked Brevo | PASS: 15/15 cases passed | LOCAL | test-results/upgrade-browser-local.json | 2026-09-18T19:16:15.916Z |
| Governance negative/version tests | PASS: 12/12 cases passed | LOCAL | test-results/governance-local.json | none |
| Governance real Edge UI | PASS: 9/9 cases passed | LOCAL | test-results/governance-browser-local.json | 2026-09-18T19:53:25.257Z |
| Governance PostgreSQL contention | PASS: 5/5 cases passed | STAGING | test-results/governance-postgres-staging.json | 2026-09-18T19:49:19.932Z |
| Backup corruption/retention guards | PASS: 3/3 cases passed | LOCAL | test-results/backup-guards-local.json | 2026-09-18T19:58:21.954Z |
| Public-file backup guards | PASS: 3/3 cases passed | LOCAL | test-results/public-files-backup-local.json | 2026-09-18T20:00:27.296Z |
| Restored private files and A/B access | PASS: 4/4 cases passed | STAGING | test-results/restored-access-staging.json | 2026-09-18T19:57:01.224Z |
| Care backend/negative cases | PASS: 14/14 cases passed | LOCAL | test-results/care-automation-local.json | 2026-09-18T21:10:34.492Z |
| Care real Edge UI | PASS: 9/9 cases passed | LOCAL | test-results/care-browser-local.json | 2026-09-18T21:02:55.036Z |
| Care PostgreSQL contention | PASS: 7/7 cases passed | STAGING | test-results/care-automation-postgres.json | 2026-09-18T21:11:15.274Z |
| Actual PM2 care worker kill/recovery | PASS: 4/4 cases passed | STAGING | test-results/care-worker-postgres.json | 2026-09-18T20:51:13.962Z |
| Identifier/merge backend | PASS: 10/10 cases passed | LOCAL | test-results/partner-merge-local.json | 2026-09-18T21:48:55.645Z |
| DML-only PostgreSQL merge contention/rollback | PASS: 12/12 cases passed | STAGING | test-results/partner-merge-postgres.json | 2026-09-18T21:49:34.685Z |
| Identifier/merge real Edge UI | PASS: 5/5 cases passed | LOCAL | test-results/partner-merge-browser-local.json | 2026-09-18T21:50:51.011Z |
| Live actual Edge mobile/desktop | FAIL: 3/4 cases passed | PRODUCTION | test-results/browser-production.json | 2026-09-18T21:26:32.203Z |
| Managed candidate runtime | PASS: 3/3 cases passed | STAGING | test-results/managed-runtime-staging.json | 2026-09-18T20:31:57.232Z |
| Live read-only HTTPS smoke | UNKNOWN: 8/8 cases passed | PRODUCTION | test-results/public-smoke-production.json | 2026-09-18T21:16:38.457Z |
| Live source/process/migration/timer state | PASS: 6/6 cases passed | PRODUCTION | test-results/release-production.json | 2026-09-18T21:16:38.937Z |

- E01: backend mocked mailbox verification / supplementation / approval tested. UI report is separate. True Brevo delivery BLOCKED by configuration/test-recipient gate.
- E02: same-decision retry and simultaneous PostgreSQL approvals PASS on isolated STAGING.
- E03/E15: scoped search/bookmarks/files/notifications/export download and revoked assignment tests; commercial reports/stock domains not implemented.
- E04: invitation ceiling only; staff commercial order/owner approval NOT_STARTED.
- E05-E13/E16: commercial price/stock/delivery/money/consignment/procurement/report ledgers NOT_STARTED.
- E14: atomic import failure, unique origins, duplicate confirmation and expired job-lease recovery tested. Actual Node claim/interruption/restart passed under isolated QA with fixture-expired lease; supervised PostgreSQL kill/automatic restart, real two-minute lease expiry and second restart PASS in worker-postgres-staging.json, without clock/lease fixture manipulation.
- E17: independent PostgreSQL restore of all 49 tables plus bytea/source links PASS; restored A/B access and exact bytes PASS (backup-restore-staging.json; restored-access-staging.json).
- E18: actual production cutover PASS at 6a25d273aec8d23444ee7a18a9893c3f7dd2c301; prior normal-startup RSS guard caused source rollback and preserved additive DB history (RELEASE-HISTORY-140.md).

PGlite sequential/local retry is not PostgreSQL concurrency proof. governance-postgres-staging.json separately proves four multi-connection contention scenarios. No performance dataset or p50/p95 thresholds agreed, no load claim. Dependency audit originally 36; scoped ExcelJS uuid 11.1.1 override returns install audit to 34 existing advisories (29 moderate, 5 high); full remediation is not claimed. Build/typecheck/lint logs and packaging results are recorded in PROGRESS-140 after final runs.
