import { apiError, apiUser, json, sameOrigin } from '@/lib/crm/http';
import { assertPermission, CrmError } from '@/lib/crm/permissions';
import { listInternalDocuments, uploadInternalDocument } from '@/lib/crm/internal-documents';
import { INTERNAL_DOCUMENT_MAX_BYTES } from '@/lib/crm/internal-document-model';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const user = await apiUser();
    const query = new URL(request.url).searchParams;
    return json(await listInternalDocuments(user, { q: query.get('q') ?? undefined, page: query.get('page') ?? undefined }));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await apiUser();
    assertPermission(user, 'internal-documents.manage');
    const type = request.headers.get('content-type') ?? '';
    if (!type.startsWith('multipart/form-data;')) throw new CrmError('MULTIPART_REQUIRED', 415);
    const maximum = INTERNAL_DOCUMENT_MAX_BYTES + 32768;
    if (Number(request.headers.get('content-length')) > maximum) throw new CrmError('FILE_SIZE_INVALID', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new CrmError('INVALID_FIELDS', 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maximum) { await reader.cancel(); throw new CrmError('FILE_SIZE_INVALID', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': type } }).formData(); }
    catch { throw new CrmError('INVALID_FIELDS', 400); }
    const keys = ['file', 'title', 'description', 'uploadKey'];
    if ([...form.keys()].some(key => !keys.includes(key)) || keys.some(key => form.getAll(key).length !== 1)) throw new CrmError('INVALID_FIELDS', 400);
    const file = form.get('file');
    if (!(file instanceof File)) throw new CrmError('INVALID_FIELDS', 400);
    const result = await uploadInternalDocument(user, { title: form.get('title'), description: form.get('description'), uploadKey: form.get('uploadKey'), filename: file.name, mime: file.type, content: Buffer.from(await file.arrayBuffer()) });
    return json(result, 201);
  } catch (error) { return apiError(error); }
}
