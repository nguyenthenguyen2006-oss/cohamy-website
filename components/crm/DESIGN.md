---
name: Cohamy CRM workspace
description: Boundary-local design system extracted from the implemented operations workspace.
colors:
  action-orange: "#b9420c"
  action-hover: "#983409"
  action-pressed: "#802906"
  focus-orange: "#bf4b14"
  navy: "#172b43"
  nav-hover: "#243e58"
  nav-text: "#dae4ee"
  modal-backdrop: "rgb(23 43 67 / .4)"
  white-paper: "#fff"
  canvas: "#f4f6f8"
  ink: "#182538"
  muted-ink: "#586577"
  rule: "#dbe2e8"
  field-rule: "#aebbc7"
  button-rule: "#bac7d1"
  quiet-hover: "#eef2f5"
  record-link: "#225b86"
  status-paper: "#eef2f6"
  status-ink: "#455366"
  pending-paper: "#fff0df"
  pending-ink: "#854509"
  progress-paper: "#eaf1ff"
  progress-ink: "#244d8b"
  ready-paper: "#e6f5ed"
  ready-ink: "#175f40"
  error-paper: "#fff0ef"
  rejected-ink: "#9d2929"
  error-ink: "#a22424"
  success-ink: "#166344"
typography:
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.6
  button:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  status:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.6
rounded:
  field-and-status: "5px"
  control: "6px"
  toolbar-and-mobile-section: "8px"
  section: "10px"
spacing:
  label-gap: "7px"
  control-gap: "8px"
  toolbar-gap: "12px"
  form-gap: "16px"
  field-grid-gap: "18px"
  section-heading-gap: "20px"
  section-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-orange}"
    textColor: "{colors.white-paper}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-primary-active:
    backgroundColor: "{colors.action-pressed}"
  button-secondary:
    backgroundColor: "{colors.white-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.white-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field-and-status}"
    padding: "9px 11px"
  navigation:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.nav-text}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
  navigation-active:
    backgroundColor: "{colors.white-paper}"
    textColor: "{colors.navy}"
  status:
    backgroundColor: "{colors.status-paper}"
    textColor: "{colors.status-ink}"
    typography: "{typography.status}"
    rounded: "{rounded.field-and-status}"
    padding: "5px 8px"
  status-ready:
    backgroundColor: "{colors.ready-paper}"
    textColor: "{colors.ready-ink}"
  section:
    backgroundColor: "{colors.white-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.section}"
    padding: "24px"
  disclosure:
    textColor: "{colors.record-link}"
    padding: "10px 0"
  quick-create-dialog:
    backgroundColor: "{colors.white-paper}"
    rounded: "{rounded.toolbar-and-mobile-section}"
    padding: "24px"
    width: "min(650px, calc(100vw - 32px))"
  detail-dialog:
    backgroundColor: "{colors.white-paper}"
    padding: "28px"
    width: "min(520px, 100vw)"
    height: "100dvh"
  checkbox-columns:
    padding: "16px"
---

# Design System: Cohamy CRM workspace

## Overview

**Creative North Star: "The Cohamy work desk"**

Cohamy operations use a navy navigation rail, white working surfaces and orange primary actions. Be Vietnam Pro and the Cohamy logo carry the identity while compact records, readable labels and local feedback support daily work. This system applies only inside `.cohamy-crm`; the public website and independent CMS retain their own design.

This is a scan of the implemented workspace and its local CRM/portal extension. `app/(operations)/layout.tsx` loads `components/crm/work.css` followed by `components/crm/upgrade.css`; that cascade and the current shell, pages and forms are the visual authority. The former HumanBank launcher, floating dock and glass login are superseded. The retained `crm.css` is historical reference, not the loaded workspace palette. The surface contract records the task strategy; this document records the reusable visual system.

**Key Characteristics:**

- Persistent navy navigation beside white operational surfaces.
- Be Vietnam Pro with compact labels and clear page headings.
- Orange primary actions, text-labeled statuses and visible keyboard focus.
- Mobile request lists and early customer-context disclosures.
- Explicit pending, empty, error and success feedback.
- Native dialogs and disclosures keep quick actions close to their record.
- Dated document-version receipts distinguish acknowledged and current versions.

## Colors

