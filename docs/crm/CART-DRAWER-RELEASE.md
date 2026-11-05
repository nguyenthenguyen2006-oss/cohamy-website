# Cohamy storefront cart drawer

Selecting a quantity and adding a product now opens a right-hand cart. The layout follows the user's Maison Marou screenshots: a 450px cart with a 220px recommendation rail on desktop, and a full-width cart on phones. The product card reveals quantity and Add on hover or keyboard focus; touch devices show these controls immediately.

The drawer uses Cohamy photographs and current server quotes. Customers can adjust quantities from 1 to 100, remove products, add recommendations, open the full cart, or continue to checkout. The native modal supports Escape, backdrop dismissal, background inertness and focus restoration. Only basket contents persist across reloads; the drawer starts closed. Main product photographs keep their natural proportions. Contained drawer thumbnails use the square inventory layout in the supplied reference.

The checkout amount includes the configured discount and each product's VAT. Existing changed-price acceptance, unavailable-product, quote-error and intake-off guards apply. Adding more of an existing product preserves its stored price until the customer accepts a revised quote. Cohamy's existing shipping-confirmation notice remains; the reference site's shipping rewards and dispatch location were not added.

## Verification

- LOCAL: TypeScript and changed-source ESLint passed. The MCP catalog check passed without changes to API contracts.
- STAGING: A production build against a separate PostgreSQL fixture passed the ten storefront service groups and all 14 browser cases. Desktop 1440×900 and mobile 390×844 had no horizontal page overflow. Drawer-scoped axe checks returned zero violations or incomplete checks. This is not an exhaustive accessibility or screen-reader audit.
- STAGING price-change test used fictitious data, changed the fixture discount from 30% to 25%, then restored and re-read 30%. No production data was changed and no order or email was submitted.
- The native dialog sometimes yields a BODY active element while the document has no focus; the following Tab returns inside. Sixty forward/reverse Tab steps and a direct focus attempt did not focus a background document control. The report records this observation without claiming the browser address bar was inspected.
- Evidence: [browser report](test-results/cart-drawer/browser-staging.json), final screenshots in the same directory, [Impeccable scan](test-results/cart-drawer/impeccable-detector.json). The final report supersedes the initial strict browser-chrome focus assertion.
- PRODUCTION: Deployed `4c34999674341c616e6abd6c557ed69a1ff85a6a` after 18 candidate smoke checks. Both backup restore proofs passed against 240 tables from consistent snapshots. Web and worker started online with zero restarts. The [live browser report](test-results/cart-drawer/production/browser-production.json) passed 11/11 cases on desktop and mobile, including 61,992 VND per cashew pack and 123,984 VND for two packs, matching checkout. No production business mutation, order submission, Admin settings change or GET mock was used by that browser suite. [Release proof](test-results/cart-drawer/production-release.json).
- PRODUCTION MCP: The connected authenticated `GET /api/crm/storefront` returned HTTP 200, discount 30%, eight products and the same 61,992 VND cashew price. [MCP proof](test-results/cart-drawer/production-mcp.json). Browser-local cart contents remain outside that remote API.
- Cleanup: the owned QA database, restricted role, staging server and local tunnel were removed. Production and rollback backups were retained. Final proof documentation is committed separately from the deployed application SHA.
- Final [public health and runtime check](test-results/cart-drawer/production-runtime.json) at 06:07 UTC remained PASS with both Cohamy processes online and zero restarts.

No new raster assets, database migrations, endpoints or API inputs were introduced. The targeted condensed heading font is self-hosted through Next.js; global typography remains unchanged.

## MCP coverage

**MCP có dùng được không?** Có: the existing CRM storefront tools still read and manage server-side prices and discount settings. Existing order tools operate submitted website requests. The operation catalog is unchanged.

**MCP có đọc được dữ liệu này không?** Server-side pricing/settings and submitted order data remain readable through the existing tools. An anonymous, unsent basket is stored in that browser's local storage; the remote CRM MCP cannot read that browser-local basket or open its drawer. This change does not silently upload unsent shopping contents to CRM.
