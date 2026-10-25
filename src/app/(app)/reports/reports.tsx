"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RevenueChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";
import { exportXlsx, MONEY_FMT, QTY_FMT, type XlsxColumn } from "@/lib/xlsx";

type Kind = "money" | "qty" | "percent" | "date" | "text" | "abc";

interface Col<T> {
  key: keyof T & string;
  title: string;
  kind: Kind;
  total?: boolean;
}

function fmt(kind: Kind, v: unknown) {
  if (v === null || v === undefined) return "—";
  switch (kind) {
    case "money":
      return formatMoney(v as number);
    case "qty":
      return formatQty(v as number);
    case "percent":
      return formatPercent(v as number);
    case "date":
      return formatDate(v as string);
    case "abc":
      return <Badge tone={v === "A" ? "success" : v === "B" ? "warning" : "neutral"}>{String(v)}</Badge>;
    default:
      return String(v);
  }
}

/** Таблица отчёта с итогами и выгрузкой в XLSX. */
function ReportTable<T extends Record<string, unknown>>({ rows, cols, file, loading }: { rows: T[]; cols: Col<T>[]; file: string; loading: boolean }) {
  const totals = cols.map((c) => (c.total ? rows.reduce((a, r) => a + Number(r[c.key] ?? 0), 0) : null));

  async function toXlsx() {
    const columns: XlsxColumn<T>[] = cols.map((c) => ({
      header: c.title,
      key: c.key,
      width: c.kind === "text" ? 32 : 15,
      numFmt: c.kind === "money" ? MONEY_FMT : c.kind === "qty" ? QTY_FMT : c.kind === "percent" ? "0.00" : undefined,
    }));
    const data = rows.map((r) => (cols.some((c) => c.kind === "date") ? ({ ...r, ...Object.fromEntries(cols.filter((c) => c.kind === "date").map((c) => [c.key, formatDate(r[c.key] as string)])) } as T) : r));
    await exportXlsx(file, [{ name: "Отчёт", columns, rows: data }]);
  }

  return (
    <Card>
      <CardContent className="p-0 md:p-0">
        <div className="flex items-center justify-between gap-2 p-3">
          <span className="text-sm text-muted-foreground">{loading ? <Loader2 className="size-4 animate-spin" aria-label="Загрузка" /> : `Строк: ${rows.length}`}</span>
          <Button variant="outline" size="sm" onClick={toXlsx} disabled={!rows.length}>
            <Download aria-hidden /> XLSX
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {cols.map((c) => (
                <TableHead key={c.key} className={c.kind === "text" || c.kind === "date" ? undefined : "num"}>
                  {c.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={cols.length} className="py-8 text-center text-muted-foreground">
                  Нет данных за период
                </TableCell>
              </TableRow>
            )}
            {rows.map((r, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c.key} className={c.kind === "text" || c.kind === "date" ? undefined : "num"}>
                    {fmt(c.kind, r[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {totals.some((t) => t !== null) && rows.length > 0 && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                {cols.map((c, i) => (
                  <TableCell key={c.key} className={c.kind === "text" ? undefined : "num"}>
                    {i === 0 ? "Итого" : totals[i] !== null ? fmt(c.kind, totals[i]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}

function useReport<T>(fn: string, args: Record<string, unknown>, enabled: boolean) {
  const [rows, setRows] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const key = JSON.stringify(args);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    (createClient().rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: T[] | null; error: unknown }>)(fn, JSON.parse(key))
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast.error(errorMessage(error));
        setRows((data ?? []) as T[]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fn, key, enabled]);
  return { rows, loading };
}

type Sales = { period: string; retail: number; wholesale: number; total: number; orders: number };
type Margin = { name: string; qty: number; revenue: number; cost: number; profit: number; margin_percent: number };
type TopP = { sku: string; name: string; qty: number; revenue: number };
type TopC = { name: string; orders: number; revenue: number };
type Aging = { name: string; manager_name: string | null; not_due: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number };
type Mgr = { full_name: string; orders: number; revenue: number; avg_check: number };
type StockV = { sku: string; name: string; category_name: string | null; qty: number; avg_cost: number; value: number };
type Abc = { sku: string; name: string; revenue: number; share: number; cumulative: number; abc: string };

export function Reports({ from, to, isOwner, initialTab }: { from: string; to: string; isOwner: boolean; initialTab?: string }) {
  const [tab, setTab] = React.useState(initialTab ?? "sales");
  const [group, setGroup] = React.useState("day");
  const [marginBy, setMarginBy] = React.useState("product");
  const period = { p_from: from, p_to: to };
  const suffix = `${formatDate(from)}-${formatDate(to)}`;

  const sales = useReport<Sales>("report_sales", { ...period, p_group: group }, tab === "sales");
  const margin = useReport<Margin>("report_margin", { ...period, p_by: marginBy }, tab === "margin" && isOwner);
  const topP = useReport<TopP>("report_top_products", { ...period, p_limit: 20 }, tab === "top");
  const topC = useReport<TopC>("report_top_clients", { ...period, p_limit: 20 }, tab === "top");
  const aging = useReport<Aging>("report_receivables_aging", {}, tab === "aging");
  const managers = useReport<Mgr>("report_sales_by_manager", period, tab === "managers");
  const stock = useReport<StockV>("report_stock_value", {}, tab === "stock" && isOwner);
  const abc = useReport<Abc>("report_abc", period, tab === "abc");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="sales">Продажи</TabsTrigger>
        {isOwner && <TabsTrigger value="margin">Маржа</TabsTrigger>}
        <TabsTrigger value="top">Топ-20</TabsTrigger>
        <TabsTrigger value="aging">Дебиторка</TabsTrigger>
        <TabsTrigger value="managers">По продавцам</TabsTrigger>
        {isOwner && <TabsTrigger value="stock">Стоимость склада</TabsTrigger>}
        <TabsTrigger value="abc">ABC</TabsTrigger>
      </TabsList>

      <TabsContent value="sales" className="flex flex-col gap-3">
        <NativeSelect value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Группировка" className="w-48">
          <option value="day">По дням</option>
          <option value="week">По неделям</option>
          <option value="month">По месяцам</option>
        </NativeSelect>
        <Card>
          <CardContent className="pt-5">
            <RevenueChart split data={sales.rows.map((r) => ({ date: r.period, retail: Number(r.retail), wholesale: Number(r.wholesale) }))} />
          </CardContent>
        </Card>
        <ReportTable
          rows={sales.rows}
          loading={sales.loading}
          file={`Продажи ${suffix}.xlsx`}
          cols={[
            { key: "period", title: group === "day" ? "День" : group === "week" ? "Неделя с" : "Месяц", kind: "date" },
            { key: "wholesale", title: "Опт", kind: "money", total: true },
            { key: "retail", title: "Розница", kind: "money", total: true },
            { key: "total", title: "Всего", kind: "money", total: true },
            { key: "orders", title: "Отгрузок", kind: "qty", total: true },
          ]}
        />
      </TabsContent>

      {isOwner && (
        <TabsContent value="margin" className="flex flex-col gap-3">
          <NativeSelect value={marginBy} onChange={(e) => setMarginBy(e.target.value)} aria-label="Разрез" className="w-48">
            <option value="product">По товарам</option>
            <option value="category">По категориям</option>
          </NativeSelect>
          <ReportTable
            rows={margin.rows}
            loading={margin.loading}
            file={`Маржа ${suffix}.xlsx`}
            cols={[
              { key: "name", title: marginBy === "category" ? "Категория" : "Товар", kind: "text" },
              { key: "qty", title: "Кол-во", kind: "qty", total: true },
              { key: "revenue", title: "Выручка", kind: "money", total: true },
              { key: "cost", title: "Себестоимость", kind: "money", total: true },
              { key: "profit", title: "Прибыль", kind: "money", total: true },
              { key: "margin_percent", title: "Маржа", kind: "percent" },
            ]}
          />
        </TabsContent>
      )}

      <TabsContent value="top" className="grid gap-4 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold">Товары</h2>
          <ReportTable
            rows={topP.rows}
            loading={topP.loading}
            file={`Топ товаров ${suffix}.xlsx`}
            cols={[
              { key: "name", title: "Товар", kind: "text" },
              { key: "qty", title: "Кол-во", kind: "qty" },
              { key: "revenue", title: "Выручка", kind: "money", total: true },
            ]}
          />
        </div>
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold">Клиенты</h2>
          <ReportTable
            rows={topC.rows}
            loading={topC.loading}
            file={`Топ клиентов ${suffix}.xlsx`}
            cols={[
              { key: "name", title: "Клиент", kind: "text" },
              { key: "orders", title: "Заказов", kind: "qty" },
              { key: "revenue", title: "Выручка", kind: "money", total: true },
            ]}
          />
        </div>
      </TabsContent>

      <TabsContent value="aging">
        <p className="mb-2 text-sm text-muted-foreground">Неоплаченные отгруженные заказы по сроку просрочки на сегодня (период не влияет).</p>
        <ReportTable
          rows={aging.rows}
          loading={aging.loading}
          file="Возраст дебиторки.xlsx"
          cols={[
            { key: "name", title: "Клиент", kind: "text" },
            { key: "manager_name", title: "Менеджер", kind: "text" },
            { key: "not_due", title: "Срок не наступил", kind: "money", total: true },
            { key: "d1_30", title: "1–30 дн.", kind: "money", total: true },
            { key: "d31_60", title: "31–60 дн.", kind: "money", total: true },
            { key: "d61_90", title: "61–90 дн.", kind: "money", total: true },
            { key: "d90_plus", title: "Более 90", kind: "money", total: true },
            { key: "total", title: "Всего", kind: "money", total: true },
          ]}
        />
      </TabsContent>

      <TabsContent value="managers">
        <ReportTable
          rows={managers.rows}
          loading={managers.loading}
          file={`Продажи по продавцам ${suffix}.xlsx`}
          cols={[
            { key: "full_name", title: "Сотрудник", kind: "text" },
            { key: "orders", title: "Отгрузок", kind: "qty", total: true },
            { key: "revenue", title: "Выручка", kind: "money", total: true },
            { key: "avg_check", title: "Средний чек", kind: "money" },
          ]}
        />
      </TabsContent>

      {isOwner && (
        <TabsContent value="stock">
          <p className="mb-2 text-sm text-muted-foreground">Остатки по средней себестоимости на текущий момент.</p>
          <ReportTable
            rows={stock.rows}
            loading={stock.loading}
            file="Стоимость склада.xlsx"
            cols={[
              { key: "name", title: "Товар", kind: "text" },
              { key: "category_name", title: "Категория", kind: "text" },
              { key: "qty", title: "Остаток", kind: "qty" },
              { key: "avg_cost", title: "Себестоимость", kind: "money" },
              { key: "value", title: "Стоимость", kind: "money", total: true },
            ]}
          />
        </TabsContent>
      )}

      <TabsContent value="abc">
        <p className="mb-2 text-sm text-muted-foreground">A — товары, дающие 80% выручки, B — следующие 15%, C — остальные 5%.</p>
        <ReportTable
          rows={abc.rows}
          loading={abc.loading}
          file={`ABC ${suffix}.xlsx`}
          cols={[
            { key: "name", title: "Товар", kind: "text" },
            { key: "revenue", title: "Выручка", kind: "money", total: true },
            { key: "share", title: "Доля", kind: "percent" },
            { key: "cumulative", title: "Накопительно", kind: "percent" },
            { key: "abc", title: "Класс", kind: "abc" },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}
