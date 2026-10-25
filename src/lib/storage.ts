import { PRODUCT_IMAGES_BUCKET } from "@/lib/constants";

/** Публичный адрес фото товара (бакет публичный на чтение, запись — только владелец). */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
