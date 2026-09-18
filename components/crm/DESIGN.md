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

This is a scan of the implemented workspace and its CRM/portal extensions, including governance. `app/(operations)/layout.tsx` loads `components/crm/work.css` followed by `components/crm/upgrade.css`; that cascade and the current shell, pages and forms are the visual authority. The direction is code-led preservation of the incumbent Operate system; there is no approved replacement comp. The former HumanBank launcher, floating dock and glass login are superseded. The retained `crm.css` is historical reference, not the loaded workspace palette. The surface contract records the task strategy; this document records the reusable visual system.

**Key Characteristics:**

- Persistent navy navigation beside white operational surfaces.
- Be Vietnam Pro with compact labels and clear page headings.
- Orange primary actions, text-labeled statuses and visible keyboard focus.
- Mobile request lists and early customer-context disclosures.
- Explicit pending, empty, error and success feedback.
- Native dialogs and disclosures keep quick actions close to their record.
- Dated document-version receipts distinguish acknowledged and current versions.
- Explicit impact previews precede bulk updates and role changes.
- Typed custom fields preserve earlier definition versions; audit comparisons lead with readable Vietnamese.

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

Partner column preferences place visibility, a labeled numeric width and explicit up/down actions in three desktop columns with (16px) gaps and thin row dividers. At the mobile breakpoint, visibility and width share two columns; the wrapping movement actions span the full next row. Column width accepts (80–600px); the implemented defaults are (240px) for the record name and (150px) for other selected fields. The fixed-layout table follows the saved visible order and adds a (120px) quick-view column. Its width is the selected-column sum plus that action column, subject to the existing table minimum; horizontal overflow stays inside the named, keyboard-focusable list region. These widths do not expand the workspace viewport.

Governance previews reuse ordinary forms, headings and record lists rather than a new overlay system. Custom-field definitions, older values and technical audit metadata use native disclosures. Notification hour controls follow the shared two-column form grid, then stack on mobile. Device/session rows wrap their actions on mobile. Technical audit payloads preserve line breaks, inherit the working text font and wrap long content; file checksums also break long strings inside their disclosure.

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

The custom-field key has associated guidance through `aria-describedby`: (2–40) characters, starting with a lowercase Latin letter, followed only by lowercase Latin letters, digits or underscores. The visible example is `muc_tieu_thang`. Native invalid-input feedback repeats that format in Vietnamese, and editing clears the custom validity message. Existing keys are read-only. Keep this help beside the field; it also tells the operator not to use keys for passwords, OTPs or tokens. Required custom values retain their written marker and type-appropriate control; a checkbox's false value is a valid boolean, not an absent required value.

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

Partner column preferences now combine native visibility checkboxes with labeled widths and up/down buttons inside a disclosure. Movement controls name their column and disable the impossible first/last movement; saving is disabled when no column is visible. The saved receipt names visibility, order and width, and further changes clear it. Other checkbox groups retain their legend and native semantics. Task checklists retain written step labels and explicit add/remove/save actions. The prerequisite section links to real prerequisite tasks and writes “Đã xong” or “Chưa xong”; checklist/dependency failures explain why completion was rejected rather than implying success.

### Saved filters and explicit clearing

Filter-saving remains inside its disclosure and separates the name, shared-use checkbox, save action and receipt. “Không gian cá nhân” lists saved filters, labels shared/default state in writing and lets the owner edit the name, keyword, default and shared-use choices. Editing retains the saved filter's other values. A personal default applies only when opening the matching customer/dealer list without an explicit keyword or tags. “Bỏ bộ lọc” supplies an explicit bypass, so clearing does not immediately reapply that default. Keep default selection and current query state distinct; this is a list preference rather than a permission change.

### Bulk and role impact previews

Bulk actions select records on the current list page, choose a care stage or activate/deactivate action and require a reason. The first action is secondary and reads “Xem tác động trước khi áp dụng”; the preview lists each record with written before/after values. A separate primary confirmation applies that preview. Editing any form input invalidates the preview. The UI explains its (10-minute) lifetime and the all-or-nothing contract: changed permissions or versions block the whole batch. Errors identify affected records; success reports the applied count. Preserve this distinction between preview and committed change, without presenting a preview as a saved update.

Changing an account role first displays the actual account, old/new roles, affected session count, new scope and written permissions. It also explains that earlier customer/warehouse assignments are cleared and need reassignment. “Áp dụng quyền đã xem” applies the membership version from that preview; changing the role selection clears the preview. The role choices remain within the account's internal/dealer role family. The profile's “Quyền đang áp dụng” panel states the effective scope and that server checks still govern actions. These impact summaries belong beside the action, before its primary confirmation.

### Typed custom fields and retained values

“Trường tùy chỉnh” shows each definition's version and inactive state in its disclosure. Definition forms offer text, exact number, date, boolean and enumerated choices, with one option per line for enumerations; they also expose required, active, read-role and write-role settings. The write-role legend explains that both read permission and record access are needed. A successful edit reports a new definition version while retaining old values.

Within a record, accessible active fields show their display label and current value, “Cần bổ sung” or “Chưa ghi nhận”. Editable fields use the appropriate select, date input, checkbox or text input with decimal input mode. Read-only roles see the value without a save action. “Giá trị theo định nghĩa cũ” keeps earlier values together with their definition version; do not silently reinterpret them as values of the new type or current definition.

### Notification preferences and session control

