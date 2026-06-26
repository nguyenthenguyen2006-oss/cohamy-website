"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, MapPin, Phone } from "lucide-react";
import { CONTACT, getAddresses, getCompanyName } from "@/lib/contact";
import type { Locale } from "@/lib/types";

const SUBJECT_KEYS = ["general", "order", "gift", "product"] as const;

type FormState = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  subject: "general",
  message: "",
};

export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale() as Locale;
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const subjectOptions = SUBJECT_KEYS.map((key) => ({
    value: key,
    label: t(`subjects.${key}`),
  }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setErrorCode(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          subject: subjectOptions.find((item) => item.value === form.subject)?.label ?? form.subject,
          message: form.message,
          locale,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorCode(data?.error ?? "SEND_FAILED");
        setStatus("error");
        return;
      }

      setStatus("success");
      setForm(initialForm);
    } catch {
      setErrorCode("SEND_FAILED");
      setStatus("error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12">
      <div>
        <h1 className="font-serif text-5xl tracking-tight mb-2">{t("title")}</h1>
        <p className="text-[#4A2418]/70 mb-2">{t("subtitle")}</p>
        <p className="text-sm font-medium text-[#4A2418] mb-10">{getCompanyName(locale)}</p>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Phone className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.phone")}</div>
              <a
                href={CONTACT.phoneTel}
                className="text-[#4A2418]/70 hover:text-[#D9A441] transition"
              >
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Phone className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.zalo")}</div>
              <a
                href={CONTACT.zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4A2418]/70 hover:text-[#D9A441] transition"
              >
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Mail className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div>
              <div className="font-medium">{t("info.email")}</div>
              <a
                href={CONTACT.emailMailto}
                className="text-[#4A2418]/70 hover:text-[#D9A441] transition break-all"
              >
                {CONTACT.email}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <MapPin className="text-[#D9A441] mt-1 shrink-0" size={20} />
            <div className="space-y-4">
              <div>
                <div className="font-medium">{t("info.addressHanoi")}</div>
                <p className="text-[#4A2418]/70 leading-relaxed">{getAddresses(locale).hanoi}</p>
                <a
                  href={CONTACT.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm text-[#D9A441] hover:underline"
                >
                  {t("info.openMapsHanoi")}
                </a>
              </div>
              <div>
                <div className="font-medium">{t("info.addressHcmc")}</div>
                <p className="text-[#4A2418]/70 leading-relaxed">{getAddresses(locale).hcmc}</p>
                <a
                  href={CONTACT.mapsLinkHcmc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm text-[#D9A441] hover:underline"
                >
                  {t("info.openMapsHcmc")}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-[#4A2418]/10 shadow-sm">
          <iframe
            title={t("info.mapTitle")}
            src={CONTACT.mapsEmbedUrl}
            className="h-56 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>

      <div>
        <h2 className="font-medium text-lg mb-6">{t("form.title")}</h2>
        {status === "success" ? (
          <div className="p-8 bg-[#FFF4D8] rounded-2xl text-center">{t("form.success")}</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              name="name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("form.name")}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            />
            <input
              required
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder={t("form.email")}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            />
            <input
              required
              name="phone"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder={t("form.phone")}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            />
            <select
              name="subject"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full h-12 px-4 border rounded-xl bg-white"
            >
              {subjectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <textarea
              required
              name="message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder={t("form.messagePlaceholder")}
              className="w-full p-4 border rounded-xl bg-white"
            />
            {status === "error" ? (
              <p className="text-sm text-red-700">
                {errorCode === "SHEETS_NOT_CONFIGURED" ? t("form.errorSheets") : t("form.error")}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-primary w-full h-14 rounded-2xl disabled:opacity-60"
            >
              {status === "sending" ? t("form.sending") : t("form.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}