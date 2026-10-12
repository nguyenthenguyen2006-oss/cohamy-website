---
name: "Cohamy local public homepage"
description: "Current local homepage system: original product scenes, cacao, warm paper and gold actions."
colors:
  cacao: "#2c1914"
  paper: "#f0e6d5"
  gold: "#edbe39"
  ink: "#432820"
  rule: "#43282026"
  gold-hover: "#f8d467"
  link-hover: "#765235"
  footer-muted: "#e0cfbd"
typography:
  display:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(64px, 6.95vw, 112px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(40px, 4.5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.1
  section-headline:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(34px, 3.15vw, 46px)"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(23px, 2.3vw, 33px)"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  hero-action:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.4
  navigation:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.65
  flavor:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(20px, 1.9vw, 28px)"
    fontWeight: 700
    lineHeight: 1.65
  link:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.5
  article-row:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.5
  footer-detail:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  action: "5px"
spacing:
  page-gutter: "clamp(20px, 4vw, 64px)"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  grid: "28px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.cacao}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-hero:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.cacao}"
    typography: "{typography.hero-action}"
    rounded: "{rounded.action}"
    padding: "14px 28px"
  text-link:
    textColor: "{colors.ink}"
    typography: "{typography.link}"
  text-link-hover:
    textColor: "{colors.link-hover}"
  product-article:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  homepage-navigation:
    backgroundColor: "{colors.cacao}"
    textColor: "{colors.paper}"
    typography: "{typography.navigation}"
  homepage-navigation-hover:
    textColor: "{colors.gold}"
  flavor-navigation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.flavor}"
    padding: "20px clamp(20px, 4vw, 64px)"
  article-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.article-row}"
    padding: "16px 0"
  contact-disclosure:
    backgroundColor: "{colors.cacao}"
    textColor: "{colors.footer-muted}"
    typography: "{typography.footer-detail}"
  mobile-menu-control:
    backgroundColor: "{colors.cacao}"
    textColor: "{colors.paper}"
---

# Design System: Cohamy local public homepage

## Overview

**Creative North Star: "Cacao Scenes"**

"Cacao Scenes" is the visual world selected as direction C. Original Cohamy product and exhibition photographs lead the page; warm paper carries product selection and article links, while cacao carries the shell and action scenes. Strong serif headings and simple gold actions keep the product legible within the photographs.

This file records the **current LOCAL public homepage only**: `app/[locale]/page.tsx`, `components/home/CacaoHome.tsx`, its CSS module, and the homepage branches of `components/Header.tsx` and `components/Footer.tsx`. The locale-aware pathname must be `/` for those shell branches. Other public routes retain their incumbent header, footer and styles. CRM and portal retain their own system; `components/crm/DESIGN.md` remains separate and authoritative for that scope.

The tokens below come from the implemented source after the latest bounded correction batch. The selected scene sequence remains in `.impeccable/surfaces/app-locale-page-tsx.md`; it is not a mandate for every future route. Documentation is a local source record, not a production release, a browser/QA result or an Impeccable gate approval.

**The Homepage Boundary Rule.** Apply this system only to the locale-aware homepage and its homepage shell branches. Read the incumbent system before extending any other surface.

**The Original Asset Rule.** Use the original photographs and transparent wordmark. Cropping, masking and readable scrims belong to the layout; redrawing package pixels or the brand mark does not.

**Key Characteristics:**

- Original product photographs and the original transparent gold wordmark.
- Cacao and paper surfaces with a compact gold action vocabulary.
- Playfair Display headings paired with Manrope controls and supporting text.
- Open photo articles, fine rules and underlined text links.
- Responsive scene crops and a compact mobile shell.

**Status and findings not canonized:** The build-phase spec remains open with a refused gate for the generated comp's header/footer wordmark regions; no force or manual chosen-font override is recorded. The original shipping assets remain the visual authority. The tool ranked Rasa 700 first, but visual review rejected its character; the current source uses Playfair Display 700. The second independent finish verdict in `.impeccable/review/verdict-round-2.md` records the scored visual fixes and partner-heading regression as resolved while technical persistence remains partial, with pending machine phases and diagnostic drift. These process findings and fidelity scores are not tokens or future design rules.

## Colors

The palette uses deep cacao and warm paper as large surfaces, gold for actions, and brown ink for reading. The frontmatter holds the exact CSS colors; prose names their roles.

### Primary

- **Gold** (`colors.gold`): the filled actions and supplied wordmark. **Gold hover** (`colors.gold-hover`) is the action's lighter response.
- **Cacao** (`colors.cacao`): homepage header, footer, partner band, and the dark basis for hero/gift scrims.

### Neutral

- **Warm paper** (`colors.paper`): product, brand-copy, activity and article surfaces; readable text on cacao.
- **Brown ink** (`colors.ink`): headings, product titles and content links on paper.
- **Fine ink rule** (`colors.rule`): the alpha border separating flavor selection, brand and article rows.
- **Link hover** (`colors.link-hover`): the warm response for underlined text links.
- **Muted footer paper** (`colors.footer-muted`): copyright and the contact disclosure in the compact footer.

