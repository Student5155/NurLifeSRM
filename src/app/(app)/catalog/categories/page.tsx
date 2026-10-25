import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoryTree } from "./category-tree";

export const metadata: Metadata = { title: "Категории" };

export default async function CategoriesPage() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, parent_id, name, sort_order, is_active").order("sort_order").order("name"),
    supabase.from("products").select("category_id"),
  ]);
  const counts: Record<string, number> = {};
  for (const p of products ?? []) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;

  return (
    <>
      <PageHeader title="Категории" description="До трёх уровней вложенности" back={{ href: "/catalog", label: "Каталог" }} />
      <CategoryTree categories={categories ?? []} counts={counts} />
    </>
  );
}
