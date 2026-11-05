---
name: "Cohamy public storefront and shared footer"
description: "Compact public storefront and shared footer: whole original photographs, cacao, warm paper and gold actions."
colors:
  cacao: "#2c1914"
  paper: "#f0e6d5"
  gold: "#edbe39"
  ink: "#432820"
  rule: "#43282026"
  gold-hover: "#f8d467"
  link-hover: "#765235"
  footer-muted: "#e0cfbd"
  metadata-ink: "#73584d"
typography:
  display:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(40px, 4.5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(28px, 2.5vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
  section-headline:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "clamp(28px, 2.5vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "var(--font-playfair), Georgia, serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
  hero-action:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
  navigation:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.65
  flavor:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.65
  link:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  article-row:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.6
  metadata:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.75
  commerce-action:
    fontFamily: "var(--font-cart-heading), sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.01em"
  commerce-title:
    fontFamily: "var(--font-cart-heading), sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.15
  footer-detail:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  footer-heading:
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.65
rounded:
  action: "5px"
  gallery: "12px"
spacing:
  page-gutter: "clamp(20px, 4vw, 64px)"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  grid: "24px"
  grid-row: "36px"
  scene: "44px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.cacao}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-hero:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.cacao}"
    typography: "{typography.hero-action}"
    rounded: "{rounded.action}"
    padding: "12px 22px"
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
    padding: "12px clamp(20px, 4vw, 64px)"
  article-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.article-row}"
    padding: "16px 0"
  public-footer:
    backgroundColor: "{colors.cacao}"
    textColor: "{colors.footer-muted}"
    typography: "{typography.footer-detail}"
    padding: "64px clamp(20px, 4vw, 64px) 28px"
  public-footer-heading:
    textColor: "{colors.paper}"
    typography: "{typography.footer-heading}"
  mobile-menu-control:
    backgroundColor: "{colors.cacao}"
    textColor: "{colors.paper}"
---

# Design System: Cohamy public storefront and shared footer

## Overview

**Creative North Star: "Cacao Scenes"**

"Cacao Scenes" keeps the original Cohamy product and exhibition photographs, warm paper, cacao fields and gold actions. Playfair Display supplies the heading character; Manrope carries navigation, supporting copy and facts. The user-authorized refinement makes public typography smaller and displays complete photographs instead of the previous cover crops.

This source record covers the locale-aware homepage (`components/home/CacaoHome.tsx` and its CSS module), the homepage header, the shared public footer, and the approved public type boundary in `app/globals.css` / `app/[locale]/layout.tsx`. The image-framing refinement also covers `components/ActivityGallery.tsx` and the About page. Other public routes keep their incumbent structures while inheriting the smaller public root/Tailwind type scale and compact non-home navigation. CRM, portal and administration keep their existing root/type behavior; `components/crm/DESIGN.md` remains authoritative for those workspaces.

The current contract is `.impeccable/surfaces/components-home-cacaohome-tsx.md`. This is an approved refinement of the established world, not a new comp reproduction or a new visual identity. This document records final source; environment-specific browser results, review verdict and deployment evidence are separate records.

**The Public Boundary Rule.** Apply the public 16px root and scoped type variables only when `[data-public-storefront]` is present. Apply the homepage scene/header system only to the locale-aware homepage. The documented shared footer applies across public routes. Keep internal CRM/portal typography outside this boundary.

**The Original Asset Rule.** Keep original photograph and wordmark pixels. Show complete promotional, About and gallery frames at their actual aspect ratios; product photo slots use `object-fit: contain`. Do not redraw packaging or the supplied brand mark.

**Key Characteristics:**

- Original product photographs and the original transparent gold wordmark.
- Cacao and paper surfaces with compact gold actions.
- Playfair Display headings with Manrope controls and supporting text; the existing Barlow Condensed commerce face retains its limited purchase/catalog role.
- Eight open product articles in a four-column desktop grid, with prices and commerce controls supplied by the existing components.
- Whole photographic frames in balanced content rows, fine rules, underlined links and a compact mobile shell.

**Historical process findings not canonized:** The build-phase spec remains open with a refused gate for the generated comp's header/footer wordmark regions; no force or manual chosen-font override is recorded. The original shipping assets remain the visual authority. The tool ranked Rasa 700 first, but visual review rejected its character; the current source uses Playfair Display 700. The second independent finish verdict in `.impeccable/review/verdict-round-2.md` records the scored visual fixes and partner-heading regression as resolved while technical persistence remains partial, with pending machine phases and diagnostic drift. These process findings and fidelity scores are not tokens or future design rules.

## Colors

The palette retains deep cacao, warm paper, gold actions and brown reading ink. Frontmatter owns the exact primitives.

- **Gold / gold-hover:** the filled actions, their hover response and the supplied wordmark.
- **Cacao:** homepage header, hero, gift and partner surfaces, plus the shared footer.
- **Warm paper:** product, team, activity and article surfaces; foreground text on cacao.
- **Brown ink / fine ink rule / link-hover:** headings, reading, separators and quieter text-link response.
- **Metadata ink:** the existing warm brown `#73584d`, used for readable activity date/location information and commerce secondary text.
- **Muted footer paper:** shared-footer facts, links and copyright; warm paper distinguishes footer headings and legal company name.

**The Paper and Cacao Rule.** Use paper with ink for open homepage content and cacao with paper for the shell and action scenes. Gold identifies actions and the supplied wordmark.

The existing commerce controls retain their own white/brown values from `product-purchase.css`; this record does not replace that palette or turn every scanner advisory into a new global color. Whole-image scenes no longer need broad backdrop zooms, photo masks or readability scrims.

## Typography

**Heading face:** Playfair Display, Georgia/serif fallback; homepage headings use weight 700. **Supporting face:** Manrope and the incumbent sans-serif fallback. Root loads Playfair 500/600/700 and Manrope 400/500/600/700. Existing purchase actions and non-home catalog card titles use Barlow Condensed through `--font-cart-heading`; this is the retained commerce voice, not a new display family.

### Hierarchy

| Role | Actual use and responsive behavior |
| --- | --- |
| `display` | Homepage hero: `clamp(40px, 4.5vw, 64px)`, line-height 1.08, tracking -0.025em. English uses 38–60px; Chinese/Korean/Japanese use 36–54px with line-height 1.2 and normal tracking. At 900px the default title is 42px. At 600px the default/English title uses 30–40px; CJK uses 28–36px. |
| `headline` / `section-headline` | Catalog, team, gift, activity and blog headings share 28–36px / 1.2. At 600px these use 28px; the catalog heading is left aligned. |
| `title` | Homepage product names: 20px / 1.3, becoming 17px at 600px. A minimum 2.6em title area helps align the commerce content. |
| `body` | Public root/body is 16px / 1.65. Hero supporting copy is 16px with a 40ch measure. Team/activity copy has a 48ch measure and line-height 1.75. Narrow promotional supporting copy is 15px. |
| `label` / `hero-action` | One gold action treatment, 15px / 700 / 1.4 at all sizes; no oversized hero-only button. |
| `navigation` / `flavor` | Home navigation and flavor links use Manrope 15px / 500. Home navigation becomes 14px at 1100px, flavor links become 14px at 900px and 12px at 600px. The non-home desktop navigation uses 14px. |
| `link` / `article-row` | General text links use 14px / 1.5. Product detail links use 13px; CMS rows use 15px / 500 / 1.6, becoming 14px at 600px. |
| `metadata` | Home activity location/date is 13px / 1.75. Gallery metadata uses the existing `text-xs` utility (12px at the public root) with opaque warm brown; its small size requires sufficient contrast. |
| `commerce-action` / `commerce-title` | Home compact purchase action is 18px Barlow Condensed / 700; non-home catalog titles are 24px / 600, becoming 22px on mobile. Price components remain server-backed; homepage sale price is 18px, becoming 16px at 600px. |
| `footer-detail` / `footer-heading` | Shared-footer copy and headings keep one Manrope size (16px / 1.65) on every viewport; weight provides hierarchy. |

`html:has([data-public-storefront])` sets the public root to 16px. The same public container scopes the Tailwind heading variables: 6xl=2.75rem, 5xl=2.25rem, 4xl=2rem, 3xl=1.75rem, 2xl=1.375rem and xl=1.125rem. Without that marker the existing root remains 17px, then 18px from 768px. This is how public density changes without shrinking CRM/portal workspaces.

**The Two Voice Rule.** Preserve Playfair Display for homepage headings and Manrope for supporting copy and controls. Retain Barlow Condensed only in its existing commerce roles. The historical tool-ranked Rasa face is not the implementation.

**The Shared Footer Type Rule.** Keep every footer heading, link, fact and copyright line at the `footer-detail` size and family on every viewport. Use the `footer-heading` weight for headings and the legal name, and weight (600) for contact labels; no mobile size reduction applies.

## Layout

The homepage keeps full-width color sections and the shared fluid gutter (`spacing.page-gutter`). Original photographs and open content carry the composition; product articles are not enclosed by new cards.

- **Desktop shell:** sticky header, 76px high, 184px wordmark and 15px navigation. At 1100px the wordmark becomes 164px and navigation 14px.
- **Mobile shell:** at 900px use `44px minmax(0, 1fr) 88px` tracks for menu, wordmark and the complete language/cart action area. Header height is 68px, then 64px at 600px. Logo width is 142px at 600px and 112px at 360px. Keep the two 44px action areas separate from the mark. Non-home public navigation changes to its menu below 1024px.
- **Product selection:** all eight current products, four equal columns and two rows above 900px, with row/column gaps of 36px/24px. At 900px and below use two columns; gaps become 28px/20px, then 28px/14px at 600px. No last-product span. Slots use ratio 1122/1402 and contained full images. The cashew slot uses the existing portrait photograph `02.jpg` rather than the first landscape photograph.
- **Flavor navigation:** eight direct product links in a horizontal desktop group, changing to four columns from 900px. These are navigation destinations, not stateful filter chips.
- **Hero:** two equal columns with a 48px gap and 32px vertical padding. Copy is limited to 560px; the whole pouch image has a 500px maximum height with contain behavior. At 900px the gap is 24px; at 600px copy and a maximum-280px photo stack.
- **Team and activity:** equal image/copy columns with a 28–72px fluid gap and 44px vertical padding. Team photo width is capped at 440px and activity photo at 360px, both intrinsic height. Supporting copy is capped at 48ch. From 600px they stack with a 24px gap and 32px vertical padding.
- **Gift:** 1.3fr/1fr copy/photo columns, 48px gap and 32px vertical padding; whole image width is capped at 320px. From 600px copy/photo stack, with a 260px photo cap and 28px vertical padding.
- **Gallery and About:** gallery uses one/two/three masonry columns at the existing 640px/1024px breakpoints and all eight source image ratios. About keeps its actual 2560/1707 image ratio. Neither forces portrait photographs into a 4:3 cover frame.
- **Shared public footer:** four desktop columns in the order brand, seven policies, contact and company registration, with proportions (.95fr / 1.25fr / 1fr / 1.35fr), gap (40px) and centered maximum width (1440px). At (1100px) and below use two equal columns with row gap (36px); at (600px) and below use one column with gap (32px). The horizontal gutter uses `spacing.page-gutter`; mobile vertical padding becomes (40px 24px). All information remains expanded; there is no Quick Links group or native contact disclosure.

The partner band is a compact text/action row, stacking on mobile. Blog titles remain a ruled list. Reduced motion removes gold-button transitions; the shared footer adds no motion. The sidecar records scoped public breakpoints without changing the CRM system.

## Elevation & Depth

Homepage sections and product articles are flat. Original photographs, cacao/paper contrast and fine separators provide depth; no new shadow or ornamental overlay is introduced. The existing locale switcher retains its own rounded, shadowed popover.

**The Flat Content Rule.** Keep product articles and article rows flat. The photograph, surface contrast and fine rules provide depth; the existing locale popover retains its incumbent treatment.

Gold actions transition background/color over 160ms with `ease`; reduced motion suppresses that transition. Homepage/header focus uses a 3px current-color outline with 4px offset. Commerce controls retain their existing focus rule, and shared-footer links retain the gold outline and 4px offset.

## Shapes

Gold actions use the small 5px radius. Homepage photographs remain complete rectangles; the activity gallery/About retain their source's 12px wrapper/image corners. Product articles have no enclosing border or shadow, while fine rules divide content groups. The current complete-image layout uses no hero/gift crop mask.

**The Small Corner Rule.** Use the action radius for gold actions. Preserve the whole-frame photography and existing locale control; do not reshape the control into a product card.

## Components

### Buttons

Gold actions share one compact family: cacao text on gold, 5px radius, 12px/22px padding, 44px minimum height and the `label` role. The hero uses the same treatment. Hover uses gold-hover and focus retains the visible outline. No additional variant is inferred.

### Text Links

Underlined links use inline flex, a 44px minimum height, 10px gap and 4px underline offset. General links use the `link` role; product destinations use 13px. Arrows are existing SVG icons. Hover uses link-hover; focus remains visible.

### Product Articles and Commerce

Eight original photographs sit on paper above Playfair titles, existing server-backed price/discount/VAT components, quantity controls, the existing purchase action and a named product link. No review, certification or stock badge is synthesized. Title top margin is 14px (12px on mobile), with no enclosing card padding or shadow. Price areas have a 66px minimum (80px on mobile) for stable alignment. Quantity tracks are 44px / minmax(0,1fr) / 44px so narrow cards retain both controls.

The photo link is skipped by keyboard and hidden from assistive technology because the adjacent named destination provides the same link. Product IDs, locale-aware slugs, price authority, quote flow and cart behavior remain in their existing components. The sidecar's quantity sample is a visual primitive preview, not a working cart or price quote.

### Navigation and Article Rows

The homepage retains paper links on cacao, 12px vertical link padding and gold hover. A minimum 44px menu control carries `aria-expanded` and its controlled region; selection closes the menu. The real language control remains, and the cart appears only when the actual order-intake flag is enabled. Flavor hover underlines at 5px offset.

CMS titles form a fine-ruled list with 16px vertical padding, the `article-row` role and a 5px hover underline offset. The source requests two featured posts; if there are none, the section keeps its heading/index link without inventing article rows.

### Shared Public Footer


Every public page uses the same four groups: original brand logo and existing copy, seven purchase policies, contact details, and company registration. The footer surface brief records the user's structural reference and factual sources.

- **Structure:** `public-footer` surface and type, with warm-paper headings through `public-footer-heading`. A fine muted-paper border separates the copyright row. Keep the original transparent logo at height (56px); no replacement artwork or certification badge.
- **States:** contact and policy links retain minimum height (44px), underline on hover and a visible gold keyboard outline (3px) with offset (4px). The policy stylesheet retains its existing hover/focus shade; no new global color is inferred from it.
- **Responsive behavior:** use the four/two/one-column rules in Layout, retain the same type size throughout, and allow long factual strings to wrap. All company and contact information remains visible without a disclosure control.
- **Content:** preserve all seven existing policy destinations, locale routing and telephone, email, Zalo and map targets. Registration facts come from the supplied certificate through `lib/contact.ts`; the payment policy uses the user-supplied MB Bank account. These facts do not establish a new visual token or an independently verified bank-ownership claim.


The sidecar preserves the existing self-contained footer policy/company previews and adds only source-derived gold-action, text-link and quantity-control primitives. All preview classes use the `ds-` prefix. No raster asset, company fact, policy destination or unrelated CRM component is regenerated.

## Do's and Don'ts

### Do:

- **Do** apply the Public Boundary Rule before changing public type or using homepage scene styles.
- **Do** keep original asset pixels, logo transparency, complete promotional frames and existing product/link targets.
- **Do** show the complete eight-product range in the documented responsive grid.
- **Do** retain the observed small-screen hierarchy, locale overrides, 44px controls and visible keyboard focus.
- **Do** source prices, article titles and order-intake state from their existing runtime authorities.
- **Do** preserve the shared footer's four groups, uniform 16px type and factual content.

### Don't:

- **Don't** propagate the homepage scene/header world or public root scale into CRM/portal workspaces.
- **Don't** use the historical tool-ranked Rasa face as an implementation rule.
- **Don't** reconstruct the original wordmark or packaging, or crop a whole-frame photograph merely to fill a shallow banner.
- **Don't** invent prices, reviews, certification claims, stock facts or delivery evidence.
- **Don't** turn historical refused comp gates, current defects or detector findings outside this public scope into reusable design rules.
