import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrdersBoard, type OrderRow } from "./orders-board";

export const metadata: Metadata = { title: "Заказы" };

export default async function OrdersPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const [{ data: orders }, { data: managers }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, status, payment_status, price_type, total, paid_amount, created_at, shipped_at, due_date, manager_id, client_id, clients(name, phone)")
      .or(`created_at.gte.${since},status.in.(new,confirmed,assembled,shipped)`)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const names = new Map((managers ?? []).map((m) => [m.id, m.full_name]));
  const rows: OrderRow[] = (orders ?? []).map((o) => {
    const c = o.clients as { name: string; phone: string | null } | null;
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      payment_status: o.payment_status,
      price_type: o.price_type,
      total: Number(o.total),
      paid_amount: Number(o.paid_amount),
      created_at: o.created_at,
      shipped_at: o.shipped_at,
      due_date: o.due_date,
      manager_id: o.manager_id,
      manager_name: o.manager_id ? (names.get(o.manager_id) ?? "") : "",
      client_name: c?.name ?? "Розничный покупатель",
      client_phone: c?.phone ?? null,
    };
  });

  return (
    <>
      <PageHeader title="Заказы" description="За последний год и все незавершённые" />
      <OrdersBoard rows={rows} managers={managers ?? []} currentUserId={session.userId} />
    </>
  );
}
