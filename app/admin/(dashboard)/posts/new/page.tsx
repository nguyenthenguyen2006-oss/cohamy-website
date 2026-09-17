import { PostForm } from "@/components/admin/PostForm";
import { products } from "@/data/products";

export default function NewAdminPostPage() {
  return (
    <PostForm
      products={products.map((product) => ({
        id: product.id,
        label: product.name.vi,
      }))}
    />
  );
}
