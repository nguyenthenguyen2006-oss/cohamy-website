"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

const FAQ_KEYS = ["q1", "q2", "q3", "q4"] as const;

export function ProductFAQ() {
  const t = useTranslations("products.faq");
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mt-16">
      <h2 className="font-serif text-2xl mb-6">{t("title")}</h2>
      <div className="space-y-3">
        {FAQ_KEYS.map((key, index) => (
          <div key={key} className="border border-[#4A2418]/10 rounded-2xl bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(open === index ? null : index)}
              className="w-full flex items-center justify-between p-5 text-left font-medium"
            >
              {t(`${key}.question`)}
              <ChevronDown
                size={18}
                className={`transition ${open === index ? "rotate-180" : ""}`}
              />
            </button>
            {open === index && (
              <div className="px-5 pb-5 text-sm text-[#4A2418]/80">{t(`${key}.answer`)}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}