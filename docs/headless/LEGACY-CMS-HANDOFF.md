# CMS handoff

## Trạng thái

Phần source đã được triển khai và build thành công. Runtime local đã xác minh
đăng nhập admin, JWT cookie, editor, desktop/mobile layout, health endpoint và
error boundary khi thiếu Google Sheets.

Chưa deploy production, chưa ghi vào Spreadsheet thật và chưa seed 40 dòng vì
phiên làm việc không có SSH, Sheet ID hoặc service-account credential. Vì vậy
không tuyên bố production đã hoàn tất.

## File tạo mới

```text
app/admin/(dashboard)/error.tsx
app/admin/(dashboard)/layout.tsx
app/admin/(dashboard)/page.tsx
app/admin/(dashboard)/posts/page.tsx
app/admin/(dashboard)/posts/new/page.tsx
app/admin/(dashboard)/posts/[id]/page.tsx
app/admin/(dashboard)/posts/[id]/preview/page.tsx
app/admin/login/page.tsx
app/api/admin/login/route.ts
app/api/admin/logout/route.ts
app/api/admin/posts/route.ts
app/api/admin/posts/import/route.ts
app/api/admin/posts/[id]/route.ts
app/api/admin/posts/[id]/duplicate/route.ts
app/api/admin/uploads/route.ts
app/api/health/route.ts
components/admin/AdminSidebar.tsx
components/admin/ImageUploader.tsx
components/admin/ImportCsvDialog.tsx
components/admin/LoginForm.tsx
components/admin/PostEditor.tsx
components/admin/PostForm.tsx
components/admin/PostTable.tsx
components/admin/SeoPanel.tsx
deploy/nginx-blog-uploads.conf
docs/CMS-DEPLOY.md
docs/CMS-HANDOFF.md
docs/posts-import-template.csv
lib/admin-auth.ts
lib/admin-rate-limit.ts
lib/admin-session.ts
lib/blog-mutations.ts
lib/blog-repository.ts
lib/blog-sanitize.ts
lib/blog-schema.ts
lib/blog-toc.ts
lib/google-sheets-blog.ts
lib/upload.ts
proxy.ts
scripts/hash-admin-password.ts
scripts/init-blog-sheet.ts
scripts/register-server-only.cjs
scripts/seed-existing-blog-to-sheet.ts
scripts/verify-cms.ts
```

## File đã sửa

```text
.env.example
README.md
app/globals.css
app/layout.tsx
app/sitemap.ts
app/[locale]/layout.tsx
app/[locale]/page.tsx
app/[locale]/about/page.tsx
app/[locale]/blog/page.tsx
app/[locale]/blog/[slug]/page.tsx
components/ActivityGallery.tsx
components/BlogArticle.tsx
components/BlogCard.tsx
components/BlogDetailLayout.tsx
components/BlogList.tsx
components/BlogPageClient.tsx
components/BlogPreview.tsx
components/BrandLogo.tsx
components/CartView.tsx
components/ProductGallery.tsx
components/ProductGrid.tsx
ecosystem.config.js
lib/blog.ts
lib/google-sheets.ts
lib/seo.ts
messages/en.json
messages/ja.json
messages/ko.json
messages/vi.json
messages/zh.json
next.config.ts
package.json
package-lock.json
scripts/manual-deploy.sh
scripts/setup-github-deploy.sh
scripts/vps-first-setup.sh
```

`middleware.ts` đã được thay bằng `proxy.ts` theo convention Next.js 16.

## Package thêm cho CMS

Production:

```text
@tiptap/extension-image
@tiptap/extension-link
@tiptap/pm
@tiptap/react
@tiptap/starter-kit
bcryptjs
googleapis
jose
papaparse
postcss
sanitize-html
server-only
sharp
zod
```

Development:

```text
@types/papaparse
@types/sanitize-html
tsx
```

Next.js và `eslint-config-next` được nâng, khóa ở `16.2.12`. Dependency override
được dùng cho bản đã vá của `postcss`, `sharp` và `gaxios`.

## Kết quả kiểm thử local

```text
npm ci                 PASS
npm run test:cms       PASS
npm run lint           PASS, 0 warning
npx tsc --noEmit       PASS
npm run build          PASS, Next.js 16.2.12 / Turbopack
npm audit --omit=dev   PASS, 0 vulnerability
```

`test:cms` kiểm tra đúng 23 header, schema, lịch đăng, XSS sanitizer, heading,
JWT, login rate limit, ảnh WebP, từ chối SVG và file trên 8 MB, cấu hình Sheet
thiếu và proxy matcher.

Browser smoke test local:

- `/admin/login` render đúng và đăng nhập đúng credential test;
- session bảo vệ được `/admin`;
- `/admin/posts/new` render TipTap, SEO, upload, publish và sản phẩm liên quan;
- layout desktop và mobile 390 px hoạt động, menu mobile mở được;
- không còn cảnh báo TipTap extension trùng;
- `/api/health` trả `200`, báo Sheet chưa cấu hình và upload writable;
- dashboard thiếu credential hiển thị thông báo phục hồi, không lộ secret.

Full `npm audit` vẫn báo advisory ở dependency chỉ dùng khi phát triển
(`eslint`/`minimatch`). Production audit không có vulnerability. Không dùng
`npm audit fix --force` vì đề xuất hiện tại hạ sai `eslint-config-next` hoặc
nâng major ESLint chưa được Next.js config bảo đảm.

## Phần cần xác minh trên môi trường đích

1. Điền `.env.production`, chia sẻ Sheet cho service account.
2. Chạy `npm run sheet:init`.
3. Chạy `npm run sheet:seed-blog` và xác nhận 8 nhóm, 40 dòng.
4. Kiểm tra CRUD, publish/archive/schedule/duplicate/import trên Sheet thật.
5. Kiểm tra các URL cũ, metadata, sitemap và hreflang với dữ liệu đã seed.
6. Cấu hình quyền upload/Nginx, chạy smoke test HTTPS.
7. Backup và kiểm tra rollback theo `docs/CMS-DEPLOY.md`.
8. Thu hồi hoặc redeploy Apps Script URL cũ từng xuất hiện trong source.
