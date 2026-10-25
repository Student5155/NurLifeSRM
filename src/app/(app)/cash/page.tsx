import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { PeriodFilter } from "@/components/period-filter";
import { requireOwner } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { CashManager } from "./cash-manager";

export const metadata: Metadata = { title: "Касса" };

export default async function CashPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireOwner();
  const { from, to } = resolvePeriod(await searchParams);
  const supabase = await createClient();
  const fromTs = new Date(`${from}T00:00:00+05:00`).toISOString();
  const toTs = new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86_400_000).toISOString();

  const [{ data: balances }, { data: ops }, { data: accounts }] = await Promise.all([
    supabase.rpc("cash_balances"),
    supabase.from("cash_operations").select("*, cash_accounts(name)").gte("created_at", fromTs).lt("created_at", toTs).order("created_at", { ascending: false }),
    supabase.from("cash_accounts").select("*").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Касса" description="Балансы счетов, прочие приходы и расходы" />
      <CashManager
        balances={(balances ?? []).map((b) => ({ ...b, balance: Number(b.balance) }))}
        accounts={accounts ?? []}
        operations={(ops ?? []).map((o) => ({
          id: o.id,
          created_at: o.created_at,
          direction: o.direction as "in" | "out",
          amount: Number(o.amount),
          category: o.category,
          comment: o.comment,
          account: (o.cash_accounts as { name: string } | null)?.name ?? "",
        }))}
        period={<PeriodFilter from={from} to={to} />}
      />
    </>
  );
}
