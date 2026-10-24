# Retire seven CRM modules

Owner request: remove Notifications, Tasks, Import/export, Global search, Period sales, KPI/rewards and Intake reports from the internal CRM.

The module availability policy closes their index, create, detail and hub routes, including the warehouse notification alias. Navigation, header shortcuts, dashboard task panels, partner task forms, quick task creation, notification preferences and general partner export controls follow this policy. Related read/write/download APIs return 404 before parsing inputs. The data-job and scheduled-report workers stop processing these retired features.

No schema or historical business data is deleted. Dealer Portal search, notifications and period reports retain their existing behavior. Document mail settings, order/warehouse/accounting workflows, audit and account security remain available.

LOCAL validation: focused service/API/role/browser suite passed 10 groups; all internal roles, desktop/mobile, legacy URLs, worker suppression, retained workflows and Portal compatibility checked. TypeScript, ESLint, production build and build-trace checks passed. See `test-results/work-report-removal-local.json` and the corresponding screenshots. Production validation is recorded separately after rollout.
