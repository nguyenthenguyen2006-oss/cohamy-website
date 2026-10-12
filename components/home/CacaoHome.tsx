import Image from "next/image";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { activities } from "@/data/activities";
import { productArrivals } from "@/data/product-arrivals";
import { Link } from "@/i18n/navigation";
import { getFeaturedPosts } from "@/lib/blog-repository";
import type { Locale } from "@/lib/types";
import styles from "./CacaoHome.module.css";

const flavorProducts = [
  ["almond", "cohamy-almond-chocolate-80g"],
  ["cashew", "cohamy-cashew-chocolate-80g"],
  ["matcha", "cohamy-almond-matcha-chocolate-80g"],
  ["strawberry", "cohamy-almond-strawberry-chocolate-80g"],
  ["durian", "cohamy-almond-durian-chocolate-80g"],
  ["macadamia", "cohamy-macadamia-chocolate-80g"],
  ["mango", "cohamy-mango-chocolate-80g"],
  ["candy", "cohamy-chocolate-candy-65g"],
] as const;

const featuredPhotos = [
  { id: "cohamy-almond-chocolate-80g", photo: "almond" },
  { id: "cohamy-almond-matcha-chocolate-80g", photo: "matcha" },
  { id: "cohamy-almond-strawberry-chocolate-80g", photo: "strawberry" },
] as const;

async function CacaoBlog({ locale }: { locale: Locale }) {
  const [t, posts] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getFeaturedPosts(locale, 2).catch(() => []),
  ]);

  return (
    <section className={styles.blog} aria-labelledby="cacao-blog-title">
      <div className={styles.sectionHeading}>
        <h2 id="cacao-blog-title">{t("cacao.blogTitle")}</h2>
        <Link href="/blog" className={styles.textLink}>
          {t("blog.viewAll")} <ArrowRight size={18} aria-hidden />
        </Link>
      </div>
      {posts.length > 0 ? (
        <div className={styles.blogRows}>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }}
              className={styles.blogRow}
            >
              <span>{post.title}</span>
              <ArrowRight size={21} aria-hidden />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export async function CacaoHome({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  const almond = productArrivals.find(
    (product) => product.id === "cohamy-almond-chocolate-80g",
  )!;
  const strawberry = productArrivals.find(
    (product) => product.id === "cohamy-almond-strawberry-chocolate-80g",
  )!;
  const team = activities.find((activity) => activity.id === "exhibition-booth-team")!;
  const visitors = activities.find((activity) => activity.id === "exhibition-booth-visitors")!;

  return (
    <div className={styles.home} data-home-cacao>
      <section className={styles.hero} aria-labelledby="cacao-hero-title">
        <div className={styles.heroBackdrop} aria-hidden="true">
          <Image
            src="/images/home-cacao/almond.jpg"
            alt=""
            fill
            sizes="100vw"
          />
        </div>
        <div className={styles.heroPhoto}>
          <Image
            src="/images/home-cacao/almond.jpg"
            alt={almond.name[locale]}
            fill
            preload
            sizes="(max-width: 600px) 48vw, 53vw"
          />
        </div>
        <div className={styles.heroCopy}>
          <h1 id="cacao-hero-title" className={styles.heroTitle}>
            <span>{t("cacao.heroLine1")}</span>
            <span>{t("cacao.heroLine2")}</span>
          </h1>
          <p className={styles.heroDescription}>{t("cacao.heroDescription")}</p>
          <Link href="/products" className={styles.button}>
            {t("hero.ctaPrimary")}
          </Link>
        </div>
      </section>

      <nav className={styles.flavors} aria-label={t("cacao.flavorsLabel")}>
        {flavorProducts.map(([flavor, id]) => {
          const product = productArrivals.find((item) => item.id === id)!;
          return (
            <Link
              key={id}
              href={{ pathname: "/products/[slug]", params: { slug: product.slug[locale] } }}
              aria-label={product.name[locale]}
            >
              {t(`cacao.flavors.${flavor}`)}
            </Link>
          );
        })}
      </nav>

      <section className={styles.catalog} aria-labelledby="cacao-catalog-title">
        <h2 id="cacao-catalog-title" className={styles.catalogTitle}>
          {t("cacao.productsTitle")}
        </h2>
        <div className={styles.productGrid}>
          {featuredPhotos.map(({ id, photo }) => {
            const product = productArrivals.find((item) => item.id === id)!;
            const href = {
              pathname: "/products/[slug]" as const,
              params: { slug: product.slug[locale] },
            };
            return (
              <article className={styles.product} key={id}>
                <Link href={href} className={styles.productPhoto} tabIndex={-1} aria-hidden="true">
                  <Image
                    src={`/images/home-cacao/${photo}.jpg`}
                    alt=""
                    fill
                    sizes={photo === "strawberry" ? "(max-width: 600px) 90vw, 32vw" : "(max-width: 600px) 44vw, 32vw"}
                  />
                </Link>
                <h3>{product.name[locale].replace(/^Cohamy\s+/u, "").replace(/^Socola\s+/u, "")}</h3>
                <Link href={href} className={styles.textLink} aria-label={`${t("cacao.productLink")}: ${product.name[locale]}`}>
                  {t("cacao.productLink")} <ArrowRight size={18} aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.brand} aria-labelledby="cacao-brand-title">
        <div className={styles.brandPhoto}>
          <Image src="/images/home-cacao/brand.jpg" alt={team.caption[locale]} fill sizes="(max-width: 900px) 100vw, 64vw" />
        </div>
        <div className={styles.brandCopy}>
          <h2 id="cacao-brand-title">{t("about.subtitle")}</h2>
          <Link href="/about" className={styles.button}>{t("about.cta")}</Link>
        </div>
      </section>

      <section className={styles.gift} aria-labelledby="cacao-gift-title">
        <div className={styles.giftBackdrop} aria-hidden="true">
          <Image src="/images/home-cacao/strawberry.jpg" alt="" fill sizes="100vw" />
        </div>
        <div className={styles.giftPhoto}>
          <Image src="/images/home-cacao/strawberry.jpg" alt={strawberry.name[locale]} fill sizes="(max-width: 600px) 42vw, 39vw" />
        </div>
        <div className={styles.giftCopy}>
          <h2 id="cacao-gift-title">{t("cacao.giftTitle")}</h2>
          <p>{t("cacao.giftDescription")}</p>
          <Link href="/contact" className={styles.button}>{t("cacao.giftCta")}</Link>
        </div>
      </section>

      <section className={styles.activities} aria-labelledby="cacao-activities-title">
        <div className={styles.sectionHeading}>
          <h2 id="cacao-activities-title">{t("activities.title")}</h2>
          <Link href="/activities" className={styles.textLink}>
            {t("activities.viewAll")} <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <Link href="/activities" className={styles.activitiesPhoto} aria-label={t("activities.viewAll")}>
          <Image src="/images/home-cacao/activities.jpg" alt={visitors.caption[locale]} fill sizes="92vw" />
        </Link>
      </section>

      <Suspense fallback={null}>
        <CacaoBlog locale={locale} />
      </Suspense>

      <section className={styles.partners} aria-labelledby="cacao-partner-title">
        <div className={styles.partnerPhoto} aria-hidden="true">
          <Image src="/images/home-cacao/almond.jpg" alt="" fill sizes="300px" />
        </div>
        <h2 id="cacao-partner-title">{t("cacao.partnerTitle")}</h2>
        <Link href="/partners" className={styles.button}>{t("cacao.partnerCta")}</Link>
      </section>
    </div>
  );
}
