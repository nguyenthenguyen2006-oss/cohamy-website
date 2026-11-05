# Shared public website footer

The homepage and other public pages now use one `Footer` component. The layout follows the user's four-column reference: logo/brand, seven purchase policies, contact and company information. Quick Links and the separate homepage policy grid were removed. Text throughout the footer uses Manrope at 16px; headings use weight rather than another font or size. Desktop has four columns, tablet two and phones one.

Company details come from the registration certificate supplied by the user: tax/enterprise ID `0111549388`, first registration `25/06/2026`, issuing office `Phòng Đăng ký kinh doanh và Tài chính doanh nghiệp, Sở Tài chính Thành phố Hà Nội`, and the registered Hanoi address. The certificate also records amendment 1 dated `24/09/2026`; this is preserved in the shared profile without relabelling it as the first issue date. The source image is not published on the website. [Fact provenance](test-results/footer-unification/company-facts.md).

The payment policy publishes the user-supplied MB Bank account `9139 8888 6666`, beneficiary `CÔNG TY TNHH COHAMY`. The bank details are interpolated from `CONTACT.bankAccount`. Order/amount confirmation, transaction reconciliation, COD and other existing payment behavior remain. No payment, transfer or collected-money status is created by publishing these details. [Humanizer editorial record](test-results/footer-unification/humanizer-payment.md).

All policy URLs and contact destinations remain. The reference's third-party logo, company facts and Ministry of Industry and Trade badge were not copied. The update introduces no new raster assets, database migration, inventory movement or finance posting.

## Verification

- LOCAL: TypeScript, changed-source ESLint and whitespace checks passed. The regenerated MCP catalog passed with 359 operations, 251 available, 108 retired, 139 reads, 220 writes and 13 excluded routes.
- STAGING: A separate PostgreSQL fixture and restricted runtime role passed 10 storefront service cases. Native HTTP checks passed unauthenticated 401, Admin data access and non-Admin 403, including exact company and bank values. [API proof](test-results/footer-unification/api-staging.json).
- STAGING: Browser checks passed 9/9 cases with 30 route/viewport records, shared footer signatures within each locale, all seven actual policy destinations, five locales, responsive columns and uniform computed typography. [Browser report](test-results/footer-unification/staging/browser-staging.json). The user's wide viewport was checked separately without changing application styles. Mobile footer captures were corrected using document-coordinate browser screenshots to prevent the sticky header from obscuring the logo; this was a capture correction, not a UI fix.
- PRODUCTION: Pending guarded deployment, live public browser checks and connected MCP verification.

## MCP coverage

**MCP có dùng được không?** The existing `cohamy_read` operation `GET /api/crm/storefront/policies` is extended with `companyProfile`, while preserving Admin-only access and `editable: false`. The generated route source hash was refreshed.

**MCP có đọc được dữ liệu này không?** The response includes all seven policy bodies, MST, registration dates, issuing authority, registered address, public contact/office details and the published MB Bank account. Browser tests do not invoke remote MCP; the production release owner verifies the connected runtime separately. These public publication constants are not an editable bank integration or a mutation of CRM organization records.
