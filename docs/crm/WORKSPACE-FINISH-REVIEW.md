disposition: fix

Inputs: all 15 required captures opened and valid; no approved comp or QUALITY BAR card supplied because this is a code-led operational redesign. No provided application input left unread. Independent finish reviewer; no second detector or browser run.

## persistence

Pass: PRODUCT.md and docs/crm/WORKSPACE-UI-CONTRACT.md record the authorized task-oriented redesign, Cohamy identity, operational scope, and unopened business transactions. This review covers the implemented operations UI only. The former components/crm/DESIGN.md still describes the superseded launcher; replacing it is the scheduled documenter handoff for this new world, and must finish before delivery. Detector color/type/radius differences against that former world do not establish visual defects in the replacement. The contract records code-led execution but no generated concept seed; there is no corroborated concept-roll or comp approval claim to certify.

## fidelity

| Element / promise | Finding | Evidence |
| --- | --- | --- |
| TYPE | match | Be Vietnam Pro, compact legible labels and clear heading levels retain the stated identity in every capture. |
| MATERIAL | match | Flat white work surfaces, navy navigation and restrained orange actions match OWN-WORLD; no imitation physical material. |
| Dashboard / THESIS | match | Incoming requests and named follow-up tasks lead the desktop work area; the empty mobile queue reflects processed QA data, not an invented KPI. |
| Navigation / FIRST VIEWPORT | adaptation | Fixed desktop navigation becomes a mobile menu as explicitly required by the surface contract; mobile queues become readable stacked records at 390px and 320px. |
| Profile entry / accessibility | missing | CrmShell hides all work-user text on mobile while its SVG is aria-hidden; the remaining icon-only link has no accessible name. |
| Order detail / STORY | contradicted | Mobile contact name and phone are early, but delivery address, customer message and desired payment are below history, tasks and audit. A salesperson must traverse the entire record before reading the request context. |
| Entity follow-up / STORY | contradicted | Empty task sections inside order/customer records instruct the user to open the order list; the relevant inline creation disclosure appears after that detour. |
| Login / craft floor | contradicted | login-desktop.png displays “Cohamy · Không gian làm việc” as an eyebrow above the story heading, explicitly refused by the craft floor. |
| Business truth | match | QA records are visibly labeled LOCAL QA. Request value is not called revenue; READY explicitly does not post stock or debt. Pending transactional modules remain identified as unopened. |

## ceiling

The supplied Operate direction reaches the appropriate level of expression through the Cohamy logo, navy navigation, orange actions, quiet rules and consistent typography. No ornamental or motion additions are required for this workflow. A generated QUALITY BAR was not supplied, so no claim of matching one is made. The remaining ceiling is practical: immediate request context and an unambiguous next action on a mobile record.

## material_fixes

1. Accessibility / FIRST VIEWPORT: give the CrmShell profile link a persistent accessible name such as “Hồ sơ và bảo mật”; retain it when its visible account text is hidden on mobile.
2. STORY / order-detail-mobile.png: expose all customer context near the early name/phone block, preferably an initially collapsed labeled “Thông tin khách và giao hàng” disclosure before the products/editor; keep address, original message, email and payment preference reachable there without scrolling past history/tasks. Preserve the desktop aside.
3. STORY / order-detail-desktop.png, order-detail-mobile.png and customer-desktop.png: use an entity-aware empty task state with a direct inline “Tạo việc và đặt hạn” action; remove the order-list detour from records that already supply the required context. Keep the global task-list empty state separate.
4. Craft floor / login-desktop.png: remove the story eyebrow “Cohamy · Không gian làm việc”; let the story heading lead while retaining the actual Cohamy logo in the login form.

## keep

Keep the current brand, operational density, mobile request rows, text-labeled statuses, explicit save feedback, account-role boundaries and unopened stock/financial transaction notices while applying this single batch.

---

## verdict

Verdict pass after the first fix batch: all 15 original screenshot paths reopened, plus order-inline-task-desktop.png; all captures valid. Scoring the original four fixes only, with source confirmation for the accessible name and supporting evidence in docs/crm/test-results/work-review-local.json.

1. Resolved — the unchanged mobile profile icon now has the explicit accessible name “Hồ sơ và bảo mật của [display name]” in CrmShell; the browser regression assertion passes.
2. Resolved — order-detail-mobile.png now shows the expandable customer context immediately below the name/phone block and before products. Address, original message, email and desired payment are present; the desktop contact aside remains intact and the duplicate mobile bottom section is gone.
3. Resolved — order/customer captures show contextual empty-task text immediately followed by “Tạo việc và đặt hạn”, without the order-list detour. order-inline-task-desktop.png confirms that this opens the task form within the same record.
4. Resolved — login-desktop.png now starts the story with its main heading; the removed eyebrow leaves the actual form-side Cohamy logo intact.

## remaining

Clear. No regression introduced by the fix batch is visible in the recaptures. This ship verdict covers the four scored UI fixes only; it does not approve backend correctness, production deployment, or unopened stock/financial workflows. The documenter handoff remains a delivery step outside this scoring pass.

disposition: ship
