# Cohamy - operations runbook

Read prior RUNBOOK.md with this current-batch addendum; historical deploy statements do not describe this candidate.

Environment: CRM_REGISTRATION_MODE=OPEN (user confirmed; INVITE supported), CRM_EMAIL_ENABLED=false, CRM_BREVO_API_KEY and CRM_BREVO_SENDER_EMAIL from a secret manager. Use a verified sender and a designated test recipient before enabling true delivery. Never commit keys or codes. Registration remains persisted on provider errors; resend is limited.

Database initialization: npm run crm:init; migrations 001-011. Worker: npm run crm:worker, supervised in the same app runtime with PostgreSQL configuration, or -- --once for an authorized scheduler. after() provides a fast kick only. Inspect failed data_jobs via the authorized job UI; rows are imported atomically. Running leases expire after 2 minutes, max five claims. A failed business conflict requires a new corrected preview. Large imports/exports are deliberately capped.

LOCAL tests: npm run test:crm; npm run test:crm:work; npm run test:crm:upgrade; npm run test:crm:data-jobs; npm run test:crm:portal; npm run test:crm:library; npm run test:crm:care; npm run test:crm:worker-restart; npm run typecheck; npm run lint; npm run build; npm run test:crm:build. Browser harness upgrade uses port 4320, separate .local/crm-qa-upgrade-ui-* DB and isolated Next build directory. QA mailbox preload accepts fictitious @crm-qa.invalid only and refuses production. Never load it for staging/production.

Do not open a CLI worker/init against a PGlite directory owned by Next. Production requires PostgreSQL, supervised restart recovery, DB grants, real provider monitoring, periodic DB backups including bytea documents, checksum and independent restore. Actual PM2 restart/lease recovery and isolated PostgreSQL contention PASS; scheduled production backup activation and production alerts remain pending deployment.
