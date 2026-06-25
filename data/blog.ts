import type { BlogPost } from "@/lib/types";
import { buildBlogContent } from "@/lib/blog-content";

const viContent1 = `
<h1 id="huong-dan-chon-socola-hat">Hướng dẫn chọn socola hạt Cohamy phù hợp gu thưởng thức</h1>
<p>Socola hạt không chỉ là món ăn vặt — đó là trải nghiệm cảm giác giữa vị béo của hạt và vị đắng ngọt của cacao. Bài viết này giúp bạn chọn đúng sản phẩm Cohamy cho từng dịp.</p>

<h2 id="phan-loai-socola-hat">Phân loại socola hạt Cohamy</h2>
<p>Dòng socola hạt Cohamy chia thành ba nhóm chính: socola đen bọc hạt, socola sữa/trắng hương vị và socola hạt đặc sản Việt.</p>

<h3 id="socola-den">Socola đen 55% cacao</h3>
<p>Phù hợp người thích vị đậm, ít ngọt. <a href="/vi/san-pham/cohamy-socola-hanh-nhan">Cohamy Socola Hạnh Nhân</a> là lựa chọn bán chạy nhất với hạnh nhân California rang thủ công.</p>

<h3 id="socola-sua">Socola sữa dịu ngọt</h3>
<p>Dành cho gia đình và trẻ em. Thử <a href="/vi/san-pham/cohamy-socola-hanh-nhan-sua">Socola Hạnh Nhân Sữa</a> với Belcolade 33% cacao — vị ngọt cân bằng, dễ ăn.</p>

<h3 id="huong-vi-dac-san">Hương vị đặc sản</h3>
<p>Matcha Uji, dâu tươi, sầu riêng Việt Nam — những hương vị chỉ có tại Cohamy, ví dụ <a href="/vi/san-pham/cohamy-socola-hanh-nhan-sau-rieng">Socola Hạnh Nhân Sầu Riêng</a>.</p>

<h2 id="chon-theo-dip">Chọn theo dịp sử dụng</h2>
<ul>
<li><strong>Ăn vặt hàng ngày:</strong> gói 55g tiện lợi, dễ mang theo.</li>
<li><strong>Quà tặng:</strong> hũ thủy tinh 160g hoặc <a href="/vi/san-pham/cohamy-bo-qua-tang-hu-socola">Bộ Quà Tặng Hũ Socola</a>.</li>
<li><strong>Đãi khách doanh nghiệp:</strong> bộ quà 4 hũ với logo gold foil sang trọng.</li>
</ul>

<h2 id="bao-quan">Cách bảo quản socola hạt</h2>
<p>Giữ nhiệt độ dưới 25°C, tránh ánh nắng trực tiếp. Sau khi mở, đậy kín túi hoặc nắp hũ để giữ độ giòn của hạt.</p>
`;

const viContent2 = `
<h1 id="xoai-say-hoa-loc">Xoài sấy Hòa Lộc: Từ trái cây Việt đến snack cao cấp</h1>
<p>Xoài cát Hòa Lộc nổi tiếng với vị ngọt thanh và hương thơm đặc trưng. Jamy Green đã biến loại trái cây này thành sản phẩm snack healthy và quà tặng tinh tế.</p>

<h2 id="quy-trinh-say">Quy trình sấy lạnh giữ trọn dưỡng chất</h2>
<p>Khác với sấy nhiệt thông thường, quy trình sấy lạnh của Jamy giúp giữ nguyên màu vàng tự nhiên, độ dai vừa phải và hương vị ngọt thanh của xoài chín.</p>

<h3 id="nguyen-lieu-100">Nguyên liệu 100% xoài</h3>
<p><a href="/vi/san-pham/jamy-xoai-say">Jamy Xoài Sấy 150g</a> chỉ chứa xoài cát Hòa Lộc — không đường thêm, không chất bảo quản.</p>

<h2 id="ket-hop-socola">Kết hợp xoài sấy và socola</h2>
<p>Đối với người yêu chocolate, <a href="/vi/san-pham/jamy-socola-xoai-say">Jamy Socola Xoài Sấy 160g</a> mang đến sự hòa quyện giữa vị ngọt xoài và socola sữa Belcolade mịn màng trong hũ thủy tinh sang trọng.</p>

<h3 id="so-sanh-hai-dong">So sánh hai dòng sản phẩm</h3>
<ul>
<li><strong>Xoài sấy nguyên chất:</strong> healthy, ít calo, phù hợp ăn kiêng.</li>
<li><strong>Xoài sấy phủ socola:</strong> trải nghiệm cao cấp, lý tưởng làm quà.</li>
</ul>

<h2 id="goi-y-su-dung">Gợi ý sử dụng</h2>
<p>Thưởng thức trực tiếp, trộn salad trái cây, hoặc đựng trong hộp quà cùng <a href="/vi/san-pham/jamy-socola-macca">Jamy Socola Macca</a> để tạo bộ quà đa dạng hương vị.</p>
`;

