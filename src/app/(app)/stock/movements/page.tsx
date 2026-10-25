import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { PeriodFilter } from "@/components/period-filter";
import { requireOwner } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { MovementsTable, type MovementRow } from "./movements-table";

export const metadata: Metadata = { title: "Журнал движений" };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireOwner();
  const { from, to } = resolvePeriod(await searchParams);
  const supabase = await createClient();

  const fromTs = new Date(`${from}T00:00:00+05:00`).toISOString();
  const toTs = new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86_400_000).toISOString();

  const [{ data: moves }, { data: products }, { data: profiles }, { data: orders }, { data: purchases }, { data: docs }] = await Promise.all([
    supabase.from("stock_movements").select("*").gte("created_at", fromTs).lt("created_at", toTs).order("created_at", { ascending: false }).limit(3000),
    supabase.from("products").select("id, name, sku"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("orders").select("id, number").gte("created_at", new Date(Date.now() - 400 * 86_400_000).toISOString()),
    supabase.from("purchases").select("id, number"),
    supabase.from("stock_adjustments").select("id, number"),
  ]);

  const p = new Map((products ?? []).map((x) => [x.id, x]));
  const u = new Map((profiles ?? []).map((x) => [x.id, x.full_name]));
  const refs = new Map<string, string>([
    ...(orders ?? []).map((x) => [x.id, x.number] as [string, string]),
    ...(purchases ?? []).map((x) => [x.id, x.number] as [string, string]),
    ...(docs ?? []).map((x) => [x.id, x.number] as [string, string]),
  ]);

  const rows: MovementRow[] = (moves ?? []).map((m) => ({
    id: m.id,
    created_at: m.created_at,
    product: p.get(m.product_id)?.name ?? "—",
    sku: p.get(m.product_id)?.sku ?? "",
    type: m.type,
    qty: Number(m.qty),
    unit_cost: m.unit_cost === null ? null : Number(m.unit_cost),
    balance_after: Number(m.balance_after),
    ref_type: m.ref_type,
    ref_id: m.ref_id,
    ref_number: m.ref_id ? (refs.get(m.ref_id) ?? "") : "",
    user: m.created_by ? (u.get(m.created_by) ?? "") : "Система",
  }));

  return (
    <>
      <PageHeader title="Журнал движений" description="Неизменяемая история всех изменений остатков" back={{ href: "/stock", label: "Склад" }} />
      <div className="mb-4">
        <PeriodFilter from={from} to={to} />
      </div>
      <MovementsTable rows={rows} />
    </>
  );
}
