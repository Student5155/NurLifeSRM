import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { StockDocumentEditor } from "./stock-document-editor";

export const metadata: Metadata = { title: "Документ склада" };

export default async function StockDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwner();
  const supabase = await createClient();

  const [{ data: doc }, { data: items }, { data: catalog }] = await Promise.all([
    supabase.from("stock_adjustments").select("*").eq("id", id).maybeSingle(),
    supabase.from("stock_adjustment_items").select("*").eq("adjustment_id", id),
    supabase.from("catalog_items").select("id, sku, barcode, name, unit_code, is_fractional, qty_on_hand, is_active").order("name"),
  ]);
  if (!doc) notFound();

  const title = `${doc.type === "inventory" ? "Инвентаризация" : "Корректировка"} ${doc.number}`;

  return (
    <>
      <PageHeader
        title={title}
        description={
          <span className="inline-flex items-center gap-2">
            {doc.status === "posted" ? <Badge tone="success">Проведён {formatDateTime(doc.posted_at)}</Badge> : <Badge tone="warning">Черновик</Badge>}
          </span>
        }
        back={{ href: "/stock/documents", label: "Документы склада" }}
      />
      <StockDocumentEditor
        doc={{ id: doc.id, type: doc.type as "adjustment" | "inventory", status: doc.status as "draft" | "posted", reason: doc.reason ?? "" }}
        items={(items ?? []).map((i) => ({ product_id: i.product_id, qty_actual: Number(i.qty_actual), qty_expected: Number(i.qty_expected), qty_diff: Number(i.qty_diff ?? 0) }))}
        catalog={(catalog ?? []).map((c) => ({
          id: c.id!,
          sku: c.sku ?? "",
          barcode: c.barcode,
          name: c.name ?? "",
          unit_code: c.unit_code ?? "",
          is_fractional: !!c.is_fractional,
          qty_on_hand: Number(c.qty_on_hand ?? 0),
          is_active: !!c.is_active,
        }))}
      />
    </>
  );
}
