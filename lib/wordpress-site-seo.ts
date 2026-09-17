import "server-only";
import { cache } from "react";
import { z } from "zod";
import { blogSource } from "@/lib/blog-source";
import { bridgeRequest } from "@/lib/wordpress-blog";
const schema = z.object({revision:z.string().uuid(),name:z.string(),logo:z.string(),same_as:z.array(z.url()),website_name:z.string(),website_description:z.string()});
export const wordpressSiteSeo = cache(async () => {
  if(blogSource()!=="wordpress") return undefined;
  try { return schema.parse(await bridgeRequest("/site-seo")); }
  catch { return undefined; } // Static company identity is valid even while the blog CMS is unavailable.
});
