import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { HeroShowcase } from "@/components/HeroShowcase";
import { FeaturedProducts } from "@/components/FeaturedProducts";
import { BentoGrid } from "@/components/BentoGrid";
import { GiftCollection } from "@/components/GiftCollection";
import { BrandStory } from "@/components/BrandStory";
import { QualitySection } from "@/components/QualitySection";
import { ActivitiesPreview } from "@/components/ActivitiesPreview";
import { BlogPreview } from "@/components/BlogPreview";
import { ContactCTA } from "@/components/ContactCTA";
import { MarqueeStrip } from "@/components/MarqueeStrip";
import { FlavorRibbon } from "@/components/FlavorRibbon";
import { VisualBreak } from "@/components/VisualBreak";
import { StatsBanner } from "@/components/StatsBanner";
import { ProcessSection } from "@/components/ProcessSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { routing } from "@/i18n/routing";


export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return null;
  }

  setRequestLocale(locale);

  return (
    <div className="bg-[#FAF6EF]">
      <HeroShowcase />
      <MarqueeStrip />
      <FlavorRibbon />
      <FeaturedProducts />
      <StatsBanner />
      <BentoGrid />
      <VisualBreak />
      <GiftCollection />
      <ProcessSection />
      <BrandStory />
      <QualitySection />
      <TestimonialsSection />
      <ActivitiesPreview locale={locale} />
      <BlogPreview locale={locale} />
      <ContactCTA />
    </div>
  );
}