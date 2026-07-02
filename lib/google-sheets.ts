export type ContactSubmission = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  locale?: string;
};

const DEFAULT_SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbyJLPIwSK_3x5d2bPjCmuAf7wltaThcmPPgiesCljfr2oESXStW6ZAxQEAhWEPLEWJtQg/exec";

function getSheetsWebhookUrl(): string {
  return process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim() || DEFAULT_SHEETS_WEBHOOK_URL;
}

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(getSheetsWebhookUrl());
}

export async function appendContactToSheet(data: ContactSubmission): Promise<void> {
  const url = getSheetsWebhookUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      submittedAt: new Date().toISOString(),
    }),
    redirect: "follow",
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    if (!response.ok) {
      throw new Error("SHEETS_APPEND_FAILED");
    }
  }

  if (!response.ok || parsed?.error) {
    throw new Error(parsed?.error || "SHEETS_APPEND_FAILED");
  }
}