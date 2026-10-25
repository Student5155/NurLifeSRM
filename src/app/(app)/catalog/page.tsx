import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CatalogList, type CatalogRow } from "./catalog-list";

export const metadata: Metadata = { title: "Каталог" };

export default async function CatalogPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: items }, { data: categories }, { data: costs }] = await Promise.all([
    supabase.from("catalog_items").select("*").order("name"),
    supabase.from("categories").select("id, parent_id, name, sort_order, is_active").order("sort_order").order("name"),
    session.isOwner
      ? supabase.from("products").select("id, purchase_price")
      : Promise.resolve({ data: [] as { id: string; purchase_price: number | null }[] }),
  ]);

  const purchase = new Map((costs ?? []).map((c) => [c.id, c.purchase_price]));
  const rows: CatalogRow[] = (items ?? []).map((i) => ({
    id: i.id!,
    sku: i.sku ?? "",
    barcode: i.barcode,
    name: i.name ?? "",
    category_id: i.category_id,
    category_name: i.category_name,
    unit_code: i.unit_code ?? "",
    retail_price: Number(i.retail_price ?? 0),
    wholesale_price: Number(i.wholesale_price ?? 0),
    purchase_price: session.isOwner ? (purchase.get(i.id!) ?? null) : null,
    qty_available: Number(i.qty_available ?? 0),
    qty_on_hand: Number(i.qty_on_hand ?? 0),
    min_stock: Number(i.min_stock ?? 0),
    is_low_stock: !!i.is_low_stock,
    is_active: !!i.is_active,
    main_image: i.main_image,
    description: i.description,
  }));

  return (
    <>
      <PageHeader title="Каталог" description={`${rows.filter((r) => r.is_active).length} активных товаров`} />
      <CatalogList rows={rows} categories={categories ?? []} isOwner={session.isOwner} />
    </>
  );
}