Notification preferences use a labeled checkbox group for work, onboarding, support and system messages, plus the implemented in-app channel. Quiet-start/end selects offer hourly choices or “Không đặt giờ”. Help states Vietnam time, retention until the quiet period ends and immediate mandatory security messages. Saving these settings retains other workspace preferences, including selected columns and widths. Do not imply that an email or push channel is available from this form.

Session rows show a device label, sign-in/expiry times and an explicit “Phiên hiện tại” marker. Only other sessions offer an individual end action. “Kết thúc mọi phiên khác” appears when other sessions exist, and its receipt confirms that the current session remains active. Role changes separately disclose revocation in their impact preview. Keep the device description and current-session marker visible; the UI does not claim a location or full device-management system.

### Operator-readable audit history

The audit search exposes action/object keyword, actor and from/to dates. Timeline rows retain actor, timestamp and action/object identity. “Nội dung thay đổi và lý do” leads with Vietnamese attribute names and written “Trước” / “Sau” values, translates known status/role values and displays a recorded reason. Events without a comparison explicitly say that before/after details are absent. Unmapped keys retain their identifier under “Thuộc tính”; do not invent a meaning for them.

The separate nested “Dữ liệu kỹ thuật của sự kiện” disclosure contains the supplied redacted metadata as formatted text. This renderer does not itself redact the payload. Keep that technical disclosure secondary to the comparison and allow long content to wrap, including at (320px). Do not make operators read raw JSON as the only account of a change.

### Native quick actions and note drafts

Quick-create and quick-detail are labeled native `dialog` elements opened with `showModal()`. The browser supplies modal focus handling and normal Escape cancellation; quick-create blocks cancellation and disables its close control while saving. Quick-detail has an explicit native dialog close form. Fetch errors stay in the originating list. Quick-create offers note/task actions only when the current route supplies supported record context; success keeps the user on the working screen.

The record note draft uses an explicit textarea label, serializes overlapping saves and debounces edits by (700ms). Its key carries the record identifier and the request carries record type/version; it is recovered from the scoped draft source. Written receipts distinguish recovered, saving, saved and posted notes. Posting waits for the latest draft save, then clears the draft after adding the note to care history. A draft receipt is not a posted-note receipt, and this implementation does not establish an unload-time flush.

### Private documents and current receipts

Document rows link to a specific private-file version and show title, version number, filename and file size. The upload disclosure lets the user create a document or add a version using a native file input labeled PDF, PNG or JPEG, maximum (8 MB). Acknowledgement is attached to the version: an unacknowledged row offers “Xác nhận đã đọc”, while an acknowledged row replaces that action with “Đã xác nhận” and its dated own-user receipt. The shared action reports pending, error and successful acknowledgement states.

Library lists and detail headings distinguish draft, published and withdrawn content with written labels. Publication controls expose audience, unit scope, effective/expiry dates and required reading; the form error explains that a file is required before publication. Required-reading text refers to acknowledgement of the current version. Older receipts remain attached to their earlier versions and do not make the current-version requirement complete.

### Portal operation groups

Staff rows distinguish the owner from staff and active from locked state in writing; lock/reopen actions reuse the shared action-state control. The portal cart is explicitly a saved per-account draft with SKU, quantity and base unit, not a price quotation or stock posting. Address/profile editing and support use labeled forms in the same working-surface language; support can expose an explicitly labeled internal-note checkbox when allowed. These UI groups do not establish a completed checkout, revenue or financial workflow.

The earlier scoped finish review ended with disposition ship after four UI fixes: the mobile profile accessible name, early mobile customer context, contextual task creation and removed login eyebrow. The extension's review scored its two action-state findings resolved and returned disposition ship. The final governance review also returned disposition ship after resolving two findings: readable Vietnamese audit comparisons with secondary technical metadata, and associated custom-key format/example/invalid-input guidance. Those verdicts score their recorded findings; they do not certify the whole CRM/portal inventory.

Governance browser evidence in `docs/crm/test-results/governance-browser-local.json` reports (9/9) PASS in real Edge/Next with an isolated local QA database, no page errors and (19) screenshot paths spanning desktop (1366px), mobile (390px) and narrow mobile (320px). It covers persistence and the recorded governance workflows. This is local UI evidence, not a statement about production deployment, live provider readiness, complete backend correctness or unopened stock/financial workflows. The earlier local/staging-only scope in `PRODUCT.md` is superseded by the user's explicit push/deploy authorization; authorization is distinct from successful deployment evidence. No commercial policy is inferred here. The sidecar is a preview of visual primitives; its fragment links, inline-open dialog samples and sample text do not perform application actions.

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
- Do retain explicit column order/width controls and confine table scrolling to the list region.
- Do keep saved defaults, editable filters and an explicit clear/bypass action distinct.
- Do show actual bulk/role impacts before a separate confirmation, and invalidate stale previews.
- Do associate custom-key guidance with its control and retain typed values under their definition version.
- Do keep quiet-hour rules, mandatory security notices and the current-session marker readable.
- Do lead audit detail with Vietnamese before/after values and keep redacted technical metadata secondary.

### Don't:

- Don't copy the superseded launcher, floating dock or glass login into this workspace.
- Don't export CRM tokens into the public website or CMS.
- Don't encode status through color alone.
- Don't turn preview-only tonal ramps into application tokens.
- Don't describe the finish review as backend correctness or production approval.
- Don't turn a saved draft, won opportunity or acknowledged older file into a completed transaction or current-version receipt.
- Don't reinterpret older custom-field values under a new definition or imply that preview means committed change.
- Don't substitute raw JSON for readable audit detail or treat the display component as the redaction boundary.
- Don't describe local Edge PASS or deploy permission as production/provider readiness.
