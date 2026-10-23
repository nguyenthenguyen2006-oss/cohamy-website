import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';
import { z } from 'zod';
import { audit, assertCurrentPrincipal } from './auth';
import { database } from './db';
import { assertPermission, CrmError } from './permissions';
import type { Principal } from './types';
import { INTERNAL_DOCUMENT_MAX_BYTES, internalDocumentTypes, type InternalDocumentSummary } from './internal-document-model';

const columns = 'd.id,d.title,d.description,d.filename,d.mime,d.size,d.created_at::text,u.display_name AS uploaded_by_name';
const inputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  filename: z.string().min(1).max(180).regex(/^[^/\\\x00-\x1f\x7f]+$/u).refine(value => !/\p{Cf}/u.test(value)),
  mime: z.string().max(180),
  content: z.instanceof(Buffer),
  uploadKey: z.uuid(),
}).strict();
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function uuid(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new CrmError('NOT_FOUND', 404);
  return parsed.data;
}

async function validateFile(filename: string, mime: string, content: Buffer): Promise<string> {
  if (!content.length || content.length > INTERNAL_DOCUMENT_MAX_BYTES) throw new CrmError('FILE_SIZE_INVALID', 413);
  const extension = path.extname(filename).toLowerCase();
  const expected = internalDocumentTypes[extension];
  if (!expected || (mime && mime !== 'application/octet-stream' && mime !== expected)) throw new CrmError('FILE_TYPE_INVALID', 400);
  let valid = false;
  if (extension === '.pdf') valid = content.subarray(0, 5).toString('ascii') === '%PDF-' && content.subarray(-1024).includes(Buffer.from('%%EOF'));
  else if (['.png', '.jpg', '.jpeg'].includes(extension)) {
    try {
      const image = await sharp(content, { limitInputPixels: 40_000_000 }).metadata();
      valid = image.format === (extension === '.png' ? 'png' : 'jpeg');
    } catch { /* Invalid image. */ }
  } else if (['.doc', '.xls', '.ppt'].includes(extension)) {
    valid = content.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  } else {
    // Bound the ZIP directory before parsing; Office files are never extracted or executed.
    let end = -1;
    for (let offset = content.length - 22; offset >= Math.max(0, content.length - 65557); offset--) {
      if (content.readUInt32LE(offset) === 0x06054b50 && offset + 22 + content.readUInt16LE(offset + 20) === content.length) { end = offset; break; }
    }
    if (end >= 0 && content.readUInt32LE(0) === 0x04034b50 && content.readUInt16LE(end + 4) === 0 && content.readUInt16LE(end + 6) === 0) {
      const entries = content.readUInt16LE(end + 10), directorySize = content.readUInt32LE(end + 12), directoryOffset = content.readUInt32LE(end + 16);
      if (entries > 0 && entries <= 2000 && directorySize <= 4 * 1024 * 1024 && directoryOffset + directorySize <= end) {
        try {
          const zip = await JSZip.loadAsync(content);
          const names = Object.keys(zip.files);
          const required = extension === '.docx' ? 'word/document.xml' : extension === '.xlsx' ? 'xl/workbook.xml' : 'ppt/presentation.xml';
          valid = names.length <= 2000 && !!zip.file('[Content_Types].xml') && !!zip.file(required) && !names.some(name => /vbaProject\.bin$/i.test(name));
        } catch { /* Invalid Office archive. */ }
      }
    }
  }
  if (!valid) throw new CrmError('FILE_CONTENT_INVALID', 400);
  return expected;
}

export async function listInternalDocuments(user: Principal, query: { q?: string; page?: string } = {}) {
  assertPermission(user, 'internal-documents.access');
  const q = (query.q ?? '').trim().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)));
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    const params = [q, '%' + q + '%'];
    const total = Number((await tx.query<{ total: string }>("SELECT count(*)::text AS total FROM cohamy_crm.internal_documents WHERE ($1='' OR title ILIKE $2 OR filename ILIKE $2)", params)).rows[0].total);
    const items = (await tx.query<InternalDocumentSummary>(`SELECT ${columns} FROM cohamy_crm.internal_documents d JOIN cohamy_crm.users u ON u.id=d.uploaded_by WHERE ($1='' OR d.title ILIKE $2 OR d.filename ILIKE $2) ORDER BY d.created_at DESC,d.id LIMIT 50 OFFSET $3`, [...params, (page - 1) * 50])).rows;
    return { items, total, page, pageSize: 50 };
  });
}

export async function internalDocumentMetadata(user: Principal, id: string) {
  assertPermission(user, 'internal-documents.access');
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    const file = (await tx.query<InternalDocumentSummary>(`SELECT ${columns} FROM cohamy_crm.internal_documents d JOIN cohamy_crm.users u ON u.id=d.uploaded_by WHERE d.id=$1`, [uuid(id)])).rows[0];
    if (!file) throw new CrmError('NOT_FOUND', 404);
    return file;
  });
}

export async function uploadInternalDocument(user: Principal, input: unknown) {
  assertPermission(user, 'internal-documents.manage');
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new CrmError('INVALID_FIELDS', 400);
  const data = parsed.data;
  const mime = await validateFile(data.filename, data.mime, data.content);
  const checksum = digest(data.content);
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    await tx.exec('LOCK TABLE cohamy_crm.internal_documents IN SHARE ROW EXCLUSIVE MODE');
    const previous = (await tx.query<{ id: string; title: string; description: string; filename: string; checksum: string }>('SELECT id,title,description,filename,checksum FROM cohamy_crm.internal_documents WHERE uploaded_by=$1 AND upload_key=$2', [user.id, data.uploadKey])).rows[0];
    if (previous) {
      if (previous.checksum !== checksum || previous.title !== data.title || previous.description !== data.description || previous.filename !== data.filename) throw new CrmError('IDEMPOTENCY_CONFLICT', 409);
      return { id: previous.id };
    }
    const recent = Number((await tx.query<{ total: string }>("SELECT count(*)::text AS total FROM cohamy_crm.internal_documents WHERE uploaded_by=$1 AND created_at>now()-interval '1 hour'", [user.id])).rows[0].total);
    if (recent >= 30) throw new CrmError('UPLOAD_RATE_LIMITED', 429);
    const id = randomUUID();
    await tx.query('INSERT INTO cohamy_crm.internal_documents(id,title,description,filename,mime,size,checksum,content,uploaded_by,upload_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, data.title, data.description, data.filename, mime, data.content.length, checksum, data.content, user.id, data.uploadKey]);
    await audit(tx, user.id, 'internal-document.uploaded', id, { title: data.title, filename: data.filename, size: data.content.length, checksum });
    return { id };
  });
}

export async function downloadInternalDocument(user: Principal, id: string) {
  // Admin manages the catalogue; only accountants and warehouse accounts receive file contents.
  assertPermission(user, 'internal-documents.read');
  return (await database()).transaction(async tx => {
    await assertCurrentPrincipal(tx, user);
    const file = (await tx.query<InternalDocumentSummary & { content: Uint8Array; checksum: string }>(`SELECT ${columns},d.content,d.checksum FROM cohamy_crm.internal_documents d JOIN cohamy_crm.users u ON u.id=d.uploaded_by WHERE d.id=$1`, [uuid(id)])).rows[0];
    if (!file) throw new CrmError('NOT_FOUND', 404);
    const content = Buffer.from(file.content);
    if (content.length !== file.size || digest(content) !== file.checksum) throw new CrmError('FILE_INTEGRITY_FAILED', 503);
    return { ...file, content };
  });
}
