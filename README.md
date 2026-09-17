# Cohamy Website + Google Sheets Blog CMS

Website Next.js 16 đa ngôn ngữ của Cohamy, kèm CMS nội bộ tại `/admin`.

## Chức năng CMS

- Google Sheet `Posts` là nguồn dữ liệu bài viết với đúng 23 cột.
- CRUD, nhân bản, lưu nháp, đặt lịch, xuất bản và lưu trữ bài viết.
- Soạn thảo TipTap; HTML được làm sạch ở server trước khi ghi.
- Upload JPEG/PNG/WebP tối đa 8 MB; Sharp xoay theo EXIF, thu nhỏ tối đa
  1920 px và xuất WebP.
- Import CSV có xem trước, kiểm tra từng dòng và bỏ qua dòng lỗi.
- Blog công khai 5 ngôn ngữ, tìm kiếm, lọc danh mục, phân trang, SEO,
  JSON-LD, hreflang và sitemap động.
- JWT cookie `HttpOnly`, bcrypt, giới hạn đăng nhập và kiểm tra same-origin.

## Chạy local

Yêu cầu Node.js 20 LTS trở lên.

```bash
npm ci
cp .env.example .env.local
npm run admin:hash -- "mat-khau-can-bam"
npm run test:cms
npm run lint
npx tsc --noEmit
npm run dev
```

Điền thông tin Google service account, Sheet ID, tài khoản admin và thư mục
upload trong `.env.local` trước khi kiểm thử luồng có dữ liệu thật.

Khởi tạo Sheet và nhập 8 bài cũ cho 5 ngôn ngữ:

```bash
npm run sheet:init
npm run sheet:seed-blog
```

Script seed dùng `group_id + locale` để upsert nên có thể chạy lại an toàn.
Kết quả mong đợi là 8 nhóm và 40 dòng.

## Kiểm tra production

```bash
npm ci
npm run test:cms
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

Hướng dẫn đầy đủ về Google Cloud, biến môi trường, Nginx, PM2, backup,
deploy, smoke test và rollback nằm tại [docs/CMS-DEPLOY.md](docs/CMS-DEPLOY.md).
Mẫu CSV nằm tại [docs/posts-import-template.csv](docs/posts-import-template.csv).
Danh sách file, package và bằng chứng kiểm thử nằm tại
[docs/CMS-HANDOFF.md](docs/CMS-HANDOFF.md).

Không commit `.env.local`, `.env.production`, JSON service account hoặc file
backup có dữ liệu thật.
