# Live public footer verification

Final result: **PASS, 10 groups**, 2026-11-05T07:27:54.909Z. Direct HTTPS browser reads against cohamy.vn produced 31 route/viewport records and eight screenshots. The release owner confirmed application SHA `87ed9d5ef7bb94abcf84be8bdd2d21114a520e67`; deployment, backup, runtime and authenticated MCP proofs are separate from this browser report.

Verified the shared four-column footer, absence of Quick Links, consistent computed Manrope 16px text, company registration fields, seven policy destinations and the supplied MB Bank account in the payment-policy body. Home and other public route types matched within each locale. The suite sampled Vietnamese page families, one real blog detail, and home/products in four additional languages. No public CMS-page link was discoverable, so that page type has shared-layout source coverage without an invented live fixture.

Responsive checks passed at 1440px, 900px, 390px, 320px and the user's 2378px width. Native CDP document-coordinate captures show the complete mobile footer without hiding or altering the sticky header. Desktop and mobile footer-scoped axe audits each returned 17 passes, zero violations and zero incomplete checks; this is not an exhaustive accessibility or screen-reader assessment.

The final report records zero first-party errors, Admin API requests, business writes, order submissions, GET mocks or third-party network errors. Actual route handlers drained to zero with a one-second quiet interval before close; late first-party errors would still fail final status. No application edits or visual polishing occurred during production verification.

The first attempt is preserved as `harness-drain-first-run.json`: its ten visual/functional groups passed and it recorded zero first-party errors, but finalization timed out while waiting on a global native-browser Request set. Its lifecycle result is inconclusive for the application and remains a raw failed harness report. `harness-drain-first-run-note.json` explains the evidence and bounded correction: await actual route-handler/API-proxy operations; native browser streams may remain open until ordinary browser close. One full production rerun then passed, including teardown. The final authoritative report is `browser-production.json`.

MCP was not invoked by this browser suite. The release owner independently verifies policy and companyProfile data through the authenticated remote tools.
