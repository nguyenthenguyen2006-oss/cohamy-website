---
version: 1
slug: "components-cartdrawer-tsx"
primary_target: "components/CartDrawer.tsx"
related_targets: ["components/ProductPurchase.tsx","components/ProductCard.tsx","components/Header.tsx"]
---

## Direction contract

THESIS: Adding a product reveals its basket immediately, following the user's Maison Marou screenshots and inspected interaction.

OWN-WORLD: Original Cohamy photographs, cream and cacao with gold prices, white shopping panel, restrained rules. Condensed Barlow headings echo the pinned reference; existing global typography remains.

STORY: Select quantity, add, adjust or remove products, optionally add a relevant suggestion, then continue to checkout with the real VAT-inclusive total.

FIRST VIEWPORT: A 450px cart sits on the right with a 220px independently scrolling recommendation rail to its left. Header has a prominent close action. Products scroll above an anchored total and checkout action. At 390px only the full-width cart is shown, with suggestions after its items.

FORM: Precisely specified extension, reference-pinned rather than a new-world exercise. One rightward sheet transition, native modal focus and Escape, persistent basket and ephemeral open state. Shipping text follows Cohamy's current quote-pending policy.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Current implementation record — 2026-11-05

**Mode: Operate.** The success condition is a correct quantity and basket total followed by checkout. The pinned Maison Marou interaction and composition remain the direction; the values below describe this extension rather than a replacement visual world.

### Boundary and authority

This record covers `CartDrawer`, the quantity/add overlay in `ProductCard`, the shared `ProductPurchase` and `QuantityControl`, and their scoped styles/font. Original Cohamy product photos and product names remain authoritative. Catalog images use their intrinsic dimensions with automatic height; square drawer and suggestion fields contain the whole source photo. No new raster asset was introduced for this surface.

Root `DESIGN.md` explicitly documents the LOCAL public homepage and its homepage shell branches. Its Playfair/Manrope system remains authoritative there; this cart extension does not promote Barlow Condensed into global, homepage, CRM or portal typography. The existing root document is preserved. `.impeccable/design.json` was already absent when this record was added; that preexisting documentation gap is reported without repair.

### Colors and typography

The cart's scoped CSS is the source of these implementation values.

| Role | Current value | Application |
| --- | --- | --- |
| Cart ink / primary action | `#2a120c` | Text and checkout/add fill; checkout hover is `#49261b`. |
| Muted text | `#6b5245` | Weight, VAT and shipping information. |
| Cart gold | `#8c601c` | Drawer unit prices, suggestion names/add links and drawer focus outline. |
| Card gold | `#80550e` | Catalog product-name links and purchase/card focus outline. |
| Rule | `#ded4c8` | Header, item, recommendation and footer separators. |
| Photo field | `#f3eddf` | Contained thumbnail backgrounds. |
| Shopping panel | `#fff` | Main cart, recommendation rail and quantity input. |
| Backdrop | `rgb(20 14 10 / .62)` | Modal scrim, with blur (3px) outside reduced motion. |

Barlow Condensed is loaded through `next/font/google` with weights 500, 600 and 700, Latin/Vietnamese subsets and swap display. Its scoped variable supplies cart headings, drawer unit prices, catalog-card titles and the compact add label. Manrope remains on controls and supporting copy. Header type is (30px/600, line-height 1.1), item names (20px/600, line-height 1.2), drawer unit prices (24px/700), and catalog titles (28px/600, line-height 1.1). At mobile widths, item names become 19px, drawer unit prices 23px and catalog titles 26px. Titles and compact add labels are uppercase. Tabular numerals support changing quantities and prices.

### Layout and responsive behavior

The native dialog is fixed to the right with zero border/radius and height (100dvh). Desktop uses a 220px recommendation rail beside a 450px cart, for a maximum total width of 670px. The rail and cart item region scroll independently; header and checkout footer remain in the cart's column. With no suggestions, the drawer narrows to at most 450px.

At 760px and below, the rail is hidden and the cart is at most 450px wide, capped by the viewport. Recommendations follow the items as a horizontal row of 148px articles. At the verified 390px viewport the drawer fills the width. The footer respects the bottom safe area. Drawer product rows use a 126px square photo and a 20px gap on desktop, changing to 108px and 16px on mobile. The header is 72px high; main horizontal padding is 16px.

Catalog quantity/add controls overlay the lower photograph edge, inset (24px) on desktop and (16px) at 600px and below. Fine-pointer hover and keyboard focus reveal them with a 150ms transition; touch layouts show them continuously. Card photos retain their natural ratio and titles/prices sit below them. The stepper is white with a fine cacao border and 3px corners; the compact add action joins directly below it. No card shadow or additional enclosing panel is added.

### Behavior and states

- Add uses the selected quantity and immediately opens the drawer. The separate product-detail buy action still navigates directly to checkout. The shared stepper accepts integers from 1 through 100 and disables the matching decrement/increment endpoint.
- `showModal()` supplies native modality. Escape, the close button, outside-backdrop clicks and navigation close the drawer. Root scrolling is locked while open; the basket persists while the open state is ephemeral.
- Recommendations exclude current/unavailable products, prefer the source product's related IDs and show at most four. Adding one updates the shared basket; the polite live region names the added item.
- The footer uses the existing server quote, VAT-inclusive total and quote-pending shipping policy. Price changes require explicit acceptance. Quote errors expose retry and disable checkout; unavailable items and paused intake also prevent checkout. An empty cart replaces the item content and removes checkout.
- Drawer controls use a visible 3px focus outline with 3px offset. Close and quantity buttons have at least 44px targets. The panel enters from the right in 260ms with `cubic-bezier(.16,1,.3,1)`; reduced motion removes the entry animation, backdrop blur and overlay transitions.

### Evidence and limits

The four reviewed captures are `.impeccable/review/cart-drawer-desktop.png`, `cart-drawer-mobile.png`, `cart-card-desktop.png` and `cart-card-mobile.png`. `docs/crm/test-results/cart-drawer/browser-staging.json` records 14/14 PASS at 2026-11-05T05:53:45.334Z in isolated PostgreSQL staging. It measured the desktop rail/cart at 220px/450px within a 670px drawer, and the mobile cart at 390×844px with its footer ending at the viewport bottom. Drawer-scoped axe runs recorded no violations or incomplete checks at both viewport classes.

The fresh read-only finish review in `docs/crm/test-results/cart-drawer/impeccable-review.md` has disposition `ship` for the reviewed staging captures and source. No material visual repair is requested. The recorded detector result is 0 primary findings and 44 advisories; no detector rerun occurred during documentation. Pinned reference review does not create an automated Cohamy pixel golden, whole-site accessibility proof or production approval.

MCP có dùng được không? This documentation pass does not independently verify remote MCP; the supplied staging report retains server pricing/settings in the existing MCP domain. MCP có đọc được dữ liệu này không? The anonymous unsent basket and drawer-open state are browser-local and are not readable through remote MCP.