const viContent3 = `
<h1 id="qua-tang-tet-cohamy">Gợi ý quà tặng Tết và lễ hội từ Cohamy</h1>
<p>Quà Tết không chỉ cần đẹp mắt mà còn phải mang giá trị thưởng thức thực sự. Bộ sưu tập Cohamy & Jamy đáp ứng cả hai tiêu chí đó.</p>

<h2 id="bo-qua-cao-cap">Bộ quà cao cấp 4 hũ socola</h2>
<p><a href="/vi/san-pham/cohamy-bo-qua-tang-hu-socola">Bộ Quà Tặng Cohamy – Bộ Sưu Tập Hũ Socola</a> gồm 4 hũ đa hương vị: hạnh nhân, hạt điều, macca và xoài sấy — đóng trong hộp gold foil sang trọng.</p>

<h3 id="tai-sao-chon-bo-qua">Tại sao chọn bộ quà hũ?</h3>
<ul>
<li>Thiết kế premium, phù hợp biếu sếp, đối tác.</li>
<li>Đa dạng hương vị — ai cũng tìm được món yêu thích.</li>
<li>Bao bì chống ẩm, bảo quản lâu trong mùa Tết.</li>
</ul>

<h2 id="qua-tang-theo-ngan-sach">Quà tặng theo ngân sách</h2>
<h3 id="tren-100k">Trên 100.000đ</h3>
<p><a href="/vi/san-pham/jamy-socola-macca">Jamy Socola Macca 160g</a> — macca Úc phủ socola trắng và socola sữa.</p>

<h3 id="duoi-100k">Dưới 100.000đ</h3>
<p>Gói socola hạt 55g như <a href="/vi/san-pham/cohamy-socola-hat-dieu">Socola Hạt Điều</a> hoặc <a href="/vi/san-pham/cohamy-socola-hanh-nhan-matcha">Socola Hạnh Nhân Matcha</a> — tinh tế mà không quá đắt.</p>

<h2 id="dat-hang-doanh-nghiep">Đặt hàng quà doanh nghiệp</h2>
<p>Cohamy hỗ trợ in logo, đặt số lượng lớn và giao hàng toàn quốc. Liên hệ hotline/Zalo 0981 956 111 hoặc email Cohamyvietnam@gmail.com để được tư vấn combo phù hợp.</p>
`;

const viContent4 = `
<h1 id="cach-an-socola-hat">Cẩm nang thưởng thức socola hạt đúng cách</h1>
<p>Để cảm nhận trọn vẹn hương vị socola hạt, bạn cần biết cách ăn, cách bảo quản và cách kết hợp với đồ uống.</p>

<h2 id="nhiet-do-thuong-thuc">Nhiệt độ thưởng thức lý tưởng</h2>
<p>Socola ngon nhất ở 18–22°C. Tránh để trong tủ lạnh vì hơi ẩm làm socola bị bệt và mất độ giòn của hạt.</p>

<h3 id="thu-tu-nham">Thứ tự nếm hương vị</h3>
<ol>
<li>Bắt đầu với socola sữa nhẹ nhàng: <a href="/vi/san-pham/cohamy-socola-hanh-nhan-sua">Socola Hạnh Nhân Sữa</a>.</li>
<li>Chuyển sang socola đen đậm: <a href="/vi/san-pham/cohamy-socola-hanh-nhan">Socola Hạnh Nhân</a>.</li>
<li>Kết thúc bằng hương vị đặc sản: matcha, dâu hoặc sầu riêng.</li>
</ol>

<h2 id="ket-hop-do-uong">Kết hợp đồ uống</h2>
<ul>
<li><strong>Socola đen:</strong> espresso, trà đen.</li>
<li><strong>Socola sữa:</strong> latte, trà sữa nhẹ.</li>
<li><strong>Socola trắng/matcha:</strong> trà xanh Nhật, nước ép trái cây.</li>
</ul>

<h2 id="dung-trong-nau-an">Dùng socola hạt trong nấu ăn</h2>
<p>Băm nhỏ <a href="/vi/san-pham/cohamy-socola-hanh-nhan-dau">Socola Hạnh Nhân Dâu</a> để rắc lên kem, yogurt hoặc bánh cheesecake — tạo điểm nhấn giòn và thơm.</p>
`;

