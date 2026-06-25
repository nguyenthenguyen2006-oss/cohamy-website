"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Phone } from "lucide-react";
import { Tilt3D } from "@/components/ui/Tilt3D";
import { MotionWrapper } from "@/components/MotionWrapper";
import { DecorativeOrbs } from "@/components/DecorativeOrbs";
import { SectionOrnament } from "@/components/SectionOrnament";
import { CONTACT } from "@/lib/contact";

export function ContactCTA() {
  const t = useTranslations("home.cta");

  return (
    <section className="relative overflow-hidden px-6 py-24 md:py-32">
      <DecorativeOrbs variant="gold" density="rich" />
      <MotionWrapper className="relative mx-auto max-w-5xl">
        <SectionOrnament variant="dark">
          <Tilt3D intensity={6} scale={1.01} glare={false}>
            <div className="card-shine pattern-chocolate relative overflow-hidden rounded-[2rem] border border-[#4A2418]/10 bg-gradient-to-br from-[#2A120C] via-[#4A2418] to-[#2A120C] px-8 py-16 text-center text-[#FAF6EF] shadow-[0_32px_80px_-28px_rgba(42,18,12,0.6)] md:px-16 md:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#D9A441]/20 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-14 -left-10 h-52 w-52 rounded-full bg-[#D9A441]/10 blur-3xl"
              />
              <h2 className="type-display-md relative text-[#FAF6EF]">{t("title")}</h2>
              <p className="type-body-lg relative mx-auto mt-5 max-w-2xl text-[#FAF6EF]/85">{t("subtitle")}</p>
              <div className="relative mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact"
                  className="btn-primary btn-3d inline-flex h-14 items-center rounded-full px-10 text-base md:h-16 md:px-12 md:text-lg"
                >
                  {t("contact")}
                </Link>
                <Link
                  href="/products"
                  className="btn-secondary btn-3d inline-flex h-14 items-center rounded-full border-[#FAF6EF]/30 px-10 text-base text-[#FAF6EF] hover:border-[#FAF6EF] hover:bg-[#FAF6EF]/10 md:h-16 md:px-12 md:text-lg"
                >
                  {t("button")}
                </Link>
              </div>
              <a
                href={CONTACT.phoneTel}
                className="relative mt-8 inline-flex items-center gap-2 text-base text-[#D9A441] transition hover:text-[#FAF6EF] md:text-lg"
              >
                <Phone size={18} />
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </Tilt3D>
        </SectionOrnament>
      </MotionWrapper>
    </section>
  );
}