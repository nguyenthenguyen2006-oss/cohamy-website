# Impeccable documentation: warehouse sales percentage pricing

Date: 2026-11-06

Status: documented as an incumbent **Operate extension**. The scoped finish review at `impeccable-review.md` has disposition `ship` for the sale form and customer PDF. This documentation pass preserves `components/crm/DESIGN.md` and `.impeccable/design.json`; it does not introduce or revise a visual world, token, component primitive or global rule.

## Authority and boundary

The durable authority is `components/crm/DESIGN.md`, with Golden-Orange CRM canon seed `d6192f7e`, Be Vietnam Pro and dense operational ledgers. `PRODUCT.md` preserves that CRM commitment and the independent public-site and Portal boundaries. The updated FORM in `.impeccable/surfaces/components-crm-flowproductlines-tsx.md` explicitly inherits this authority.

The approved historical comp named by DESIGN.md, `.impeccable/mocks/canon-golden-orange.png`, is absent from this checkout. No visual comparison against that image is claimed. This is preservation of the incumbent implementation and recorded authority, not a newly approved comp. The scoped finish review requires no new-world comp or separate quality card for this extension.

The root sidecar currently describes the public storefront and shared footer, while the CRM authority is boundary-local. DESIGN.md also retains earlier shell descriptions alongside its active Golden-Orange overview. Those preexisting documentation/boundary inconsistencies remain outside this pass. They are not repaired or used to redefine this extension.

## Recorded extension

The checked implementation is `FlowProductLines.tsx`, `DocumentFlowWorkspace.tsx`, `AdminInvoiceActions.tsx`, `document-flow.css` and `lib/crm/document-flow-pdf.ts`.

- New standalone warehouse issues distinguish `SALE`, sample, gift and other handoffs. A sale explicitly chooses its customer. Existing unclassified records retain their unclassified choice.
- Each selected sale product has its own percentage CK input. Original price, net unit price and line amount are rendered as read-only outputs. Quantity or percentage changes recalculate line values and the total ledger; invalid calculations produce written feedback and disable draft saving. Source-linked prices and discounts stay read-only.
- Shipping and optional catalog VAT have separate controls. The summary writes original goods, discount, net goods, shipping, VAT, payable, paid and remaining amounts. The copy distinguishes confirmation and settlement from a draft preview.
- The confirmed-snapshot view and current settlement use separate sections. Admin correction code retains frozen original price and tax, offers independent percentage and quantity edits, and derives the new money summary. Admin correction received source sampling here, not a separate visual-state review.
- The customer PDF extends the existing document table with original unit price, CK (%), net unit price and line amount. Its summary exposes the same money categories and emphasizes the final total. Cost is not added to the checked customer PDF.

These are surface-specific behaviors. They do not establish new system-wide rules or replace the existing table and form vocabulary.

## System summary

1. **Palette:** incumbent warm ivory/white paper, amber/orange actions and pale ledger rows with dark working text; the customer PDF retains its existing white/navy document palette.
2. **Type:** incumbent Be Vietnam Pro and compact operational hierarchy; money and quantity use tabular numerals. No new display family or type-ramp step is recorded.
3. **Layout:** dense product-entry table within its local horizontal-scroll region; the sale summary becomes vertically stacked label/value facts on narrow screens.
4. **Material and shapes:** flat paper, thin rules, existing shallow control corners and ordinary fieldsets; no added shadow, raster treatment or decorative card system.
5. **Named rules preserved:** the Boundary Rule, One Family Rule and Flat Surface Rule remain the applicable incumbent rules.

In the scoped stylesheet, the priced ledger retains a fixed table layout and a 1450px minimum width inside the product-entry region. New price outputs and editable controls receive a 44px minimum height. Summary facts use the existing compact label/strong-value treatment and stack at 600px. These observed implementation values are recorded only as evidence, not promoted into new global tokens or breakpoints.

## Evidence checked

The documentation pass read the direction FORM, relevant PRODUCT.md and DESIGN.md sections, sidecar identity, full `document-flow.css` and `FlowProductLines.tsx`, and the affected form, Admin edit and PDF source sections. It also read the existing finish review and the supplied reports below. No context generator, detector, browser session, build or test was run by this pass.

| Evidence | Checked result and limit |
| --- | --- |
| `../handover-sale/browser/browser-staging.json` | PASS, 6/6 cases in actual Edge against loopback staging (`127.0.0.1:4373`) with fictitious QA accounts/products. Reports two saves of one draft, zero confirmed documents, zero external emails, no browser errors, failed assets or external requests. This is staging evidence, not production proof. |
| `../handover-sale/browser/browser-pdf-proof.json` | One-page PDF proof reports original total 410,000, discount 52,000, final 358,000, percentages present and no cost labels. |
| `../handover-sale/browser/desktop-1440-prices.png` | Visually inspected: three independent 10%, 20%, 5% inputs, read-only original prices, separate VAT/shipping and the 410,000 / 52,000 / 358,000 summary. |
| `../handover-sale/browser/narrow-390-names.png` | Visually inspected replacement capture: table heading and all three product names remain visible at their local scroll position. The reloaded decimal draft has 40,750 discount and 369,250 total. |
| `../handover-sale/browser/narrow-320-totals.png` | Visually inspected: percentage inputs remain touch-sized in the horizontal ledger, while all summary facts fit as stacked label/value rows. |
| `../handover-sale/browser/browser-preview-page-1.png` | Visually inspected: customer PDF shows all three product names, original and net prices, 10%, 20%, 5%, line amounts and final 358,000 VND. |
| `impeccable-detector.json` | Supplied detector has zero primary findings. Its sole advisory is the preexisting 21px mobile h1 outside the documented type ramp. No second detector run was performed. |
| `impeccable-review.md` | Scoped `ship` after valid 390px recapture; records ten valid named captures and PDF/stress evidence. This pass independently viewed the four images named above, not every capture or stress page. |

The 358,000 PDF total belongs to saved v1, whose second product has 20% CK. The 369,250 narrow-screen total belongs to the reloaded v2 draft with 12.5% on that product. These are distinct recorded versions, not a mismatch between the same snapshot and its PDF.

## Gaps and non-canonized drift

The 21px mobile-heading advisory, absent historical canon comp, sidecar boundary mismatch and older shell prose are disclosed without canonizing or repairing them. The scope calls for an ordinary incumbent extension and does not authorize a system refresh. Existing tokens and system files therefore remain unchanged by this pass.

The supplied browser report does not exercise confirmation, real stock/payment events, production deployment or external mail delivery. This documentation review does not independently verify backend invariants, historic PDF byte preservation, MCP runtime coverage, every Admin correction state or unrelated CRM surfaces. Those require their own implementation/runtime evidence; the scoped visual `ship` verdict must not be extended to them.
