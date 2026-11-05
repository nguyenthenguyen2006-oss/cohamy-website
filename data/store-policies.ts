import { CONTACT } from "@/lib/contact";

export interface StorePolicySection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface StorePolicy {
  slug: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: StorePolicySection[];
  sources?: { label: string; url: string }[];
}

const company = CONTACT.companyName.vi;
const contact = `Hotline/Zalo: ${CONTACT.phoneDisplay}. Email: ${CONTACT.email}. Website: https://cohamy.vn. Bạn cũng có thể gửi biểu mẫu tại trang Liên hệ.`;
const offices = `Văn phòng Hà Nội: ${CONTACT.addresses.hanoi.vi}. Văn phòng TP. Hồ Chí Minh: ${CONTACT.addresses.hcmc.vi}. Vui lòng liên hệ trước khi đến hoặc gửi hàng để được hướng dẫn đúng nơi tiếp nhận.`;
const updatedAt = "2026-11-05";
const consumerLaw = {
  label: "Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15",
  url: "https://congbao.chinhphu.vn/van-ban/luat-so-19-2023-qh15-39843.htm",
};
const ecommerceLaw = {
  label: "Luật Thương mại điện tử số 122/2025/QH15",
  url: "https://chinhphu.vn/?classid=1&docid=216503&orggroupid=1&pageid=27160",
};
const personalDataLaw = {
  label: "Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15",
  url: "https://chinhphu.vn/?docid=214590&pageid=27160",
};

