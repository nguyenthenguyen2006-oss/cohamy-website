# Public storefront refinement: design record

Documented on 2026-11-05 by a separate post-correction documenter. The user's request authorizes this merge: eight homepage products in four desktop columns, a smaller public type scale, Cohamy-only authored branding and whole promotional photographs. The incumbent **Cacao Scenes** world, fonts, palette and original assets remain the authority. This is a system refinement, with no new visual direction or comp reproduction.

## Files and write boundary

- Merged current tokens and source-derived rules into [DESIGN.md](../../../../DESIGN.md).
- Updated the [schema2 sidecar](../../../../.impeccable/design.json) as extensions only. Primitive tokens remain in the YAML frontmatter. Existing footer component previews, factual text and related extension fields were preserved.
- This document records the checked source/evidence. Application files, API contracts, tests, CRM design files, product facts, policy/bank details and raster pixels were not changed by the documenter.

The [surface contract](../../../../.impeccable/surfaces/components-home-cacaohome-tsx.md) chooses **Persuade** for the homepage, preserving the existing world. The public type boundary also applies to other public routes; CRM/portal workspaces remain outside it.

## Source-derived system

| Area | Final source record |
| --- | --- |
| Palette | Existing cacao `#2c1914`, paper `#f0e6d5`, gold `#edbe39`, brown ink and fine warm rules. Opaque metadata brown `#73584d` records the existing secondary commerce/activity ink. No new accent family or invented tonal ramp. |
| Type | Playfair Display homepage headings and Manrope supporting text; the existing Barlow Condensed commerce face retains its limited purchase/catalog roles. Public root/body is 16px. Desktop homepage navigation is 15px, product titles 20px and section headings 28–36px. Mobile product names are 17px; small links/location/date roles are documented separately. |
| Public boundary | `html:has([data-public-storefront])` and scoped Tailwind variables reduce public typography. Without the marker, the incumbent 17px root and 18px-from-768px rule remain. No global CRM/portal type reduction is implied. |
| Catalog | Eight original product identities, four columns/two rows above 900px; two columns below. Complete portrait images use contain behavior, with existing server-backed prices, quantity and purchase components. Product/slug/checkout authority is unchanged. |
| Whole photographs | Hero, team, gift and activity images keep their entire frame and source ratio in split rows, stacking at 600px. About keeps its landscape ratio. The gallery uses the eight actual ratios in one/two/three columns, instead of 4:3 cover crops. |
| Narrow header | At 900px, tracks are `44px minmax(0,1fr) 88px`; the action region reserves both controls. Logo width is 142px at 600px and 112px at 360px. This records the final correction rather than the colliding first capture. |
| Controls | Gold actions use one 15px/700 treatment, 44px minimum height, 12px/22px padding and 5px corners. Focus stays visible. Existing commerce quantity controls retain 44px side tracks and their native pending/disabled/focus behavior. |
| Footer | Existing four/two/one-column structure, uniform 16px Manrope, seven policy destinations and registration/contact facts are preserved. Footer source/previews were not regenerated with new factual content. |

The merged sidecar keeps its two original footer previews and adds only self-contained `ds-` previews of the actual compact gold action, text link and quantity geometry. The quantity sample is a visual primitive, not a functioning cart or price quote. No shadow or new motion system was invented; the existing gold color transition and reduced-motion exception are recorded.

## Evidence checked

- [Baseline/reference measurements](baseline/measurements.json) establish the previous larger Cohamy type and the reference's density. Maison Marou is a scale/density reference; its condensed type and identity are not copied into Cohamy.
- [Source manifest](stage-app-source.json) records 22 normalized application files matching staging. The documenter independently matched the final homepage CSS and gallery source hashes to this manifest.
- [Initial staging browser report](staging.json) retains the actual 16 passes and one gallery-metadata contrast failure. It covers all eight products/cart quantities, 4×2 desktop and two-column mobile geometry, complete photo ratios, five locales, routes, internal type boundary and accessibility/reflow samples. It is not relabeled as an all-pass run.
- [Activity recapture](staging-activity-recapture.json) replaces only the malformed targeted mobile activity image. The documenter opened the valid desktop catalog and mobile team image, then the final 320px full homepage and mobile gallery captures.
- [Post-correction confirmation](staging-confirmation.json) records five passes: no logo/control overlap at 320/390px, whole gallery frames at desktop/mobile, corrected metadata contrast and clear read-only/error guards. Gallery axe samples report no violations or incomplete checks at those sampled widths.
- [Fresh full review](impeccable-review.md) identified two UI defects and the stale design record. This merge records the final source and closes the documentation work item; the reviewer's own final disposition remains in that separate report.
- [Brand source audit](brand-copy-audit.json) records 58 bounded replacements across 14 files, with preserved links, identifiers, numeric sequences and standalone manufacturer/product names. [WordPress inspection](wordpress-brand-audit.json) records the separate runtime pattern-scan boundary.

No new browser pass, context command, detector invocation, production action or provider call was performed by this documenter. Original screenshots are evidence rather than new shipping art. No new or replaced raster needs a generation prompt; the existing photographs and packaging pixels remain unchanged.

## Detector and historical findings

The original [manual detector output](impeccable-detector.json) is retained unchanged: **75 findings**, comprising **73 advisories** and **two warnings**. The 45 type advisories principally reflect the deliberately smaller user-authorized ramp; the 25 color and three radius advisories also include the incumbent commerce vocabulary. Current reused rules are documented from source, rather than changing the UI simply to silence a scanner.

The two warnings identify the pre-existing Admin-editor blockquote (`border-l-4`, gray text on an amber background) in `app/globals.css`. That internal editor is outside this public refinement. It was neither changed nor canonized into the public system. Earlier comp/gate history remains explicitly historical in DESIGN.md; it is not a new comp obligation or evidence that the current source passed a machine gate.

YAML and JSON parse, component token references, original footer palette/type/primitives/previews and the two final correction hashes were checked. The schema2 sidecar carries no duplicate primitive-token store. This design record does not certify every website page, exhaustive accessibility, production deployment, business mutations or real email delivery.