const viContent5 = `
<h1 id="cau-chuyen-cohamy">Câu chuyện thương hiệu Cohamy: Từ xưởng nhỏ đến triển lãm quốc tế</h1>
<p>Cohamy ra đời từ niềm đam mê kết hợp hạt điều Việt Nam với chocolate Bỉ. Hành trình của chúng tôi là minh chứng cho sự kiên trì về chất lượng.</p>

<h2 id="khoi-nguon">Khởi nguồn tại Bình Dương</h2>
<p>Từ một xưởng sản xuất nhỏ, đội ngũ Cohamy không ngừng thử nghiệm công thức phủ socola để giữ trọn vị béo tự nhiên của hạt điều Bình Phước và hạnh nhân rang.</p>

<h3 id="cong-thuc-dac-quyen">Công thức độc quyền</h3>
<p>Mỗi sản phẩm trải qua ít nhất 12 bước kiểm định: từ chọn hạt, rang, phủ socola Belcolade đến đóng gói chống ẩm.</p>

<h2 id="mo-rong-dong-san-pham">Mở rộng dòng sản phẩm</h2>
<p>Bên cạnh dòng pouch 55g, Cohamy phát triển hũ thủy tinh 160g cùng thương hiệu Jamy Green — như <a href="/vi/san-pham/jamy-socola-xoai-say">Socola Xoài Sấy</a> và <a href="/vi/san-pham/jamy-socola-macca">Socola Macca</a>.</p>

<h2 id="tam-nhin-tuong-lai">Tầm nhìn tương lai</h2>
<p>Cohamy hướng tới trở thành thương hiệu socola hạt hàng đầu Việt Nam, vươn ra thị trường châu Á với hương vị đặc trưng: sầu riêng, matcha và trái cây sấy nhiệt đới.</p>
`;

const viContent6 = `
<h1 id="socola-sau-rieng">Socola sầu riêng: Hương vị Việt trên bản đồ chocolate thế giới</h1>
<p>Sầu riêng là trái cây đặc sản Việt Nam được yêu thích khắp châu Á. Cohamy đã đưa hương vị này vào dòng socola hạt cao cấp.</p>

<h2 id="su-ket-hop-doc-dao">Sự kết hợp độc đáo</h2>
<p><a href="/vi/san-pham/cohamy-socola-hanh-nhan-sau-rieng">Cohamy Socola Hạnh Nhân Sầu Riêng</a> kết hợp hạnh nhân rang giòn với lớp socola sầu riêng thơm béo — không quá nồng, không quá nhạt.</p>

<h3 id="nguyen-lieu-sau-rieng">Nguyên liệu sầu riêng</h3>
<p>Bột sầu riêng chiếm 5% công thức, được tuyển chọn từ vùng trồng uy tín, đảm bảo hương vị tự nhiên không dùng hương liệu nhân tạo.</p>

<h2 id="doi-tuong-phu-hop">Đối tượng phù hợp</h2>
<ul>
<li>Người yêu sầu riêng muốn trải nghiệm mới.</li>
<li>Quà tặng cho bạn bè nước ngoài — giới thiệu ẩm thực Việt.</li>
<li>Biếu người thân dịp lễ Tết, sinh nhật.</li>
</ul>

<h2 id="mon-khac-tu-cohamy">Món khác nên thử cùng</h2>
<p>Kết hợp với <a href="/vi/san-pham/cohamy-socola-hanh-nhan-dau">Socola Hạnh Nhân Dâu</a> và <a href="/vi/san-pham/jamy-xoai-say">Xoài Sấy Hòa Lộc</a> để có bộ quà đa hương vị nhiệt đới.</p>
`;

const viContent7 = `
<h1 id="hat-dieu-binh-phuoc">Hạt điều Bình Phước trong socola Cohamy</h1>
<p>Bình Phước được mệnh danh là thủ phủ hạt điều Việt Nam. Cohamy tận dụng nguồn nguyên liệu này để tạo nên <a href="/vi/san-pham/cohamy-socola-hat-dieu">Socola Hạt Điều</a> đậm đà và tự nhiên.</p>

<h2 id="tai-sao-hat-dieu-binh-phuoc">Tại sao hạt điều Bình Phước?</h2>
<p>Hạt điều vùng này có size đồng đều, vị béo bùi tự nhiên và độ giòn cao sau rang — lý tưởng để phủ socola đen 55% cacao.</p>

<h3 id="quy-trinh-rang">Quy trình rang thủ công</h3>
<p>Mỗi mẻ hạt điều được rang ở nhiệt độ kiểm soát, đảm bảo không bị đắng hay cháy trước khi đi vào dây chuyền phủ socola.</p>

<h2 id="so-sanh-hanh-nhan">So sánh với socola hạnh nhân</h2>
<ul>
<li><strong>Hạnh nhân:</strong> vị thanh, giòn, phù hợp socola đen.</li>
<li><strong>Hạt điều:</strong> vị béo đậm, mềm hơn, hài hòa với socola đen và socola sữa.</li>
</ul>

<h2 id="goi-y-qua-tang">Gợi ý quà tặng</h2>
<p>Đựng gói socola hạt điều cùng <a href="/vi/san-pham/cohamy-socola-hanh-nhan">Socola Hạnh Nhân</a> trong hộp quà — combo hai hương vị hạt phổ biến nhất Việt Nam.</p>
`;