export const STORE_POLICIES: StorePolicy[] = [
  {
    slug: "bao-mat-thong-tin",
    title: "Chính sách bảo mật thông tin",
    summary: "Thông tin Cohamy thu thập khi bạn liên hệ, đặt hàng và cách yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân.",
    updatedAt,
    sections: [
      {
        id: "don-vi-quan-ly",
        title: "1. Đơn vị quản lý thông tin",
        paragraphs: [`${company} quản lý thông tin khách hàng cung cấp trên website cohamy.vn.`, contact, offices],
      },
      {
        id: "thong-tin-thu-thap",
        title: "2. Thông tin được thu thập",
        items: [
          "Khi đặt hàng: họ tên, email, số điện thoại, địa chỉ, khu vực giao nhận và ghi chú.",
          "Thông tin giao dịch: sản phẩm, số lượng, giá trị đơn, phương thức thanh toán đề nghị và lịch sử xử lý.",
          "Khi liên hệ: họ tên, email, số điện thoại, chủ đề, nội dung và ngôn ngữ sử dụng.",
          "Khi hỗ trợ: mã đơn, hình ảnh hoặc chứng từ bạn cung cấp. Che dữ liệu không liên quan trên chứng từ.",
          "Dữ liệu kỹ thuật phục vụ vận hành và bảo vệ website, như thông tin phiên, trình duyệt và giỏ hàng lưu trên thiết bị.",
        ],
        paragraphs: ["Cohamy không yêu cầu bạn gửi mật khẩu ngân hàng, mã OTP, mã PIN hoặc thông tin bảo mật thẻ qua biểu mẫu liên hệ hay ghi chú đơn hàng."],
      },
      {
        id: "muc-dich",
        title: "3. Mục đích và căn cứ sử dụng",
        paragraphs: ["Cohamy dùng thông tin để xác nhận yêu cầu, giao hàng, đối chiếu thanh toán, lập chứng từ, đổi trả và giải quyết phản ánh. Dữ liệu kỹ thuật giúp duy trì website, bảo vệ tài khoản và phòng ngừa gian lận.", "Việc xử lý dựa trên sự đồng ý hoặc căn cứ pháp luật phù hợp để thực hiện giao dịch. Cohamy chỉ dùng dữ liệu cần thiết cho mục đích đã thông báo; nếu mục đích mới cần sự đồng ý, Cohamy xin lại trước khi thực hiện.", "Quảng cáo chỉ được gửi khi có căn cứ đồng ý phù hợp. Bạn có thể từ chối qua kênh đã nhận hoặc liên hệ Cohamy; việc từ chối không làm mất quyền hỗ trợ đơn hàng."],
      },
      {
        id: "ben-tiep-can",
        title: "4. Người được tiếp cận và dịch vụ hỗ trợ",
        paragraphs: ["Nhân sự được phân quyền của Cohamy tiếp cận theo công việc. Đơn vị vận chuyển nhận tên, số điện thoại, địa chỉ và thông tin cần thiết cho giao hàng. Ngân hàng hoặc đơn vị thanh toán xử lý theo giao dịch và chính sách của họ.", "Website sử dụng dịch vụ máy chủ, thư điện tử và quản lý dữ liệu; biểu mẫu liên hệ được chuyển vào Google Sheets. Nhà cung cấp chỉ được tiếp cận trong phạm vi cần thiết và có nghĩa vụ bảo vệ dữ liệu. Cohamy không bán hay cho thuê thông tin cá nhân.", "Cohamy cung cấp thông tin cho cơ quan có thẩm quyền khi có căn cứ pháp luật. Nếu phát sinh chuyển dữ liệu cá nhân xuyên biên giới, Cohamy thực hiện các yêu cầu pháp luật tương ứng."],
      },
      {
        id: "luu-tru-bao-ve",
        title: "5. Lưu trữ và bảo vệ dữ liệu",
        paragraphs: ["Dữ liệu được giữ trong thời gian cần để xử lý yêu cầu và giao dịch. Chứng từ, dữ liệu kế toán hoặc hồ sơ tranh chấp được giữ theo thời hạn pháp luật tương ứng. Khi hết mục đích và thời hạn bắt buộc, Cohamy xóa, hủy hoặc khử nhận dạng.", "Cohamy phân quyền truy cập và áp dụng biện pháp bảo vệ phù hợp. Khi phát hiện sự cố dữ liệu cá nhân, Cohamy kiểm tra, xử lý và thông báo theo quy định."],
      },
      {
        id: "cookie-thiet-bi",
        title: "6. Cookie và dữ liệu trên thiết bị",
        paragraphs: ["Trình duyệt lưu giỏ hàng và thông tin nhận diện lần gửi để tiếp tục mua sắm, hạn chế gửi trùng. Khu vực đăng nhập dùng cookie phiên. Bạn có thể xóa dữ liệu website trong trình duyệt; giỏ hàng hoặc phiên đăng nhập có thể bị mất.", "Khi truy cập liên kết Zalo, bản đồ hoặc website khác, hãy xem chính sách của dịch vụ đó trước khi cung cấp thêm thông tin."],
      },
      {
        id: "quyen-khach-hang",
        title: "7. Yêu cầu về dữ liệu và phản ánh vi phạm",
        paragraphs: ["Bạn có thể yêu cầu biết, truy cập, nhận bản sao, sửa hoặc xóa dữ liệu; rút lại sự đồng ý, hạn chế hoặc phản đối xử lý trong phạm vi pháp luật cho phép. Gửi từ email hoặc số điện thoại đã dùng, mô tả yêu cầu và mã đơn nếu có. Cohamy xác minh thêm khi cần bảo vệ đúng chủ thể.", "Nếu phải tiếp tục lưu hoặc xử lý theo luật, Cohamy giải thích phạm vi và căn cứ. Rút lại sự đồng ý không thay đổi tính hợp pháp của hoạt động đã thực hiện trước đó.", "Nếu nghi ngờ dùng dữ liệu sai mục đích, gửi phản ánh qua hotline, email hoặc trang Liên hệ. Cohamy thông báo tiếp nhận trong 03 ngày làm việc từ khi nhận phản ánh của người tiêu dùng và thông báo hướng giải quyết. Bạn vẫn có quyền khiếu nại đến cơ quan có thẩm quyền hoặc giải quyết tranh chấp theo luật."],
      },
      {
        id: "cap-nhat",
        title: "8. Cập nhật chính sách",
        paragraphs: ["Phiên bản mới được công bố cùng ngày cập nhật trên trang này. Thay đổi chính sách không tự tạo ra sự đồng ý cho mục đích xử lý mới và không làm giảm quyền của bạn theo pháp luật."],
      },
    ],
    sources: [personalDataLaw, consumerLaw],
  },
  {
    slug: "van-chuyen-kiem-tra-doi-tra",
    title: "Chính sách vận chuyển - kiểm tra - đổi trả hàng",
    summary: "Cách xác nhận giao hàng, kiểm tra sản phẩm thực phẩm đóng gói và xử lý hàng giao sai, thiếu hoặc có vấn đề chất lượng.",
    updatedAt,
    sections: [
      {
        id: "pham-vi-thoi-gian",
        title: "1. Phạm vi và thời gian giao hàng",
        paragraphs: ["Cohamy giao hàng tại Việt Nam trong phạm vi đơn vị vận chuyển hỗ trợ, sau khi kiểm tra địa chỉ, hàng sẵn có và điều kiện bảo quản. Đơn lớn, hàng theo yêu cầu hoặc giao ngoài phạm vi thông thường cần thỏa thuận riêng.", "Cohamy liên hệ xác nhận sản phẩm, số lượng, địa chỉ, phí và thời gian dự kiến. Mã tiếp nhận chưa phải thông báo xuất kho; thời gian giao được tính theo xác nhận của từng đơn.", "Nếu chậm trễ, Cohamy báo lý do và thời gian mới để bạn lựa chọn tiếp tục hoặc thỏa thuận hủy. Nếu không thể thực hiện, Cohamy thông báo và hoàn khoản đã thu cho phần không thực hiện theo thỏa thuận và pháp luật."],
      },
      {
        id: "phi-giao-hang",
        title: "2. Phí và thông tin giao nhận",
        paragraphs: ["Phí vận chuyển được báo theo địa chỉ, khối lượng, phương thức giao và chương trình áp dụng. Nếu website chỉ hiển thị tiền hàng, Cohamy sẽ báo phí giao trước khi bạn xác nhận tổng thanh toán. Phụ phí giao nhanh, giao lại hoặc đóng gói riêng chỉ áp dụng khi đã được thông báo và bạn đồng ý.", "Bạn cần cung cấp địa chỉ, số điện thoại và người nhận chính xác. Khi cần đổi thông tin, liên hệ Cohamy sớm để kiểm tra khả năng điều chỉnh. Chi phí thực tế phát sinh do thay đổi chỉ được thu sau khi hai bên thống nhất."],
      },
      {
        id: "trach-nhiem-van-chuyen",
        title: "3. Đóng gói và trách nhiệm vận chuyển",
        paragraphs: ["Cohamy chuẩn bị hàng, đóng gói phù hợp và cung cấp thông tin, chứng từ giao nhận. Đơn vị vận chuyển giao theo dịch vụ đã thỏa thuận. Khi Cohamy bố trí vận chuyển, Cohamy là đầu mối xử lý mất, thiếu, hư hỏng trên đường giao; khách hàng có thể liên hệ trực tiếp Cohamy.", "Phiếu giao hàng, hóa đơn được cung cấp theo giao dịch và quy định liên quan. Khi cần hóa đơn, hãy cung cấp thông tin chính xác. Không chuyển tiền vào tài khoản lạ do người tự nhận là nhân viên giao hàng cung cấp."],
      },
      {
        id: "kiem-tra",
        title: "4. Kiểm tra khi nhận hàng",
        paragraphs: ["Kiểm tra người nhận, tình trạng kiện, niêm phong và đối chiếu sản phẩm, số lượng theo đơn. Bạn có thể yêu cầu đồng kiểm khi dịch vụ hỗ trợ. Nếu chưa thể kiểm tra lúc giao, bạn vẫn được phản ánh sau khi mở kiện.", "Nếu kiện rách, ướt, móp nặng, có dấu hiệu mở trước hoặc giao sai, hãy ghi nhận hiện trạng, liên hệ Cohamy và có thể từ chối phần hàng bất thường. Kiểm tra thực phẩm không yêu cầu mở túi hoặc nếm thử.", "Ảnh, video và biên bản giúp đối chiếu; thiếu video mở kiện không tự động làm mất quyền phản ánh hoặc giải quyết theo luật."],
      },
      {
        id: "doi-tra",
        title: "5. Hàng được xem xét đổi, trả hoặc giao bù",
        items: ["Giao sai sản phẩm, sai quy cách hoặc thiếu số lượng so với đơn đã xác nhận.", "Bao bì sản phẩm bị hở, rách, rò rỉ hoặc hư hỏng trong quá trình giao nhận do bên bán bố trí.", "Hàng hết hạn khi giao, có dấu hiệu không an toàn hoặc lỗi chất lượng thuộc trách nhiệm của nhà sản xuất, nhà phân phối hay người bán.", "Sản phẩm thuộc thông báo thu hồi hoặc trường hợp được đổi, trả theo thỏa thuận và pháp luật."],
        paragraphs: ["Thông báo ngay khi phát hiện để Cohamy kiểm tra lô hàng. Ngừng sử dụng nếu nghi ngờ mất an toàn; giữ bao bì, nhãn, mã lô và phần hàng còn lại nếu còn. Các quyền luật định về chất lượng, an toàn và hàng có khuyết tật vẫn được bảo đảm.", "Với thực phẩm giao đúng và không lỗi, đổi vì thay đổi sở thích cần Cohamy đồng ý trước. Hàng phải còn hạn, nguyên niêm phong và bảo quản theo nhãn. Cohamy có thể từ chối hàng đã mở hoặc bảo quản sai cho việc đổi tự nguyện; trách nhiệm với lỗi có sẵn vẫn được áp dụng."],
      },
      {
        id: "quy-trinh-hoan-tien",
        title: "6. Quy trình, chi phí và hoàn tiền",
        paragraphs: ["Cung cấp mã đơn hoặc thông tin mua hàng, sản phẩm, số lượng và mô tả vấn đề. Cohamy xác minh, thống nhất phương án đổi, giao bù hoặc hoàn tiền, rồi hướng dẫn thu hồi. Không tự gửi về văn phòng khi chưa có hướng dẫn.", "Cohamy chịu chi phí hợp lý để khắc phục lỗi thuộc trách nhiệm của mình. Nếu đổi tự nguyện hoặc lỗi do khách hàng, mức chênh lệch và phí giao phải được thống nhất trước.", "Khoản hoàn căn cứ số thực thu và phần hàng chấp nhận trả. Cohamy xác nhận số tiền, cách hoàn, thời hạn và thời gian ngân hàng xử lý nếu có. Bạn không phải trả phí để nhận hoàn. Các thời hạn, quyền bắt buộc theo luật được ưu tiên áp dụng."],
      },
      { id: "lien-he", title: "7. Liên hệ hỗ trợ", paragraphs: [contact, offices] },
    ],
    sources: [consumerLaw],
  },
  {
    slug: "thanh-toan",
    title: "Chính sách thanh toán",
    summary: "Phân biệt yêu cầu đặt hàng với thanh toán, cách xác nhận COD, chuyển khoản hoặc phương thức được Cohamy hỗ trợ cho từng đơn.",
    updatedAt,
    sections: [
      {
        id: "xac-nhan-don",
        title: "1. Xác nhận trước khi thanh toán",
        paragraphs: ["Bạn gửi sản phẩm, số lượng, thông tin giao nhận và phương thức thanh toán mong muốn trên website. Hệ thống cấp mã tiếp nhận để Cohamy kiểm tra và liên hệ. Thông báo nhận yêu cầu không có nghĩa là tiền đã được thu hoặc đơn đã được xác nhận giao.", "Cohamy và bạn xác nhận tiền hàng, giảm giá áp dụng, thuế, phí vận chuyển, khoản phí khác nếu có, tổng tiền và cách thanh toán trước khi thực hiện đơn. Không chuyển tiền chỉ dựa vào mã tiếp nhận nếu chưa có hướng dẫn thanh toán chính thức."],
      },
      {
        id: "phuong-thuc",
        title: "2. Phương thức có thể lựa chọn",
        items: ["Thanh toán khi nhận hàng (COD): áp dụng khi địa chỉ và dịch vụ giao nhận hỗ trợ, sau khi Cohamy xác nhận. Thanh toán đúng số tiền thu hộ đã thống nhất, nhận chứng từ giao nhận hoặc xác nhận cần thiết.", `Chuyển khoản ngân hàng: ${CONTACT.bankAccount.bankName}, số tài khoản ${CONTACT.bankAccount.accountNumberDisplay}, chủ tài khoản ${CONTACT.bankAccount.accountHolder}. Cohamy xác nhận số tiền và nội dung chuyển khoản cho đơn đã đối chiếu. Kiểm tra tên người nhận, ngân hàng, số tài khoản và số tiền trước khi chuyển. Ghi mã đơn và số điện thoại mua hàng trong nội dung chuyển khoản để hỗ trợ đối soát.`, "MoMo hoặc phương thức khác: lựa chọn trên biểu mẫu là đề nghị của khách hàng. Chỉ thanh toán khi Cohamy xác nhận phương thức khả dụng và cung cấp hướng dẫn chính thức; website không tự ghi nhận đã trả tiền khi bạn chọn phương thức này."],
      },
      {
        id: "doi-soat",
        title: "3. Đối soát và chứng từ",
        paragraphs: ["Cohamy đối chiếu giao dịch thực nhận để xác nhận khoản thanh toán. Ảnh chuyển khoản là tài liệu hỗ trợ; trạng thái thành công cần được kiểm tra với ngân hàng hoặc đơn vị thanh toán. Giữ mã giao dịch, biên lai và mã đơn đến khi hoàn tất nhận hàng.", "Nếu chuyển sai nội dung, sai số tiền, chuyển trùng hoặc cần kiểm tra khoản đã trả, liên hệ hotline/email kèm mã đơn và thông tin giao dịch đã che dữ liệu không liên quan. Cohamy xác minh và thống nhất cách bù trừ hoặc hoàn khoản thừa.", "Khi cần hóa đơn, cung cấp đúng thông tin người mua và thông tin thuế theo giao dịch. Hóa đơn được lập, cung cấp theo quy định pháp luật; phiếu tiếp nhận yêu cầu không thay thế hóa đơn hoặc chứng từ xác nhận thanh toán."],
      },
      {
        id: "an-toan",
        title: "4. An toàn thanh toán",
        paragraphs: ["Cohamy không yêu cầu mật khẩu, OTP, mã PIN hoặc mã bảo mật thẻ qua điện thoại, email, Zalo hay biểu mẫu website. Không cung cấp các mã này cho người tự nhận là nhân viên hỗ trợ. Nếu có thông báo đổi tài khoản nhận tiền, gọi lại hotline công bố trên website để kiểm tra.", "Không truy cập đường dẫn thanh toán lạ hoặc cài ứng dụng theo hướng dẫn không xác minh được. Khi nghi ngờ giao dịch giả mạo, liên hệ ngay ngân hàng hoặc đơn vị thanh toán và thông báo cho Cohamy để phối hợp."],
      },
      {
        id: "huy-hoan",
        title: "5. Hủy đơn và hoàn tiền",
        paragraphs: ["Việc hủy, đổi trả và hoàn tiền thực hiện theo chính sách vận chuyển, kiểm tra, đổi trả và thỏa thuận của từng đơn. Khi được hoàn, Cohamy xác nhận số tiền, thông tin nhận hoàn và thời hạn xử lý; không tự thu thêm phí chưa được thông báo. Bạn vẫn có đầy đủ quyền theo pháp luật đối với đơn không được thực hiện hoặc hàng hóa không phù hợp."],
      },
      { id: "lien-he", title: "6. Hỗ trợ thanh toán", paragraphs: [contact] },
    ],
    sources: [consumerLaw],
  },
  {
    slug: "gia",
    title: "Chính sách giá",
    summary: "Cách đọc giá niêm yết, giá sau giảm và các khoản cần xác nhận trước khi thanh toán.",
    updatedAt,
    sections: [
      {
        id: "gia-san-pham",
        title: "1. Giá sản phẩm",
        paragraphs: ["Giá trên website được thể hiện bằng đồng Việt Nam (VND/đ), theo đơn vị và quy cách của từng sản phẩm. Giá tiền hàng niêm yết làm cơ sở tính trong hệ thống chưa bao gồm thuế giá trị gia tăng (VAT). Giá thanh toán nổi bật trên website gồm VAT áp dụng cho sản phẩm; phần chi tiết cho biết tiền hàng chưa thuế và khoản thuế tương ứng. Hãy đối chiếu khối lượng túi, số lượng và tên hàng trước khi đặt. Sản phẩm chưa có giá được ghi Liên hệ; Cohamy báo giá trước khi xác nhận bán.", "Giá bán lẻ công khai và báo giá dành cho khách hàng, đại lý hoặc đơn số lượng lớn có thể áp dụng điều kiện khác nhau. Giá dành riêng chỉ có hiệu lực theo báo giá hoặc thỏa thuận được hai bên xác nhận."],
      },
      {
        id: "giam-gia",
        title: "2. Giá gạch ngang và giá giảm",
        paragraphs: ["Khi áp dụng giảm giá, giá gạch ngang là giá trước giảm đã tính VAT, phần trăm hiển thị là mức giảm tiền hàng và giá nổi bật là giá sau giảm đã tính VAT. Giá trước và sau giảm trên cùng dòng dùng cùng cách tính thuế để bạn so sánh. Mức giảm chỉ áp dụng cho sản phẩm, đối tượng và thời gian được công bố; không mặc định cộng dồn với chiết khấu đại lý hoặc ưu đãi khác.", "Ví dụ, tiền hàng niêm yết chưa VAT là 79.000 đ, giảm 30% còn 55.300 đ chưa VAT. Thuế được tính trên tiền hàng sau giảm theo mức áp dụng cho sản phẩm, rồi cộng vào giá thanh toán. Phí vận chuyển hoặc dịch vụ riêng chưa được tính trong phép giảm này, trừ khi chương trình ghi rõ.", "Cohamy công bố mức giảm và điều kiện áp dụng tại thời điểm mua. Việc đổi mức giảm cho các yêu cầu mới không tự thay đổi giá của đơn đã được hai bên xác nhận."],
      },
      {
        id: "thue-phi",
        title: "3. Thuế và chi phí giao hàng",
        paragraphs: ["Thuế suất được áp dụng theo từng sản phẩm và quy định tại thời điểm xác nhận. Giỏ hàng và yêu cầu đặt hàng thể hiện tổng đã tính VAT; chi tiết tiền hàng, mức giảm và tiền thuế giúp bạn đối chiếu. Cohamy không tự thêm khoản thuế hoặc phí chưa thông báo sau khi bạn đã chấp nhận tổng tiền.", "Tổng tiền trên giỏ hoặc yêu cầu đặt hàng chưa mặc định bao gồm phí vận chuyển. Cohamy báo phí giao theo địa chỉ và dịch vụ áp dụng trước khi bạn xác nhận thực hiện đơn. Các phí giao nhanh, đóng gói riêng hoặc dịch vụ khác chỉ thu khi đã được thông báo và bạn đồng ý.", "Cohamy không thu phí để bạn truy cập website hoặc gửi yêu cầu đặt hàng. Nếu có dịch vụ bổ sung có tính phí, tên dịch vụ, mức phí và điều kiện áp dụng phải được xác nhận riêng."],
      },
      {
        id: "thay-doi-sai-sot",
        title: "4. Thời điểm áp dụng và sai sót giá",
        paragraphs: ["Với yêu cầu chưa được xác nhận, Cohamy đối chiếu giá, hàng sẵn có và tổng chi phí rồi liên hệ để bạn quyết định. Giá và điều kiện của đơn đã được xác nhận được giữ theo thỏa thuận; thay đổi chỉ thực hiện khi có sự đồng ý của bạn hoặc căn cứ pháp luật.", "Nếu phát hiện giá hiển thị sai do lỗi kỹ thuật, Cohamy thông báo sai sót và phương án xử lý, không tự chuyển sang giá cao hơn rồi yêu cầu bạn thanh toán. Việc thay đổi hoặc hủy đơn đã xác nhận phải tuân theo thỏa thuận và quyền của người tiêu dùng; khoản thu cho phần đơn không thực hiện phải được hoàn lại theo quy định."],
      },
      { id: "lien-he", title: "5. Hỏi giá và đối chiếu đơn", paragraphs: [contact] },
    ],
    sources: [ecommerceLaw, consumerLaw],
  },
  {
    slug: "tiep-nhan-giai-quyet-khieu-nai",
    title: "Phương thức tiếp nhận và giải quyết yêu cầu phản ánh khiếu nại",
    summary: "Kênh gửi phản ánh, thông tin cần cung cấp và quy trình Cohamy đối chiếu, trả lời, giải quyết yêu cầu của khách hàng.",
    updatedAt,
    sections: [
      {
        id: "kenh-tiep-nhan",
        title: "1. Kênh tiếp nhận",
        paragraphs: [`${company} tiếp nhận phản ánh về đơn hàng, giao nhận, chất lượng, thanh toán hoặc dữ liệu cá nhân qua các kênh sau.`, contact, offices],
      },
      {
        id: "thong-tin",
        title: "2. Thông tin giúp đối chiếu",
        items: ["Họ tên và một kênh liên hệ để nhận phản hồi.", "Mã đơn hoặc thông tin nhận diện lần mua: số điện thoại, ngày mua, tên sản phẩm và số lượng nếu có.", "Nội dung sự việc, thời điểm phát hiện và cách bạn mong muốn được giải quyết.", "Ảnh, video, chứng từ thanh toán hoặc giao nhận nếu bạn có. Che số thẻ, số dư và thông tin cá nhân không liên quan."],
        paragraphs: ["Cohamy tiếp nhận cả khi bạn chưa có đủ tài liệu và hướng dẫn bổ sung phần cần thiết để xác minh. Không bắt buộc video mở kiện làm điều kiện duy nhất. Nếu có dấu hiệu thực phẩm không an toàn, hãy dừng sử dụng và thông báo sớm, giữ phần hàng còn lại, bao bì hoặc mã lô nếu còn."],
      },
      {
        id: "quy-trinh",
        title: "3. Trình tự giải quyết",
        items: ["Tiếp nhận: ghi nhận nội dung và thông báo việc tiếp nhận trong thời hạn 03 ngày làm việc kể từ khi nhận phản ánh, yêu cầu, khiếu nại của người tiêu dùng.", "Xác minh: đối chiếu đơn, giá đã xác nhận, thanh toán, giao nhận và tình trạng hàng; phối hợp với các bộ phận hoặc đơn vị liên quan. Nếu cần thêm thông tin, Cohamy nêu rõ nội dung cần bổ sung.", "Đề xuất: thông báo kết quả kiểm tra và phương án như giải thích, sửa thông tin, giao bù, đổi, nhận lại hàng hoặc hoàn tiền theo trách nhiệm và chính sách áp dụng.", "Thực hiện: hai bên xác nhận cách xử lý, số tiền hoặc hàng cần điều chỉnh, chi phí và thời hạn. Cohamy cập nhật nếu có trở ngại, không tự kéo dài vô thời hạn.", "Kết thúc: thông báo kết quả qua kênh liên hệ đã thống nhất và giữ hồ sơ theo yêu cầu giải quyết giao dịch, bảo vệ dữ liệu và quy định lưu trữ."],
      },
      {
        id: "thoi-han",
        title: "4. Thời hạn và yêu cầu thương lượng",
        paragraphs: ["Thời gian xử lý cụ thể phụ thuộc nội dung cần kiểm tra và phương án hai bên thống nhất; Cohamy thông báo thời hạn dự kiến khi phản hồi, đồng thời tuân thủ thời hạn bắt buộc của pháp luật.", "Nếu bạn yêu cầu thương lượng, Cohamy tiếp nhận và tiến hành thương lượng trong thời hạn 07 ngày làm việc kể từ khi nhận yêu cầu. Nếu từ chối, Cohamy trả lời bằng văn bản trong thời hạn này và nêu rõ lý do theo quy định. Mốc bắt đầu tiếp nhận không bị chuyển sang ngày bạn bổ sung đủ mọi tài liệu."],
      },
      {
        id: "quyen-giai-quyet",
        title: "5. Khi chưa thống nhất được kết quả",
        paragraphs: ["Bạn có thể yêu cầu Cohamy giải thích lại căn cứ xử lý, bổ sung chứng cứ hoặc đề nghị trao đổi với người phụ trách. Các bên có thể lựa chọn hòa giải, trọng tài khi có thỏa thuận hợp lệ, hoặc Tòa án và cơ quan có thẩm quyền theo pháp luật.", "Quy trình nội bộ không hạn chế quyền phản ánh, khiếu nại, khởi kiện hoặc nhờ cơ quan, tổ chức bảo vệ quyền lợi người tiêu dùng hỗ trợ. Điều khoản hoặc hướng dẫn của Cohamy không loại trừ trách nhiệm bắt buộc với hàng hóa, dữ liệu cá nhân hoặc thiệt hại thuộc phạm vi pháp luật quy định."],
      },
      {
        id: "phoi-hop-bao-mat",
        title: "6. Phối hợp và bảo mật",
        paragraphs: ["Khách hàng cung cấp thông tin trung thực và phối hợp trong phạm vi hợp lý. Cohamy chỉ chia sẻ tài liệu cần thiết cho người xử lý hoặc đơn vị liên quan và có trách nhiệm bảo vệ dữ liệu. Nếu chưa thể xác minh, Cohamy giải thích phần chưa rõ và cách bổ sung, thay vì mặc định bác bỏ yêu cầu."],
      },
    ],
    sources: [consumerLaw],
  },
  {
    slug: "dieu-kien-cung-cap-hang-hoa",
    title: "Các điều kiện hạn chế trong việc cung cấp hàng hóa",
    summary: "Điều kiện xác nhận đơn, giới hạn nguồn hàng, địa chỉ giao nhận và các trường hợp cần thỏa thuận trước.",
    updatedAt,
    sections: [
      {
        id: "yeu-cau-dat-hang",
        title: "1. Điều kiện tiếp nhận và xác nhận",
        paragraphs: ["Bạn có thể gửi yêu cầu trên website khi hệ thống hoạt động. Cohamy chỉ xác nhận thực hiện sau khi kiểm tra thông tin mua hàng, sản phẩm, giá, địa chỉ và phương thức thanh toán. Yêu cầu chưa xác nhận không tự giữ hàng, xuất kho hoặc ghi nhận thanh toán.", "Người đặt hàng cần cung cấp thông tin đúng và có thẩm quyền thực hiện giao dịch. Người chưa đủ điều kiện tự giao dịch theo luật cần sự tham gia hoặc đồng ý phù hợp của người đại diện. Với giao dịch cho tổ chức, người đặt chịu trách nhiệm về thẩm quyền và thông tin tổ chức đã cung cấp."],
      },
      {
        id: "nguon-hang",
        title: "2. Hàng sẵn có và số lượng",
        paragraphs: ["Sản phẩm, quy cách và số lượng được đáp ứng theo nguồn hàng thực tế đã xác nhận. Hàng hết sẽ được thông báo; Cohamy không tự thay sản phẩm, vị hoặc quy cách khác nếu chưa có sự đồng ý của bạn.", "Giới hạn mua của chương trình ưu đãi, yêu cầu đặt trước hoặc thời gian chuẩn bị đơn lớn được thông báo trước khi bạn xác nhận. Giỏ hàng không phải cam kết đã giữ đủ số lượng. Giá hoặc chiết khấu dành cho đại lý cần được xác nhận theo điều kiện thương mại riêng."],
      },
      {
        id: "khu-vuc-bao-quan",
        title: "3. Địa chỉ giao nhận và điều kiện bảo quản",
        paragraphs: ["Cohamy xác nhận khả năng giao đến từng địa chỉ trong nước. Hải đảo, vùng xa, khu vực hạn chế đi lại hoặc tuyến vận chuyển không đáp ứng điều kiện bảo quản có thể cần phương án khác hoặc chưa thể phục vụ. Giao ra nước ngoài cần thỏa thuận riêng về vận chuyển và quy định nhập khẩu.", "Sản phẩm socola và thực phẩm đóng gói cần được bảo quản theo hướng dẫn trên nhãn, tránh điều kiện làm ảnh hưởng chất lượng. Nếu không bảo đảm được tuyến giao phù hợp, Cohamy thông báo để hai bên lựa chọn phương án trước khi thực hiện."],
      },
      {
        id: "luu-y-su-dung",
        title: "4. Điều kiện sử dụng thực phẩm",
        paragraphs: ["Đọc thành phần, cảnh báo dị ứng, hạn sử dụng và hướng dẫn bảo quản trên từng sản phẩm. Không dùng nếu dị ứng với thành phần được ghi trên nhãn, bao bì mất kín hoặc sản phẩm có dấu hiệu bất thường. Với sản phẩm có hạt hoặc viên kẹo, cần tuân theo cảnh báo độ tuổi và phòng ngừa hóc trên nhãn.", "Ảnh trưng bày giúp nhận diện mẫu hàng; thông tin nhãn của lô giao thực tế cần được đối chiếu. Nếu có thay đổi ảnh hưởng đến lựa chọn hoặc không khớp thông tin đã xác nhận, hãy liên hệ Cohamy để kiểm tra trước khi sử dụng."],
      },
      {
        id: "tam-ngung",
        title: "5. Gián đoạn và trường hợp chưa thể thực hiện",
        paragraphs: ["Hệ thống, nguồn hàng hoặc giao nhận có thể gián đoạn do bảo trì, sự cố kỹ thuật, thời tiết, yêu cầu của cơ quan có thẩm quyền hoặc sự kiện khác. Cohamy thông báo ảnh hưởng đến đơn đã xác nhận và phối hợp lựa chọn thời gian mới hoặc cách xử lý phù hợp. Sự cố không tự loại trừ nghĩa vụ thông báo, hoàn tiền hoặc trách nhiệm theo luật.", "Cohamy có thể đề nghị làm rõ, chưa xác nhận hoặc từ chối yêu cầu có thông tin giao nhận không hợp lệ, không thể liên hệ, dấu hiệu gian lận có căn cứ, hết hàng hoặc không đáp ứng điều kiện cung cấp. Nếu phát hiện lỗi giá, Cohamy thông báo để bạn lựa chọn, không tự áp dụng giá cao hơn. Với đơn đã xác nhận, việc thay đổi hoặc hủy phải có căn cứ theo thỏa thuận và pháp luật.", "Nếu phần đơn không được thực hiện mà đã thu tiền, Cohamy đối chiếu và hoàn lại khoản tương ứng; thông báo rõ số tiền, phương thức và thời hạn. Không áp dụng giới hạn mới hồi tố để làm giảm quyền của đơn đã xác nhận."],
      },
      { id: "lien-he", title: "6. Kiểm tra điều kiện trước khi mua", paragraphs: [contact] },
    ],
    sources: [ecommerceLaw, consumerLaw],
  },
  {
    slug: "quyen-nghia-vu-cac-ben",
    title: "Quyền và nghĩa vụ 2 bên",
    summary: "Trách nhiệm của Cohamy và khách hàng từ lúc xác nhận yêu cầu đến thanh toán, giao nhận và giải quyết phát sinh.",
    updatedAt,
    sections: [
      {
        id: "pham-vi",
        title: "1. Phạm vi và xác nhận giao dịch",
        paragraphs: [`Quy định áp dụng giữa ${company} và khách hàng qua cohamy.vn. Thỏa thuận bổ sung cho đơn đại lý, bán buôn hoặc hàng đặt riêng phải tuân thủ pháp luật và quyền bắt buộc của người tiêu dùng.`, "Trước khi xác nhận, bạn được kiểm tra hàng, quy cách, số lượng, tiền hàng, thuế, phí giao, cách thanh toán và điều kiện liên quan. Truy cập website hoặc im lặng không tự tạo thành sự đồng ý với điều khoản mới hay xử lý dữ liệu cần sự đồng ý.", "Mã tiếp nhận thể hiện website đã nhận yêu cầu. Giao dịch thực hiện theo nội dung hai bên xác nhận sau khi Cohamy kiểm tra khả năng đáp ứng. Bạn có thể yêu cầu cung cấp lại thông tin đã thỏa thuận để lưu, đối chiếu."],
      },
      {
        id: "quyen-cohamy",
        title: "2. Quyền của Cohamy",
        items: ["Yêu cầu thông tin cần thiết, chính xác để xác nhận người mua, giao nhận và đối chiếu thanh toán.", "Nhận khoản thanh toán đúng giá và thời hạn đã thống nhất; đề nghị khách hàng phối hợp kiểm tra khi có phát sinh.", "Công bố, điều chỉnh sản phẩm, giá và chương trình cho giao dịch mới; giữ thỏa thuận với đơn đã xác nhận trừ khi có căn cứ thay đổi hợp lệ.", "Từ chối yêu cầu chưa xác nhận nếu không thể đáp ứng hoặc có căn cứ về hành vi vi phạm; thông báo rõ cách xử lý tiền đã nhận nếu có.", "Áp dụng biện pháp phù hợp để bảo vệ hệ thống, dữ liệu và quyền lợi hợp pháp khi có dấu hiệu gian lận, đồng thời tôn trọng quyền của khách hàng."],
      },
      {
        id: "nghia-vu-cohamy",
        title: "3. Nghĩa vụ của Cohamy",
        items: ["Cung cấp thông tin đúng về người bán, hàng hóa, quy cách, giá, điều kiện ưu đãi và tổng chi phí trước khi khách hàng chấp nhận.", "Giao đúng hàng, số lượng, chất lượng và điều kiện đã xác nhận; cung cấp hướng dẫn sử dụng, bảo quản, cảnh báo và chứng từ theo quy định.", "Thông báo khi việc thực hiện có thay đổi hoặc chậm trễ; không tự đổi sản phẩm hoặc tăng tổng tiền của đơn đã xác nhận.", "Tiếp nhận và giải quyết phản ánh, đổi trả, hoàn tiền, thu hồi hàng không an toàn hoặc nghĩa vụ khác thuộc trách nhiệm của mình.", "Bảo vệ dữ liệu cá nhân, giới hạn người được tiếp cận và xử lý yêu cầu về dữ liệu theo chính sách bảo mật và pháp luật.", "Thực hiện nghĩa vụ về hóa đơn, thuế và trách nhiệm với người tiêu dùng theo quy định; phối hợp với đơn vị vận chuyển khi Cohamy bố trí việc giao hàng."],
      },
      {
        id: "quyen-khach",
        title: "4. Quyền của khách hàng",
        items: ["Được cung cấp thông tin rõ ràng và được lựa chọn mua sau khi biết hàng hóa, giá và điều kiện giao dịch.", "Kiểm tra thông tin trước khi gửi, đề nghị sửa sai và nhận thông tin xác nhận theo giao dịch.", "Nhận hàng đúng thỏa thuận; phản ánh khi giao sai, thiếu, chậm hoặc có vấn đề chất lượng.", "Yêu cầu đổi, trả, hoàn tiền, bồi thường hoặc biện pháp khắc phục khác khi có căn cứ theo thỏa thuận và pháp luật.", "Yêu cầu bảo vệ và thực hiện quyền liên quan đến dữ liệu cá nhân; từ chối quảng cáo theo quy định.", "Khiếu nại, yêu cầu thương lượng, nhờ cơ quan hoặc tổ chức bảo vệ quyền lợi người tiêu dùng hỗ trợ, và sử dụng phương thức giải quyết tranh chấp hợp pháp."],
      },
      {
        id: "nghia-vu-khach",
        title: "5. Nghĩa vụ của khách hàng",
        items: ["Cung cấp thông tin trung thực, đúng thẩm quyền và kênh liên lạc có thể sử dụng; báo sớm nếu cần sửa thông tin.", "Đọc tên hàng, quy cách, thành phần, cảnh báo, giá và các điều kiện trước khi xác nhận; thanh toán theo thỏa thuận.", "Phối hợp nhận hàng, kiểm tra và phản ánh khi phát hiện bất thường; bảo quản, sử dụng theo hướng dẫn trên nhãn.", "Cung cấp thông tin cần thiết để xác minh phát sinh; không giả mạo giao dịch, chứng từ hoặc lợi dụng chính sách để trục lợi.", "Bảo vệ thông tin đăng nhập nếu có tài khoản; không truy cập trái phép, phá hoại hoặc sử dụng website cho hành vi vi phạm pháp luật."],
      },
      {
        id: "tranh-chap-cap-nhat",
        title: "6. Phối hợp, tranh chấp và hiệu lực cập nhật",
        paragraphs: ["Các bên ưu tiên trao đổi và thương lượng để xác định sự việc, trách nhiệm và cách khắc phục. Khi không đạt thỏa thuận, khách hàng được sử dụng cơ chế hòa giải, trọng tài nếu có thỏa thuận hợp lệ, Tòa án hoặc cơ quan có thẩm quyền theo pháp luật Việt Nam.", "Cập nhật công bố trên website áp dụng cho giao dịch mới theo thời điểm và điều kiện được thông báo. Không tự thay đổi quyền, nghĩa vụ của đơn đã xác nhận. Nếu một nội dung trái quy định bắt buộc, quy định pháp luật được áp dụng; các quyền khác của khách hàng vẫn được bảo đảm."],
      },
      { id: "lien-he", title: "7. Thông tin liên hệ", paragraphs: [company, contact, offices] },
    ],
    sources: [consumerLaw, ecommerceLaw],
  },
];

export const STORE_POLICY_SLUGS = STORE_POLICIES.map((policy) => policy.slug);

export function getStorePolicy(slug: string): StorePolicy | undefined {
  return STORE_POLICIES.find((policy) => policy.slug === slug);
}
