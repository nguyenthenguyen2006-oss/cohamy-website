import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/PostForm";
import { products } from "@/data/products";
import { getAdminPostById } from "@/lib/blog-repository";

export default async function EditAdminPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getAdminPostById(id);
  if (!post) notFound();

  return (
    <PostForm
      initialPost={post}
      products={products.map((product) => ({
        id: product.id,
        label: product.name.vi,
      }))}
    />
  );
}
