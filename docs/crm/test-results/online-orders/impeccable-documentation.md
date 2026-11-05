# Online-order inbox: finish documentation

Documented on 2026-11-05 after the list-column correction by a separate documenter. This is an ordinary **Operate** extension of the existing CRM workbench. It adds an Admin inbox and a scoped warehouse handoff without changing the public storefront's visual world.

## Authority and persistence

The checked authority is [the CRM design system](../../../../components/crm/DESIGN.md), [PRODUCT.md](../../../../PRODUCT.md), the [scoped surface brief](../../../../.impeccable/surfaces/components-crm-onlineorderspage-tsx.md), and the finished implementation in `OnlineOrdersPage.tsx`, `OnlineOrderForms.tsx` and `OnlineOrders.module.css`. The CRM retains its Golden-Orange workbench, seed `d6192f7e`, and Be Vietnam Pro. This extension preserves the existing root/public and CRM design files and sidecars. It neither regenerates their tokens nor repairs unrelated drift.

No new visual direction, approved surface comp, raster plate or motion system is introduced. The public-site root sidecar describes a different surface and is not used as CRM authority.

## Source-derived design record

| Element | Finished implementation |
| --- | --- |
| Type | Inherited Be Vietnam Pro, system UI fallback, compact CRM headings, native form labels and tabular numeric amounts. No display face or new type scale. |
| Ground and ink | Inherited `--crm-bg-canvas: #fffbf5`, white working sections, `--crm-bg-elevated: #fef9ef`, `--crm-ink: #1c1917`, `--crm-ink-secondary: #44403c` and `--crm-ink-muted: #57534e` from `crm-humanbank.css`. |
| Actions and rules | Existing primary/secondary CRM buttons and form fields, warm borders and explicit textual pending/error/reload feedback. No new global control primitive. |
| Dispatch state | Written “Chưa điều phối”, “Đã giao về kho” and “Kho đã tiếp nhận” labels. Local 4px-radius labels use the incumbent elevated/warning/success backgrounds; accepted state uses `--crm-success-bg: #ecfdf5` and `--crm-success-ink: #15803d`. Assigned text retains the source value `#854509`. |
| Queue geometry | Fixed 1745px list, ten widths: 190/240/200/240/140/155/190/155/135/100px. The named focusable region scrolls horizontally. Identifiers, dates and detail actions do not wrap; contact content may wrap. |
| Detail geometry | Products and customer facts use `minmax(0, 1.6fr)` / `minmax(280px, 1fr)` columns with a 20px gap; below 1000px they stack. Below 600px facts use one column. Action sections use an adaptive grid with 20px gaps. |
| Detail ledgers | Products, dispatch history and Admin-only mail tables have local minimum widths of 620px, 780px and 760px. Images are existing 52×52px product thumbnails with `object-fit: contain`. |
| Task boundaries | Frozen products/prices, contact/delivery facts, requested payment method, payment state, dispatch acknowledgement and email status are separate written facts. Dispatch does not present itself as stock deduction, delivery, debt posting or collected payment. |

The source check is recorded in [stage-app-source.json](stage-app-source.json). It compares normalized application sources and migrations with staging; QA-only and documentation changes are outside that manifest.

## Evidence checked

The documenter opened the final [Admin desktop list](browser-staging/admin-list-desktop.png) and [Admin mobile detail](browser-staging/admin-detail-mobile.png), inspected the three UI source files and checked the following recorded evidence:

- [Browser staging report](browser-staging.json): 10 passing functional cases, including role restrictions, handoff/acceptance, stale-version feedback, same-request retry and responsive/accessibility sampling. Contacts and orders are fictitious. No real email or production order submission is recorded.
- [Warehouse recapture report](browser-staging-recapture.json): the corrected warehouse-mobile evidence was captured at document top with neutral focus. It does not record a business mutation.
- [List confirmation](browser-staging-list-confirmation.json): two passing targeted checks after the single geometry fix. The 1745px table stays within local regions of 1032px, 320px and 250px. Document/body widths stay at 1366px, 390px and 320px respectively; zero errors, new orders, real email or production writes are recorded.
- [Same-reviewer verdict](impeccable-review.md): the reviewer re-opened the three canonical list images and three right-scroll supplements, scored the one P2 list-column finding **resolved**, and returned **disposition: ship** at that scope.
- [Original detector output](impeccable-detector.json): an empty array. The documenter did not rerun context or detector and did not reopen a polishing pass.

## Finish scope

Review and documentation are complete for this ordinary extension. The existing token-bearing CRM design system remains the source of visual authority. The scoped brief now records the finished geometry and evidence.

There are no newly produced or replaced shipping raster assets to document. Product thumbnails come from existing saved order content; screenshots are QA evidence. The sampled axe checks are not exhaustive screen-reader or color-contrast proof. The reviewer notes that the assigned HN viewport ends before the acceptance button, whose behavior is evidenced by source and the functional browser report.

This document does not certify every CRM state, backend correctness, production deployment, MCP runtime coverage or real provider/mailbox delivery. The release owner records those separately. “Nhà cung cấp đã nhận” and “Đã giao tới máy chủ thư” remain distinct from a person reading an email.
