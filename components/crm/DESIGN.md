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
---

# Design System: Cohamy CRM workspace

## Overview

**Creative North Star: "The Cohamy work desk"**

Cohamy operations use a navy navigation rail, white working surfaces and orange primary actions. Be Vietnam Pro and the Cohamy logo carry the identity while compact records, readable labels and local feedback support daily work. This system applies only inside `.cohamy-crm`; the public website and independent CMS retain their own design.

This is a scan of the implemented replacement workspace. `app/(operations)/layout.tsx` loads `components/crm/work.css`; that stylesheet and the current shell, pages and forms are the visual authority. The former HumanBank launcher, floating dock and glass login are superseded. The surface contract records the task strategy; this document records the reusable visual system.

**Key Characteristics:**

- Persistent navy navigation beside white operational surfaces.
- Be Vietnam Pro with compact labels and clear page headings.
- Orange primary actions, text-labeled statuses and visible keyboard focus.
- Mobile request lists and early customer-context disclosures.
- Explicit pending, empty, error and success feedback.

## Colors

The source palette combines deep navy, white and cool gray working paper with burnt orange controls. Frontmatter values are extracted from the current stylesheet; the sidecar's synthesized eight-step ramps are preview-only metadata, not an application palette.

### Primary

Action orange identifies primary buttons and the text caret. Its darker hover and pressed variants distinguish interaction. Focus orange is a separate, slightly lighter source value used by the global keyboard outline. Primary button text is white.

### Secondary

Navy anchors the sidebar and the desktop login story. The navigation hover tone sits between navy and its light labels. Record-link blue identifies ordinary record links and disclosures; it is not the primary button color.

### Neutral

White paper separates sections, forms and the top bar from the cool gray canvas. Ink and muted ink distinguish primary records from explanatory text. Rule, field-rule and button-rule are separate source strokes.

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

The login uses equal story/form columns on desktop. Its form box has a maximum width of (460px), desktop padding (60px 36px), and logo width (180px). Mobile hides the story and uses padding (55px 25px); it does not shrink the inputs.

## Elevation & Depth

The workspace is flat. Borders and background changes distinguish records, filters, forms and navigation. No box-shadow, glass blur, particle canvas or floating dock belongs to the current loaded stylesheet. Layering is structural: desktop sidebar (z-index 30), sticky header (40), mobile backdrop (50), mobile navigation (60), and skip link (100).

Buttons transition background and text color over (160ms ease). No movement is needed to signal control state. The boundary-scoped reduced-motion rule disables transitions and animations and restores automatic scroll behavior.

**The Flat Surface Rule.** Separate working surfaces with borders and tone; the current workspace has no box shadows.

## Shapes

Inputs, statuses and feedback use the shallow field/status corner. Buttons and navigation rows use the slightly rounder control corner. Filters and mobile sections use the medium corner; desktop sections and record forms use the section corner. These are distinct source roles, not a universal radius. Ordinary sections use a one-pixel rule and no shadow.

The navigation rail is rectangular and fills the available viewport height. Status badges are compact rounded rectangles rather than capsules. Login fields share the white outlined field treatment and add icon insets; there is no separate glass-card silhouette.

## Components

### Buttons

Primary buttons use action orange, white text and the button typography role. Secondary buttons are white with ink text and a button-rule border. Both have a minimum height of (42px), horizontal/vertical padding recorded in frontmatter and a shallow control corner. Secondary hover uses quiet-hover; primary hover and pressed states use their own colors.

All focusable elements inherit the focus outline (3px solid, 3px offset). Disabled buttons use opacity (0.6) and a not-allowed cursor. Work forms disable their submit action while pending, show “Đang lưu…” and announce success with status semantics or errors with alert semantics. Their client busy guard prevents duplicate submissions; that is not a claim about backend transaction correctness. The login submit has a minimum height of (48px).

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

The scoped finish review ended with disposition ship after four UI fixes. It covers the mobile profile accessible name, early mobile customer context, contextual task creation and removed login eyebrow. It does not certify backend correctness, production deployment or unopened stock/financial workflows. The sidecar is a preview of visual primitives; its fragment links and sample text do not perform application actions.

## Do's and Don'ts

### Do:

- Do apply this system only inside `.cohamy-crm`.
- Do preserve the Cohamy logo, Be Vietnam Pro and navy/orange identity.
- Do retain visible labels, keyboard focus and accessible names when visible account text is hidden.
- Do keep order/customer follow-up creation within the current record.
- Do keep tables in their own overflow region and use the implemented mobile request lists.
- Do distinguish request status and request value from stock, payment and debt.

### Don't:

- Don't copy the superseded launcher, floating dock or glass login into this workspace.
- Don't export CRM tokens into the public website or CMS.
- Don't encode status through color alone.
- Don't turn preview-only tonal ramps into application tokens.
- Don't describe the finish review as backend correctness or production approval.
