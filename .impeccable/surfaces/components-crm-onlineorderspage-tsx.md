---
version: 1
slug: "components-crm-onlineorderspage-tsx"
primary_target: "components/crm/OnlineOrdersPage.tsx"
related_targets: ["components/crm/OnlineOrderForms.tsx", "components/crm/OnlineOrders.module.css", "lib/crm/modules.ts"]
---

## Direction contract

THESIS: Website orders become a working Admin inbox, with an explicit handoff to the assigned warehouse and a separate warehouse acknowledgement.

OWN-WORLD: Inherit the CRM's Be Vietnam Pro, warm amber actions, dense data tables, small status labels and restrained separators. Preserve the public storefront and unrelated CRM surfaces.

STORY: Find the customer and order, inspect its frozen products/prices and delivery details, select an active warehouse with a reason, then see who accepted the handoff. Email history distinguishes queued, provider accepted and delivered states.

FIRST VIEWPORT: Existing CRM sidebar and command bar surround a searchable, paginated order table. Detail pages show product rows beside customer/shipping facts, followed by the handoff action, paginated history and Admin-only mail status. Tables scroll within their region on narrow screens; forms and facts stack.

FORM: Operate mode, ordinary extension of the existing CRM system. Warehouse users receive a scoped inbox under the same route. Assignment and acceptance do not claim shipping, payment, stock deduction or debt posting. No new raster assets or motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finished extension · 2026-11-05

Mode remains **Operate**. This is an ordinary extension of `components/crm/DESIGN.md`, not a new visual world or a public-site redesign. The incumbent system and its sidecars are preserved.

The list uses a fixed 1745px ledger with explicit column widths of 190/240/200/240/140/155/190/155/135/100px inside its named, keyboard-focusable horizontal scroll region. Order identifiers, dates and the “Xem đơn” link stay on one line; long contact values wrap. Detail facts stack below 1000px, and label/value facts become a single column below 600px. Product, history and email tables retain their own local scrolling.

The fresh finish review scored its single list-column finding **resolved** and returned **disposition: ship** after the bounded correction and same-reviewer confirmation. The verdict covers that recorded finding; functional, server, MCP and deployment evidence remain separate. The post-fix documenter compared the implementation, final list captures, a detail-mobile capture and recorded viewport measurements with the incumbent CRM system. See `docs/crm/test-results/online-orders/impeccable-review.md` and `impeccable-documentation.md` for the checked evidence and limits.

The original detector result is an empty array in `impeccable-detector.json`; context and detector were not rerun at documentation. No shipping raster was created or replaced: the implementation reuses existing Cohamy product images from each saved order. Captures contain fictitious staging contacts and are evidence artifacts, not product artwork. Queued email, provider acceptance and delivered-to-mail-server labels retain separate meanings; this finish record does not claim real inbox delivery.
