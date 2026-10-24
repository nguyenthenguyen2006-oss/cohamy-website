# Retire seven CRM modules

Owner request: remove Notifications, Tasks, Import/export, Global search, Period sales, KPI/rewards and Intake reports from the internal CRM.

The module availability policy closes their index, create, detail and hub routes, including the warehouse notification alias. Navigation, header shortcuts, dashboard task panels, partner task forms, quick task creation, notification preferences and general partner export controls follow this policy. Related read/write/download APIs return 404 before parsing inputs. The data-job and scheduled-report workers stop processing these retired features.

No schema or historical business data is deleted. Dealer Portal search, notifications and period reports retain their existing behavior. Document mail settings, order/warehouse/accounting workflows, audit and account security remain available.

LOCAL validation: focused service/API/role/browser suite passed 10 groups; all internal roles, desktop/mobile, legacy URLs, worker suppression, retained workflows and Portal compatibility checked. TypeScript, ESLint, production build and build-trace checks passed. See `test-results/work-report-removal-local.json` and the corresponding screenshots. Production validation is recorded separately after rollout.

PRODUCTION: deployed `4c7f658c8a4db1e6eed214d603aaba3bb7f6b98a`, incorporating the concurrent performance, heap/replay and inline document-mail settings changes. Edge verification against production HTTPS through a temporary SSH SOCKS5 tunnel passed four groups covering desktop/mobile, closed URLs/APIs and retained workflows. Public health is OK; web and worker are online with zero restarts and the web retains its 1536 MB heap setting.

The final cutover took a new source/environment backup and verified database restoration with 207 tables. Twelve candidate checks passed before activation. Rollback uses the immediately preceding `afa6cef` release. Backup: `/root/cohamy-backups/20261024T214011Z-removal-final-4c7f658c8a4d`. See `test-results/work-report-removal-production.json` and `test-results/work-report-removal-release-production.json`. Production screenshots remain private under `.local/production-work-report-removal/`.
