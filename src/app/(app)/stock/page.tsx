import type { Metadata } from "next";
import Link from "next/link";
import { History, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StockList, type StockRow } from "./stock-list";

export const metadata: Metadata = { title: "Склад" };

export default async function StockPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: items }, { data: costs }] = await Promise.all([
    supabase.from("catalog_items").select("id, sku, name, category_name, unit_code, qty_on_hand, qty_reserved, qty_available, min_stock, is_low_stock, is_active").order("name"),
    session.isOwner ? supabase.from("stock").select("product_id, avg_cost") : Promise.resolve({ data: [] as { product_id: string; avg_cost: number }[] }),
  ]);
  const cost = new Map((costs ?? []).map((c) => [c.product_id, Number(c.avg_cost)]));

  const rows: StockRow[] = (items ?? []).map((i) => ({
    id: i.id!,
    sku: i.sku ?? "",
    name: i.name ?? "",
    category_name: i.category_name,
    unit_code: i.unit_code ?? "",
    qty_on_hand: Number(i.qty_on_hand ?? 0),
    qty_reserved: Number(i.qty_reserved ?? 0),
    qty_available: Number(i.qty_available ?? 0),
    min_stock: Number(i.min_stock ?? 0),
    is_low_stock: !!i.is_low_stock,
    is_active: !!i.is_active,
    avg_cost: session.isOwner ? (cost.get(i.id!) ?? 0) : null,
  }));

  return (
    <>
      <PageHeader
        title="Склад"
        description="Остатки меняются только документами: приход, продажа, корректировка, инвентаризация"
        actions={
          session.isOwner && (
            <>
              <Button variant="outline" asChild>
                <Link href="/stock/movements">
                  <History aria-hidden /> Журнал движений
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/stock/documents">
                  <ClipboardCheck aria-hidden /> Корректировки и инвентаризация
                </Link>
              </Button>
            </>
          )
        }
      />
      <StockList rows={rows} isOwner={session.isOwner} initialFilter={filter === "low" ? "low" : "all"} />
    </>
  );
}
