# Public storefront refinement

The authorized scope is the complete eight-product homepage, four columns/two rows on desktop, smaller public typography, whole promotional/about/activity photographs, and Cohamy-only combined-brand presentation. Product identities, URLs, pricing/VAT/discount rules, cart/checkout and CRM/portal permissions remain outside the change.

## Evidence

- `baseline/measurements.json` records actual Cohamy and Maison Marou public typography and image geometry. Reference: https://maisonmarou.com/. Original asset dimensions explain the old clipping; this is not a comp-reproduction claim.
- `brand-copy-audit.json`: 58 combined-brand strings in 14 files, five locales, valid JSON/key shapes, unchanged URLs/numbers and standalone manufacturer names. Humanizer's embedded mark/draft/review/final-edit workflow is recorded. Original image pixels are unchanged.
- `wordpress-brand-audit.json`: published post/page candidate scan and selected public SEO/alt metadata found no matching combined brand requiring a WordPress write. This does not claim every published URL was visited.
- `fixture-staging.json`: eight available products at a deliberately uniform fictitious price in a fresh isolated PostgreSQL database, restricted runtime role, zero orders and no worker/email. The fixture preparation initially omitted a legacy mapping for the candy; it was corrected to seed all eight explicit mappings before the recorded passing build/browser run. This was QA setup, not a production catalog change.
- `stage-app-source.json`: normalized hashes of all 22 changed application/content files match the built staging source. QA helpers and documentation are separate from this manifest.
- `staging.json`: 16/17 original functional/browser cases passed. The one failure was low-contrast gallery metadata. It includes all eight local-cart quantity/add operations, 4×2 and mobile layouts, whole frames, five locales, route samples and unchanged internal root typography; all request writes were blocked.
- `staging-activity-recapture.json`: only the invalid required mobile activity capture was replaced with a correctly framed capture; the original functional report remains unchanged.
- `staging-confirmation.json`: 5/5 bounded checks after the one correction batch. The 320/390px wordmark and menu/locale/cart hit regions no longer intersect; all three controls retain 44px targets. Gallery contrast checks at desktop/mobile have no violations. Ten affected canonical images were replaced, without rerunning unrelated workflows.
- `impeccable-review.md` and `impeccable-documentation.md` distinguish the fresh full review, the same-reviewer correction scoring, and the final source-derived design documentation.

One manual detector run is retained unchanged in `impeccable-detector.json`: 73 advisory findings and two primary warnings in the pre-existing Admin-editor blockquote rules, outside this public scope. The intended smaller scale is codified in the updated public design system; no second detector was run.

LOCAL TypeScript and scoped ESLint passed. The production-mode staging build passed after the final two-file correction. No new API/input contract or database migration was introduced; production builds still check the existing MCP catalog. Production release/read-only verification is recorded separately after deployment. Browser/axe samples are not exhaustive device, screen-reader or accessibility proof.

## Production release

Application SHA: `76cccbf7bcf932775059de597cd12ab99d68a685`. The later documentation/proof HEAD is separate from the running application revision.

- `production-release.json`: both consistent backup/restore proofs passed over 241 tables, with zero file/source integrity errors; all 18 candidate smoke cases passed before cutover. The first helper attempt stopped before release/database changes because of CRLF shell line endings; `deploy-first-attempt.json` records the cause and verified unchanged old release. The corrected LF helper deployed the same tested SHA successfully.
- `production-app-source.json`: all 22 normalized application/content sources match the staged files. No raster pixels were changed.
- `runtime-production.json`: web and CRM worker are online at this application revision, both with zero restarts; the configured WordPress blog remains ready.
- `production.json`: 16/16 actual public HTTPS browser cases passed with 17 captures. It checks all eight actual price quotes, desktop 4×2/mobile two-column layouts, whole photographs, five locales and public routes, the 320/390px header correction, accessibility/keyboard/reflow samples, and unchanged internal type boundary. Production skips the local-cart mutation case; that case passed on isolated staging. All browser request writes were blocked, and no test order/email was created.
- `mcp-production.json`: the actual OAuth MCP reads eight package identities and their current prices/VAT/discount values. The catalog/quote/version and 30% discount matched the pre-release read; GET and existing discount-settings POST remain available. Presentation/CSS/source editing is not exposed as an MCP operation.
- `cleanup.json`: only the owned staging process, database, runtime role and local SSH tunnel were removed. Production releases and rollback/backup evidence are retained.
