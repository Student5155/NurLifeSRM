import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { PeriodFilter } from "@/components/period-filter";
import { requireSession } from "@/lib/auth";
import { resolvePeriod } from "@/lib/period";
import { Reports } from "./reports";

export const metadata: Metadata = { title: "Отчёты" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; tab?: string }> }) {
  const sp = await searchParams;
  const session = await requireSession();
  const { from, to } = resolvePeriod(sp);
  return (
    <>
      <PageHeader title="Отчёты" description={session.isOwner ? "Выручка считается по дате отгрузки" : "Ваши продажи и клиенты; выручка — по дате отгрузки"} />
      <div className="mb-4">
        <PeriodFilter from={from} to={to} />
      </div>
      <Reports from={from} to={to} isOwner={session.isOwner} initialTab={sp.tab} />
    </>
  );
}
