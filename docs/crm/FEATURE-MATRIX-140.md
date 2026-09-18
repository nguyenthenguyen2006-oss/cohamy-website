# Cohamy - feature matrix F001-F140

Updated 2026-09-18T23:03:11.052Z. Source HEAD 684057fe7624ecd3ae0a390393ad973007cfd9e4. Production code at 684057fe7624ecd3ae0a390393ad973007cfd9e4 through migration014; source includes015/016 versioned pricing/quotation cohort. Public mobile acceptance follows the separate production Edge report. LOCAL and isolated PostgreSQL STAGING evidence are recorded separately. Exactly 140 target IDs. 28 RELEASED, 8 VERIFIED_STAGING, 0 VERIFIED_LOCAL, 27 IN_PROGRESS, 77 NOT_STARTED. This matrix is a status report, not a claim that 140 features work.

Status vocabulary: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, VERIFIED_LOCAL, VERIFIED_STAGING, RELEASED, BLOCKED.

## F001 - Tự đăng ký đối tác/đại lý

- Phase / status: P2 / RELEASED.
- UI / API / migration: /portal/register / onboarding/register / 006.
- Current behavior and gap: OPEN form, durable profile, hashed password and retry fingerprint verified in LOCAL backend/UI; staging and live delivery pending.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Lưu tên đơn vị, người đại diện, điện thoại, email, địa chỉ, khu vực; validate rõ; gửi lặp không tạo nhiều hồ sơ
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F002 - Trang theo dõi hồ sơ đăng ký

- Phase / status: P2 / RELEASED.
- UI / API / migration: /portal/application / onboarding/application / 006.
- Current behavior and gap: Applicant cookie is separate from CRM membership; history and all application states.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Người đăng ký chỉ thấy hồ sơ mình và trạng thái chờ duyệt, cần bổ sung, chấp nhận hoặc từ chối cùng bước tiếp theo
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F003 - Hàng đợi xét duyệt cho admin

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /crm/applications / onboarding/queue,review / 006,009.
- Current behavior and gap: Queue/reviewer/wait filters verified in LOCAL; PostgreSQL competing approvals grant exactly one membership/organization (governance-postgres-staging.json).
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Lọc đăng ký mới, người phụ trách, thời gian chờ; xử lý đồng thời không duyệt hồ sơ hai lần
- Evidence: test-results/upgrade-local.json, test-results/partner-library-local.json, test-results/upgrade-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F004 - Yêu cầu bổ sung thông tin

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /portal/application; /crm/applications/:id / onboarding/edit,submit,review / 006.
- Current behavior and gap: Selected requested fields, review reason, applicant edit/resubmit and immutable history; request choices displayed in applicant history. Attachment requests for applicant identities remain.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Admin chỉ rõ trường/tài liệu cần bổ sung; người đăng ký sửa và gửi lại, giữ nguyên lịch sử
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F005 - Xác minh email hoặc điện thoại

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /portal/application / onboarding/verification-send,verification-confirm / 006.
- Current behavior and gap: Brevo adapter, delivery failure, hashed six-digit code, 10-minute expiry, five attempts, single use, resend and per-account limits. LIVE delivery NOT_RUN.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Kênh được chọn xác minh trước gửi duyệt; token hết hạn/dùng lại/thử quá số lần đều bị chặn; có test delivery thật khi cấu hình
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F006 - Duyệt kèm phân quyền

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /crm/applications/:id / onboarding/review / 006,009.
- Current behavior and gap: Atomic role/org/assignment/audit and exact retry in LOCAL; simultaneous PostgreSQL approvals verified on an independent STAGING database.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Chọn tổ chức, vai trò, người hỗ trợ và scope; cấp quyền nhất quán trong transaction, không cho tự nâng quyền
- Evidence: test-results/upgrade-local.json, test-results/partner-library-local.json, test-results/upgrade-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F007 - Link mời đăng ký riêng

- Phase / status: P2 / RELEASED.
- UI / API / migration: /crm/invitations / onboarding/invitation,invitation-revoke / 006.
- Current behavior and gap: Creator, expiry, usage ceiling, revocation and invitation role/organization ceiling.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: CRM ADMIN; portal DEALER_OWNER may invite only DEALER_STAFF into their own organization.
- Acceptance: Lưu người giới thiệu, hạn, lượt dùng; thu hồi được; không dùng token hết hạn hoặc dùng lại ngoài giới hạn
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F008 - Gắn đăng ký vào đại lý hiện có

- Phase / status: P2 / RELEASED.
- UI / API / migration: /crm/applications/:id / onboarding/review / 006.
- Current behavior and gap: Admin sees normalized phone/email duplicate candidates and chooses existing dealer; exact approval retry preserves membership.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Admin xem trùng và chọn đơn vị; người đăng ký không tự gia nhập tổ chức; không nhân bản đơn vị khi retry
- Evidence: test-results/upgrade-local.json, test-results/partner-library-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F009 - Checklist bắt đầu sử dụng

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /portal / library/checklist / 009.
- Current behavior and gap: Profile/catalog/current-policy-read checklist; acknowledgements follow latest version. First actual commercial request item remains incomplete until P4.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Theo dõi hoàn thiện hồ sơ, đọc đúng phiên bản chính sách, xem danh mục; mục tạo yêu cầu chỉ hoàn tất khi có yêu cầu thật
- Evidence: test-results/partner-library-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F010 - Mục Dành cho đối tác trên website

- Phase / status: P2 / RELEASED.
- UI / API / migration: /vi/doi-tac; /en|zh|ko|ja/partners / public localized route / none.
- Current behavior and gap: Five-locale guide and footer link, registration/login/tracking links.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Public, without CRM/portal membership.
- Acceptance: Có đăng nhập, đăng ký, hướng dẫn hợp tác trên desktop/mobile; liên kết đúng locale và route, giữ website hiện có
- Evidence: test-results/upgrade-browser-local.json, test-results/partner-merge-browser-local.json, test-results/browser-production.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F011 - Trang chủ riêng cho đại lý

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hiện việc, đơn và thông báo thuộc đúng đơn vị/người dùng; không có số liệu mẫu trong runtime thật
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F012 - Đặt nhanh theo SKU

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Nhập nhiều mã, số lượng và đơn vị trên một màn; báo mã không bán, sai quy cách hoặc vượt điều kiện
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F013 - Đặt lại đơn cũ

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Sao chép dòng hàng, tính lại giá/khả năng cung ứng và hiển thị thay đổi trước xác nhận
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F014 - Giỏ hàng nháp theo tài khoản

