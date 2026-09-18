# Cohamy - test report

Updated 2026-09-18T19:19:43.460Z.

| Group | Result | Environment | Evidence | Time |
|---|---|---|---|---|
| Access/intake baseline | 21/21 PASS | LOCAL | test-results/access-local.json | 2026-09-18T18:59:45.481Z |
| Work baseline | 21/21 PASS | LOCAL | test-results/work-local.json | 2026-09-18T18:59:48.324Z |
| Registration/workspace/care | 18/18 PASS | LOCAL | test-results/upgrade-local.json | 2026-09-18T19:11:02.983Z |
| Portal services | 5/5 PASS | LOCAL | test-results/portal-services-local.json | 2026-09-18T18:59:47.125Z |
| Partner library/checklist/staff | 6/6 PASS | LOCAL | test-results/partner-library-local.json | 2026-09-18T19:15:05.560Z |
| Opportunities/tags/preferences/visits | 6/6 PASS | LOCAL | test-results/relationships-local.json | 2026-09-18T18:56:26.174Z |
| Actual worker interruption/restart | 3/3 PASS | LOCAL | test-results/worker-restart-local.json | 2026-09-18T18:57:56.023Z |
| XLSX jobs | 8/8 PASS | LOCAL | test-results/data-jobs-local.json | 2026-09-18T18:56:28.034Z |
| Real UI / mocked Brevo | 15/15 PASS | LOCAL | test-results/upgrade-browser-local.json | 2026-09-18T19:16:15.916Z |

- E01: backend mocked mailbox verification / supplementation / approval tested. UI report is separate. True Brevo delivery BLOCKED by configuration/test-recipient gate.
- E02: same-decision retry tested; PostgreSQL competing admin connections NOT_RUN.
- E03/E15: scoped search/bookmarks/files/notifications/export download and revoked assignment tests; commercial reports/stock domains not implemented.
- E04: invitation ceiling only; staff commercial order/owner approval NOT_STARTED.
- E05-E13/E16: commercial price/stock/delivery/money/consignment/procurement/report ledgers NOT_STARTED.
- E14: atomic import failure, unique origins, duplicate confirmation and expired job-lease recovery tested. Actual Node claim/interruption/restart passed under isolated QA with fixture-expired lease; supervised PostgreSQL worker restart NOT_RUN.
- E17: independent PostgreSQL database/files restore NOT_RUN.
- E18: candidate deploy/cutover/rollback NOT_RUN.

PGlite sequential/local retry is not PostgreSQL concurrency proof. No performance dataset or p50/p95 thresholds agreed, no load claim. Dependency audit originally 36; scoped ExcelJS uuid 11.1.1 override returns install audit to 34 existing advisories (29 moderate, 5 high); full remediation is not claimed. Build/typecheck/lint logs and packaging results are recorded in PROGRESS-140 after final runs.

Final LOCAL verification: 103/103 functional cases PASS; 2/2 packaging checks PASS (67 traces, migrations 001–010, no QA leaks). Final build/typecheck/lint PASS. UI15 cases,19 screenshots, errors[]. See PROGRESS-140 and UI-FINISH-REVIEW-140 for precise process and review scope. Live Brevo, PostgreSQL concurrency, independent restore and deployment remain NOT_RUN.
