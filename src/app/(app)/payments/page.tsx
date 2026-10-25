import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { PeriodFilter } from "@/components/period-filter";
import { requireSession } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { PaymentsList, type PaymentRow } from "./payments-list";

export const metadata: Metadata = { title: "Платежи" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await requireSession();
  const { from, to } = resolvePeriod(await searchParams);
  const supabase = await createClient();
  const fromTs = new Date(`${from}T00:00:00+05:00`).toISOString();
  const toTs = new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86_400_000).toISOString();

  const [{ data: payments }, { data: accounts }, { data: profiles }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, direction, amount, method, paid_at, comment, is_void, created_by, client_id, supplier_id, order_id, purchase_id, cash_accounts(name), clients(name), suppliers(name), orders(number), purchases(number)")
      .gte("paid_at", fromTs)
      .lt("paid_at", toTs)
      .order("paid_at", { ascending: false })
      .limit(2000),
    supabase.from("cash_accounts").select("id, name, type").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const rows: PaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id,
    direction: p.direction as "in" | "out",
    amount: Number(p.amount),
    method: p.method,
    paid_at: p.paid_at,
    comment: p.comment,
    is_void: p.is_void,
    account: (p.cash_accounts as { name: string } | null)?.name ?? "",
    counterparty:
      (p.clients as { name: string } | null)?.name ?? (p.suppliers as { name: string } | null)?.name ?? (p.order_id ? "Розничный покупатель" : "—"),
    counterparty_href: p.client_id ? `/clients/${p.client_id}` : null,
    document: (p.orders as { number: string } | null)?.number ?? (p.purchases as { number: string } | null)?.number ?? (p.direction === "in" ? "Аванс" : ""),
    document_href: p.order_id ? `/orders/${p.order_id}` : p.purchase_id ? `/purchases/${p.purchase_id}` : null,
    user: p.created_by ? (names.get(p.created_by) ?? "") : "",
  }));

  return (
    <>
      <PageHeader title="Платежи" description={session.isOwner ? "Входящие от клиентов и исходящие поставщикам" : "Оплаты от клиентов"} />
      <div className="mb-4">
        <PeriodFilter from={from} to={to} />
      </div>
      <PaymentsList rows={rows} accounts={accounts ?? []} isOwner={session.isOwner} />
    </>
  );
}
