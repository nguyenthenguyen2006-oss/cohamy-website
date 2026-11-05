# Cart drawer browser QA

Final run: **PASS — 14 cases, 0 failures**, 2026-11-05 05:53 UTC.

Environment: isolated PostgreSQL staging with a production build, reached only through `http://localhost:4369`. Browser requests for `https://cohamy.vn/**` were proxied to this local tunnel. Service workers were blocked. No production writes, emails, orders or order-submission attempts occurred. The fictitious QA Admin changed the discount from 30% to 25% and back; final restoration to 30% was verified.

Run staging with `node scripts/crm/verify-cart-drawer-browser.mjs`. Full results, asset hashes, screenshots and focus traces are in `browser-staging.json`.

The same script supports `--production` for direct public GET/HEAD reads and local browser cart interactions. This mode has no Admin login, settings changes, order submission or mocked GET responses. Production ran after deployment confirmation at 2026-11-05 06:05 UTC: **PASS — 11 cases, 0 failures**, with 12 separate screenshots under `production/`. The live cashew price was 61,992 VND per pack and 123,984 VND for two packs. See `production/browser-production.json`.

Verified flows:

- Card quantity 2 opens the drawer with 119,448 VND including VAT; quantity changes, 1–100 limits, removal, recommendations and header count update correctly.
- Reload preserves cart contents and leaves the drawer closed. Checkout navigation closes the drawer and retains the same VAT total; product-detail Buy now remains available.
- A real staging price change disables checkout until explicit acceptance. Adding the same product preserves the previous cart price snapshot and cannot silently accept the new price.
- Public price failure and intake pause disable checkout. These two states used **mocked GET `/api/storefront` responses only**; the native settings remained enabled. Real-price retry recovery passed.
- Escape, close button and backdrop restore focus. Forward/reverse Tab traversal (30 steps per direction), background focus inertness and background scroll lock passed.

During keyboard traversal, three steps reported `document.activeElement === BODY` and `document.hasFocus() === false`. The next identical Tab direction returned inside the dialog every time. No background page control received focus. Entry into browser UI is an inference from the document blur, not a measured location-bar state.

Measured desktop at 1440×900: drawer 670px, cart column 450px, recommendation rail 220px. Mobile at 390×844: drawer and cart column 390px; desktop rail hidden. Both footers stayed within the viewport. No horizontal document overflow was found. Visible images had loaded successfully before screenshots; full-page captures exercised lazy images by scrolling first.

Drawer-scoped axe checks reported 0 violations and 0 incomplete checks on desktop and mobile (22 rules passed in each). This is an automated and keyboard audit; it does not include screen-reader testing. Automated pixel regression remains **INCONCLUSIVE** because there is no Cohamy golden image. The separate visual review uses the user's pinned Maison Marou reference screenshots; these 15 screenshots show the current Cohamy rendering for that review.

The suite did not invoke remote MCP. Pricing/settings MCP coverage is verified separately by the release owner. The anonymous unsent cart and drawer state live in the browser and are not exposed through remote MCP.
