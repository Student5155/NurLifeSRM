import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDocument } from "@/components/print/order-document";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { requireSession } from "@/lib/auth";
import { loadOrderPrintData, type PrintDocKind } from "@/lib/print-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Печать" };

const KINDS: PrintDocKind[] = ["receipt", "invoice", "waybill"];

export default async function PrintOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; format?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requireSession();
  const kind = (KINDS.includes(sp.doc as PrintDocKind) ? sp.doc : "receipt") as PrintDocKind;
  // Формат 80 мм — только для товарного чека.
  const format = kind === "receipt" && sp.format === "80mm" ? "80mm" : "a4";

  const supabase = await createClient();
  const data = await loadOrderPrintData(supabase, id, kind);
  if (!data) notFound();

  return (
    <>
      <PrintToolbar data={data} format={format} orderId={id} />
      <OrderDocument data={data} format={format} />
    </>
  );
}