const viContent8 = `
<h1 id="matcha-va-socola">Matcha Nhật Bản gặp socola trắng Cohamy</h1>
<p>Xu hướng matcha chocolate đang phát triển mạnh tại châu Á. Cohamy mang đến phiên bản tinh tế với bột matcha Uji Nhật Bản.</p>

<h2 id="socola-hanh-nhan-matcha">Socola Hạnh Nhân Matcha</h2>
<p><a href="/vi/san-pham/cohamy-socola-hanh-nhan-matcha">Cohamy Socola Hạnh Nhân Matcha 55g</a> sử dụng 3% bột matcha Uji trong lớp socola trắng — vị đắng nhẹ của trà xanh hòa cùng vị ngọt thanh của socola.</p>

<h3 id="diem-khac-biet">Điểm khác biệt so với matcha thông thường</h3>
<ul>
<li>Matcha Uji cao cấp, màu xanh tự nhiên.</li>
<li>Hạnh nhân rang giòn tạo contrast texture.</li>
<li>Không quá ngọt — phù hợp người trưởng thành.</li>
</ul>

<h2 id="cach-thuong-thuc">Cách thưởng thức matcha chocolate</h2>
<p>Ăn kèm trà xanh Nhật hoặc latte matcha. Tránh kết hợp đồ uống quá ngọt để không lấn át vị trà xanh.</p>

<h2 id="san-pham-tuong-tu">Sản phẩm tương tự nên thử</h2>
<p>Nếu thích socola trắng hương vị, hãy thử <a href="/vi/san-pham/cohamy-socola-hanh-nhan-dau">Socola Hạnh Nhân Dâu</a> hoặc <a href="/vi/san-pham/cohamy-socola-hanh-nhan-sua">Socola Hạnh Nhân Sữa</a>.</p>
`;

