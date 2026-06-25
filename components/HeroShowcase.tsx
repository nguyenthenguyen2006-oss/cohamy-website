"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/types";
import { getAssetById } from "@/lib/assets/manifest";
import { CTAButton } from "./CTAButton";

const heroImage =
  getAssetById("cohamy-almond-chocolate-55g")?.path ??
  "/images/products/cohamy-almond-chocolate-55g.jpg";

const floatProducts = [
  getAssetById("cohamy-cashew-chocolate-55g"),
  getAssetById("cohamy-almond-matcha-chocolate-55g"),
] as const;

export function HeroShowcase() {
  const t = useTranslations("home.hero");
  const locale = useLocale() as Locale;
  const heroAsset = getAssetById("cohamy-almond-chocolate-55g");
  const containerRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), {
    stiffness: 120,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 120,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="pattern-chocolate relative min-h-[100dvh] overflow-hidden bg-[#FAF6EF]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/4 h-[520px] w-[520px] rounded-full bg-[#D9A441]/12 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-[#4A2418]/6 blur-3xl"
      />
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-40" />

      {floatProducts.map((asset, i) =>
        asset ? (
          <motion.div
            key={asset.id}
            aria-hidden
            animate={{ y: [0, i % 2 === 0 ? -18 : 14, 0], rotate: [0, i % 2 === 0 ? 6 : -5, 0] }}
            transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
            className={`floating-chip pointer-events-none absolute hidden opacity-50 lg:block ${
              i === 0 ? "left-[6%] top-[28%]" : "right-[4%] bottom-[30%]"
            }`}
          >
            <div className="ring-glow overflow-hidden rounded-2xl border border-[#4A2418]/10 bg-white/50 p-2 backdrop-blur-sm">
              <Image src={asset.path} alt="" width={72} height={96} className="h-20 w-auto object-contain" />
            </div>
          </motion.div>
        ) : null,
      )}

      <motion.div
        aria-hidden
        animate={{ y: [0, -16, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="floating-chip pointer-events-none absolute right-[12%] top-[18%] hidden h-20 w-20 rounded-2xl border border-[#D9A441]/30 bg-[#FFF4D8]/80 shadow-lg backdrop-blur-sm lg:block"
      />

      <div className="relative mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-12 lg:gap-6 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 lg:col-span-5 lg:col-start-2 lg:pr-8"
        >
          <p className="type-label mb-6 text-[#D9A441]">{t("badge")}</p>
          <h1 className="type-display-xl text-[#2A120C]">{t("title")}</h1>
          <p className="type-body-lg mt-7 max-w-lg text-[#4A2418]/80">{t("subtitle")}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <CTAButton href="/products" variant="primary" size="lg">
              {t("ctaPrimary")}
            </CTAButton>
            <CTAButton href="/products" variant="secondary" size="lg">
              {t("ctaSecondary")}
            </CTAButton>
          </div>
        </motion.div>

        <div className="relative lg:col-span-6 lg:col-start-7">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ rotateX, rotateY, transformPerspective: 1200 }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <div
                aria-hidden
                className="absolute -inset-8 rounded-[2.75rem] bg-gradient-to-br from-[#D9A441]/25 via-transparent to-[#4A2418]/12"
              />
              <div className="ring-glow relative overflow-hidden rounded-[2rem] border border-[#4A2418]/10 bg-[#FFF4D8] p-8 shadow-[0_28px_70px_-14px_rgba(42,18,12,0.22)]">
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                />
                <Image
                  src={heroImage}
                  alt={heroAsset?.alt[locale] ?? t("pouchLabel")}
                  width={480}
                  height={640}
                  priority
                  className="relative z-10 mx-auto h-auto w-full max-w-[340px] object-contain drop-shadow-xl lg:max-w-[420px]"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-[#4A2418]/10 bg-white/90 px-6 py-5 shadow-lg backdrop-blur-sm md:block"
            >
              <p className="type-label text-[#D9A441]">{t("premiumLabel")}</p>
              <p className="type-display-sm mt-1 font-serif text-[#2A120C]">{t("pouchLabel")}</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}