- Phase / status: P4 / RELEASED.
- UI / API / migration: /portal/cart / portal/cart / 008.
- Current behavior and gap: Account-scoped persisted lines; active SKU/base unit validation, version conflict. Commercial checkout is separate and not implemented.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu server và tiếp tục trên thiết bị khác; xử lý phiên bản khi hai thiết bị cùng sửa
- Evidence: test-results/portal-services-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F015 - Tạo yêu cầu từ Excel

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Có mẫu, ánh xạ SKU/đơn vị, lỗi từng dòng và preview; chỉ tạo sau xác nhận, không ghi một phần ngoài ý muốn
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F016 - Nhiều địa chỉ giao hàng

- Phase / status: P4 / IN_PROGRESS.
- UI / API / migration: /portal/addresses / portal/address,addresses / 008.
- Current behavior and gap: Multiple addresses, owner writes, staff reads, default and inactive history. Confirmed-order address snapshots await P4.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu chi nhánh/người nhận, chọn mặc định; sửa địa chỉ không đổi snapshot đơn cũ
- Evidence: test-results/portal-services-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F017 - Nhân viên đại lý

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /portal/invitations / onboarding/invitation / 006.
- Current behavior and gap: Own staff invitations, owner staff lock/unlock with version guard, same-transaction session revocation; owner/internal-role mutations blocked. Existing fixed staff role ceiling inherited; per-capability editor remains.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Chủ đại lý mời/khóa/cấp quyền trong tổ chức mình; không cấp vượt quyền chủ hoặc vai trò nội bộ
- Evidence: test-results/upgrade-local.json, test-results/portal-services-local.json, test-results/partner-library-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F018 - Duyệt đơn nội bộ đại lý

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Nhân viên gửi đề nghị, chủ duyệt/từ chối; Cohamy chỉ nhận khi đáp ứng quy tắc phê duyệt
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F019 - Thư viện đối tác

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /crm/library; /portal/library / library/save,list,detail; private documents / 009.
- Current behavior and gap: Versioned files, role/organization audience, effective/expiry, draft/publish/withdraw, category/name filter and source-checked download. Real business policy texts not supplied.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Hiện catalogue, hình, hướng dẫn và chính sách đúng đối tượng/phiên bản; download kiểm tra quyền
- Evidence: test-results/partner-library-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F020 - Phiếu hỗ trợ

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /portal/support; /crm/support / portal/ticket,reply,ticket-update / 008.
- Current behavior and gap: Persistent support thread, statuses, scoped assignee selection and internal/private message separation; scoped PDF/photo attachments. PostgreSQL simultaneous support retry remains NOT_RUN.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Gửi nội dung/ảnh, phân công, theo dõi tiến độ và trao đổi; tách ghi chú nội bộ khỏi nội dung cho đại lý
- Evidence: test-results/portal-services-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F021 - Hồ sơ khách hàng tổng hợp