The source palette combines deep navy, white and cool gray working paper with burnt orange controls. Frontmatter values are extracted from the current stylesheet; the sidecar's synthesized eight-step ramps are preview-only metadata, not an application palette.

### Primary

Action orange identifies primary buttons and the text caret. Its darker hover and pressed variants distinguish interaction. Focus orange is a separate, slightly lighter source value used by the global keyboard outline. Primary button text is white.

### Secondary

Navy anchors the sidebar and the desktop login story. The navigation hover tone sits between navy and its light labels. Record-link blue identifies ordinary record links and disclosures; it is not the primary button color.

### Neutral

White paper separates sections, forms and the top bar from the cool gray canvas. Ink and muted ink distinguish primary records from explanatory text. Rule, field-rule and button-rule are separate source strokes.

Modal-backdrop is the implemented navy-alpha overlay shared by the quick-create and quick-detail dialogs. It dims the underlying workspace without blur or shadow. The mobile navigation backdrop retains its separate source color; it is not a new modal token.

Pending, in-progress, ready and rejected statuses pair tinted paper with readable ink and a written label. Success feedback is plain green text; errors use red text on error paper. Status colors do not imply that unopened business transactions are available.

**The Boundary Rule.** CRM color assignments stay inside `.cohamy-crm`; they do not become public-site or CMS tokens.

## Typography

Be Vietnam Pro is the only text family, with system-ui and sans-serif fallbacks. The operations layout imports weights 400, 500, 600, 700 and 800; each role uses the weight in the source, not all imported weights. Phosphor icons accompany navigation and controls.

The display role belongs to the desktop login story. Page headlines are smaller and tighten to (23px) at the mobile breakpoint; the login form heading is (28px). Section titles use the title role and become (16px) on mobile. Body copy starts at the body role, while most table records and task descriptions use (13px); labels use (12px), and status badges, table headers and secondary metadata use (11px). Input text remains (14px). There is no invented modular scale or separate monospace face.

Description paragraphs use a maximum line length of (75ch). Monetary columns and totals use tabular numerals and avoid wrapping; long identifiers, notes and names can wrap.

**The One Family Rule.** Use Be Vietnam Pro throughout the operations boundary, including forms and navigation.

## Layout

The desktop shell has a sticky white top bar (76px high), a fixed navy sidebar (228px wide) beneath it, and main content offset by the sidebar. Content is capped at (1440px); default main padding is (22px 32px 0). Beyond (1700px), horizontal padding grows to (60px). The logo is (153px wide) in the header.

At (1100px) and below, the sidebar narrows to (205px), main padding becomes (20px), and the detail page switches from main content plus a (290px) aside to one column. The aside temporarily uses two columns; shortcut links become two columns.

At (760px) and below, the header is (64px), the logo is (118px), and main padding is (18px 16px 0). A labeled menu toggle exposes a (260px) sidebar and a dimmed click-to-close backdrop. The toggle reports expanded state and controls the navigation region; choosing a destination closes it. Visible account text disappears, but the profile link retains its explicit accessible name. This implementation does not establish a modal focus trap or Escape-key contract.

Mobile forms use one column. Sections reduce from the frontmatter section padding to (18px). Orders and product lines switch from desktop tables to stacked mobile records. Other tables retain a (660px) minimum width inside a local overflow region. Detail pages show the customer name, call action and customer-context disclosure before products; the desktop contact aside is hidden on mobile. This behavior follows the final source cascade.

The opportunity board contains five columns, each at least (230px), with (20px) gaps and horizontal scrolling confined to its named, keyboard-focusable region. Column headings, thin top rules and record separators establish the stages; there is no drag-and-drop contract. Checklist rows place the checkbox label, step text and removal action in three desktop columns; mobile moves the label above the text/action pair. Draft-cart rows place SKU, quantity, unit and removal in four desktop columns; mobile uses two columns with the SKU across both.

The quick-create dialog uses the frontmatter width and padding with viewport margins (16px per side), a maximum height of (100dvh minus 32px), and centered placement. The quick-detail dialog occupies the right edge, uses the frontmatter width and padding, fills the viewport height and scrolls internally. On mobile the quick-create trigger hides its text and becomes (38px) wide, retaining the accessible name “Tạo nhanh”. These dialog behaviors are separate from the collapsing navigation.

