import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PurchaseEditor, type PurchaseLine } from "../purchase-editor";

export const metadata: Metadata = { title: "Новая закупка" };

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  await requireOwner();
  const supabase = await createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");

  let lines: PurchaseLine[] = [];
  if (from === "low") {
    const { data: low } = await supabase.rpc("low_stock_products");
    const ids = (low ?? []).map((l) => l.product_id);
    const { data: units } = ids.length ? await supabase.from("catalog_items").select("id, is_fractional").in("id", ids) : { data: [] };
    const frac = new Map((units ?? []).map((u) => [u.id!, !!u.is_fractional]));
    lines = (low ?? []).map((l) => ({
      key: l.product_id,
      product_id: l.product_id,
      name: l.name,
      sku: l.sku,
      unit_code: l.unit_code,
      is_fractional: frac.get(l.product_id) ?? false,
      qty: String(l.need),
      unit_cost: String(l.purchase_price ?? 0),
    }));
  }

  return (
    <>
      <PageHeader
        title="Новая закупка"
        description={from === "low" ? `Подставлены товары ниже минимального остатка: ${lines.length}` : undefined}
        back={{ href: "/purchases", label: "Закупки" }}
      />
      <PurchaseEditor suppliers={suppliers ?? []} initial={{ supplier_id: suppliers?.[0]?.id ?? "", supplier_invoice: "", lines }} />
    </>
  );
}
