/**
 * Cohamy — Google Sheet nhận form liên hệ
 *
 * Cách dùng:
 * 1. Tạo Google Sheet mới (đăng nhập Cohamyvietnam@gmail.com)
 * 2. Extensions → Apps Script → dán toàn bộ file này
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL web app → dán vào GOOGLE_SHEETS_WEBHOOK_URL (.env.local / .env.production)
 */

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Thời gian",
      "Họ tên",
      "Email",
      "SĐT",
      "Chủ đề",
      "Nội dung",
      "Ngôn ngữ",
    ]);
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders_(sheet);

    const data = JSON.parse(e.postData.contents);
    const submittedAt = data.submittedAt
      ? new Date(data.submittedAt)
      : new Date();

    sheet.appendRow([
      submittedAt,
      data.name || "",
      data.email || "",
      data.phone || "",
      data.subject || "",
      data.message || "",
      data.locale || "",
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: String(err) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}