- Phase / status: P3 / IN_PROGRESS.
- UI / API / migration: /crm/customers/:id; /crm/dealers/:id / partners/:id; care/contacts; work/* / 001,003,005.
- Current behavior and gap: Profile, contacts, website requests/notes/tasks/documents and scoped quotation histories; confirmed commercial orders remain pending.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Liên kết liên hệ, yêu cầu, báo giá, đơn, việc và trao đổi; từng phần chỉ xuất hiện khi có quyền và dữ liệu
- Evidence: test-results/access-local.json, test-results/work-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F022 - Nhiều người liên hệ

- Phase / status: P3 / RELEASED.
- UI / API / migration: /crm/customers/:id; /crm/dealers/:id / care/contact,contacts / 005.
- Current behavior and gap: Multiple responsibilities, exactly one active primary, optimistic version, retain inactive contacts.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Một đơn vị có chủ, người mua, kế toán, người nhận; chọn liên hệ chính và giữ lịch sử khi ngừng sử dụng
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F023 - Cảnh báo trùng lúc nhập

- Phase / status: P3 / RELEASED.
- UI / API / migration: partner create/edit / partners/duplicates; partner-identifiers / 013.
- Current behavior and gap: Input-time scoped phone/email/business-ID warnings before save; +84/0084 and formatting normalization, SQL generated keys, exclude current record, scope before limit and no hidden-record count. Actual save/reload and XLSX mapping/export retain business ID; warnings never auto-merge.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: So sánh điện thoại/email/mã doanh nghiệp đã chuẩn hóa; cảnh báo không tiết lộ hồ sơ ngoài scope
- Evidence: test-results/partner-merge-local.json, test-results/partner-merge-postgres.json, test-results/partner-merge-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F024 - Gộp hồ sơ trùng có preview

- Phase / status: P3 / RELEASED.
- UI / API / migration: partner detail; historical archive / partners/merge; partner-merge / 014.
- Current behavior and gap: Manager selects surviving same-kind profile and each field/default/preferences, then inspects expiring versioned source-link manifest before separate confirmation. Atomic merge preserves immutable bytes/authors/closed balance source, retains historical archive and one primary/default, flattens chained aliases, revokes both organizations sessions and records reason/choices/old settings in immutable history. DML-only PostgreSQL competing/overlapping confirmations and injected rollback verified. Same-user/same-role membership collision rejects the complete preview and needs manual account reconciliation.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chọn dữ liệu giữ lại, xem liên kết bị ảnh hưởng; bảo toàn lịch sử, không làm lộ dữ liệu hoặc thay số sổ đã chốt
- Evidence: test-results/partner-merge-local.json, test-results/partner-merge-postgres.json, test-results/partner-merge-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F025 - Bảng cơ hội bán hàng

- Phase / status: P3 / RELEASED.
- UI / API / migration: partner detail / relationships/opportunity,opportunities / 010.
- Current behavior and gap: Five-stage board, version guard and immutable actor/time/stage history; transition UI persists.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chuyển giai đoạn mới tiếp cận, nhu cầu, báo giá, thắng/mất; lưu người sửa và thời điểm
- Evidence: test-results/relationships-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F026 - Lý do chưa mua/mất khách

- Phase / status: P3 / RELEASED.
- UI / API / migration: /crm/care; partner detail; /crm/reports / relationships/dictionary; care report / 010.
- Current behavior and gap: Manager-controlled reasons, explicit reason for LOST, notes and scoped stage/reason counts. No automatic loss from expired tasks.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Danh mục lý do có ghi chú; được tổng hợp trong báo cáo và không tự ghi là mất khách từ việc hết hạn
- Evidence: test-results/relationships-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F027 - Phân nhóm khách linh hoạt

- Phase / status: P3 / RELEASED.
- UI / API / migration: partner detail and lists; /crm/care / relationships/tags,dictionary; jobs/export / 010.
- Current behavior and gap: Multiple active tags, AND combination filter on server before pagination; selected tags persist in saved filters and XLSX export.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Quản lý nhiều nhãn/nhóm và lọc theo tổ hợp; có quyền quản lý danh mục nhóm
- Evidence: test-results/relationships-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F028 - Sở thích và cách liên hệ

- Phase / status: P3 / RELEASED.
- UI / API / migration: partner detail / relationships/preferences / 010.
- Current behavior and gap: Preferred channel/time, active SKU interests, preparation notes and version locking under current partner scope.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu sản phẩm quan tâm, khung giờ và kênh ưu tiên; hiển thị ngay khi chuẩn bị chăm sóc
- Evidence: test-results/relationships-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F029 - Nhật ký thăm điểm bán

- Phase / status: P3 / RELEASED.
- UI / API / migration: partner detail; /crm/visits/:id / relationships/visit,visits / 010.
- Current behavior and gap: Append-only visit actor/time/result/support request; private photos linked to visit; exact retry and current source ACL.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gắn người thăm, thời điểm, kết quả, ảnh và đề nghị hỗ trợ vào đúng hồ sơ
- Evidence: test-results/relationships-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F030 - Quản lý hàng mẫu

- Phase / status: P3 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Preserve history and scoped organization/task references.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Theo dõi người nhận, SKU, số lượng, gửi/nhận/phản hồi/chuyển đơn; xuất mẫu thực phải đi qua nghiệp vụ kho
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F031 - Bảng giá theo cấp đại lý

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: /crm/pricing; /portal/quotations / pricing/tier,assign-tier,preview / 015.
- Current behavior and gap: Manager-configured tiers and active partner assignments; priority then organization/tier/all specificity, fresh actor/partner scope and no retail-price fallback. Structured native GUI and isolated DML-only PostgreSQL verified. Real commercial policies D04 remain unconfigured.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Đại lý chỉ nhận bảng giá phù hợp; có quy tắc ưu tiên rõ khi nhiều bảng cùng thỏa điều kiện
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F032 - Bảng giá theo thời gian

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: /crm/pricing/:id / pricing/save,publish,versions / 015.
- Current behavior and gap: Immutable policy versions, half-open Vietnam-time windows, reject equal-precedence overlap, new draft retains published version, audited publish/withdraw and exact retry. PostgreSQL competing publication commits exactly one complete policy.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Có ngày hiệu lực/kết thúc và lịch sử; xử lý đúng múi giờ và khoảng trùng hiệu lực
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F033 - Giá theo số lượng

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: catalog detail; pricing editor/preview / pricing/unit,preview; pricing-model / 015.
- Current behavior and gap: Confirmed versioned exact numerator/denominator units, BASE1/1, explicit LINE/SKU/ORDER threshold basis, exact BigInt arithmetic and no stock rounding; boundary and split-SKU tests. Base-unit change blocked while configured units active.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tính đúng tại biên ngưỡng và sau quy đổi đơn vị; cách áp theo dòng/SKU/đơn được cấu hình rõ
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F034 - Điều kiện đặt tối thiểu

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: pricing editor/preview; quotation detail / pricing/preview; quotations/action / 015,016.
- Current behavior and gap: Paid net merchandise amount, whole converted cases and paid SKU minima; exact shortfalls before send and server SEND rejection without partial event.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Kiểm tra tổng tiền, số thùng hoặc SKU theo chính sách; thông báo phần còn thiếu trước gửi
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F035 - Báo giá PDF Cohamy

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: /crm/quotations/:id; /portal/quotations/:id / quotations/pdf,action / 016.
- Current behavior and gap: Cohamy logo and embedded complete Vietnamese fonts; exact source totals/terms/expiry, source-version PDF saved atomically on SEND with checksum. One-page and six-page fixtures text/quantity checked and all seven rendered pages visually inspected. Production real customer PDF not exercised.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: PDF tiếng Việt đúng font, logo, dòng hàng, điều kiện giao và hạn; tổng tiền khớp dữ liệu nguồn, kiểm tra bản render
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F036 - Phiên bản báo giá

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: quotation detail and comparison / quotations/save,versions,events / 016.
- Current behavior and gap: Immutable snapshots of price/unit/policy/address and saved PDF; full before/after lines, retained sent versions, exact accepted version. New draft never overwrites dealer-visible sent source/PDF. SQL failure rolls back send and five concurrent draft retries create one head/version. Merge moves only current head, retaining original snapshot/PDF bytes.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Giữ bản đã gửi, so sánh thay đổi và xác định bản được chấp nhận; sửa không ghi đè lịch sử
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F037 - Đại lý phản hồi báo giá

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: /portal/quotations/:id / quotations/action / 016.
- Current behavior and gap: Owner ACCEPT/REQUEST_REVISION on exact current sent version, role/source checks, explicit expired/superseded states, immutable response reason and idempotent retry. Staff reads only; stale locked identities blocked. Actual Edge consecutive revision/accept reasons verified.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Người có quyền xác nhận/yêu cầu sửa đúng phiên bản; phản hồi vào bản hết hạn được xử lý rõ
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F038 - Duyệt chiết khấu vượt quyền

- Phase / status: P4 / VERIFIED_STAGING.
- UI / API / migration: CRM quotation approval / quotations/action; pricing-model / 015,016.
- Current behavior and gap: Server discount ceiling, override/credit/amount triggers, other-user approval if configured, actor/reason and immutable decision required before SEND; Admin creator also blocked from self approval under policy.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Quy tắc ngưỡng áp ở server; có người duyệt/lý do; không tự duyệt ngoại lệ nếu chính sách cấm
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; listed LOCAL/STAGING acceptance; deployment follows verified migration metadata.

## F039 - Combo và hàng tặng

- Phase / status: P4 / IN_PROGRESS.
- UI / API / migration: pricing gifts editor; quote snapshot / pricing-model; quotations/save / 015,016.
- Current behavior and gap: PARTIAL: AND paid-SKU conditions, deterministic priority/exclusive/stack groups and ONCE/PER_THRESHOLD gifts with exact quantity and actual confirmed BASE unit version. Free gifts never trigger later gifts. Inventory posting and returns remain NOT_STARTED; do not mark this ID verified or released.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tính điều kiện, ưu tiên/cộng dồn theo chính sách; hàng tặng vẫn có số lượng kho và được xử lý khi trả hàng
- Evidence: test-results/decimal-local.json, test-results/pricing-model-local.json, test-results/pricing-local.json, test-results/pricing-postgres.json, test-results/quotations-local.json, test-results/quotations-postgres.json, test-results/quotation-pdf-local.json, test-results/commercial-browser-local.json, test-results/commercial-controls-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F040 - Chốt giá khi xác nhận đơn

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Snapshot đơn giữ giá/đơn vị/chính sách; thay bảng giá không đổi đơn đã xác nhận
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F041 - Yêu cầu thành đơn bán hàng

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chuyển theo quyền và điều kiện, giữ nguồn; retry không tạo hai đơn hoặc bỏ qua phê duyệt
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F042 - Nhân viên tạo đơn thay khách

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Ghi người thao tác, khách, nguồn điện thoại/gặp/kênh khác; áp đủ quy tắc giá và quyền
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F043 - Duyệt đơn theo điều kiện

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tính đúng tuyến duyệt theo giá trị, giá đặc biệt, điều khoản; lưu phiên bản quy tắc áp dụng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F044 - Tách trạng thái đơn/giao/tiền

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Đơn duyệt không tự thành đã giao/đã thu; từng chiều cập nhật từ chứng từ tương ứng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F045 - Timeline đơn hàng

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hiện người, thời gian, sự kiện và bước chờ; không lộ ghi chú nội bộ qua portal
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F046 - Yêu cầu sửa đơn

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Preview trước/sau và ảnh hưởng; đơn đang giao không được sửa âm thầm làm lệch kho/tiền
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F047 - Hủy theo giai đoạn

- Phase / status: P4/P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Kiểm tra trạng thái/quyền, ghi lý do; giải phóng reservation đúng một lần và xử lý phần đã giao riêng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F048 - Giao nhiều đợt

- Phase / status: P4/P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tổng các đợt không vượt lượng được phép; theo dõi đã giao, còn lại, lịch tiếp và lịch sử
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F049 - Hàng chờ bổ sung

- Phase / status: P4/P5/P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hiện SKU/ lượng còn thiếu, ngày dự kiến và người xử lý; không cam kết từ tồn đã bị giữ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F050 - Cảnh báo đơn có thể trùng

- Phase / status: P4 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Versioned price and approval policy D04/D05 must precede real order posting.
- Dependencies / decisions: P2/P3; D03-D05; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: So khớp khách, dòng hàng, thời điểm; cho kiểm tra thay vì tự xóa đơn hợp lệ; tách khỏi idempotency kỹ thuật
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F051 - Sổ nhập–xuất–tồn

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Mọi phát sinh có chứng từ/người thực hiện; tồn khớp tổng movement; đảo chứng từ giữ lịch sử
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F052 - Quy đổi đơn vị

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gói/hộp/hũ/thùng quy đổi chính xác; thay quy cách không làm đổi số lượng chứng từ đã ghi
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F053 - Nhiều kho/vị trí

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lọc kho/khu/kệ theo quyền; không chuyển hàng đến vị trí không hợp lệ hoặc ngừng dùng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F054 - Lô, NSX và hạn dùng

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gắn lô khi nhận, truy đến lần giao; kiểm tra ngày và điều kiện hàng được xuất
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F055 - Xuất theo hạn gần nhất

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gợi ý FEFO từ lô khả dụng, đáp ứng hạn dùng tối thiểu; ngoại lệ cần quyền/lý do
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F056 - Tồn thực/giữ/khả dụng

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hai đơn tranh cùng lượng không giữ vượt tồn; giải phóng/tiêu thụ giữ hàng đúng một lần
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F057 - Chuyển kho hai bước

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu lượng đang chuyển và thực nhận; bảo toàn tổng hàng khi nhận từng phần hoặc báo thiếu
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F058 - Kiểm kê mobile/máy quét

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu lần đếm, preview chênh lệch, phê duyệt trước movement; xử lý giao dịch phát sinh trong lúc đếm
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F059 - Cảnh báo thiếu/lâu/cận hạn

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Ngưỡng theo SKU/kho, loại trừ hàng không khả dụng đúng quy tắc; bấm cảnh báo mở đúng danh sách
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F060 - Khóa và thu hồi lô

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lô khóa không được giữ/xuất mới; truy được bên nhận, đơn, lượng và tiến độ xử lý thu hồi
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F061 - Phiếu soạn trên điện thoại

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chỉ rõ vị trí/lô/lượng, lưu tiến độ; soạn theo reservation và quyền kho
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F062 - Quét kiểm tra đóng gói

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chặn/nhắc SKU sai, thiếu, thừa; có nhập mã thay thế khi thiết bị không hỗ trợ camera
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F063 - Quản lý kiện

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Một lần giao nhiều kiện có mã/nhãn/dòng hàng; tổng lượng đóng gói không vượt phiếu giao
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F064 - Gom chuyến giao

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chọn đơn phù hợp, người giao, thứ tự điểm; không xếp cùng kiện vào hai chuyến hoạt động
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F065 - Khung giờ nhận

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu ngày/giờ và yêu cầu khách, xử lý hẹn lại có lịch sử; thống nhất múi giờ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F066 - Theo dõi vận đơn

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gắn đúng hãng/mã; callback kiểm chứng, chống lặp và sai thứ tự; có trạng thái mất kết nối và cập nhật thủ công có audit
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F067 - Bằng chứng giao nhận

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu người nhận/thời gian/ảnh/xác nhận theo chính sách; chỉ người có quyền đọc chứng từ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F068 - Giao thất bại

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Ghi lý do và chọn hẹn lại/hoàn; hàng đang chuyển không tự trở thành hàng có thể bán
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F069 - Yêu cầu đổi trả dòng hàng

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chọn đơn/dòng/lượng/lý do/ảnh; không trả vượt lượng đủ điều kiện sau các lần trả trước
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F070 - Phân loại hàng trả

- Phase / status: P6 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build source-linked picking/delivery/return documents; D08 and provider contract required.
- Dependencies / decisions: P4/P5; D08; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Ghi thực nhận và kết quả bán lại/cách ly/hỏng; movement liên kết phiếu trả, không tự hoàn tiền
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F071 - Thỏa thuận ký gửi

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu SKU, thời hạn, địa điểm, điều kiện và kỳ; có phiên bản được hai bên áp dụng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F072 - Hàng gửi theo đại lý

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tách hàng ký gửi với hàng bán đứt; ghi đúng owner và nơi giữ, không đếm trùng tồn
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F073 - Đại lý xác nhận thực nhận

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Nhận đủ/thiếu/hỏng từng dòng; có đối chiếu với lượng xuất và lịch sử xử lý
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F074 - Báo bán theo kỳ

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Nhập tay/file có preview; không báo vượt khả dụng; gửi lại không nhân lượng bán
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F075 - Tồn ký gửi

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Đối chiếu gửi, bán, trả, điều chỉnh và tồn xác nhận; truy được từng chênh lệch
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F076 - Tính phần hưởng

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tính theo phiên bản thỏa thuận và cơ sở được chốt; đổi chính sách không sửa kỳ đã chấp nhận
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F077 - Đối soát hai bên

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Từng bên phản hồi/xác nhận; lưu khoản tranh chấp và người chịu trách nhiệm xử lý
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F078 - Khóa kỳ đối soát

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Kỳ chấp nhận không bị sửa trực tiếp; điều chỉnh có quyền, chứng từ và liên kết về kỳ gốc
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F079 - Đề nghị bổ sung ký gửi

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gợi ý từ tồn/tốc độ bán có giải thích; đề nghị chỉ thành giao hàng sau phê duyệt
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F080 - Thu hồi/đổi ký gửi

- Phase / status: P8 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D09 agreement and ownership/settlement ledger required; do not infer true stock/debt.
- Dependencies / decisions: P5-P7; D09; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Áp điều kiện chậm bán/cận hạn; đối chiếu lượng lấy về, thực nhận và tồn còn tại đại lý
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F081 - Hạn mức công nợ

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tính đã dùng/còn lại theo chính sách; hai đơn đồng thời không vượt hạn mức ngoài ngoại lệ được duyệt
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F082 - Kỳ hạn thanh toán

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Ngày đến hạn được tính từ sự kiện đã chốt; thay chính sách không sửa ngầm chứng từ cũ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F083 - Sổ phải thu

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Mỗi khoản có đơn/chứng từ nguồn, điều chỉnh và số còn lại; tổng khớp chi tiết
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F084 - Phân bổ thu nhiều–nhiều

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Một thu cho nhiều đơn/một đơn nhiều thu; không phân bổ vượt tiền hoặc dư nợ, kể cả concurrent
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F085 - Đặt cọc/ứng trước

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Theo dõi phát sinh, sử dụng, hoàn và dư; tránh ghi nhận hai lần khi cấn vào đơn
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F086 - Tải chứng từ chuyển khoản

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Đại lý gửi, kế toán kiểm tra/xác nhận/từ chối; ảnh tải lên không tự đánh dấu đã thu
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F087 - Nhập sao kê và gợi ý ghép

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chống nhập trùng dòng giao dịch; gợi ý có căn cứ và cần kế toán xác nhận; xử lý ghép sai có lịch sử
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F088 - Tuổi nợ

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Nhóm chưa đến hạn/quá hạn khớp ngày đối chiếu, phân bổ và khoản tranh chấp
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F089 - Nhắc thanh toán

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lịch, mẫu, người nhận và lịch sử; dừng nhắc khi đã giải quyết; không gửi lặp do retry
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F090 - Đề nghị thu–chi/hoàn tiền

- Phase / status: P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D05/D10/D11, precise amounts, source-linked ledger, reversal and allocation constraints required.
- Dependencies / decisions: P4-P6 source documents; D05/D10/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tách đề nghị, duyệt và thực hiện; lưu chứng từ, tránh duyệt/thực hiện hai lần và đảo số có lịch sử
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F091 - Hồ sơ nhà cung cấp

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu liên hệ, mặt hàng, điều kiện và tài liệu; không trộn scope/loại tổ chức hiện có
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F092 - Đề nghị mua

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Nhân viên nhập nhu cầu/lượng/hạn cần; theo dõi xét duyệt và chuyển thành mua
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F093 - Yêu cầu báo giá nhà cung cấp

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu nội dung gửi, phản hồi và phiên bản; gửi ngoài chỉ qua kênh được cấu hình/cho phép
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F094 - So sánh báo giá mua

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: So cùng đơn vị/cơ sở giá, thời gian, phí và điều kiện; ghi lý do lựa chọn
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F095 - Đơn mua

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tạo/duyệt/theo dõi, snapshot điều kiện; sửa đơn đã nhận một phần được kiểm soát
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F096 - Theo dõi giao nhiều đợt/trễ

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tổng đã nhận/còn lại khớp đợt nhận; hiện hẹn giao và nguyên nhân trễ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F097 - Đối chiếu thực nhận

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: So đơn mua và hàng nhận, ghi thiếu/thừa/lỗi; chỉ lượng chấp nhận tạo tồn khả dụng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F098 - Trả/khiếu nại nhà cung cấp

- Phase / status: P5 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Liên kết phiếu nhận/SKU/lô; có lượng, lý do, chứng từ và tiến độ giải quyết
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F099 - Phải trả và lịch thanh toán

- Phase / status: P5/P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Khoản phải trả phát sinh theo chính sách; phân bổ, trả hàng, điều chỉnh và số dư khớp
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F100 - Đánh giá nhà cung cấp

- Phase / status: P5/P7 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. D06/D07/D11, stock ledger, ownership, units, lots, transactional reservations and PostgreSQL concurrency are required.
- Dependencies / decisions: P4 line model; D06-D07/D11; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tỷ lệ đúng hẹn/đủ hàng/chất lượng tính từ chứng từ thật; có khoảng thời gian và dữ liệu để kiểm tra
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F101 - Bàn làm việc Hôm nay

- Phase / status: P3 / IN_PROGRESS.
- UI / API / migration: /crm / work/orders,tasks; onboarding/queue / 003,012.
- Current behavior and gap: Scoped overdue and remaining-today lists use Vietnam cutoff, with ADMIN submitted-applicant queue and intake queue links. Warehouse/accounting specialized pending sections expand with their actual domains.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gom việc đến hạn/quá hạn/hồ sơ chờ theo vai trò, múi giờ và scope; click mở đúng danh sách
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F102 - Checklist công việc

- Phase / status: P3 / IN_PROGRESS.
- UI / API / migration: /crm/tasks/:id / care/checklist / 005.
- Current behavior and gap: Ordered checklist with accessible move controls, persisted edits/version guard; incomplete checklist blocks completion.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Thêm/sắp/đánh dấu bước; lưu sau reload và quy tắc hoàn thành công việc rõ
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F103 - Công việc lặp lại

- Phase / status: P3 / RELEASED.
- UI / API / migration: record detail; /crm/automation / automation/schedule,schedules,schedule-runs / 012.
- Current behavior and gap: Vietnam daily/weekly/monthly cadence with end-month clamp/original anchor, pause/version edits, immutable outcomes, fresh source/assignee ACL; real PM2 kill mid-transaction/restart and concurrent PostgreSQL ticks produce exactly one task.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Sinh theo lịch, múi giờ; restart/retry không tạo trùng; có tạm dừng/chỉnh lịch
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F104 - Công việc phụ thuộc

- Phase / status: P3 / IN_PROGRESS.
- UI / API / migration: /crm/tasks/:id / care/dependency / 005.
- Current behavior and gap: Same-record scoped prerequisites, cycle detection, completion/reopen guards; Opposite concurrent PostgreSQL edits allow one dependency and reject the competing cycle (care-automation-postgres.json). UI exception workflow remains to be verified directly.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chặn vòng phụ thuộc; hoàn thành bước trước mới mở bước sau theo quy tắc
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F105 - Nhắc tên/người theo dõi

- Phase / status: P3 / RELEASED.
- UI / API / migration: record notes; /crm/tasks/:id / work/activity; automation/follow,watchers / 012.
- Current behavior and gap: Valid current-source mention candidates, atomic immutable mentions and in-app notifications; followers persist/idempotent, completion/reopen rechecks source and never grants scope. LOCAL backend and real Edge UI.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chỉ chọn người hợp lệ; nhắc tên không tự cấp quyền đọc hồ sơ; notification theo scope
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F106 - Bàn giao phụ trách

- Phase / status: P3 / RELEASED.
- UI / API / migration: /crm/automation / automation/handover-preview,handover-confirm / 012.
- Current behavior and gap: Own expiring versioned impact manifest, atomic Sales assignment/intake/open-task/future-schedule/rule transfer, old-session revocation and preserved historic actors; exact retry and competing new-task PostgreSQL consistency.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Preview việc/hồ sơ chuyển, ghi bàn giao; thu hồi quyền cũ và cấp scope mới nhất quán
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F107 - Trung tâm thông báo

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /crm/notifications; /portal/notifications / workspace/notifications,notification-read / 005,011.
- Current behavior and gap: Scoped in-app events; ALL/READ/UNREAD server filtering and UI, read action rechecks source scope.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Có đã đọc/chưa đọc, lọc và link đúng đối tượng; người mất quyền không còn đọc nội dung nhạy cảm
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F108 - Tùy chọn thông báo

- Phase / status: P2 / IN_PROGRESS.
- UI / API / migration: /crm/workspace; /portal/workspace / workspace/preferences / 005,011.
- Current behavior and gap: Type/IN_APP preferences and Vietnam quiet hours including overnight delay, mandatory security exception. Additional EMAIL channel/outbox remains.
- Dependencies / decisions: P1 minimum; D01-D03; D13 for library policies; no external live verification assumed.
- Permission: Applicant-own profile until approval; reviewer ADMIN; active portal organization after approval.
- Acceptance: Lưu loại/kênh/giờ yên lặng; hệ thống áp dụng đúng và hiển thị ngoại lệ bắt buộc nếu có
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F109 - Nhắc/chuyển cấp chậm xử lý

- Phase / status: P3 / RELEASED.
- UI / API / migration: /crm/automation / automation/sla,escalations / 012.
- Current behavior and gap: Task-kind/deadline-based configured manager recipient, immutable per-policy/task log, one notification under concurrent PostgreSQL ticks; completed work excluded and revoked recipient disables policy. IN_APP preferences/quiet hours apply.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Cấu hình hạn theo loại việc; không tạo nhiều escalation trùng và ghi rõ người nhận
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F110 - Quy tắc tự tạo việc

- Phase / status: P3 / RELEASED.
- UI / API / migration: /crm/automation / automation/rule,rule-runs / 012.
- Current behavior and gap: Enabled templates consume real committed application.approved/partner.created audit events, unique immutable per-event result, current actor/source ACL, activation window and retry; template edits preserve prior tasks. Actual approval tested in LOCAL, concurrent event consumers in PostgreSQL.
- Dependencies / decisions: P1; scoped organizations and work; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Sự kiện duyệt hồ sơ tạo đúng một việc theo mẫu; có bật/tắt, log và kiểm thử retry
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F111 - Dashboard theo vai trò

- Phase / status: P9 / IN_PROGRESS.
- UI / API / migration: /crm; /portal / existing dashboard / 001,003.
- Current behavior and gap: Existing scoped work dashboard, no invented money/stock KPI; warehouse/accounting operational dashboards await source ledgers.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Quản lý/sales/kho/kế toán có chỉ số và việc phù hợp; số liệu truy về nguồn và đúng scope
- Evidence: test-results/access-local.json, test-results/work-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F112 - Nguồn khách và chuyển đổi

- Phase / status: P9 / IN_PROGRESS.
- UI / API / migration: /crm/reports / work report / 003.
- Current behavior and gap: Intake totals only. Conversion cohort definition and merged-profile deduplication not implemented.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Định nghĩa mẫu số/mốc chuyển rõ; ghi nhận nguồn thiếu; không tính trùng khách đã gộp
- Evidence: test-results/access-local.json, test-results/work-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F113 - Phân tích giai đoạn bán

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Xem số lượng, thời gian ở giai đoạn và lý do thắng/mất trong khoảng chọn
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F114 - Đại lý mới/giảm hoạt động

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Ngưỡng hoạt động có cấu hình; phân biệt không đặt hàng với thiếu dữ liệu; mở danh sách chăm sóc
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F115 - Bán hàng theo SKU/đại lý/vùng/sales

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Theo quy tắc ghi nhận đã chốt; xử lý trả/hủy và drill-down tới chứng từ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F116 - Biên lợi nhuận

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Có nguồn giá vốn/chi phí và công thức; thiếu dữ liệu hiển thị chưa đủ, không coi thiếu là 0
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F117 - Tốc độ xử lý đơn

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tách chờ duyệt/hàng/soạn/giao; tính từ mốc sự kiện, giải thích thời gian đang chờ
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F118 - Tồn lâu/cận hạn/vòng quay

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Khớp sổ kho và ngày báo cáo, tách hàng giữ/cách ly/ký gửi theo định nghĩa
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F119 - Đổi trả/giao thất bại/chất lượng

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lọc SKU/lô/nguyên nhân; tỷ lệ có mẫu số rõ và truy tới các lần giao/trả
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F120 - Tổng hợp định kỳ

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu bộ lọc, lịch và người nhận; kiểm tra quyền ở lúc chạy/gửi; job retry không gửi trùng
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F121 - Tìm kiếm toàn hệ thống

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: /crm/search; /portal/search / workspace/search / 005.
- Current behavior and gap: Scoped partners/SKU/website requests/tasks, result pagination. Commercial order search awaits P4; task title/parent search now filters in SQL before pagination and finds matches beyond 200 rows.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Tìm khách/đại lý/SKU/đơn/việc theo quyền; hỗ trợ từ khóa thực tế, phân trang và không lộ số lượng ngoài scope
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F122 - Tạo nhanh mọi màn hình

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: every CRM workspace header / partners; work/activity,task / 001,003.
- Current behavior and gap: Quick create in protected dialog; contextual note/task on partner/intake detail; no navigation, scoped server writes and error retention.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Thêm khách/ghi chú/việc với ngữ cảnh phù hợp; đóng form quay đúng màn và vị trí trước
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F123 - Lưu bộ lọc cá nhân/chung

- Phase / status: P1 / RELEASED.
- UI / API / migration: partner lists; /crm/workspace / workspace/filter,filters / 005,011.
- Current behavior and gap: Owned edit/default UI, default applies to unfiltered list and clear bypasses; shared role checks and current data scope. PostgreSQL concurrent defaults leave exactly one per user/resource.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Đặt tên, sửa, chọn mặc định và chia sẻ có quyền; lọc không vượt quyền người mở
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F124 - Tùy chỉnh cột

- Phase / status: P1 / RELEASED.
- UI / API / migration: partner lists / workspace/preferences / 005,011.
- Current behavior and gap: Column visibility/order/80–600px width saved per user/version and applied to table with local horizontal scrolling; mobile UI verified.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chọn/thứ tự/độ rộng và lưu preference; cột nhạy cảm vẫn kiểm tra quyền server
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F125 - Ghim/vừa mở

- Phase / status: P1 / RELEASED.
- UI / API / migration: /crm/workspace; /portal/workspace / workspace/bookmark,bookmarks / 005.
- Current behavior and gap: Pinned/recent records, unpin, fresh scope check; partner and intake detail records visit.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu theo người dùng, bỏ ghim được; mục mất quyền không còn hiển thị nội dung
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F126 - Xem chi tiết bên cạnh

- Phase / status: P1 / RELEASED.
- UI / API / migration: partner lists / partners/:id / none.
- Current behavior and gap: Native dialog panel fetches fresh scoped record, closes with Escape, preserves underlying filters/scroll, full direct link.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Mở/đóng bằng chuột/bàn phím, giữ lọc/scroll; mobile có cách xem phù hợp và link chi tiết trực tiếp
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F127 - Tự lưu/khôi phục nháp

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: partner/intake note form / workspace/draft / 005.
- Current behavior and gap: Server autosave and reload restore; optimistic locking, secret field rejection, fresh scope. Only note drafts currently.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hiện trạng thái lưu, khôi phục sau reload; xử lý xung đột và không lưu mật khẩu/OTP vào draft
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F128 - Thao tác hàng loạt có preview

- Phase / status: P1 / RELEASED.
- UI / API / migration: partner lists / governance/bulk-preview,bulk-confirm / 011.
- Current behavior and gap: Per-record source ACL/version preview, expiry, atomic errors, exact confirmation retry, sorted locks; PostgreSQL overlapping batches produce one complete winner without partial writes.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hiện danh sách tác động; kiểm tra từng bản ghi/quyền/phiên bản; lỗi từng mục rõ, có thể retry an toàn
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F129 - Một chạm trên mobile

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: partner/intake detail / browser native actions / none.
- Current behavior and gap: Call, copy fallback, map deep link; photo upload via documents. Device camera QA NOT_RUN.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Gọi/sao chép/bản đồ/chụp ảnh hoạt động với thông tin đúng; có fallback khi thiết bị không hỗ trợ
- Evidence: test-results/upgrade-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F130 - Cài màn hình chính và nháp offline

- Phase / status: P9 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Reports/offline must use verified source ledgers, live scope and agreed metrics.
- Dependencies / decisions: Corresponding verified source domains; D12; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Cài được trên nền tảng hỗ trợ; cache không lộ CRM; offline chỉ lưu nháp phù hợp, đồng bộ kiểm tra lại quyền/giá/phiên bản
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F131 - Import Excel có ánh xạ/preview

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: /crm/data; partner lists / jobs/preview,confirm,detail / 007.
- Current behavior and gap: XLSX mapping, row preview/errors, bounded ZIP, confirm-only write, durable job and unique row origins; actual PM2 kill/automatic restart, unmodified two-minute lease expiry and second restart verified under isolated PostgreSQL STAGING without duplicate imports. Other import resources remain.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Kiểm tra loại file/kích thước/cột/trùng/lỗi; xác nhận mới ghi; job có tiến độ và báo cáo tác động
- Evidence: test-results/data-jobs-local.json, test-results/worker-restart-local.json, test-results/upgrade-browser-local.json, test-results/worker-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F132 - Export danh sách đang lọc

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: /crm/data; partner lists / jobs/export,download / 007.
- Current behavior and gap: Selected columns/current partner filters, scoped XLSX, formula-safe text, private download and revalidation. Partner resource only; other list exports await modules.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Chọn cột, giữ bộ lọc và quyền; xử lý nội dung công thức nguy hiểm trong file, kết quả chỉ người có quyền tải
- Evidence: test-results/data-jobs-local.json, test-results/worker-restart-local.json, test-results/upgrade-browser-local.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F133 - Tệp theo hồ sơ

- Phase / status: P1 / RELEASED.
- UI / API / migration: partner/intake/support/library detail / documents; workspace/documents / 005,008,011.
- Current behavior and gap: Private files with magic/size/checksum, scoped download, title/filename/MIME/checksum metadata search and UI.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Hợp đồng/ảnh/biên bản/chứng từ có metadata tìm kiếm; giới hạn loại/kích thước, private download kiểm tra quyền
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F134 - Phiên bản và hiệu lực tài liệu

- Phase / status: P1 / RELEASED.
- UI / API / migration: document panel; library / workspace/document-read; documents / 005,011.
- Current behavior and gap: Immutable numbered files, version-specific read receipts and effective/expiry upload/display fields. Generic panel now distinguishes overall latest from effective-current and history; future versions and per-version receipts verified in actual UI, independently of filters.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lưu bản cũ, bản hiện hành, ngày hiệu lực/hết hạn; xác nhận đọc gắn đúng version
- Evidence: test-results/care-automation-local.json, test-results/care-browser-local.json, test-results/care-automation-postgres.json, test-results/care-worker-postgres.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F135 - Trường tùy chỉnh

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: /crm/fields; partner detail / governance/field-definition,custom-value / 011.
- Current behavior and gap: TEXT/decimal-string/DATE/BOOLEAN/ENUM, required value validation, per-role/current-parent ACL, immutable schema/value history retained after type change. Required commercial profile completeness remains for P4.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Có kiểu dữ liệu, validate, bắt buộc và quyền; đổi schema trường không làm mất giá trị cũ
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F136 - Bảng quyền dễ hiểu

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: /crm/profile; /crm/accounts/:id / governance/permissions,role-preview; work/account / 001,003,011.
- Current behavior and gap: Human-readable current permissions/scope and affected-account/session preview; required expected membership version, old assignments/sessions revoked, org/self/role ceilings. Resource-specific approve/export explanation expands with commercial modules.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Giải thích xem/tạo/sửa/duyệt/xuất và scope; preview người bị ảnh hưởng khi đổi, chống tự nâng quyền
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F137 - MFA và quên mật khẩu

- Phase / status: P1 / NOT_STARTED.
- UI / API / migration: Not implemented / none / none.
- Current behavior and gap: Not implemented. Build UI, server permissions, durable state, failure/retry handling and per-ID verification.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Đăng ký/xác nhận yếu tố thứ hai, recovery code một lần, reset token an toàn; luồng khôi phục không bỏ qua MFA tùy tiện
- Evidence: NOT_RUN; no acceptance evidence.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F138 - Thiết bị và phiên

- Phase / status: P1 / RELEASED.
- UI / API / migration: /crm/profile; /portal/profile / workspace/sessions; governance/session-revoke-others / 005,011.
- Current behavior and gap: Parsed device labels, own current-session marker, revoke one/all others, immediate browser invalidation; current session kept.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Liệt kê phiên với thông tin phù hợp, kết thúc từng phiên/tất cả phiên khác; phiên bị thu hồi mất quyền ngay theo thiết kế
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

## F139 - Audit có tìm kiếm

- Phase / status: P1 / IN_PROGRESS.
- UI / API / migration: /crm/audit / workspace/audit / 001,005,011.
- Current behavior and gap: Actor/entity/date filters, nested secret redaction at write/read, append-only; Vietnamese before/after/reason for new structured payloads. Remaining mutation domains need structured payloads when implemented.
- Dependencies / decisions: P0; permissions and organization scope; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lọc người/đối tượng/thời gian; xem trường trước–sau/lý do; append-only và che bí mật/giới hạn quyền
- Evidence: test-results/governance-local.json, test-results/governance-browser-local.json, test-results/governance-postgres-staging.json; environment and test time are recorded per report.
- Release / open work: Current source based on 684057fe7624ecd3ae0a390393ad973007cfd9e4; criteria above still require remaining behavior and verification.

## F140 - Backup và kiểm tra restore

- Phase / status: P10 / RELEASED.
- UI / API / migration: operator CLI / systemd timer / backup-restore.ts; run-backup.py / all.
- Current behavior and gap: Consistent exported-snapshot dump, SHA256 of every row including bytea, independent restore of 49 tables and restored A/B/file-byte checks; guarded retention and daily timer source. Production timer active and independently restored scheduled backups PASS at each verified deployed SHA (current table count in PROGRESS-140); retention defaults are disclosed, business RPO/RTO remains unagreed.
- Dependencies / decisions: All applicable phases; D13; no external live verification assumed.
- Permission: Server role and current organization/assignment scope; jobs and downloads revalidate.
- Acceptance: Lịch tự động, retention, cảnh báo lỗi, kiểm tra checksum; restore DB và file vào nơi độc lập, xác nhận liên kết dữ liệu và ghi bằng chứng
- Evidence: test-results/backup-guards-local.json, test-results/public-files-backup-local.json, test-results/backup-restore-staging.json, test-results/restored-access-staging.json, test-results/backup-restore-production.json, test-results/release-production.json; environment and test time are recorded per report.
- Release / open work: Code deployed at 684057fe7624ecd3ae0a390393ad973007cfd9e4; production metadata/HTTPS checks are read-only, live business/provider acceptance is not inferred.

