import type { Metadata } from "next";
import Link from "next/link";
import { ACTION_LABEL, AuditDiff } from "@/components/audit-diff";
import { PageHeader } from "@/components/common";
import { PeriodFilter } from "@/components/period-filter";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { resolvePeriod } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { AuditFilters } from "./audit-filters";

export const metadata: Metadata = { title: "Аудит" };

const TABLE_LABEL: Record<string, string> = {
  products: "Товар",
  product_price_tiers: "Ступень цены",
  clients: "Клиент",
  client_prices: "Цена клиента",
  orders: "Заказ",
  order_items: "Позиция заказа",
  payments: "Платёж",
  purchases: "Закупка",
  stock_adjustments: "Документ склада",
  profiles: "Сотрудник",
  settings: "Настройки",
};

function link(table: string, id: string, data: Record<string, unknown> | null) {
  switch (table) {
    case "products":
      return `/catalog/${id}`;
    case "clients":
      return `/clients/${id}`;
    case "orders":
      return `/orders/${id}`;
    case "order_items":
      return data?.order_id ? `/orders/${data.order_id}` : null;
    case "purchases":
      return `/purchases/${id}`;
    case "stock_adjustments":
      return `/stock/documents/${id}`;
    case "product_price_tiers":
      return data?.product_id ? `/catalog/${data.product_id}` : null;
    case "client_prices":
      return data?.client_id ? `/clients/${data.client_id}` : null;
    default:
      return null;
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; table?: string; user?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const { from, to } = resolvePeriod(sp);
  const supabase = await createClient();
  const fromTs = new Date(`${from}T00:00:00+05:00`).toISOString();
  const toTs = new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86_400_000).toISOString();

  let q = supabase.from("audit_log").select("*").gte("created_at", fromTs).lt("created_at", toTs).order("created_at", { ascending: false }).limit(500);
  if (sp.table && TABLE_LABEL[sp.table]) q = q.eq("table_name", sp.table);
  if (sp.user) q = q.eq("changed_by", sp.user);

  const [{ data: rows }, { data: profiles }] = await Promise.all([q, supabase.from("profiles").select("id, full_name").order("full_name")]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <>
      <PageHeader title="Журнал аудита" description="Кто, когда и что изменил. Записи нельзя изменить или удалить." />
      <div className="mb-4 flex flex-col gap-3">
        <PeriodFilter from={from} to={to} />
        <AuditFilters tables={TABLE_LABEL} users={profiles ?? []} table={sp.table ?? ""} user={sp.user ?? ""} />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Когда / кто</TableHead>
              <TableHead>Объект</TableHead>
              <TableHead>Изменения</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Записей нет
                </TableCell>
              </TableRow>
            )}
            {(rows ?? []).map((r) => {
              const data = (r.new_data ?? r.old_data) as Record<string, unknown> | null;
              const href = r.action !== "DELETE" ? link(r.table_name, r.record_id, data) : null;
              const title = String(data?.number ?? data?.name ?? data?.sku ?? "");
              return (
                <TableRow key={r.id}>
                  <TableCell className="align-top">
                    <span className="block whitespace-nowrap">{formatDateTime(r.created_at)}</span>
                    <span className="block text-xs text-muted-foreground">{r.changed_by ? names.get(r.changed_by) || "—" : "Система"}</span>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="block text-xs font-semibold uppercase text-muted-foreground">
                      {ACTION_LABEL[r.action]} · {TABLE_LABEL[r.table_name] ?? r.table_name}
                    </span>
                    {href ? (
                      <Link href={href} className="text-primary hover:underline">
                        {title || "открыть"}
                      </Link>
                    ) : (
                      <span>{title}</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <AuditDiff action={r.action} oldData={r.old_data} newData={r.new_data} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {(rows ?? []).length === 500 && <p className="mt-2 text-sm text-muted-foreground">Показаны последние 500 записей — сузьте период или фильтр.</p>}
    </>
  );
}
