import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderEditor, type OrderDraft } from "../../order-editor";

export const metadata: Metadata = { title: "Изменение заказа" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, status, client_id, price_type, delivery_address, comment, clients(id, name, phone, inn, type)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  if (order.status !== "new") redirect(`/orders/${id}`);

  const { data: lines } = await supabase.from("order_lines").select("*").eq("order_id", id);
  const productIds = (lines ?? []).map((l) => l.product_id!);
  const { data: products } = productIds.length
    ? await supabase
        .from("catalog_items")
        .select("id, sku, barcode, name, unit_code, is_fractional, retail_price, wholesale_price, qty_available, is_active, category_name")
        .in("id", productIds)
    : { data: [] };
  const byId = new Map((products ?? []).map((p) => [p.id!, p]));

  const draft: OrderDraft = {
    id: order.id,
    client: (order.clients as OrderDraft["client"]) ?? null,
    price_type: order.price_type,
    delivery_address: order.delivery_address,
    comment: order.comment,
    lines: (lines ?? [])
      .filter((l) => byId.has(l.product_id!))
      .map((l) => ({
        key: l.id!,
        product: byId.get(l.product_id!)!,
        qty: String(l.qty),
        manualPrice: l.price_source === "manual" ? String(l.unit_price) : null,
        discount: String(l.discount_percent),
      })),
  };

  return (
    <>
      <PageHeader title={`Заказ ${order.number}`} description="Изменение позиций" back={{ href: `/orders/${id}`, label: "К заказу" }} />
      <OrderEditor isOwner={session.isOwner} initial={draft} />
    </>
  );
}
