import sanitizeHtml from "sanitize-html";

export { extractTableOfContents } from "@/lib/blog-toc";

const ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "h4", "h5", "h6", "figure", "figcaption", "div", "caption", "tfoot", "hr", "del", "sup", "sub",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "blockquote",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td", "video", "source", "iframe",
];

function decodeHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

export function slugifyHeading(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/đ/gu, "d")
    .replace(/[^a-z0-9\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return normalized || "muc-noi-dung";
}

function addHeadingIds(html: string): string {
  const used = new Set<string>();

  return html.replace(
    /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/giu,
    (_match: string, tag: string, attributes: string, content: string) => {
      const existing = attributes.match(/\sid=(?:"([^"]*)"|'([^']*)')/iu);
      const base = slugifyHeading(
        existing?.[1] || existing?.[2] || decodeHtmlText(content),
      );
      let unique = base;
      let suffix = 2;

      while (used.has(unique)) {
        unique = `${base}-${suffix}`;
        suffix += 1;
      }
      used.add(unique);

      const cleanedAttributes = attributes.replace(
        /\s+id=(?:"[^"]*"|'[^']*')/giu,
        "",
      );
      return `<${tag.toLowerCase()}${cleanedAttributes} id="${unique}">${content}</${tag.toLowerCase()}>`;
    },
  );
}

export function sanitizeBlogHtml(input: string): string {
  const sanitized = sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ['class'],
      h2: ["id"],
      h3: ["id"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      video: ["src", "controls", "poster", "width", "height", "preload"],
      source: ["src", "type"],
      iframe: ["src", "title", "loading", "allowfullscreen"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedClasses: { '*': [/^wp-block-[a-z0-9_-]+$/u, /^align(left|right|center|wide|full)$/u, /^has-[a-z0-9-]+$/u, /^is-layout-[a-z0-9-]+$/u, /^is-style-[a-z0-9-]+$/u, /^columns-[1-8]$/u] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.youtube-nocookie.com", "player.vimeo.com"],
    allowIframeRelativeUrls: false,
    transformTags: {
      h1: "h2",
      a: (_tagName, attributes) => {
        const href = attributes.href ?? "";
        const external = /^https?:\/\//iu.test(href);
        return {
          tagName: "a",
          attribs: external
            ? {
                ...attributes,
                rel: [...new Set([...(attributes.rel || "").split(/\s+/u).filter(value => ["nofollow", "sponsored", "ugc", "noopener", "noreferrer"].includes(value)), "noopener", "noreferrer"])].join(" "),
              }
            : attributes,
        };
      },
    },
  });

  return addHeadingIds(sanitized).trim();
}
