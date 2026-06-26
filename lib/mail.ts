import nodemailer from "nodemailer";
import { CONTACT } from "@/lib/contact";

export type ContactEmailPayload = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

function getSmtpConfig() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "").trim();

  if (!user || !pass) {
    return null;
  }

  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  };
}

export function isMailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export async function sendContactEmail(payload: ContactEmailPayload): Promise<void> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const to = process.env.CONTACT_TO_EMAIL?.trim() || CONTACT.email;
  const transporter = nodemailer.createTransport(smtp);

  const text = [
    "Tin nhắn mới từ form liên hệ Cohamy",
    "",
    `Họ và tên: ${payload.name}`,
    `Email: ${payload.email}`,
    `Số điện thoại: ${payload.phone}`,
    `Chủ đề: ${payload.subject}`,
    "",
    "Nội dung:",
    payload.message,
  ].join("\n");

  const html = `
    <h2>Tin nhắn mới từ form liên hệ Cohamy</h2>
    <p><strong>Họ và tên:</strong> ${escapeHtml(payload.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></p>
    <p><strong>Số điện thoại:</strong> ${escapeHtml(payload.phone)}</p>
    <p><strong>Chủ đề:</strong> ${escapeHtml(payload.subject)}</p>
    <p><strong>Nội dung:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(payload.message)}</p>
  `;

  await transporter.sendMail({
    from: `"Cohamy Website" <${smtp.auth.user}>`,
    to,
    replyTo: payload.email,
    subject: `[Cohamy] ${payload.subject} — ${payload.name}`,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}