The login uses equal story/form columns on desktop. Its form box has a maximum width of (460px), desktop padding (60px 36px), and logo width (180px). Mobile hides the story and uses padding (55px 25px); it does not shrink the inputs.

## Elevation & Depth

The workspace is flat. Borders and background changes distinguish records, filters, forms and navigation. No box-shadow, glass blur, particle canvas or floating dock belongs to the current loaded stylesheet. Layering is structural: desktop sidebar (z-index 30), sticky header (40), mobile backdrop (50), mobile navigation (60), and skip link (100). Native dialogs opened with `showModal()` use the browser top layer and the shared modal-backdrop; do not assign them a competing shell z-index.

Buttons transition background and text color over (160ms ease). No movement is needed to signal control state. The boundary-scoped reduced-motion rule disables transitions and animations and restores automatic scroll behavior.

**The Flat Surface Rule.** Separate working surfaces with borders and tone; the current workspace has no box shadows.

## Shapes

Inputs, statuses and feedback use the shallow field/status corner. Buttons and navigation rows use the slightly rounder control corner. Filters and mobile sections use the medium corner; desktop sections and record forms use the section corner. These are distinct source roles, not a universal radius. Ordinary sections use a one-pixel rule and no shadow.

The navigation rail is rectangular and fills the available viewport height. Status badges are compact rounded rectangles rather than capsules. Login fields share the white outlined field treatment and add icon insets; there is no separate glass-card silhouette.

## Components

### Buttons

Primary buttons use action orange, white text and the button typography role. Secondary buttons are white with ink text and a button-rule border. Both have a minimum height of (42px), horizontal/vertical padding recorded in frontmatter and a shallow control corner. Secondary hover uses quiet-hover; primary hover and pressed states use their own colors.

All focusable elements inherit the focus outline (3px solid, 3px offset). Disabled buttons use opacity (0.6) and a not-allowed cursor. Shared data forms and action buttons use a synchronous ref guard plus rendered pending/disabled state, change their action text while awaiting a request, announce success with status semantics and errors with alert semantics. Saved-filter submission uses the same guard and clears the saved receipt when its name changes. Column selection separately disables its save action while pending and reports errors. These are implemented client action states, not a claim about backend transaction correctness or every control being protected identically. The login submit has a minimum height of (48px).

### Inputs / Fields

Labels are explicit, arranged above their controls with the label gap. Inputs, selects and textareas have a white background, field-rule border, field corner and minimum height (42px). Input text is (14px) with line-height (1.5); placeholders are a muted source tone. Textareas resize vertically. Keyboard focus uses the shared outline; the source does not define a separate hover field style or a dedicated invalid-field border.

Login fields have minimum height (48px), left inset (42px), right inset (45px), and an icon/visibility control in the field wrapper. Checkboxes are (18px) with orange accent. Form grids use two equal columns and the field-grid gap before collapsing on mobile.

### Cards / Containers

Work sections and record forms are white, rule-bounded containers with the section corner and padding. Table sections remove side/bottom padding around the table while retaining inset headings. Filter bars use the medium corner, (18px) padding and a wrapping flex layout; mobile padding is (14px). These are task groups, not ornamental dashboard tiles.

### Navigation

Sidebar links use icons, readable sentence-case labels and the control corner. Active links reverse to white with navy text and weight (600); connected module links and the desk identify the current page with aria-current. Other links gain nav-hover on hover. Pending destinations sit in a native “Chưa mở giao dịch” disclosure. The footer keeps profile/security and sign-out reachable.

Quick filter tabs use muted labels, then orange text and a (2px) underline for the active class. They are links that change query parameters, not scripted ARIA tab widgets. The shell includes a keyboard-revealed skip link and breadcrumb navigation.

### Chips / Statuses

Status badges use (5px 8px) padding, the status corner and compact text. Default, pending-review, in-progress, ready and rejected variants are present. Each carries a written status; they are non-interactive labels without fabricated hover behavior. READY means the request is agreed with the customer, not that stock, ownership, payment or debt has been posted.

### Tables, tasks and disclosures

Tables use subdued headers, thin row rules and a light row hover. Numeric columns align right where the source marks them. Desktop table wrappers are named and keyboard-focusable; mobile order/product lists retain their actual record context. Empty lists explain what can be done next without invented metrics.

