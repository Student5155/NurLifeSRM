"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Columns3, Download, List, Plus } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from "@/lib/constants";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { exportXlsx, DATE_FMT, MONEY_FMT } from "@/lib/xlsx";

export interface OrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  price_type: "wholesale" | "retail";
  total: number;
  paid_amount: number;
  created_at: string;
  shipped_at: string | null;
  due_date: string | null;
  manager_id: string | null;
  manager_name: string;
  client_name: string;
  client_phone: string | null;
}

const BOARD: OrderStatus[] = ["new", "confirmed", "assembled", "shipped"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: "confirmed", confirmed: "assembled", assembled: "shipped" };

export function OrdersBoard({
  rows,
  managers,
  currentUserId,
}: {
  rows: OrderRow[];
  managers: { id: string; full_name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [view, setView] = React.useState<"table" | "board">("table");
  const [status, setStatus] = React.useState("");
  const [payment, setPayment] = React.useState("");
  const [manager, setManager] = React.useState("");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("nurlife-orders-view");
      if (saved === "board" || saved === "table") setView(saved);
    } catch {
      /* нет доступа к localStorage */
    }
  }, []);

  function switchView(v: "table" | "board") {
    setView(v);
    try {
      localStorage.setItem("nurlife-orders-view", v);
    } catch {
      /* нет доступа к localStorage */
    }
  }

  const filtered = rows.filter((r) => {
    if (status === "open" && !["new", "confirmed", "assembled"].includes(r.status)) return false;
    if (status && status !== "open" && r.status !== status) return false;
    if (payment === "overdue" && !(r.status === "shipped" && r.due_date && r.due_date < todayISO())) return false;
    if (payment && payment !== "overdue" && r.payment_status !== payment) return false;
    if (manager === "me" && r.manager_id !== currentUserId) return false;
    if (manager && manager !== "me" && r.manager_id !== manager) return false;
    return true;
  });

  const columns: ColumnDef<OrderRow, unknown>[] = [
    {
      accessorKey: "number",
      header: "Заказ",
      cell: ({ row }) => (
        <div>
          <span className="block font-medium">{row.original.number}</span>
          <span className="block text-xs text-muted-foreground">{formatDate(row.original.created_at)}</span>
        </div>
      ),
    },
    {
      accessorKey: "client_name",
      header: "Клиент",
      cell: ({ row }) => (
        <div>
          <span className="block">{row.original.client_name}</span>
          <span className="block text-xs text-muted-foreground">{row.original.price_type === "wholesale" ? "Опт" : "Розница"}</span>
        </div>
      ),
    },
    { accessorKey: "status", header: "Статус", cell: ({ row }) => <OrderStatusBadge status={row.original.status} /> },
    { accessorKey: "payment_status", header: "Оплата", cell: ({ row }) => <PaymentStatusBadge status={row.original.payment_status} /> },
    { accessorKey: "total", header: "Сумма", meta: { className: "num" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { accessorKey: "manager_name", header: "Менеджер" },
  ];

  async function advance(o: OrderRow) {
    const to = NEXT[o.status];
    if (!to) return;
    await run(() => rpc(createClient(), "change_order_status", { p_order_id: o.id, p_to_status: to }), {
      success: `${o.number}: ${ORDER_STATUS_LABEL[to]}`,
    });
  }

  async function toXlsx() {
    await exportXlsx(`Заказы ${todayISO()}.xlsx`, [
      {
        name: "Заказы",
        columns: [
          { header: "Номер", key: "number", width: 16 },
          { header: "Дата", key: "created_at", numFmt: DATE_FMT, width: 12 },
          { header: "Клиент", key: "client_name", width: 30 },
          { header: "Статус", key: "status_label", width: 14 },
          { header: "Оплата", key: "payment_label", width: 14 },
          { header: "Сумма", key: "total", numFmt: MONEY_FMT, width: 14 },
          { header: "Оплачено", key: "paid_amount", numFmt: MONEY_FMT, width: 14 },
          { header: "Отгружен", key: "shipped_at", numFmt: DATE_FMT, width: 12 },
          { header: "Срок оплаты", key: "due_date", numFmt: DATE_FMT, width: 12 },
          { header: "Менеджер", key: "manager_name", width: 20 },
        ],
        rows: filtered.map((r) => ({ ...r, status_label: ORDER_STATUS_LABEL[r.status], payment_label: PAYMENT_STATUS_LABEL[r.payment_status] })),
      },
    ]);
  }

  const filters = (
    <div className="mb-3 flex flex-wrap gap-2">
      <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус" className="md:w-44">
        <option value="">Все статусы</option>
        <option value="open">В работе</option>
        {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Оплата" className="md:w-44">
        <option value="">Любая оплата</option>
        {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
        <option value="overdue">Просрочена</option>
      </NativeSelect>
      <NativeSelect value={manager} onChange={(e) => setManager(e.target.value)} aria-label="Менеджер" className="md:w-48">
        <option value="">Все менеджеры</option>
        <option value="me">Мои заказы</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name || "Без имени"}
          </option>
        ))}
      </NativeSelect>
      <div className="ml-auto flex gap-1" role="group" aria-label="Вид">
        <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" onClick={() => switchView("table")} aria-label="Таблица" aria-pressed={view === "table"}>
          <List />
        </Button>
        <Button variant={view === "board" ? "secondary" : "ghost"} size="icon" onClick={() => switchView("board")} aria-label="Канбан" aria-pressed={view === "board"}>
          <Columns3 />
        </Button>
      </div>
    </div>
  );

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={toXlsx}>
        <Download aria-hidden /> Экспорт
      </Button>
      <Button size="sm" asChild>
        <Link href="/orders/new">
          <Plus aria-hidden /> Заказ
        </Link>
      </Button>
    </>
  );

  if (view === "board") {
    return (
      <>
        {filters}
        <div className="mb-3 flex justify-end gap-2">{actions}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {BOARD.map((s) => {
            const col = filtered.filter((r) => r.status === s);
            return (
              <section key={s} aria-label={ORDER_STATUS_LABEL[s]} className="flex min-h-40 flex-col rounded-lg border border-border bg-card/60">
                <header className="flex items-center justify-between border-b border-border px-3 py-2">
                  <OrderStatusBadge status={s} />
                  <span className="num text-xs text-muted-foreground">
                    {col.length} · {formatMoney(col.reduce((a, r) => a + r.total, 0))}
                  </span>
                </header>
                <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
                  {col.map((o) => (
                    <li key={o.id} className="rounded-md border border-border bg-card p-3">
                      <Link href={`/orders/${o.id}`} className="block hover:text-primary">
                        <span className="flex justify-between gap-2">
                          <span className="font-medium">{o.number}</span>
                          <span className="num text-sm">{formatMoney(o.total)}</span>
                        </span>
                        <span className="block truncate text-sm">{o.client_name}</span>
                        <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          {formatDate(o.created_at)}
                          <PaymentStatusBadge status={o.payment_status} />
                        </span>
                      </Link>
                      {NEXT[o.status] && (
                        <Button size="sm" variant="outline" className="mt-2 w-full" disabled={pending} onClick={() => advance(o)}>
                          {ORDER_STATUS_LABEL[NEXT[o.status]!]} <ChevronRight aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      {filters}
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Номер, клиент, телефон"
        searchKeys={["number", "client_name", "client_phone", "manager_name"]}
        onRowClick={(r) => router.push(`/orders/${r.id}`)}
        renderCard={(o) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{o.number}</p>
              <p className="truncate text-sm">{o.client_name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="num font-semibold">{formatMoney(o.total)}</span>
              <OrderStatusBadge status={o.status} />
            </div>
          </div>
        )}
        toolbar={actions}
      />
    </>
  );
}
