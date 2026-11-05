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
