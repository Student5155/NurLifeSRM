import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm, type ProductData } from "../product-form";
import { ProductView } from "../product-view";

export const metadata: Metadata = { title: "Товар" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const isNew = id === "new";

  const [{ data: units }, { data: categories }] = await Promise.all([
    supabase.from("units").select("*").order("code"),
    supabase.from("categories").select("id, parent_id, name, sort_order, is_active").order("sort_order").order("name"),
  ]);

  if (isNew) {
    if (!session.isOwner) notFound();
    return (
      <>
        <PageHeader title="Новый товар" back={{ href: "/catalog", label: "Каталог" }} />
        <ProductForm units={units ?? []} categories={categories ?? []} />
      </>
    );
  }

  const [{ data: item }, { data: tiers }, { data: images }] = await Promise.all([
    supabase.from("catalog_items").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_price_tiers").select("id, min_qty, price").eq("product_id", id).order("min_qty"),
    supabase.from("product_images").select("id, storage_path, sort_order").eq("product_id", id).order("sort_order"),
  ]);
  if (!item) notFound();

  if (!session.isOwner) {
    return (
      <>
        <PageHeader title={item.name} description={`Артикул ${item.sku}`} back={{ href: "/catalog", label: "Каталог" }} />
        <ProductView item={item} tiers={tiers ?? []} images={images ?? []} />
      </>
    );
  }

  const [{ data: product }, { data: stock }, { data: history }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("stock").select("qty_on_hand, qty_reserved, qty_available, avg_cost").eq("product_id", id).maybeSingle(),
    supabase.rpc("purchase_price_history", { p_product_id: id }),
  ]);
  if (!product) notFound();

  const data: ProductData = {
    ...product,
    tiers: (tiers ?? []).map((t) => ({ min_qty: Number(t.min_qty), price: Number(t.price) })),
    images: images ?? [],
  };

  return (
    <>
      <PageHeader title={product.name} description={`Артикул ${product.sku}`} back={{ href: "/catalog", label: "Каталог" }} />
      <ProductForm units={units ?? []} categories={categories ?? []} product={data} stock={stock} history={history ?? []} />
    </>
  );
}
