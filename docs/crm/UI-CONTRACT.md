# Hợp đồng giao diện CRM Cohamy

THESIS: Transfer the user's pinned HumanBank CRM, not a new dashboard. Operate mode; no sidebar or marketing KPI redesign.

OWN-WORLD: Current HumanBank dark header, navy particle launcher, multicolored Phosphor modules, Be Vietnam Pro, floating bottom navigation, bright ledger/form surfaces. Final control-design cascade wins: flat colors and 4px control/tile radius.

STORY: Authenticated Cohamy staff or dealers open permitted modules, inspect scoped database records and save actual changes. Unimplemented workflows are explicitly labelled, without invented balances.

FIRST VIEWPORT: Header above a centered launcher; desktop 180px tiles and five columns, source-matched mobile grids; floating dock at the bottom. Login follows the actual HumanBank source. Operational tables scroll within their region.

FORM: Existing HumanBank shell, user-pinned; no random seed, alternative style or ImageGen comp. Reference components render locally with labelled QA identity and mocked auth/router only.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md

## Biên giới và ngoại lệ

Chỉ `.cohamy-crm` sử dụng hệ thống này. Website công khai và CMS không thuộc hệ thống thiết kế CRM. Source và CSS cascade được ghi trong `source-manifest.json`.

Các sửa nhỏ: tương phản placeholder/footer login; giảm chuyển động theo hệ điều hành bằng selector đủ specificity; mạng hạt dừng khi trang ẩn; bảng cuộn trong vùng. Không thay phong cách nguồn.

Detector chạy một lần, còn cờ inherited bounce easing và pseudo-element thông báo thành công. Giữ nguồn theo brief; nhiều easing cũ đã bị cascade control cuối ghi đè. Không dùng detector làm lý do thiết kế lại.

Đối chiếu launcher/login tại 1366×768, 390×844 và 320×844. Ảnh tham chiếu không chứng minh backend hoặc phiên production HumanBank hoạt động. Màn hàng hóa Cohamy dùng mẫu table/toolbar nguồn; chưa có ảnh pixel-pair màn bảng HumanBank cùng dữ liệu thương mại.
