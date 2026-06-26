import { NextResponse } from "next/server";
import { appendContactToSheet } from "@/lib/google-sheets";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
      locale?: string;
      website?: string;
    };

    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    const subject = body.subject?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    const locale = body.locale?.trim() ?? "";

    if (!name || !email || !phone || !subject || !message) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: "MESSAGE_TOO_LONG" }, { status: 400 });
    }

    await appendContactToSheet({ name, email, phone, subject, message, locale });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "SHEETS_NOT_CONFIGURED") {
      return NextResponse.json({ error: "SHEETS_NOT_CONFIGURED" }, { status: 503 });
    }
    console.error("[contact]", error);
    return NextResponse.json({ error: "SEND_FAILED" }, { status: 500 });
  }
}