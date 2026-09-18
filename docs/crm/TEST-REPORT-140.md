# Cohamy - test report

Updated 2026-09-18T23:03:11.052Z.

| Group | Result | Environment | Evidence | Time |
|---|---|---|---|---|
| Access/intake baseline | PASS (case evidence): 21/21 cases passed | LOCAL | test-results/access-local.json | 2026-09-18T18:59:45.481Z |
| Work baseline | PASS (case evidence): 21/21 cases passed | LOCAL | test-results/work-local.json | 2026-09-18T23:01:33.697Z |
| Registration/workspace/care | PASS: 18/18 cases passed | LOCAL | test-results/upgrade-local.json | 2026-09-18T21:52:40.886Z |
| Portal services | PASS (case evidence): 5/5 cases passed | LOCAL | test-results/portal-services-local.json | 2026-09-18T23:01:39.122Z |
| Partner library/checklist/staff | PASS (case evidence): 6/6 cases passed | LOCAL | test-results/partner-library-local.json | 2026-09-18T19:15:05.560Z |
| Opportunities/tags/preferences/visits | PASS (case evidence): 6/6 cases passed | LOCAL | test-results/relationships-local.json | 2026-09-18T23:01:44.251Z |
| Actual local worker interruption/restart | PASS (case evidence): 3/3 cases passed | LOCAL | test-results/worker-restart-local.json | 2026-09-18T18:57:56.023Z |
| Actual PM2/PostgreSQL interruption and unmodified lease recovery | PASS: 4/4 cases passed | STAGING | test-results/worker-postgres-staging.json | 2026-09-18T20:10:07.838Z |
| XLSX jobs | PASS (case evidence): 8/8 cases passed | LOCAL | test-results/data-jobs-local.json | 2026-09-18T23:01:49.372Z |
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
| Identifier/merge backend | PASS: 10/10 cases passed | LOCAL | test-results/partner-merge-local.json | 2026-09-18T22:55:51.723Z |
| DML-only PostgreSQL merge contention/rollback | PASS: 12/12 cases passed | STAGING | test-results/partner-merge-postgres.json | 2026-09-18T22:58:33.885Z |
| Identifier/merge real Edge UI | PASS: 5/5 cases passed | LOCAL | test-results/partner-merge-browser-local.json | 2026-09-18T21:50:51.011Z |
| Exact arithmetic and Vietnam business date | PASS: 6/6 cases passed | LOCAL | test-results/decimal-local.json | 2026-09-18T23:00:39.717Z |
| Threshold/minimum/tax/gift exact calculation | PASS: 10/10 cases passed | LOCAL | test-results/pricing-model-local.json | 2026-09-18T22:55:46.012Z |
| Pricing permissions and immutable policies | PASS: 8/8 cases passed | LOCAL | test-results/pricing-local.json | 2026-09-18T22:54:38.424Z |
| DML-only PostgreSQL pricing contention | PASS: 9/9 cases passed | STAGING | test-results/pricing-postgres.json | 2026-09-18T22:58:18.865Z |
| Quotation snapshots/approval/expiry/PDF rollback | PASS: 10/10 cases passed | LOCAL | test-results/quotations-local.json | 2026-09-18T22:59:42.758Z |
| DML-only PostgreSQL quotations and concurrent retries | PASS: 11/11 cases passed | STAGING | test-results/quotations-postgres.json | 2026-09-18T22:58:25.365Z |
| Rendered Vietnamese PDF source reconciliation | PASS: 2/2 cases passed | LOCAL | test-results/quotation-pdf-local.json | 2026-09-18T22:40:53.030Z |
| Commercial real Edge GUI | PASS: 7/7 cases passed | LOCAL | test-results/commercial-browser-local.json | 2026-09-18T22:58:57.961Z |
| Tier/unit real Edge GUI | PASS: 3/3 cases passed | LOCAL | test-results/commercial-controls-browser-local.json | 2026-09-18T22:59:05.987Z |
| Live actual Edge mobile/desktop | PASS: 5/5 cases passed | PRODUCTION | test-results/browser-production.json | 2026-09-18T22:03:04.406Z |
| Managed candidate runtime | PASS: 3/3 cases passed | STAGING | test-results/managed-runtime-staging.json | 2026-09-18T20:31:57.232Z |
| Live read-only HTTPS smoke | PASS (case evidence): 8/8 cases passed | PRODUCTION | test-results/public-smoke-production.json | 2026-09-18T22:02:58.417Z |
| Live source/process/migration/timer state | PASS: 6/6 cases passed | PRODUCTION | test-results/release-production.json | 2026-09-18T22:02:52.654Z |

- E01: backend mocked mailbox verification / supplementation / approval tested. UI report is separate. True Brevo delivery BLOCKED by configuration/test-recipient gate.
- E02: same-decision retry and simultaneous PostgreSQL approvals PASS on isolated STAGING.
- E03/E15: scoped search/bookmarks/files/notifications/export download and revoked assignment tests; commercial reports/stock domains not implemented.
- E04: invitation ceiling only; staff commercial order/owner approval NOT_STARTED.
- E05-E13/E16: commercial price/stock/delivery/money/consignment/procurement/report ledgers NOT_STARTED.
- E14: atomic import failure, unique origins, duplicate confirmation and expired job-lease recovery tested. Actual Node claim/interruption/restart passed under isolated QA with fixture-expired lease; supervised PostgreSQL kill/automatic restart, real two-minute lease expiry and second restart PASS in worker-postgres-staging.json, without clock/lease fixture manipulation.
- E17: independent PostgreSQL restore of all 49 tables plus bytea/source links PASS; restored A/B access and exact bytes PASS (backup-restore-staging.json; restored-access-staging.json).
- E18: actual production cutover PASS at 684057fe7624ecd3ae0a390393ad973007cfd9e4; prior normal-startup RSS guard caused source rollback and preserved additive DB history (RELEASE-HISTORY-140.md).

PGlite sequential/local retry is not PostgreSQL concurrency proof. governance-postgres-staging.json separately proves four multi-connection contention scenarios. No performance dataset or p50/p95 thresholds agreed, no load claim. Dependency audit originally 36; scoped ExcelJS uuid 11.1.1 override returns install audit to 34 existing advisories (29 moderate, 5 high); full remediation is not claimed. Build/typecheck/lint logs and packaging results are recorded in PROGRESS-140 after final runs.
