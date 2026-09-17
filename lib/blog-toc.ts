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

export function extractTableOfContents(
  html: string,
): { id: string; text: string; level: 2 | 3 }[] {
  const headings: { id: string; text: string; level: 2 | 3 }[] = [];
  const expression = /<h([23])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/giu;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(html)) !== null) {
    headings.push({
      level: Number(match[1]) as 2 | 3,
      id: match[2],
      text: decodeHtmlText(match[3]),
    });
  }

  return headings;
}
