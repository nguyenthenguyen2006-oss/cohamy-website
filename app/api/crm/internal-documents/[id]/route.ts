import { apiError, apiUser } from '@/lib/crm/http';
import { downloadInternalDocument } from '@/lib/crm/internal-documents';
import { canPreviewInternalDocument } from '@/lib/crm/internal-document-model';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await apiUser(), { id } = await context.params;
    const file = await downloadInternalDocument(user, id);
    const inline = new URL(request.url).searchParams.get('inline') === '1' && canPreviewInternalDocument(file.mime);
    const filename = encodeURIComponent(file.filename).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
    return new Response(new Uint8Array(file.content), { headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${filename}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': inline
        ? "default-src 'none'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"
        : "default-src 'none'; frame-ancestors 'self'; sandbox",
    } });
  } catch (error) { return apiError(error); }
}