**The Paper and Cacao Rule.** Use paper with ink for open content, and cacao with paper for the shell and photographic action scenes. Gold identifies actions and the supplied wordmark.

The scrims use alpha forms of cacao, and the photo-edge masks transition from transparent to opaque. Those are scene treatments, not additional accent families.

The sidecar's tonal strips are derived previews of the canonical colors. Their synthesized OKLCH steps are not additional surface tokens used by the current page.

## Typography

**Display Font:** Playfair Display (Georgia, serif fallback). The source loads weights 500, 600 and 700; the homepage headings use 700.

**Body Font:** Manrope (the loaded fallback, then the sans-serif stack where inherited). The source loads weights 400, 500, 600 and 700.

**Character:** Contrasting thick and thin serif strokes give headings the character chosen in C. Manrope keeps the labels, navigation and supporting copy direct. Heading balance is an implemented wrapping treatment, not a fixed line-count promise.

### Hierarchy

| Role | Use |
| --- | --- |
| `display` | The two hero lines. Base desktop scale is in frontmatter; this role has locale and breakpoint overrides below. |
| `headline` | The catalog heading. At mobile widths it is left aligned and uses the source's smaller size. |
| `section-headline` | Activity and blog section headings. |
| `title` | Product names under photographs. |
| `body` | Inherited supporting text. The root rem size is 17px, then 18px from 768px. |
| `label` / `hero-action` | Gold actions, with a larger desktop hero variant. |
| `navigation` / `flavor` | Shell navigation and the eight product-flavor links. |
| `link` / `article-row` | Underlined actions and CMS article rows. |
| `footer-detail` | Copyright and the native contact disclosure. |

Desktop hero supporting copy uses a fluid size (`clamp(18px, 1.65vw, 24px)`), a line height (1.5) and a measure (420px). The hero line size changes at 1100px and 900px before the mobile treatment at 600px. English has a smaller display measure; Chinese, Korean and Japanese use a more open line height and normal tracking.

At 600px and below, the hero title uses `clamp(27px, 8.1vw, 46px)`, line height (1.12) and tracking (-0.035em). English uses `clamp(26px, 7.2vw, 42px)` with line height (1.05); Chinese, Korean and Japanese use `clamp(24px, 7vw, 38px)` with line height (1.18). Supporting copy becomes 14px with line height (1.55) and a measure (178px). The catalog heading becomes 34px, section headings 32px, product titles 21px, and flavor labels switch to Manrope at 12px/500.

**The Two Voice Rule.** Use Playfair Display at weight 700 for homepage display headings and Manrope for body copy, navigation and controls. The recorded tool-ranked Rasa face is not the current implementation.

The type ramp is fluid and role-specific. It does not use a single invented scale ratio.

## Layout

The page uses full-width scenes with a shared fluid side gutter (`spacing.page-gutter`). Open content is aligned to that gutter rather than enclosed by separate floating cards. Reused gaps and section padding are recorded in the spacing scale; individual scene geometry remains specific to this homepage.

- **Desktop shell:** sticky header, height (84px), logo width (211px), navigation to the right and controls at the end. At 1100px the logo becomes 170px and navigation reduces its type and gaps.
- **Mobile shell:** at 900px the header becomes a three-column grid: menu left, wordmark centered, locale/order controls right. Height is 70px, then 64px at 600px. The wordmark becomes 142px at 600px; a narrow-width order-control case reduces it to 100px at 360px.
- **Product selection:** three equal columns with a gap (`spacing.grid`). At 600px it becomes two columns, with the last product spanning both. Standard photo aspect is (0.963); the spanning mobile photo uses (1.4).
- **Flavor selection:** a horizontal group on desktop, a four-column grid from 900px, with compact Manrope labels from 600px. These are navigation links, not filter chips.
- **Brand scene:** image and copy share one two-column scene (64.3% image). At 900px the scene stacks. At 600px the title, photo and action form a reading sequence through the existing ordering rules.
- **Photographic action scenes:** hero and gift have a broad backdrop plus a focal product crop. Desktop backdrop scale is (2); mobile scale is (4), anchored at the left bottom so the foreground ingredients and light continue behind copy. The focal crops use gradient masks, with a cacao scrim protecting text.
- **Footer:** desktop groups logo/contact and navigation horizontally. Mobile uses two columns, with logo/contact at left and a bordered navigation column at right; the native contact disclosure moves below.

At 1800px and above, the hero's left padding can use a centered measure based on (1720px). The sidecar records actual breakpoints, including the inherited root type change. Reduced motion keeps scrolling automatic and removes transitions in the homepage, header and footer scopes.

## Elevation & Depth

Homepage scenes and content articles are flat at rest. Depth comes from original photographs, paper/cacao contrast, fine separators and readable scrims. No box-shadow is declared in the homepage CSS module. The existing shared locale switcher still carries its incumbent rounded, shadowed popover; that control does not establish a new card-shadow vocabulary.

