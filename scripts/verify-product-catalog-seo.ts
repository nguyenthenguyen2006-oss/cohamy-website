import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { products, getProductBySlug } from "@/lib/products";
import { routing } from "@/i18n/routing";
import { buildProductAlternates, buildLocalizedUrl, generateProductCatalogJsonLd } from "@/lib/seo";
import { SEOJsonLd } from "@/components/SEOJsonLd";

// Real catalogue records reproduce both quote-only new items and sold-out old items.
assert.equal(products.length, 18);
assert.equal(products.filter(p => p.price === null).length, 8);
assert.equal(products.filter(p => p.outOfStock).length, 10);
let checked = 0;
for (const product of products) {
  for (const locale of routing.locales) {
    const schema = generateProductCatalogJsonLd({locale, name:product.name[locale], description:product.description[locale], image:product.images[0], slug:product.slug[locale], sku:product.id});
    assert.equal(schema["@type"], "WebPage");
    assert.equal(schema.about.identifier, product.id);
    assert.equal(schema.about.name, product.name[locale]);
    assert.equal(schema.about.description, product.description[locale]);
    const serialized = JSON.stringify(schema);
    assert(!/"offers"|"aggregateRating"|"review"|"price"|"@type":"Product"/.test(serialized));
    const alternates = buildProductAlternates(product, locale)!;
    const languages = alternates.languages as Record<string, string>;
    assert.equal(Object.keys(languages).length, 6);
    for (const target of routing.locales) {
      assert.equal(getProductBySlug(product.slug[target], target)?.id, product.id);
      assert.equal(languages[target], buildLocalizedUrl(target, {pathname:"/products/[slug]", params:{slug:product.slug[target]}}));
    }
    assert.equal(languages["x-default"], languages.en);
    assert.equal(alternates.canonical, languages[locale]);
    assert.equal(schema.url, alternates.canonical);
    checked++;
  }
}
const unsafe = '</script><script>alert(1)</script>';
const pricedProduct=products.find(product=>product.id==='cohamy-almond-chocolate-80g')!;
const pricedSchema=generateProductCatalogJsonLd({locale:'vi',name:pricedProduct.name.vi,description:pricedProduct.description.vi,image:pricedProduct.images[0],slug:pricedProduct.slug.vi,sku:pricedProduct.id,offerPrice:59724});
assert.equal(pricedSchema.about['@type'],'Product');
assert.deepEqual(pricedSchema.about.offers?.price,59724);
assert.equal(pricedSchema.about.offers?.priceCurrency,'VND');
assert(!/aggregateRating|"review"/.test(JSON.stringify(pricedSchema)));
const html=renderToStaticMarkup(createElement(SEOJsonLd,{type:"Product",product:{name:unsafe,description:"Source text",image:["https://cohamy.vn/image.jpg"],sku:"test-sku",url:"https://cohamy.vn/en/products/test"}}));
assert(!html.includes(unsafe));
const payload=JSON.parse(html.replace(/^.*?<script[^>]*>/s,"").replace(/<\/script>.*$/s,""));
assert.equal(payload.name,unsafe);
assert.equal(payload["@type"],"WebPage");
assert(!("offers" in payload));
console.log(JSON.stringify({status:"PASS",catalogueLocaleCases:checked,quoteOnly:8,soldOut:10,legacyComponent:"PASS",scriptEscaping:"PASS",richProductOffers:"NONE_WITHOUT_PUBLIC_PRICING"}));
