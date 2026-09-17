import type { BlogRow } from "@/lib/blog-schema";
export function WordPressPageContent({post}:{post:BlogRow}) {
  return <div className="container mx-auto px-6 py-14 max-w-4xl"><h1 className="text-4xl font-semibold mb-8">{post.title}</h1><div className="prose-cohamy" dangerouslySetInnerHTML={{__html:post.content_html}}/></div>;
}