**The Flat Content Rule.** Keep product articles and article rows flat. The photograph, surface contrast and fine rules provide the depth; the existing locale popover retains its incumbent treatment.

Color transitions on gold actions last (160ms) with `ease`. Underlined links and navigation change color or underline without moving the content. Focus is a visible outline (3px, current color) with an offset (5px); the footer disclosure uses gold with an offset (4px).

## Shapes

Gold actions have the small corner radius in `rounded.action`. Product and exhibition photos retain rectangular frames with intentional cover crops. Product articles have no card border or enclosing radius; fine rules divide the larger content groups. Hero and gift masks blend their focal photo edge into the scene.

The shared locale control remains a rounded control with its own incumbent dropdown. That existing shape is separate from the small corners on gold actions.

**The Small Corner Rule.** Use the action radius for gold actions. Keep product and exhibition photographs rectangular; preserve the existing locale control rather than restyling it as a product card.

## Components

### Buttons

Gold actions are compact, readable and flat.

- **Primary:** gold background, cacao text, action radius, and the `label` type role. Desktop padding is recorded in `components.button-primary`; minimum height is (56px).
- **Hero:** uses `hero-action` type with minimum height (76px) and minimum width (340px), capped by the available width.
- **Mobile:** ordinary actions use minimum height (44px), padding (11px 20px) and type (14px/700). The hero action uses padding (11px 14px) and type (13px/700), with no minimum width.
- **States:** gold-hover on hover; the shared visible-focus outline applies to links. Color transitions are suppressed for reduced motion.
- **Variants:** the current homepage has one filled gold action family. Text links provide its quieter navigation/action treatment.

### Text Links

Underlining carries the quieter action vocabulary.

- **Shape:** inline flex with a minimum height (44px), no filled container, and an arrow drawn as SVG.
- **Type:** `link` role; gap (12px), underline offset (4px). On mobile the type becomes 13px and gap becomes 8px.
- **States:** link-hover color and the shared keyboard outline.

### Product Articles

The photo and product name stay open on paper.

- **Background:** inherited paper, with ink titles and links.
- **Form:** a rectangular original photograph, followed by a serif title and an underlined product link; no price, review or stock badge is synthesized.
- **Internal rhythm:** title top margin (18px), then (10px) on mobile. There is no enclosing card padding or shadow.
- **Behavior:** the photo link is skipped by keyboard and hidden from assistive technology because the adjacent named product link provides the destination. Source product names and locale-aware slugs remain authoritative.

### Navigation

The shell is visually quiet enough for the original logo and product imagery.

- **Desktop:** paper links on cacao with the `navigation` type role; links have vertical padding (12px), and hover becomes gold.
- **Mobile:** a minimum target (44px) toggles the menu, with `aria-expanded`, a controlled navigation region and Escape handling. Menu links close the menu on selection.
- **Locale/order controls:** the actual shared language control remains; the cart is present only when the real order-intake flag is enabled.
- **Flavor navigation:** eight direct product links use the `flavor` role on desktop and the compact Manrope treatment on mobile. Hover underlines at an offset (6px).

### Article Rows

CMS article titles form a simple ruled list.

- **Structure:** ink text on paper, an arrow at the end, and a bottom fine rule. The list also has a top rule.
- **Type and padding:** `article-row` role and recorded vertical padding; mobile uses 14px type.
- **States:** the title underlines on hover at an offset (5px); the link keeps the shared keyboard outline.
- **Data behavior:** the source requests two featured CMS posts. If none are returned, it keeps the section heading and index link without inventing article rows.

### Contact Disclosure

The footer keeps company/contact/navigation together and exposes addresses through native `details` and `summary`.

- **Structure:** cacao with muted footer-paper text; footer-detail type, minimum summary height (44px) and vertical summary padding (12px).
- **States:** native open/closed behavior, a gold keyboard outline, and gold hover on links.
- **Mobile:** contact and navigation retain separate columns; email can break at the actual `@` using `wbr`. Source contact details and external targets remain unchanged.

The sidecar contains self-contained `ds-` examples of implemented primitives. It embeds the original product photograph for its product-article example and expands framework utilities to CSS. It introduces no input, chip or dialog pattern that this homepage does not implement.

## Do's and Don'ts

### Do:

- **Do** apply the Homepage Boundary Rule before using these tokens.
- **Do** keep original asset pixels, logo transparency and existing product/link targets.
- **Do** use the documented gold action and underlined link variants with visible keyboard focus.
- **Do** retain the observed mobile hierarchy and locale-specific heading sizes.
- **Do** suppress color transitions when reduced motion is requested.
- **Do** source article titles from the existing CMS and retain the actual order-intake flag.

### Don't:

- **Don't** propagate this homepage world into other public routes, CRM or portal without a separate authorized change.
- **Don't** use the tool-ranked Rasa result as the homepage display rule; the current source uses Playfair Display.
- **Don't** replace the original wordmark or product packaging with reconstructed artwork.
- **Don't** add prices, reviews, certification claims or other product facts that the existing source does not provide.
- **Don't** turn unresolved comp clipping, fidelity drift or a refused gate into a reusable design-system rule.
