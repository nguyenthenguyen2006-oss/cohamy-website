# Admin invoice controls — design evidence

Reviewed: 2026-10-25, Asia/Saigon. This is a bounded documentation pass for an ordinary CRM extension. It records the finished implementation and evidence; it does not establish a new visual system or replace `DESIGN.md`.

## Overview

The surface uses **Operate** mode: Admin opens an existing invoice, reviews its products or recall impact, supplies a reason, then saves a new version or recalls the document. The dense spreadsheet workspace, Cohamy identity, Be Vietnam Pro family and Golden-Amber CRM boundary remain the incumbent direction.

`PRODUCT.md` supplies the durable product constraints. The applicable visual record is `components/crm/DESIGN.md`; the current CSS and rendered captures resolve implementation details where its older prose differs. Root `DESIGN.md` describes the public homepage and is outside this extension. No approved new composition, replacement visual world or system change was introduced.

Source checked:

- `components/crm/AdminInvoiceActions.tsx`, `AdminInvoiceIndex.tsx`, `invoice-admin.css`, `ProductEntryGrid.tsx`, `product-entry-grid.css` and `product-images.ts`.
- The existing tokens and controls in `components/crm/work.css`, `commercial.css` and `crm-humanbank.css`, plus font loading in `app/(operations)/layout.tsx`.
- Entry points in `DocumentFlowWorkspace.tsx`, `HistoricalOrdersPage.tsx` and `OrderPages.tsx`; invoice kind and retained tax contracts in `lib/crm/invoice-admin-model.ts`.
- `PRODUCT.md`, root `DESIGN.md`, `components/crm/DESIGN.md` and `components/crm/.impeccable/design.json`.

### Evidence and limits

All twelve latest captures below were visually inspected. File dimensions and freshness were checked directly; the set was written at 16:10:18–16:10:19 on the review date.

| State | Capture under `.impeccable/review/` | Dimensions |
| --- | --- | --- |
| Edit, initial viewport | `desktop.png`, `mobile.png`, `user-320.png` | 1366×900; 390×844; 320×844 |
| Edit, product rows | `edit-products-desktop.png`, `edit-products-mobile.png`, `edit-products-user-320.png` | 1366×900; 390×844; 320×844 |
| Edit, reason/actions/history | `edit-footer-desktop.png`, `edit-footer-mobile.png`, `edit-footer-user-320.png` | 1366×900; 390×844; 320×844 |
| Recall, impact and reason | `recall-desktop.png`, `recall-mobile.png` | 1366×900; 390×844 |
| Recall, horizontally scrolled quantities | `recall-mobile-quantities.png` | 390×844 |

The captures establish the visible edit/recall layout and containment for those states. The desktop set is 900px high; it is not evidence of a separate 1366×768 capture. There is no separate 320px recall capture in this set. Screenshots alone do not establish focus trapping, Escape handling, persistence, permissions, stock correctness or every invoice-kind state.

The accompanying result files were read, rather than rerun by this documentation pass:

| Artifact in this directory | Recorded result and environment |
| --- | --- |
| `browser-ui-staging.json` | PASS: actual Admin edit/recall, reason requirement, focus trap, Escape, impact quantities and desktop/390/320 fit; STAGING production build against restored native PostgreSQL. |
| `browser-mcp-staging.json` | PASS: SDK discovery/read/write, exact recall preview, three history tables, staged edit/recall and retry without a second stock return. |
| `services-local.json` | PASS: 14 isolated LOCAL cases covering Admin permissions, quantity deltas, original revisions, partial delivery, reservations, VAT, historical invoices, transfers, dependencies, pagination and retry. |
| `native-staging.json` | PASS: five native PostgreSQL cases including concurrent recall, retry, original image preservation, transfer reversal and protected history. |

These are LOCAL/STAGING proofs. This document makes no production-write, deployment or email-delivery claim.

## Colors

The extension uses the existing CRM paper, ink and amber strokes. It adds no palette. Token values below describe the current source; they are observations, not a second normative token registry.

