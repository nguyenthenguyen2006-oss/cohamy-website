# Production cart drawer browser QA

**PASS — 11/11 cases**, 2026-11-05 06:05 UTC. Command: `node scripts/crm/verify-cart-drawer-browser.mjs --production`.

This run browsed `https://cohamy.vn` directly after the release owner confirmed deployment. It used public reads and a fresh local browser cart only: **0 Admin writes, 0 order-submission attempts, 0 orders, 0 mocked requests, 0 production writes, 0 browser runtime errors**. Service workers were blocked.

The live cashew price was 61,992 VND including VAT. Selecting two packs opened the drawer with 123,984 VND; the same total reached checkout. Quantity bounds, recommendations, removal, header count, reload persistence, close/Escape/backdrop, keyboard containment, focus restoration, background inertness and scroll lock passed. Product-detail Buy now continued to checkout. The form was never submitted.

Desktop at 1440×900 measured 670px total: 450px cart and 220px recommendation rail. Mobile at 390×844 filled the viewport and kept its footer visible. Neither layout had horizontal document overflow. Visible images loaded successfully before capture; full-page captures exercised lazy loading.

Drawer-scoped axe checks found 0 violations and 0 incomplete results on desktop and mobile (22 rules passed each). Keyboard checks traversed 30 forward and 30 reverse steps. A native document blur was permitted only for BODY with `document.hasFocus() === false`, followed by verified return inside on the next identical key; no background page control received focus. Browser UI focus remains an inference from this observation.

`browser-production.json` contains all results, dimensions, focus traces and CSS hashes. Twelve screenshots show the production rendering. There is no Cohamy golden image for automated pixel regression; the separate visual review uses the user's pinned Maison Marou reference screenshots. Screen-reader testing and remote MCP calls were outside this browser run. Real price-change and mocked outage/intake states were tested on isolated staging, not production.
