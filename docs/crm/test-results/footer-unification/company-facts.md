# Cohamy company information provenance

Checked on 2026-11-05. This report records the facts used for the shared footer and payment-policy update. No company registry or CRM record was changed by this verification.

## Primary source

The user supplied a photograph of the enterprise registration certificate at `C:/Users/ACER/AppData/Local/Temp/codex-clipboard-367cdfad-f82e-4cc9-88bd-60751244d11e.png`. The image was inspected directly. It resolves the date and issuing authority that were absent from the earlier template document and CRM company row.

| Field | Certificate evidence |
| --- | --- |
| Vietnamese legal name | CÔNG TY TNHH COHAMY |
| Enterprise number | 0111549388 |
| First registration | 25/06/2026, explicitly labelled “Đăng ký lần đầu” |
| First amendment | 24/09/2026, explicitly labelled “Đăng ký thay đổi lần thứ: 1” |
| Issuing office | Phòng Đăng ký kinh doanh và Tài chính doanh nghiệp |
| Parent authority | Sở Tài chính Thành phố Hà Nội |
| Registered address | Tầng 3, Tháp A, Tòa nhà T608, KĐT mới Cổ Nhuế, Đường Tôn Quang Phiệt, Phường Nghĩa Đô, Thành phố Hà Nội, Việt Nam |

The footer's registration date uses the first-registration date, not the amendment date. Its issuing-authority text may combine the office and parent authority above. Representative details, member information and registered capital are outside this request and were not transcribed. The source image is not copied into application code, `public/` or browser-delivered assets.

## Supporting and earlier sources

- The user supplied the [MaSoThue company page](https://masothue.com/0111549388-cong-ty-tnhh-cohamy). The release owner's browser observation records 25/06/2026 under “Ngày hoạt động”; this label alone does not establish the issuing office or a separate certificate issue date. The supplied certificate takes precedence.
- The [Thư Viện Pháp Luật company listing](https://thuvienphapluat.vn/ma-so-thue/cong-ty-tnhh-cohamy-mst-0111549388.html) independently lists MST 0111549388 and “Ngày cấp: 25/06/2026”. This is a supporting aggregate source, not the primary registration record.
- `C:/Users/ACER/Downloads/Chính sách mới luật TMĐT.docx` contains only the template placeholders “Ngày cấp: ...” and “Nơi cấp: ...” at extracted paragraphs 21 and 22. It supplies no Cohamy-specific registration facts.
- The existing `lib/contact.ts` supplied company contact details and office addresses, but no registration date or issuing authority. The live CRM `COHAMY` organization row had an empty business ID and address; its schema had no registration-date or issuer field. Its record creation date was not used as a registration date.
- Tax administration, such as “Thuế cơ sở 5 thành phố Hà Nội”, is not evidence of the certificate's issuing authority. The unrelated Trung Kim footer remains a layout reference only.

## Payment instructions

The bank details come directly from the user's request, not the certificate: account **9139 8888 6666**, **MB Bank**, beneficiary **Công ty TNHH Cohamy**. They are transcribed as supplied. No external bank-account verification or payment was performed.
