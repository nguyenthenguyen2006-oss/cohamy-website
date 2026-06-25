"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

const PHRASE_KEYS = ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5", "phrase6"] as const;

export function MarqueeStrip() {
  const t = useTranslations("home.marquee");
  const phrases = PHRASE_KEYS.map((key) => t(key));
  const track = [...phrases, ...phrases];

  return (
    <section className="relative overflow-hidden border-y border-[#4A2418]/10 bg-[#2A120C] py-5 md:py-6">
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,#2A120C,transparent_18%,transparent_82%,#2A120C)]" />
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-20" />
      <div className="marquee-track relative flex w-max items-center gap-12">
        {track.map((phrase, index) => (
          <span
            key={`${phrase}-${index}`}
            className="inline-flex shrink-0 items-center gap-4 text-base font-medium uppercase tracking-[0.2em] text-[#FAF6EF]/90 md:text-lg"
          >
            <Sparkles size={16} className="text-[#D9A441]" />
            {phrase}
          </span>
        ))}
      </div>
    </section>
  );
}