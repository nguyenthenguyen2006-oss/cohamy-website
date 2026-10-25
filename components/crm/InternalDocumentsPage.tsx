import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, CrmError } from '@/lib/crm/permissions';
import { internalDocumentMetadata, listInternalDocuments } from '@/lib/crm/internal-documents';
import { canPreviewInternalDocument } from '@/lib/crm/internal-document-model';
import type { Principal } from '@/lib/crm/types';
import { InternalDocumentUpload } from './InternalDocumentUpload';
import './internal-documents.css';

const root = '/crm/internal-documents';
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
const size = (value: number) => value >= 1024 * 1024 ? (value / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.ceil(value / 1024)) + ' KB';

export async function InternalDocumentsPage({ user, id, query }: { user: Principal; id?: string; query: Record<string, string | string[] | undefined> }) {
  const read = can(user, 'internal-documents.read'), manage = can(user, 'internal-documents.manage');
  if (!can(user, 'internal-documents.access')) notFound();
  if (id) {
    const file = await internalDocumentMetadata(user, id).catch(error => {
      if (error instanceof CrmError && error.status === 404) notFound();
      throw error;
    });
    const download = '/api/crm/internal-documents/' + file.id;
    return <div className="internal-documents-page">
      <Link className="work-back" href={root}>← Tài liệu nội bộ</Link>
      <header className="portal-page-header"><div><h1>{file.title}</h1><p>{file.description || 'Tài liệu do admin đăng cho kế toán và thủ kho.'}</p></div></header>
      <section className="work-section">
        <dl className="crm-readonly"><dt>Tệp</dt><dd>{file.filename}</dd><dt>Dung lượng</dt><dd>{size(file.size)}</dd><dt>Người đăng</dt><dd>{file.uploaded_by_name}</dd><dt>Ngày đăng</dt><dd>{date(file.created_at)}</dd></dl>
        {read ? <>
          <div className="upgrade-actions"><a className="button button--primary" href={download}>Tải xuống</a>{canPreviewInternalDocument(file.mime) && <a className="button button--secondary" href={download + '?inline=1'} target="_blank" rel="noopener noreferrer">Mở trong tab mới</a>}</div>
          {canPreviewInternalDocument(file.mime) ? <iframe className="internal-document-preview" src={download + '?inline=1'} title={'Xem tài liệu: ' + file.title}/> : <p className="work-help">Tải tệp về để mở bằng Word, Excel hoặc PowerPoint trên thiết bị của bạn.</p>}
        </> : <p className="work-help">Chỉ tài khoản kế toán và thủ kho được mở tệp và tải xuống.</p>}
      </section>
    </div>;
  }
  const q = typeof query.q === 'string' ? query.q : '', page = typeof query.page === 'string' ? query.page : undefined;
  const data = await listInternalDocuments(user, { q, page });
  return <div className="internal-documents-page">
    <header className="portal-page-header"><div><h1>Tài liệu nội bộ</h1><p>{manage ? 'Admin đăng và kiểm tra tài liệu; kế toán và thủ kho được mở tệp và tải xuống.' : 'Tài liệu do admin đăng dành cho kế toán và thủ kho.'}</p></div></header>
    {manage && <section className="work-section"><h2>Đăng tài liệu mới</h2><InternalDocumentUpload/></section>}
    <section className="work-section">
      <form className="table-toolbar" method="get"><label>Tìm tài liệu<input name="q" defaultValue={q} maxLength={120} placeholder="Tên tài liệu hoặc tên tệp"/></label><button className="button button--secondary">Tìm kiếm</button>{q && <Link href={root} className="button button--secondary">Bỏ lọc</Link>}</form>
      <p className="work-help">{data.total.toLocaleString('vi-VN')} tài liệu</p>
      {data.items.length ? <div className="crm-table-wrap" role="region" tabIndex={0} aria-label="Danh sách tài liệu nội bộ"><table className="data-table internal-documents-table"><caption className="sr-only">Danh sách tài liệu nội bộ</caption><thead><tr><th scope="col">Tài liệu</th><th scope="col">Tệp</th><th scope="col">Dung lượng</th><th scope="col">Người đăng</th><th scope="col">Ngày đăng</th>{read && <th scope="col">Thao tác</th>}</tr></thead><tbody>{data.items.map(file => <tr key={file.id}><td><Link href={root + '/' + file.id}>{file.title}</Link>{file.description && <p className="work-help">{file.description}</p>}</td><td>{file.filename}</td><td>{size(file.size)}</td><td>{file.uploaded_by_name}</td><td>{date(file.created_at)}</td>{read && <td><div className="internal-document-actions"><Link href={root + '/' + file.id}>Xem</Link><a href={'/api/crm/internal-documents/' + file.id}>Tải xuống</a></div></td>}</tr>)}</tbody></table></div> : <p className="crm-status-note" role="status">{q ? 'Không có tài liệu phù hợp với từ khóa.' : 'Chưa có tài liệu nội bộ.'}</p>}
      {data.total > data.pageSize && <nav className="upgrade-actions" aria-label="Phân trang tài liệu">{data.page > 1 && <Link href={'?' + new URLSearchParams({ q, page: String(data.page - 1) })}>Trang trước</Link>}<span>Trang {data.page} / {Math.ceil(data.total / data.pageSize)}</span>{data.page * data.pageSize < data.total && <Link href={'?' + new URLSearchParams({ q, page: String(data.page + 1) })}>Trang sau</Link>}</nav>}
    </section>
  </div>;
}
