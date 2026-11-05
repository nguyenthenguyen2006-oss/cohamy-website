# Shared public footer verification

STAGING: **PASS for the original functional batch**, 2026-11-05: nine groups with 30 route/viewport records and zero recorded errors. The targeted 2378px visual assertions and a separate three-image mobile evidence recapture also passed. The raw 2378px companion report contains four teardown proxy errors despite its legacy PASS flag; its capture remains valid, but that companion does not support an all-errors-clear claim. No application source was changed or full functional batch repeated for the screenshot correction.

The browser visited the public origin through the owned localhost4370 tunnel to VPS4334, with service workers blocked. All first-party non-read requests were guarded. No Admin API requests, business writes or order submissions occurred. No GET response was replaced with fixture content; the staging origin proxy returned the real staging responses. Third-party contact-page map reads were allowed and separately observed; no third-party errors or blocked telemetry attempts occurred in this run.

The batch checked:

- 17 Vietnamese page types/destinations, including all seven policy pages, product detail, empty cart and checkout; one discoverable blog detail; home and products in English, Chinese, Korean and Japanese.
- Identical footer content/link signatures within each locale and viewport; four desktop columns, two tablet columns and one mobile column; no Quick Links; consistent computed Manrope 16px text and headings.
- The expected company tax ID, first-issued date, issuing authority and registered address, plus the supplied MB Bank account in the payment-policy body. These comparisons use the release owner's confirmed data; the browser suite does not independently validate company registration or bank ownership.
- Existing telephone, email, Zalo and map destinations, link security attributes and visible keyboard focus.
- No horizontal page/footer overflow at 1440px, 900px, 390px, 320px or the user's 2378px width.
- Footer-scoped axe checks: 17 passes, zero violations and zero incomplete checks at desktop and mobile. This is not a screen-reader or exhaustive whole-site accessibility audit.

No public CMS-page link was discoverable. Shared LocaleLayout source coverage applies, but no CMS fixture was invented or individually claimed tested.

Evidence is in `staging/browser-staging.json`, `browser-user-2378.json`, `browser-mobile-recapture.json` and eight PNG captures. The initial tall-element mobile screenshots contained a sticky-header capture artifact. They were replaced using native CDP document-coordinate clips at scroll0, preserving the actual page layout and UI. The original report records that recapture and its timestamp.

The four errors in the unchanged raw `browser-user-2378.json` say `route.fetch: Request context disposed` and refer to RSC prefetch GETs. Source ordering shows that the pre-close zero-error assertion had passed before the report gained these errors during browser/context shutdown. This supports a harness teardown-race classification, rather than an observed footer-render failure. The companion `browser-user-2378-lifecycle-note.json` records that distinction. No raw errors were removed or reclassified as successful requests. Future runs wait for pending first-party reads and route handlers to drain before closing, and any errors arriving during drain or close fail the final status. This harness change was syntax/static checked; the full staging suite was not repeated.

Run `node scripts/crm/verify-footer-browser.mjs` for the staging suite. The normal suite now includes the 2378px capture and the corrected capture method. `--production` visits the live website directly with the same read-only guards and saves separate production evidence; it has not been executed yet. Remote MCP checks are performed separately by the release owner.
