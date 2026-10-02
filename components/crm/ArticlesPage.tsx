import Link from 'next/link';
import { can, CrmError } from '@/lib/crm/permissions';
import type { Principal } from '@/lib/crm/types';
import { listCrmArticles, getCrmArticle } from '@/lib/crm/articles';
import {getAllPublicPosts} from '@/lib/blog-repository';
import {buildBlogPostPath} from '@/lib/blog-seo';
import { BLOG_LOCALES, BLOG_CATEGORIES, BLOG_STATUSES, type BlogStatus, type BlogLocale, type BlogCategory } from '@/lib/blog-schema';
import { ActionButton, DataForm } from './UpgradeForms';

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <header className="portal-page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="crm-status-note" role="status">{children}</p>;
}

const statusLabels: Record<string, string> = {
  draft: 'Bản nháp (Chưa công khai)',
  published: 'Đã xuất bản (Công khai trên web)',
  scheduled: 'Đã lên lịch',
  archived: 'Đã lưu trữ',
};

const categoryLabels: Record<string, string> = {
  chocolate: 'Socola',
  'dried-fruit': 'Hoa quả sấy',
  'gift-ideas': 'Ý tưởng quà tặng',
  'food-guide': 'Cẩm nang ẩm thực',
  'brand-story': 'Câu chuyện thương hiệu',
};

