import assert from "node:assert/strict";
import { getContentCanonical, getBlogPostCanonical } from "@/lib/blog-seo";
import { legacyBlogRows } from "@/lib/blog-legacy";
import { blogRowSchema } from "@/lib/blog-schema";
import { SITE_URL } from "@/lib/seo";

const fallback = `${SITE_URL}/vi/bai-viet/test-post`;
const target = `${SITE_URL}/vi/bai-viet/original-photo`;
assert.equal(getContentCanonical(target, fallback), target);
for (const bad of ["https://other.example/vi/bai-viet/a", `${SITE_URL}/en/blog/a`, `${SITE_URL}/vi/bai-viet/`, `${target}/extra`, `${target}?a=b`, `${target}#fragment`, "javascript:alert(1)", "https://user:pass@cohamy.vn/vi/bai-viet/a", `${SITE_URL}/vi/bai-viet/%2fadmin`, `${SITE_URL}/vi/bai-viet/../admin/a`]) {
  assert.equal(getContentCanonical(bad, fallback), fallback, bad);
}
assert.equal(getContentCanonical(`${SITE_URL}/en/pages/original`, `${SITE_URL}/en/pages/copy`), `${SITE_URL}/en/pages/original`);
const row = legacyBlogRows()[0];
assert.equal(getBlogPostCanonical({...row, locale:"vi",slug:"copy",canonical_url:target}),target);
const schema = {"@type":"ImageObject",name:"</script><script>alert(1)</script>",contentUrl:"https://cohamy.vn/image.jpg"};
const parsed = blogRowSchema.parse({...row,seo:{follow:true,pillar:false,facebook_title:"",facebook_description:"",facebook_image:"",twitter_title:"",twitter_description:"",twitter_image:"",twitter_card_type:"",custom_schema:[schema]}});
assert.deepEqual(parsed.seo?.custom_schema,[schema]);
const serialized=JSON.stringify({...schema,"@context":"https://schema.org"}).replace(/</gu,"\\u003c");
assert(!serialized.includes("</script>"));
assert.equal(JSON.parse(serialized).name,schema.name);
console.log("PASS: own-site same-language canonical, invalid route rejection, custom schema contract and script escaping.");
