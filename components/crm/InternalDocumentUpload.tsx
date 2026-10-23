'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INTERNAL_DOCUMENT_MAX_BYTES, internalDocumentAccept } from '@/lib/crm/internal-document-model';

const errors: Record<string, string> = {
  FILE_SIZE_INVALID: 'Tệp phải có dữ liệu và không vượt quá 20 MB.',
  FILE_TYPE_INVALID: 'Chỉ nhận PDF, Word, Excel, PowerPoint và ảnh JPG/PNG.',
  FILE_CONTENT_INVALID: 'Nội dung tệp không đúng định dạng hoặc đã bị hỏng.',
  INVALID_FIELDS: 'Kiểm tra lại tên tài liệu, ghi chú và tệp đính kèm.',
  UPLOAD_RATE_LIMITED: 'Bạn đã tải 30 tài liệu trong giờ vừa qua. Vui lòng thử lại sau.',
  FORBIDDEN: 'Tài khoản này không được tải tài liệu lên.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  IDEMPOTENCY_CONFLICT: 'Nội dung lần tải trước đã thay đổi. Chọn lại tệp và thử lại.',
};
export function InternalDocumentUpload() {
  const router = useRouter();
  const uploading = useRef(false), uploadKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  return <form className="work-form internal-document-upload" onChange={() => { if (!uploading.current) uploadKey.current = null; }} onSubmit={async event => {
    event.preventDefault(); if (uploading.current) return;
    const form = event.currentTarget, data = new FormData(form), file = data.get('file');
    setError(''); setSuccess('');
    if (!(file instanceof File) || !file.size || file.size > INTERNAL_DOCUMENT_MAX_BYTES) { setError(errors.FILE_SIZE_INVALID); return; }
    uploadKey.current ??= crypto.randomUUID(); data.set('uploadKey', uploadKey.current);
    uploading.current = true; setPending(true);
    try {
      const response = await fetch('/api/crm/internal-documents', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw Error(errors[result.error] ?? 'Chưa lưu được tài liệu. Vui lòng thử lại.');
      uploadKey.current = null; form.reset(); setSuccess('Đã đăng tài liệu. Kế toán và thủ kho có thể xem và tải xuống.'); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Kết nối bị gián đoạn. Vui lòng thử lại.'); }
    finally { uploading.current = false; setPending(false); }
  }}>
    <div className="work-fields">
      <label>Tên tài liệu<input name="title" required maxLength={200} disabled={pending}/></label>
      <label>Tệp tài liệu<input name="file" type="file" required accept={internalDocumentAccept} disabled={pending} aria-describedby="internal-document-file-help"/></label>
      <label className="internal-document-description">Ghi chú<textarea name="description" maxLength={2000} rows={3} disabled={pending}/></label>
    </div>
    <p id="internal-document-file-help">Tối đa 20 MB mỗi tệp. Nhận PDF, Word, Excel, PowerPoint, JPG và PNG.</p>
    <button className="button button--primary" disabled={pending}>{pending ? 'Đang tải lên…' : 'Đăng tài liệu'}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
  </form>;
}