export const blogPosts: BlogPost[] = [
  {
    id: "blog-chon-socola-hat",
    slug: {
      vi: "huong-dan-chon-socola-hat-cohamy",
      en: "how-to-choose-cohamy-nut-chocolate",
      zh: "how-to-choose-cohamy-nut-chocolate",
      ko: "how-to-choose-cohamy-nut-chocolate",
      ja: "how-to-choose-cohamy-nut-chocolate",
    },
    title: {
      vi: "Hướng dẫn chọn socola hạt Cohamy phù hợp gu thưởng thức",
      en: "How to Choose the Right Cohamy Nut Chocolate",
      zh: "如何选择适合您的 Cohamy 坚果巧克力",
      ko: "취향에 맞는 코하미 견과 초콜릿 고르는 법",
      ja: "好みに合うCohamyナッツチョコレートの選び方",
    },
    excerpt: {
      vi: "Phân loại socola hạt Cohamy theo hương vị, dịp sử dụng và cách bảo quản để thưởng thức trọn vẹn.",
      en: "Classify Cohamy nut chocolates by flavor, occasion, and storage for the best tasting experience.",
      zh: "按风味、场合和保存方式分类 Cohamy 坚果巧克力，尽享美味。",
      ko: "맛, 용도, 보관법별로 코하미 견과 초콜릿을 분류해 완벽하게 즐기세요.",
      ja: "風味・用途・保存方法別にCohamyナッツチョコレートを分類し、味わいを最大限に。",
    },
    content: buildBlogContent("blog-chon-socola-hat", viContent1),
    coverImage: "/images/products/cohamy-almond-chocolate-55g.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-11-15",
    category: "chocolate",
    tags: ["socola", "hạt", "hướng dẫn", "chocolate"],
    featured: true,
    relatedProductIds: ["cohamy-almond-chocolate", "cohamy-almond-milk-chocolate", "cohamy-gift-jar-collection"],
    metaTitle: {
      vi: "Hướng dẫn chọn socola hạt Cohamy | Blog Cohamy",
      en: "How to Choose Cohamy Nut Chocolate | Cohamy Blog",
      zh: "如何选择 Cohamy 坚果巧克力 | Cohamy 博客",
      ko: "코하미 견과 초콜릿 고르는 법 | 코하미 블로그",
      ja: "Cohamyナッツチョコレートの選び方 | Cohamyブログ",
    },
    metaDescription: {
      vi: "Bí quyết chọn socola hạt Cohamy: socola đen, socola sữa, hương vị đặc sản và quà tặng phù hợp từng dịp.",
      en: "Tips for choosing Cohamy nut chocolate: dark, milk, specialty flavors and gifts for every occasion.",
      zh: "选择 Cohamy 坚果巧克力的秘诀：黑巧、牛奶巧、特色风味及场合礼品。",
      ko: "코하미 견과 초콜릿 선택 팁: 다크, 밀크, 특별 맛과 상황별 선물.",
      ja: "Cohamyナッツチョコレート選びのコツ：ダーク、ミルク、特別フレーバーとギフト。",
    },
  },
  {
    id: "blog-xoai-say-hoa-loc",
    slug: {
      vi: "xoai-say-hoa-loc-jamy",
      en: "jamy-hoa-loc-dried-mango",
      zh: "jamy-hoa-loc-dried-mango",
      ko: "jamy-hoa-loc-dried-mango",
      ja: "jamy-hoa-loc-dried-mango",
    },
    title: {
      vi: "Xoài sấy Hòa Lộc: Từ trái cây Việt đến snack cao cấp",
      en: "Hoa Loc Dried Mango: From Vietnamese Fruit to Premium Snack",
      zh: "和平芒果干：从越南水果到高端零食",
      ko: "호아록 건조 망고: 베트남 과일에서 프리미엄 스낵까지",
      ja: "ホアロックドライマンゴー：ベトナムの果物からプレミアムスナックへ",
    },
    excerpt: {
      vi: "Khám phá quy trình sấy lạnh xoài cát Hòa Lộc và dòng socola xoài sấy Jamy cao cấp.",
      en: "Discover cold-dried Hoa Loc mango and Jamy's premium dried mango chocolate line.",
      zh: "探索和平芒果冷干燥工艺及 Jamy 高端芒果干巧克力系列。",
      ko: "호아록 망고 냉풍 건조 공정과 자미 프리미엄 망고 초콜릿 라인을 알아보세요.",
      ja: "ホアロックマンゴーの冷風乾燥とJamyプレミアムマンゴーチョコレートを紹介。",
    },
    content: buildBlogContent("blog-xoai-say-hoa-loc", viContent2),
    coverImage: "/images/products/jamy-dried-mango-150g.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-10-28",
    category: "dried-fruit",
    tags: ["xoài sấy", "Hòa Lộc", "Jamy", "trái cây sấy"],
    featured: true,
    relatedProductIds: ["jamy-dried-mango", "jamy-mango-dried-chocolate"],
    metaTitle: {
      vi: "Xoài sấy Hòa Lộc Jamy | Blog Cohamy",
      en: "Jamy Hoa Loc Dried Mango | Cohamy Blog",
      zh: "Jamy 和平芒果干 | Cohamy 博客",
      ko: "자미 호아록 건조 망고 | 코하미 블로그",
      ja: "Jamyホアロックドライマンゴー | Cohamyブログ",
    },
    metaDescription: {
      vi: "Tìm hiểu xoài sấy Hòa Lộc 100% tự nhiên và socola xoài sấy Jamy trong hũ thủy tinh sang trọng.",
      en: "Learn about 100% natural Hoa Loc dried mango and Jamy mango chocolate in elegant glass jars.",
      zh: "了解100%天然和平芒果干及精美玻璃罐装 Jamy 芒果巧克力。",
      ko: "100% 천연 호아록 건조 망고와 우아한 유리병 자미 망고 초콜릿을 알아보세요.",
      ja: "100%天然ホアロックドライマンゴーとエレガントなガラス瓶のJamyマンゴーチョコレート。",
    },
  },
  {
    id: "blog-qua-tang-tet",
    slug: {
      vi: "goi-y-qua-tang-tet-cohamy",
      en: "cohamy-holiday-gift-ideas",
      zh: "cohamy-holiday-gift-ideas",
      ko: "cohamy-holiday-gift-ideas",
      ja: "cohamy-holiday-gift-ideas",
    },
    title: {
      vi: "Gợi ý quà tặng Tết và lễ hội từ Cohamy",
      en: "Cohamy Holiday & Festival Gift Ideas",
      zh: "Cohamy 节日礼品推荐",
      ko: "코하미 명절 및 축제 선물 아이디어",
      ja: "Cohamyの祝日・フェスティバルギフトアイデア",
    },
    excerpt: {
      vi: "Bộ quà 4 hũ socola, hũ macca cao cấp và gói socola hạt — gợi ý quà Tết cho mọi ngân sách.",
      en: "4-jar gift sets, premium macadamia jars and nut chocolate pouches for every budget.",
      zh: "四罐礼品套装、高端夏威夷果罐和坚果巧克力袋装——各价位春节礼品。",
      ko: "4병 기프트 세트, 프리미엄 마카다미아, 견과 초콜릿 파우치 — 모든 예산의 명절 선물.",
      ja: "4瓶ギフトセット、プレミアムマカダミア、ナッツチョコパウチ — あらゆる予算の祝日ギフト。",
    },
    content: buildBlogContent("blog-qua-tang-tet", viContent3),
    coverImage: "/images/products/cohamy-gift-jar-collection.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-12-01",
    category: "gift-ideas",
    tags: ["quà tặng", "Tết", "lễ hội", "doanh nghiệp"],
    featured: true,
    relatedProductIds: ["cohamy-gift-jar-collection", "jamy-macadamia-chocolate"],
    metaTitle: {
      vi: "Quà tặng Tết Cohamy | Blog Cohamy",
      en: "Cohamy Holiday Gifts | Cohamy Blog",
      zh: "Cohamy 节日礼品 | Cohamy 博客",
      ko: "코하미 명절 선물 | 코하미 블로그",
      ja: "Cohamy祝日ギフト | Cohamyブログ",
    },
    metaDescription: {
      vi: "Gợi ý quà Tết và lễ hội từ bộ quà 4 hũ Cohamy đến gói socola hạt tiện lợi.",
      en: "Holiday gift ideas from Cohamy 4-jar sets to convenient nut chocolate pouches.",
      zh: "从 Cohamy 四罐套装到便携坚果巧克力袋装的节日礼品推荐。",
      ko: "코하미 4병 세트부터 휴대용 견과 초콜릿까지 명절 선물 아이디어.",
      ja: "Cohamy 4瓶セットから携帯用ナッツチョコまで祝日ギフトアイデア。",
    },
  },
  {
    id: "blog-cam-nang-thuong-thuc",
    slug: {
      vi: "cam-nang-thuong-thuc-socola-hat",
      en: "nut-chocolate-tasting-guide",
      zh: "nut-chocolate-tasting-guide",
      ko: "nut-chocolate-tasting-guide",
      ja: "nut-chocolate-tasting-guide",
    },
    title: {
      vi: "Cẩm nang thưởng thức socola hạt đúng cách",
      en: "The Complete Guide to Enjoying Nut Chocolate",
      zh: "坚果巧克力品鉴完全指南",
      ko: "견과 초콜릿 올바른 즐기기 가이드",
      ja: "ナッツチョコレートの正しい楽しみ方ガイド",
    },
    excerpt: {
      vi: "Nhiệt độ lý tưởng, thứ tự nếm hương vị và cách kết hợp đồ uống với socola hạt.",
      en: "Ideal temperature, tasting order, and beverage pairings for nut chocolate.",
      zh: "理想温度、品鉴顺序及坚果巧克力饮品搭配。",
      ko: "이상적인 온도, 시식 순서, 견과 초콜릿과 음료 페어링.",
      ja: "理想温度、テイスティング順序、ナッツチョコとドリンクのペアリング。",
    },
    content: buildBlogContent("blog-cam-nang-thuong-thuc", viContent4),
    coverImage: "/images/products/cohamy-cashew-chocolate-55g.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-09-20",
    category: "food-guide",
    tags: ["cẩm nang", "thưởng thức", "food guide", "tips"],
    featured: false,
    relatedProductIds: ["cohamy-cashew-chocolate", "cohamy-almond-chocolate"],
    metaTitle: {
      vi: "Cẩm nang thưởng thức socola hạt | Blog Cohamy",
      en: "Nut Chocolate Tasting Guide | Cohamy Blog",
      zh: "坚果巧克力品鉴指南 | Cohamy 博客",
      ko: "견과 초콜릿 시식 가이드 | 코하미 블로그",
      ja: "ナッツチョコレートテイスティングガイド | Cohamyブログ",
    },
    metaDescription: {
      vi: "Hướng dẫn thưởng thức socola hạt: bảo quản, nhiệt độ, kết hợp đồ uống và dùng trong nấu ăn.",
      en: "Guide to enjoying nut chocolate: storage, temperature, drink pairings and cooking uses.",
      zh: "坚果巧克力享用指南：保存、温度、饮品搭配及烹饪用途。",
      ko: "견과 초콜릿 즐기기: 보관, 온도, 음료 페어링, 요리 활용.",
      ja: "ナッツチョコの楽しみ方：保存、温度、ドリンクペアリング、料理への活用。",
    },
  },
  {
    id: "blog-cau-chuyen-cohamy",
    slug: {
      vi: "cau-chuyen-thuong-hieu-cohamy",
      en: "cohamy-brand-story",
      zh: "cohamy-brand-story",
      ko: "cohamy-brand-story",
      ja: "cohamy-brand-story",
    },
    title: {
      vi: "Câu chuyện thương hiệu Cohamy: Từ xưởng nhỏ đến triển lãm quốc tế",
      en: "The Cohamy Brand Story: From Small Workshop to Global Exhibitions",
      zh: "Cohamy 品牌故事：从小作坊到国际展会",
      ko: "코하미 브랜드 스토리: 작은 공방에서 국제 전시회까지",
      ja: "Cohamyブランドストーリー：小さな工房から国際展示会へ",
    },
    excerpt: {
      vi: "Hành trình xây dựng thương hiệu socola hạt Việt Nam với công thức độc quyền và tiêu chuẩn quốc tế.",
      en: "Building a Vietnamese nut chocolate brand with exclusive recipes and international standards.",
      zh: "以独家配方和国际标准打造越南坚果巧克力品牌。",
      ko: "독점 레시피와 국제 기준으로 베트남 견과 초콜릿 브랜드를 구축한 여정.",
      ja: "独自レシピと国際基準でベトナムナッツチョコレートブランドを築いた軌跡。",
    },
    content: buildBlogContent("blog-cau-chuyen-cohamy", viContent5),
    coverImage: "/images/activities/team-factory.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-08-10",
    category: "brand-story",
    tags: ["thương hiệu", "câu chuyện", "Cohamy", "Jamy Green"],
    featured: true,
    relatedProductIds: ["cohamy-almond-chocolate", "jamy-mango-dried-chocolate"],
    metaTitle: {
      vi: "Câu chuyện thương hiệu Cohamy | Blog",
      en: "Cohamy Brand Story | Blog",
      zh: "Cohamy 品牌故事 | 博客",
      ko: "코하미 브랜드 스토리 | 블로그",
      ja: "Cohamyブランドストーリー | ブログ",
    },
    metaDescription: {
      vi: "Tìm hiểu hành trình Cohamy từ xưởng sản xuất nhỏ tại Bình Dương đến triển lãm thực phẩm quốc tế.",
      en: "Discover Cohamy's journey from a small Binh Duong factory to international food exhibitions.",
      zh: "了解 Cohamy 从平阳小工厂到国际食品展的历程。",
      ko: "빈즈엉의 작은 공장에서 국제 식품 전시회까지 코하미의 여정.",
      ja: "ビンズオンの小さな工場から国際食品展示会までのCohamyの歩み。",
    },
  },
  {
    id: "blog-socola-sau-rieng",
    slug: {
      vi: "socola-sau-rieng-huong-vi-viet",
      en: "durian-chocolate-vietnamese-flavor",
      zh: "durian-chocolate-vietnamese-flavor",
      ko: "durian-chocolate-vietnamese-flavor",
      ja: "durian-chocolate-vietnamese-flavor",
    },
    title: {
      vi: "Socola sầu riêng: Hương vị Việt trên bản đồ chocolate thế giới",
      en: "Durian Chocolate: A Vietnamese Flavor on the World Chocolate Map",
      zh: "榴莲巧克力：世界巧克力地图上的越南风味",
      ko: "두리안 초콜릿: 세계 초콜릿 지도上的 베트남 맛",
      ja: "ドリアンチョコレート：世界のチョコレート地図上のベトナムの味",
    },
    excerpt: {
      vi: "Khám phá socola hạnh nhân sầu riêng Cohamy — sự kết hợp độc đáo giữa đặc sản Việt và chocolate Bỉ.",
      en: "Explore Cohamy almond durian chocolate — a unique fusion of Vietnamese specialty and Belgian chocolate.",
      zh: "探索 Cohamy 榴莲杏仁巧克力——越南特产与比利时巧克力的独特融合。",
      ko: "코하미 아몬드 두리안 초콜릿 — 베트남 특산품과 벨기에 초콜릿의 독특한 조합.",
      ja: "Cohamyアーモンドドリアンチョコレート — ベトナム特産とベルギーチョコの独自融合。",
    },
    content: buildBlogContent("blog-socola-sau-rieng", viContent6),
    coverImage: "/images/products/cohamy-almond-durian-chocolate-55g.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-11-02",
    category: "chocolate",
    tags: ["sầu riêng", "đặc sản", "Việt Nam", "chocolate"],
    featured: false,
    relatedProductIds: ["cohamy-almond-durian-chocolate", "jamy-dried-mango"],
    metaTitle: {
      vi: "Socola sầu riêng Cohamy | Blog",
      en: "Cohamy Durian Chocolate | Blog",
      zh: "Cohamy 榴莲巧克力 | 博客",
      ko: "코하미 두리안 초콜릿 | 블로그",
      ja: "Cohamyドリアンチョコレート | ブログ",
    },
    metaDescription: {
      vi: "Socola hạnh nhân sầu riêng Cohamy — hương vị Việt độc đáo trên nền hạnh nhân rang giòn.",
      en: "Cohamy almond durian chocolate — unique Vietnamese flavor on crispy roasted almonds.",
      zh: "Cohamy 榴莲杏仁巧克力——香脆烤杏仁上的独特越南风味。",
      ko: "코하미 아몬드 두리안 초콜릿 — 바삭한 구운 아몬드 위의 독특한 베트남 맛.",
      ja: "Cohamyアーモンドドリアンチョコ — 香ばしいローストアーモンド上のユニークなベトナムの味。",
    },
  },
  {
    id: "blog-hat-dieu-binh-phuoc",
    slug: {
      vi: "hat-dieu-binh-phuoc-trong-socola-cohamy",
      en: "binh-phuoc-cashew-in-cohamy-chocolate",
      zh: "binh-phuoc-cashew-in-cohamy-chocolate",
      ko: "binh-phuoc-cashew-in-cohamy-chocolate",
      ja: "binh-phuoc-cashew-in-cohamy-chocolate",
    },
    title: {
      vi: "Hạt điều Bình Phước trong socola Cohamy",
      en: "Binh Phuoc Cashews in Cohamy Chocolate",
      zh: "平顺腰果与 Cohamy 巧克力",
      ko: "빈푹 캐슈넛과 코하미 초콜릿",
      ja: "ビンフォック産カシューとCohamyチョコレート",
    },
    excerpt: {
      vi: "Tại sao hạt điều Bình Phước là nguyên liệu lý tưởng cho dòng socola hạt điều Cohamy.",
      en: "Why Binh Phuoc cashews are the ideal ingredient for Cohamy cashew chocolate.",
      zh: "为什么平顺腰果是 Cohamy 腰果巧克力的理想原料。",
      ko: "빈푹 캐슈넛이 코하미 캐슈 초콜릿의 이상적인 원료인 이유.",
      ja: "ビンフォック産カシューがCohamyカシューチョコに最適な理由。",
    },
    content: buildBlogContent("blog-hat-dieu-binh-phuoc", viContent7),
    coverImage: "/images/products/cohamy-cashew-chocolate-55g.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-10-05",
    category: "food-guide",
    tags: ["hạt điều", "Bình Phước", "nguyên liệu", "food guide"],
    featured: false,
    relatedProductIds: ["cohamy-cashew-chocolate", "cohamy-almond-chocolate"],
    metaTitle: {
      vi: "Hạt điều Bình Phước & Socola Cohamy | Blog",
      en: "Binh Phuoc Cashew & Cohamy Chocolate | Blog",
      zh: "平顺腰果与 Cohamy 巧克力 | 博客",
      ko: "빈푹 캐슈넛과 코하미 초콜릿 | 블로그",
      ja: "ビンフォックカシューとCohamyチョコ | ブログ",
    },
    metaDescription: {
      vi: "Tìm hiểu hạt điều Bình Phước và quy trình rang thủ công trong Socola Hạt Điều Cohamy.",
      en: "Learn about Binh Phuoc cashews and hand-roasting in Cohamy Cashew Chocolate.",
      zh: "了解平顺腰果及 Cohamy 腰果巧克力中的手工烘烤工艺。",
      ko: "빈푹 캐슈넛과 코하미 캐슈 초콜릿의 손 로스팅 공정을 알아보세요.",
      ja: "ビンフォック産カシューとCohamyカシューチョコの手焙煎工程を紹介。",
    },
  },
  {
    id: "blog-matcha-socola",
    slug: {
      vi: "matcha-nhat-ban-va-socola-trang-cohamy",
      en: "japanese-matcha-white-chocolate-cohamy",
      zh: "japanese-matcha-white-chocolate-cohamy",
      ko: "japanese-matcha-white-chocolate-cohamy",
      ja: "japanese-matcha-white-chocolate-cohamy",
    },
    title: {
      vi: "Matcha Nhật Bản gặp socola trắng Cohamy",
      en: "Japanese Matcha Meets Cohamy White Chocolate",
      zh: "日本抹茶遇见 Cohamy 白巧克力",
      ko: "일본 말차와 코하미 화이트 초콜릿의 만남",
      ja: "日本抹茶とCohamyホワイトチョコレートの出会い",
    },
    excerpt: {
      vi: "Bột matcha Uji trong socola hạnh nhân matcha Cohamy — xu hướng chocolate châu Á.",
      en: "Uji matcha powder in Cohamy almond matcha chocolate — an Asian chocolate trend.",
      zh: "宇治抹茶粉融入 Cohamy 抹茶杏仁巧克力——亚洲巧克力趋势。",
      ko: "우지 말차 가루가 들어간 코하미 아몬드 말차 초콜릿 — 아시아 초콜릿 트렌드.",
      ja: "宇治抹茶パウダーを使ったCohamyアーモンド抹茶チョコ — アジアのチョコトレンド。",
    },
    content: buildBlogContent("blog-matcha-socola", viContent8),
    coverImage: "/images/products/cohamy-almond-matcha-chocolate-55g.jpg",
    author: "Cohamy Editorial",
    publishedAt: "2025-11-20",
    category: "chocolate",
    tags: ["matcha", "Uji", "socola trắng", "chocolate"],
    featured: false,
    relatedProductIds: ["cohamy-almond-matcha-chocolate", "cohamy-almond-strawberry-chocolate"],
    metaTitle: {
      vi: "Matcha & Socola Trắng Cohamy | Blog",
      en: "Matcha & Cohamy White Chocolate | Blog",
      zh: "抹茶与 Cohamy 白巧克力 | 博客",
      ko: "말차와 코하미 화이트 초콜릿 | 블로그",
      ja: "抹茶とCohamyホワイトチョコ | ブログ",
    },
    metaDescription: {
      vi: "Socola hạnh nhân matcha Cohamy với bột matcha Uji Nhật Bản — vị đắng nhẹ, ngọt thanh.",
      en: "Cohamy almond matcha chocolate with Japanese Uji matcha — subtle bitterness, gentle sweetness.",
      zh: "Cohamy 抹茶杏仁巧克力采用日本宇治抹茶——微苦清甜。",
      ko: "일본 우지 말차를 사용한 코하미 아몬드 말차 초콜릿 — 은은한 쓴맛과 달콤함.",
      ja: "日本宇治抹茶を使用したCohamyアーモンド抹茶チョコ — ほろ苦さとやさしい甘さ。",
    },
  },
];