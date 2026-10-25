import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { RevenueChart } from "@/components/charts";
import { Money, OrderStatusBadge, PageHeader, Stat } from "@/components/common";
import { PeriodFilter } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { resolvePeriod } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";

interface DashboardStats {
  revenue: number;
  shipped_count: number;
  orders_count: number;
  avg_check: number;
  retail_revenue: number;
  wholesale_revenue: number;
  gross_profit: number | null;
  margin_percent: number | null;
  expenses: number | null;
  net_profit: number | null;
  receivables: number;
  overdue: number;
  low_stock: number;
  open_orders: number;
  by_day: { date: string; revenue: number; orders: number }[];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const { from, to } = resolvePeriod(sp);
  const supabase = await createClient();

  let ordersQuery = supabase
    .from("orders")
    .select("id, number, status, total, created_at, clients(name)")
    .in("status", ["new", "confirmed", "assembled"])
    .order("created_at", { ascending: false })
    .limit(6);
  if (!session.isOwner) ordersQuery = ordersQuery.eq("manager_id", session.userId);

  const [{ data: statsData }, { data: openOrders }, { data: lowStock }] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_from: from, p_to: to }),
    ordersQuery,
    supabase.rpc("low_stock_products"),
  ]);

  const s = (statsData ?? {}) as unknown as DashboardStats;
  const name = session.profile.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={name ? `Здравствуйте, ${name}` : "Главная"}
        description={session.isOwner ? "Сводка по компании" : "Ваши продажи и заказы"}
        actions={
          <Button asChild>
            <Link href="/sale">Быстрая продажа</Link>
          </Button>
        }
      />

      {sp.error === "forbidden" && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/60 px-3 py-2 text-sm">
          Этот раздел доступен только владельцу.
        </p>
      )}

      <div className="mb-4">
        <PeriodFilter from={from} to={to} />
      </div>

      <section aria-label="Показатели" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat arch label={session.isOwner ? "Выручка" : "Мои продажи"} value={formatMoney(s.revenue)} hint={`${s.shipped_count ?? 0} отгрузок`} tone="gold" />
        <Stat arch label="Заказы" value={s.orders_count ?? 0} hint={`В работе: ${s.open_orders ?? 0}`} />
        <Stat arch label="Средний чек" value={formatMoney(s.avg_check)} />
        {session.isOwner ? (
          <Stat
            arch
            label="Валовая прибыль"
            value={formatMoney(s.gross_profit)}
            hint={`Маржа ${formatPercent(s.margin_percent)} · чистая ${formatMoney(s.net_profit)}`}
            tone={(s.gross_profit ?? 0) >= 0 ? "success" : "danger"}
          />
        ) : (
          <Stat arch label="Долги моих клиентов" value={formatMoney(s.receivables)} tone={s.receivables > 0 ? "danger" : undefined} />
        )}
        {session.isOwner && <Stat label="Дебиторка" value={formatMoney(s.receivables)} hint="Долги клиентов" />}
        <Stat label="Просрочено" value={formatMoney(s.overdue)} tone={s.overdue > 0 ? "danger" : undefined} />
        <Stat label="Опт / розница" value={<span className="text-lg">{formatMoney(s.wholesale_revenue)}</span>} hint={`Розница: ${formatMoney(s.retail_revenue)}`} />
        <Stat label="Низкий остаток" value={s.low_stock ?? 0} hint="Товаров ниже минимума" tone={s.low_stock > 0 ? "danger" : undefined} />
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Выручка по дням</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={(s.by_day ?? []).map((d) => ({ date: d.date, revenue: Number(d.revenue) }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Заказы в работе</CardTitle>
            <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline md:min-h-0">
              Все <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {(openOrders ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Нет открытых заказов</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {(openOrders ?? []).map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:text-primary">
                      <span className="min-w-0">
                        <span className="block font-medium">{o.number}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {(o.clients as { name: string } | null)?.name ?? "Розничный покупатель"} · {formatDate(o.created_at)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Money value={o.total} className="text-sm" />
                        <OrderStatusBadge status={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(lowStock ?? []).length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" aria-hidden /> Нужно заказать
            </CardTitle>
            <Link href="/stock?filter=low" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline md:min-h-0">
              Все <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(lowStock ?? []).slice(0, 9).map((p) => (
                <li key={p.product_id} className="flex justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="num text-muted-foreground">
                    {formatQty(p.qty_available)} / {formatQty(p.min_stock)} {p.unit_code}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