export async function ArticlesPage({
  user,
  id,
  query,
}: {
  user: Principal;
  id?: string;
  query: Record<string, string>;
}) {
  if (!can(user, 'articles.read')) throw new CrmError('FORBIDDEN', 403);
  const canWrite = can(user, 'articles.write');

  if (id === 'new') {
    if (!canWrite) throw new CrmError('FORBIDDEN', 403);
    return (
      <>
        <Link className="work-back" href="/crm/articles">
          ← Danh sách bài viết
        </Link>
        <Heading
          title="Tạo bài viết website mới"
          description="Bài viết tạo với trạng thái nháp sẽ không xuất hiện trên website cho đến khi được xuất bản."
        />
        <section className="work-section">
          <DataForm
            url="/api/crm/articles/save"
            context={{ status: 'draft' }}
            fields={[
              { name: 'title', label: 'Tiêu đề bài viết', required: true },
              { name: 'slug', label: 'Đường dẫn (Slug)', required: true },
              {
                name: 'locale',
                label: 'Ngôn ngữ',
                type: 'select',
                options: BLOG_LOCALES.map(loc => ({ value: loc, label: loc.toUpperCase() })),
                value: 'vi',
              },
              {
                name: 'category',
                label: 'Chuyên mục',
                type: 'select',
                options: BLOG_CATEGORIES.map(cat => ({ value: cat, label: categoryLabels[cat] || cat })),
                value: 'brand-story',
              },
              { name: 'author', label: 'Tác giả', value: 'Cohamy' },
              { name: 'coverImage', label: 'URL ảnh đại diện', value: '' },
              { name: 'coverImageAlt', label: 'Mô tả ảnh đại diện (Alt text)', value: '' },
              { name: 'excerpt', label: 'Mô tả ngắn (Trích dẫn)', type: 'textarea' },
              { name: 'contentHtml', maxLength:180000, label: 'Nội dung (HTML / Văn bản)', type: 'textarea', required: true },
              { name: 'seoTitle', label: 'SEO Title (Tùy chọn)' },
              { name: 'seoDescription', label: 'SEO Description (Tùy chọn)', type: 'textarea' },
            ]}
            label="Lưu bản nháp"
          />
        </section>
      </>
    );
  }

  if (id) {
    const post = await getCrmArticle(user, id);
    const isPublic = (await getAllPublicPosts()).some(row=>row.id===post.id);

    return (
      <>
        <Link className="work-back" href="/crm/articles">
          ← Danh sách bài viết
        </Link>
        <Heading
          title={post.title}
          description={`${statusLabels[post.status] || post.status} · Ngôn ngữ: ${post.locale.toUpperCase()} · Chuyên mục: ${categoryLabels[post.category] || post.category}`}
        />
        <section className="work-section">
          <div className="crm-status-note">
            <strong>Trạng thái hiển thị: </strong>
            {isPublic ? (
              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
                Đang có bản công khai: <Link href={buildBlogPostPath(post)}>{buildBlogPostPath(post)}</Link>
              </span>
            ) : (
              <span style={{ color: '#d97706', fontWeight: 'bold' }}>
                BẢN NHÁP — Riêng tư nội bộ, hoàn toàn KHÔNG hiển thị trên website công khai.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
            {canWrite && post.status!=='published' && (
              <ActionButton
                url="/api/crm/articles/publish"
                data={{ id: post.id, expectedUpdatedAt:post.updated_at }}
                label="Xuất bản lên website"
                success="Bài viết đã được xuất bản và website đã revalidate."
              />
            )}
            {canWrite && isPublic && (
              <ActionButton
                url="/api/crm/articles/unpublish"
                data={{ id: post.id }}
                label="Hủy xuất bản (Chuyển về nháp)"
                success="Đã hủy xuất bản bài viết."
              />
            )}
            {canWrite && (
              <ActionButton
                url="/api/crm/articles/archive"
                data={{ id: post.id }}
                label="Lưu trữ bài viết"
                success="Đã chuyển bài viết vào kho lưu trữ."
              />
            )}
          </div>

          {canWrite ? (
            <DataForm
              url="/api/crm/articles/save"
              context={{ id: post.id, status:'draft', expectedUpdatedAt:post.updated_at,groupId:post.group_id,tags:post.tags,relatedProductIds:post.related_product_ids,featured:post.featured,canonicalUrl:post.canonical_url,robotsIndex:post.robots_index }}
              fields={[
                { name: 'title', label: 'Tiêu đề bài viết', required: true, value: post.title },
                { name: 'slug', label: 'Đường dẫn (Slug)', required: true, value: post.slug },
                {
                  name: 'locale',
                  label: 'Ngôn ngữ',
                  type: 'select',
                  options: BLOG_LOCALES.map(loc => ({ value: loc, label: loc.toUpperCase() })),
                  value: post.locale,
                },
                {
                  name: 'category',
                  label: 'Chuyên mục',
                  type: 'select',
                  options: BLOG_CATEGORIES.map(cat => ({ value: cat, label: categoryLabels[cat] || cat })),
                  value: post.category,
                },
                { name: 'author', label: 'Tác giả', value: post.author },
                { name: 'coverImage', label: 'URL ảnh đại diện', value: post.cover_image },
                { name: 'coverImageAlt', label: 'Mô tả ảnh đại diện', value: post.cover_image_alt },
                { name: 'excerpt', label: 'Mô tả ngắn', type: 'textarea', value: post.excerpt },
                { name: 'contentHtml', maxLength:180000, label: 'Nội dung (HTML / Văn bản)', type: 'textarea', required: true, value: post.content_html },
                { name: 'seoTitle', label: 'SEO Title', value: post.seo_title },
                { name: 'seoDescription', label: 'SEO Description', type: 'textarea', value: post.seo_description },
              ]}
              label="Lưu bản nháp mới"
            />
          ) : (
            <dl className="crm-readonly">
              <dt>Tiêu đề</dt>
              <dd>{post.title}</dd>
              <dt>Slug</dt>
              <dd>{post.slug}</dd>
              <dt>Trích dẫn</dt>
              <dd>{post.excerpt}</dd>
              <dt>Tác giả</dt>
              <dd>{post.author}</dd>
            </dl>
          )}
        </section>
      </>
    );
  }

  // List articles
  const page = Math.max(1, Number(query.page) || 1);
  const statusFilter = BLOG_STATUSES.includes(query.status as BlogStatus) ? query.status as BlogStatus : undefined;
  const localeFilter = BLOG_LOCALES.includes(query.locale as BlogLocale) ? query.locale as BlogLocale : undefined;
  const categoryFilter = BLOG_CATEGORIES.includes(query.category as BlogCategory) ? query.category as BlogCategory : undefined;
  const search = query.q || '';

  const collection = await listCrmArticles(user, {
    page,
    pageSize: 20,
    q: search,
    status: statusFilter,
    locale: localeFilter,
    category: categoryFilter,
  });

  return (
    <>
      <Heading
        title="Quản lý bài viết website"
        description="Biên tập tin tức, bài viết thương hiệu và cẩm nang. Phân biệt rõ bản nháp nội bộ và bài xuất bản công khai."
      />

      <form className="table-toolbar" method="get">
        <label>
          Từ khóa
          <input name="q" defaultValue={search} placeholder="Tìm theo tiêu đề, trích dẫn..." maxLength={120} />
        </label>
        <label>
          Trạng thái
          <select name="status" defaultValue={statusFilter ?? 'ALL'}>
            <option value="ALL">Tất cả trạng thái</option>
            {BLOG_STATUSES.map(s => (
              <option key={s} value={s}>
                {statusLabels[s] || s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ngôn ngữ
          <select name="locale" defaultValue={localeFilter ?? 'ALL'}>
            <option value="ALL">Tất cả ngôn ngữ</option>
            {BLOG_LOCALES.map(loc => (
              <option key={loc} value={loc}>
                {loc.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chuyên mục
          <select name="category" defaultValue={categoryFilter ?? 'ALL'}>
            <option value="ALL">Tất cả chuyên mục</option>
            {BLOG_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {categoryLabels[cat] || cat}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--primary">Lọc bài viết</button>
        {canWrite && (
          <Link className="button button--secondary" href="/crm/articles/new">
            + Viết bài mới
          </Link>
        )}
      </form>

      <section className="work-section">
        <h2>{collection.totalItems} bài viết trong danh sách</h2>
        {!collection.items.length ? (
          <Empty>Không có bài viết nào phù hợp với bộ lọc.</Empty>
        ) : (
          <ul className="work-task-list">
            {collection.items.map(post => {
              const isPub = post.status === 'published';
              return (
                <li key={post.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Link href={`/crm/articles/${post.id}`} style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                      {post.title}
                    </Link>
                    <p style={{ margin: '4px 0', color: '#64748b', fontSize: '0.875rem' }}>
                      Slug: <code>/{post.slug}</code> · {post.locale.toUpperCase()} ·{' '}
                      {categoryLabels[post.category] || post.category} · Tác giả: {post.author}
                    </p>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: isPub ? '#dcfce7' : '#fef3c7',
                        color: isPub ? '#15803d' : '#b45309',
                      }}
                    >
                      {statusLabels[post.status] || post.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link className="button button--secondary" href={`/crm/articles/${post.id}`}>
                      Chỉnh sửa
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="table-footer" style={{ marginTop: '16px' }}>
          <span>
            Trang {collection.page} / {collection.totalPages} · {collection.totalItems} bài viết
          </span>
          <nav aria-label="Phân trang">
            {collection.page > 1 && (
              <Link
                className="button button--secondary"
                href={`?${new URLSearchParams({ ...query, page: String(collection.page - 1) })}`}
              >
                Trang trước
              </Link>
            )}
            {collection.page < collection.totalPages && (
              <Link
                className="button button--secondary"
                href={`?${new URLSearchParams({ ...query, page: String(collection.page + 1) })}`}
              >
                Trang sau
              </Link>
            )}
          </nav>
        </footer>
      </section>
    </>
  );
}