Native disclosures reveal task creation, assignments, audit history and mobile contact facts. Their summary uses record-link blue and visible keyboard focus; opening adds spacing below the summary. Within an order or customer record, an empty task section points directly to “Tạo việc và đặt hạn” underneath it. The global task-list empty state separately links to the order list. Timeline entries use thin rules, author/time metadata and wrapping notes.

Column preferences are native checkboxes grouped under a legend in a wrapping, bordered fieldset. Filter-saving remains inside its disclosure and separates the name, shared-use checkbox, save action and receipt. Task checklists retain written step labels and explicit add/remove/save actions. The prerequisite section links to real prerequisite tasks and writes “Đã xong” or “Chưa xong”; checklist/dependency failures explain why completion was rejected rather than implying success.

### Native quick actions and note drafts

Quick-create and quick-detail are labeled native `dialog` elements opened with `showModal()`. The browser supplies modal focus handling and normal Escape cancellation; quick-create blocks cancellation and disables its close control while saving. Quick-detail has an explicit native dialog close form. Fetch errors stay in the originating list. Quick-create offers note/task actions only when the current route supplies supported record context; success keeps the user on the working screen.

The record note draft uses an explicit textarea label, serializes overlapping saves and debounces edits by (700ms). Its key carries the record identifier and the request carries record type/version; it is recovered from the scoped draft source. Written receipts distinguish recovered, saving, saved and posted notes. Posting waits for the latest draft save, then clears the draft after adding the note to care history. A draft receipt is not a posted-note receipt, and this implementation does not establish an unload-time flush.

### Private documents and current receipts

Document rows link to a specific private-file version and show title, version number, filename and file size. The upload disclosure lets the user create a document or add a version using a native file input labeled PDF, PNG or JPEG, maximum (8 MB). Acknowledgement is attached to the version: an unacknowledged row offers “Xác nhận đã đọc”, while an acknowledged row replaces that action with “Đã xác nhận” and its dated own-user receipt. The shared action reports pending, error and successful acknowledgement states.

Library lists and detail headings distinguish draft, published and withdrawn content with written labels. Publication controls expose audience, unit scope, effective/expiry dates and required reading; the form error explains that a file is required before publication. Required-reading text refers to acknowledgement of the current version. Older receipts remain attached to their earlier versions and do not make the current-version requirement complete.

### Portal operation groups

Staff rows distinguish the owner from staff and active from locked state in writing; lock/reopen actions reuse the shared action-state control. The portal cart is explicitly a saved per-account draft with SKU, quantity and base unit, not a price quotation or stock posting. Address/profile editing and support use labeled forms in the same working-surface language; support can expose an explicitly labeled internal-note checkbox when allowed. These UI groups do not establish a completed checkout, revenue or financial workflow.

The earlier scoped finish review ended with disposition ship after four UI fixes: the mobile profile accessible name, early mobile customer context, contextual task creation and removed login eyebrow. The extension's first review requested two action-state fixes; the final verdict scored both resolved and returned disposition ship. That verdict scores those two findings only. Neither review certifies the whole CRM/portal inventory, backend correctness, production deployment or unopened stock/financial workflows. The sidecar is a preview of visual primitives; its fragment links, inline-open dialog samples and sample text do not perform application actions.

## Do's and Don'ts

### Do:

- Do apply this system only inside `.cohamy-crm`.
- Do preserve the Cohamy logo, Be Vietnam Pro and navy/orange identity.
- Do retain visible labels, keyboard focus and accessible names when visible account text is hidden.
- Do keep order/customer follow-up creation within the current record.
- Do keep tables in their own overflow region and use the implemented mobile request lists.
- Do distinguish request status and request value from stock, payment and debt.
- Do retain native dialog/disclosure semantics and written pending, error and saved receipts on implemented action forms.
- Do show dated acknowledgement on its own document version and check required reading against the current version.

### Don't:

- Don't copy the superseded launcher, floating dock or glass login into this workspace.
- Don't export CRM tokens into the public website or CMS.
- Don't encode status through color alone.
- Don't turn preview-only tonal ramps into application tokens.
- Don't describe the finish review as backend correctness or production approval.
- Don't turn a saved draft, won opportunity or acknowledged older file into a completed transaction or current-version receipt.
