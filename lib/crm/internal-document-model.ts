export const INTERNAL_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const internalDocumentTypes: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
export const internalDocumentAccept = Object.keys(internalDocumentTypes).join(',');
export function canPreviewInternalDocument(mime: string): boolean {
  return ['application/pdf', 'image/png', 'image/jpeg'].includes(mime);
}
export interface InternalDocumentSummary {
  id: string;
  title: string;
  description: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
  uploaded_by_name: string;
}
