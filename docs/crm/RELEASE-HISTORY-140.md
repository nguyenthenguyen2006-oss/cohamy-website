# Cohamy - preserved release history

Historical checkpoints below retain failed attempts and their evidence; current state is in PROGRESS-140.

# Cohamy - checkpoint

Updated 2026-09-18T20:12:47.965Z. HEAD 856b6a9a0ca17bad863fc6609a36ffe7951ccafb. Foundation 856b6a9 is committed and pushed; this governance/backup cohort is uncommitted until final checks. User-provided PLAN remains preserved. Production is still 02746efe0aa502db71e8a18ec43537c09e382c3c. No real-data import, money/shipment or customer message performed.

Current source: P1 workspace/search/filter/columns/pins/panel/note drafts/private document versions/session/audit + XLSX jobs/worker; P2 open registration, Brevo adapter and applicant/reviewer workflow; P3 multiple contacts/checklist/dependency guard plus opportunities/reasons/tags/preferences/visits; independent portal cart/address/support/invitation/staff-lock scope, versioned partner library and onboarding checklist. Full acceptance is per-ID in FEATURE-MATRIX-140.md, not whole-phase completion.

Tests: see TEST-REPORT-140 and test-results JSON. UI server / processes / final build results are appended after verification. QA API/config credentials and OTP stay gitignored.

External inputs: Brevo key/verified sender/designated recipient; D03-D13 business decisions and backup policy. Source development of remaining IDs can continue independently using explicitly labelled fixtures.

Next source tasks: finish P1/P2 gaps listed in matrix, then P3 CRM care automation and P4 versioned policy/quotes/orders. Do not promote intake READY to delivered/paid/revenue. Before acceptance, test PostgreSQL multi-connection approval/reservation/allocation/credit, negative A/B paths and independent restore.

NOT COMPLETED: 140-feature objective. IDs lacking implementation/acceptance remain open rather than inferred completed from shared UI or a passed build.

Release-candidate verification 2026-09-19 (Vietnam): typecheck PASS, lint PASS with zero warnings, production build PASS (126 pages), packaging PASS (68 traces, all migrations 001–011, no QA/private reference leakage). The supervised PostgreSQL worker test PASS 4/4 in 133745ms; it killed the actual PM2-managed process, observed automatic restart and real lease expiry without advancing the clock/lease, then checked a second restart without duplicate imports. All local QA web servers are stopped.

VPS preflight PASS: Bash syntax for deployment/timer installation, Python compilation and systemd unit/calendar verification. DNS cohamy.vn, existing SSH host keys, deployed Git remote and public health confirm 185.201.8.180 is this project's VPS. One initial upload approval was rejected for an unverified destination; the same upload was approved after supplying this verification. No user confirmation requested because push/deploy authorization is already explicit.

The 140-feature objective remains active: 48 IDs have source, 19 have the listed LOCAL acceptance evidence, and 92 are not started. Deploy this concrete cohort, verify exact SHA/runtime/database/backup, then continue remaining per-ID work. A passed release is not acceptance of all 140 IDs.

Deploy attempt e030403: pre-migration independent restore PASS, migrations 001–011 applied additively and catalog import created zero new mappings. Production source remained 02746efe; no cutover occurred. The clean VPS install exposed undeclared dotenv usage. The upload path also overlapped an active Bash runner and produced a later syntax failure; preserve this failed release/backup as evidence, and use an immutable SHA-specific runner path for subsequent attempts. Fix uses Node 22 built-in parseEnv and --env-file, verified on that runtime against a fictitious QA env. PM2 web/worker must remain online at exact release cwd without restart for ten seconds before release acceptance.

Managed runtime diagnosis: PM2 lifecycle log proves the web process was restarted at 641921024-byte RSS by the inherited 512M threshold, so the zero-restart guard correctly caused source rollback. Worker logs contain no boot failure. Prefix-name registration was an incorrect hypothesis: two isolated fixture apps showed no prefix-induced restart. Actual VPS has 15993MiB RAM and 7316MiB available at diagnosis.

Proposed bounded runtime verified in isolated STAGING: web heap cap512MiB/RSS restart1G, worker threshold512M unchanged. Exact committed app/worker source15627f4 plus the proposed ecosystem config warmed eight read-only paths and stayed online with original PIDs through35s and another6s polling cycle;3/3PASS in managed-runtime-staging.json. Register both own processes in one PM2 invocation and preserve sanitized runtime metadata even when guard fails. This fixes a demonstrated normal-startup threshold problem while retaining restart acceptance checks; no extra VPS purchase or production stress.
