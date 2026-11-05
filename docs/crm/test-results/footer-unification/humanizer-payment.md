# Payment policy copy review

Date: 2026-11-05. Scope: the bank-transfer item in the existing `thanh-toan` policy only. The complete Humanizer skill at `C:/Users/ACER/.codex/skills/humanizer/SKILL.md` was read before editing, and its mark, draft, review and final-edit process was applied. This is an editorial check, not a search-ranking or AI-detector claim.

## Mark

The existing item said Cohamy would provide the receiving account later. It did not contain a material staged opening, inflated claim, contrast, repeated closer or decorative formatting to remove. Its generic account wording no longer met the user's request to publish the account directly. The concrete beneficiary, account and bank were missing.

Facts supplied by the user: account `9139 8888 6666`, bank `MB Bank`, beneficiary `Cty TNHH Cohamy`. The shared contact profile holds the normalized legal display name `CÔNG TY TNHH COHAMY`. These are user-provided publication details; this change does not claim the account was externally verified.

## Draft

Chuyển khoản ngân hàng: MB Bank, số tài khoản 9139 8888 6666, chủ tài khoản CÔNG TY TNHH COHAMY. Cohamy xác nhận số tiền và nội dung chuyển khoản cho đơn đã đối chiếu. Trước khi chuyển, kiểm tra tên người nhận, ngân hàng, số tài khoản và số tiền. Ghi mã đơn và số điện thoại mua hàng trong nội dung chuyển khoản để hỗ trợ đối soát.

## Review

The draft retained confirmation for the reconciled order, the account/amount check and the order/phone transfer reference. The surrounding policy still distinguishes a request code from order confirmation, and still requires reconciliation of money actually received. COD, MoMo, refund, fraud-warning and invoice wording remain unchanged. No bank branch, automatic payment recognition, payment deadline, fee or new legal condition was added.

The repeated `chuyển khoản` is functional terminology in a payment policy. No em dash, en dash, artificial contrast, concluding slogan, unsupported qualifier or bold label was added to the customer-facing copy. The final edit moved `trước khi chuyển` to the end of its sentence for a direct instruction.

## Final edit

Chuyển khoản ngân hàng: MB Bank, số tài khoản 9139 8888 6666, chủ tài khoản CÔNG TY TNHH COHAMY. Cohamy xác nhận số tiền và nội dung chuyển khoản cho đơn đã đối chiếu. Kiểm tra tên người nhận, ngân hàng, số tài khoản và số tiền trước khi chuyển. Ghi mã đơn và số điện thoại mua hàng trong nội dung chuyển khoản để hỗ trợ đối soát.

The source interpolates `CONTACT.bankAccount.bankName`, `accountNumberDisplay` and `accountHolder`; it does not duplicate the bank facts in another source constant. Policy slugs, sections, link targets, source citations and all other policy items remain unchanged.

## Validation

Changed-file ESLint and whitespace checks passed. At copy handoff, the release owner still needed to add the shared contact fields before TypeScript/runtime validation. Runtime and MCP verification belong to the release owner; this prose-only task did not access production or submit a payment.
