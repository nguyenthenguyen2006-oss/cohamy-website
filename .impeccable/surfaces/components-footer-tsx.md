---
version: 1
slug: "components-footer-tsx"
primary_target: "components/Footer.tsx"
related_targets: ["components/FooterPolicies.tsx", "components/Footer.module.css", "components/store-policies.css"]
---

## Direction contract

THESIS: A single footer gives every public page the same company identity and seven purchase policies, in the four-column structure supplied by the user.

OWN-WORLD: Existing Cohamy gold logo on cacao, warm paper text, Manrope at a consistent 16px. Headings and legal name use weight rather than a different font or size.

STORY: Find a policy, contact the company, and verify its registration details. Company facts come from the user's registration certificate; payment account details come from the user's message.

FIRST VIEWPORT: Logo and brand at left, then policies, contact, and company registration. Remove Quick Links and the separate homepage variant. Four columns become two at tablet widths and one at phone widths, with complete information always visible.

FORM: Reference-pinned extension of the existing public visual world. Keep all seven policy URLs, language routing, contact destinations and original logo. No new marketing claims or certification badge. No new raster assets or motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance


## Current implementation and evidence - 2026-11-05

Mode: Read. Visitors find policies, contact details and certificate-backed registration facts in one shared public-footer structure.

Source: Footer.tsx, Footer.module.css, FooterPolicies.tsx and only the footer selectors in store-policies.css. lib/contact.ts supplies public company/contact facts and the user-supplied payment account; the existing payment-policy data remains its display location. The shared public LocaleLayout renders the footer for public route families. This contract does not change the CRM, portal, homepage header or homepage scene world.

Current system: Manrope 16px/1.65 for all text and headings, weights 400/600/700 for hierarchy; cacao/paper/muted paper/gold retain the incumbent palette. Four columns above 1100px, two through 1100px, one through 600px; centered 1440px maximum width and clamp(20px, 4vw, 64px) horizontal gutter. Keep seven policy URLs, locale routing, original wordmark and contact destinations. No Quick Links group, separate homepage footer branch, address disclosure, new raster or motion.

Finish evidence: docs/crm/test-results/footer-unification/impeccable-review.md gives SHIP at STAGING screenshot/source scope, with all eight current captures under .impeccable/review/footer/. Nine browser PASS groups cover 30 route/viewport records; API has three PASS checks and services ten. The valid 2378px capture passes overflow, while its companion report retains four proxy-prefetch teardown errors after capture. The main suite's zero first-party errors do not erase that note. No discoverable CMS page was rendered; source coverage is explicit. DESIGN.md and the minimal schema-v2 .impeccable/design.json now record the approved shared-footer system. See impeccable-documentation.md for exact hashes and documentation boundaries. Production and remote OAuth read-only checks remain separate release evidence.
