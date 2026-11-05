# Shared footer documentation

Release-owner follow-up: the application was deployed as `87ed9d5ef7bb94abcf84be8bdd2d21114a520e67`. Separate live browser proof passed 10/10 groups and connected production MCP returned the exact company/bank profile. See `production/browser-production.json`, `production-mcp.json` and `production-release.json`. This supplements the release evidence; the independent design verdict below remains scoped to its staging screenshots/source.

Documentation-only scoped merge, 2026-11-05. Fresh documenter read PRODUCT.md, DESIGN.md, the footer surface contract, the shipped document playbook, current Footer/FooterPolicies CSS and source, lib/contact.ts, and the independent finish review. The reviewer disposition is **SHIP at STAGING screenshot/source scope**. This document does not extend that verdict to production.

## Changed artifacts

- DESIGN.md: corrected only the shared-footer scope, outdated disclosure description and footer-specific tokens. All footer text and headings use Manrope 16px/1.65; weight distinguishes hierarchy. Recorded four desktop columns, two at 1100px and one at 600px, the 1440px maximum width, fluid gutter and unchanged original wordmark. Homepage header, hero, product scenes and their tokens remain intact; CRM and portal systems remain separate.
- .impeccable/design.json: created the required minimal schemaVersion 2 sidecar, previously absent. Footer typography metadata, two source-backed breakpoints and two self-contained footer previews extend the frontmatter. No synthetic palette, unrelated component catalog or new raster was added.
- .impeccable/surfaces/components-footer-tsx.md: appended mode, implementation/source scope and current evidence; retained the original direction contract.

The local launcher reports `Unknown command: "design-extract"`; its help exposes the legacy detect/ignores/help/install/link/update/check commands. No extraction command, context reload, detector rerun or unrelated artifact repair was attempted. The sidecar follows the documented v2 schema directly. This pre-existing launcher mismatch remains outside the footer task.

## Evidence and limits

Read the existing STAGING reports: browser suite has nine PASS groups and 30 route/viewport records; API has three PASS checks; services has ten PASS checks. The independent reviewer inspected all eight current captures. The documenter also directly inspected desktop-home-footer.png and mobile-home-footer.png and checked every capture hash against its STAGING counterpart. No capture, application source, business record, CMS bank setting or review evidence was modified.

The 2378px capture/overflow check passes. Its companion report records four proxy-prefetch teardown errors after the valid capture; it is not an error-free report. The main browser suite separately records zero first-party runtime errors. The mobile evidence correction uses native document-coordinate clipping at scroll0 and changes no application behavior. No discoverable CMS page was rendered; the shared LocaleLayout supplies source coverage for that route family.

MCP có dùng được không? MCP có đọc được dữ liệu này không? Bằng chứng STAGING xác nhận native MCP đọc chính sách và Admin HTTP đọc companyProfile chứa thông tin doanh nghiệp/tài khoản. Lượt ghi tài liệu này không chạy remote OAuth hay production; chủ phát hành xác minh read-only Cohamy remote MCP sau triển khai và ghi kết quả riêng.

## Preserved captures

All SHA256 values below were checked equal to the corresponding staging files during this documentation pass.

| Capture | SHA256 |
| --- | --- |
| desktop-home-footer.png | 622e53df64d6534966d945b5b163a84da0a7fc9b0bfcf5b00841167a923859b4 |
| desktop-payment-bank-section.png | 3bc29960d794a4457a1eb3e2f3d66fe559c51ac3367c572b06284e3f5392edb3 |
| desktop-payment-footer.png | a0f1b48c6406dda476513fa546ec2550a807d37ac760af0f2f869e2592ead654 |
| desktop-products-footer.png | 73d60dd88a2a8065ce8d2bea309d7d3633b79452a0ed1dca85e837c2dba76e1f |
| mobile-home-footer.png | a2e6c7370f56921bf680853e18a2844341c5519ad9db5e9183b37111efc60c51 |
| mobile-payment-footer.png | 0cedb1c5a46bb83f84e62ff376288d35981ab36d3a4ad256b00815d2b233f375 |
| narrow-home-footer.png | 8b8ff61c617d7dbc9019856a7cab58ed976be20a97d7c81b52de96f1aa4e2c47 |
| user-2378-footer.png | c677640f8628ed44d8bf0d84e5b4f53cb475f30d4fdb8bca443cf3bfb1e68e88 |