| Role | Source evidence | Use in the extension |
| --- | --- | --- |
| Primary amber | Existing `--crm-amber-500` (#f59e0b), `--crm-amber-600` (#d97706), inherited primary/secondary buttons | Primary save/recall actions and surrounding workspace controls. |
| White working surface | Existing `--crm-bg-surface` (#ffffff) | Dialog, fields and product table surface. |
| Strong ink | Existing `--crm-ink` (#1c1917) | Invoice title, content and form values. |
| Warm rule | Existing `--crm-border` (#f3e3c3) | Dialog, fieldset, product cells and field strokes. |
| Table and filled-row tint | Product-grid fallbacks (#faf3e6 / #fff7e8) | Sticky table headings and rows with entered content. These match the established warm CRM vocabulary. |
| Muted guidance | Product-grid/dialog hint fallback (#57534e) | Row counts, search help and mobile scroll instructions. |
| Focus | Dialog fallback (#bf4b14), with existing CRM focus rules | Visible focus on inputs, actions and scroll regions. |

The recall table continues to inherit the existing commercial table header surface (#f4f6f8). That cool neutral comes from the incumbent table style; it is not promoted into a new invoice palette.

## Typography

Be Vietnam Pro is inherited through the operations boundary. The layout loads Latin and Vietnamese subsets at weights 400, 500, 600, 700 and 800; no new font is introduced by the extension.

The base CRM body is (14px, line-height 1.6). The invoice dialog title is (18px, line-height 1.4), product table text is (13px), and table text becomes (12px) at the grid's (600px) breakpoint. Guidance and row counts use (12px). Numeric inputs and inherited commercial tables retain tabular numerals. Product quantity inputs align right; the form remains in Vietnamese with explicit field and action labels.

**The One Family Rule.** Continue the existing Be Vietnam Pro operations family rather than borrowing the public homepage's display typography.

## Layout

The edit dialog is centered and constrained to `min(1180px, calc(100vw - 24px))`, with maximum height `calc(100dvh - 32px)` and internal scrolling. Its form uses a (16px) gap fallback and desktop fields use three equal columns with a (12px) gap fallback. At (700px) and below, fields become one column, dialog padding becomes (12px), action rows wrap and the maximum height becomes `calc(100dvh - 16px)`.

The reusable product grid remains one table. Its scroll region is contained, focusable and named; headings remain sticky within that region. The invoice variant preserves a minimum table width of (1100px), a product-name minimum of (300px), and numeric input minimums of (130px). This makes the columns reachable through horizontal scrolling instead of shrinking them into unreadable inputs. The mobile instruction explains that interaction. The source grid also keeps filtered rows mounted, so filtering by product name does not discard entered quantities.

The recall impact table uses the incumbent commercial minimum width of (760px). Its wrapper is now a named `region` (`Biến động tồn kho khi thu hồi`) with `tabIndex={0}` and a visible mobile swipe hint at (700px) and below. The latest mobile captures show both the product side and the unit/quantity side after scrolling. Page and dialog widths remain contained in the inspected states.

**The Contained Table Rule.** Preserve operational columns inside an explicit scroll region; keep the reason and primary action reachable through the dialog's vertical scroll.

## Elevation & Depth

The dialog uses a native modal top layer and a navy-alpha backdrop (`rgb(23 43 67 / .45)`). Its own stylesheet adds no decorative shadow or motion. The border, white surface and dimmed workspace establish separation. Existing workspace elevation remains inherited; this pass does not create a new shadow vocabulary.

## Shapes

The dialog uses the existing card-radius fallback (12px); inputs use a field-radius fallback (5px). The reusable product fieldset uses gently rounded corners (6px), while its table cells stay rectangular. Thin continuous rules preserve the spreadsheet reading pattern. These are surface observations rather than new global radius tokens.

## Components

### Invoice index and integrations

The Admin index reuses the section, filters, commercial table, actions and paging patterns. It shows code, kind, written status, creation date and compact edit/recall controls, with a cancelled-document checkbox, loading/empty/error feedback and pages of 50. The five kinds come from the shared model: factory/warehouse/delivery flow, sales, historical, VAT and transfer.

`DocumentFlowWorkspace` provides an Admin-only all-invoices disclosure, flow-detail controls and the existing VAT-context entry point. `HistoricalOrdersPage` exposes the shared controls on an historical invoice detail. `OrderPages` exposes them on a sales detail. This source inspection confirms integration; the screenshot set depicts the shared sales dialog rather than separate captures of all five kinds.

### Protected edit/recall dialog

The component portals the native dialog into `.cohamy-crm`, preserving the operations font and tokens. `showModal()` supplies modal behavior; the title labels the dialog. Busy operations disable actions and prevent cancellation. Source shows Escape closes when idle. The existing browser result records focus trapping and Escape verification.

Both modes require a reason of at least five trimmed characters; source validation caps it at 2000. The primary action is disabled until a reason is present and displays a busy label during submission. Version conflicts and business failures have visible text. Existing versions and recall history remain in a native disclosure rather than disappearing after an action.

Recall presents the affected warehouse, product, base unit and signed quantity before the reason and submit action. It also names related documents and explains treatment of received money. This preview communicates server results; the LOCAL/STAGING service and MCP artifacts carry the proof of exact-once stock return and retry handling.

### Product entry grid

The edit grid presents product images, catalog names, base units, quantity, unit price, discount and row removal. Catalog selection updates the product name and stock unit; mapped source images and a Cohamy logo fallback come from the existing resolver. Images are (44×52px), contain the product rather than cropping it, and use the product name as alternative text.

The visible **Thuế dòng** column has been removed. Existing line tax remains in the cloned content and spread updates; the input schema still carries `tax`. Adding a new line explicitly initializes its tax to zero. Hiding the column does not authorize deleting source tax or recalculating it in the browser.

Native controls preserve source restrictions: transfers keep the original warehouse/product set and prevent adding/removing lines; their price fields are read-only. Flow documents linked to a sale keep source financial fields read-only. Quantity keyboard movement operates across visible rows. These constraints are functional behavior, not visual-system prohibitions.

### MCP coverage statement

**MCP có dùng được không? MCP có đọc được dữ liệu này không?** Có theo các kết quả STAGING đã kiểm tra trong `browser-mcp-staging.json`: SDK tìm thấy công cụ đọc/ghi hóa đơn, đọc hóa đơn hiện tại, xem trước biến động kho và ba bảng lịch sử; sửa/thu hồi hóa đơn sao chép trong staging và thử lại không hoàn kho hai lần. Đây là bằng chứng runtime STAGING được đọc từ artifact, không phải một lần chạy MCP mới của người viết tài liệu và không chứng minh production đã phát hành.

## Do's and Don'ts

- **Do** keep this as an extension of the existing Operate workspace: dense product rows, human-readable names, source base units and tabular numbers.
- **Do** keep native modal behavior, a required reason, visible failure feedback, version history and named keyboard-focusable scroll regions.
- **Do** distinguish visual inspection from the LOCAL/STAGING stock, permission and retry proofs.
- **Don't** treat removal of a visible tax column as permission to remove source tax.
- **Don't** turn this invoice dialog's dimensions or per-kind editing restrictions into global CRM rules.
- **Don't** overwrite the public homepage design record or refresh existing CRM design artifacts as a side effect of this feature.

### Pre-existing drift left outside this pass

Root `DESIGN.md` is titled “Cohamy local public homepage”; the root `.impeccable/design.json` is absent in this checkout. The present sidecar is `components/crm/.impeccable/design.json`, titled “Cohamy CRM workspace” and dated 2026-09-19. Its older component/narrative content has not been regenerated.

The CRM design document's overview records the Golden-Orange workspace, while portions of its color/layout prose still describe a navy sidebar, a (228px) sidebar and a (76px) top bar. Current `crm-humanbank.css` uses the amber direction, a (260px) desktop sidebar track and a top bar with (62px) minimum height; its older direction comment still says (256px). The captures preserve the existing amber shell. Those inconsistencies predate this ordinary extension. They are reported rather than repaired or canonized here.

No `PRODUCT.md`, `DESIGN.md`, sidecar, surface brief, UI source or screenshot was changed by this documentation pass. Its only output is this file.
