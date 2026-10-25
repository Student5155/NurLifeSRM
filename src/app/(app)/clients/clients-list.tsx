"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { CLIENT_TYPE_LABEL, type ClientType } from "@/lib/constants";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { exportXlsx, MONEY_FMT, DATE_FMT } from "@/lib/xlsx";

export interface ClientListRow {
  id: string;
  type: ClientType;
  name: string;
  legal_name: string | null;
  inn: string | null;
  phone: string | null;
  email: string | null;
  discount_percent: number;
  manager_id: string | null;
  manager_name: string;
  is_active: boolean;
  debt: number;
  overdue: number;
  last_order_at: string | null;
}

export function ClientsList({
  rows,
  managers,
  currentUserId,
}: {
  rows: ClientListRow[];
  managers: { id: string; full_name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [type, setType] = React.useState("");
  const [manager, setManager] = React.useState("");
  const [filter, setFilter] = React.useState("active");

  const filtered = rows.filter((r) => {
    if (type && r.type !== type) return false;
    if (manager === "me" && r.manager_id !== currentUserId) return false;
    if (manager && manager !== "me" && r.manager_id !== manager) return false;
    if (filter === "active" && !r.is_active) return false;
    if (filter === "debt" && r.debt <= 0) return false;
    if (filter === "overdue" && r.overdue <= 0) return false;
    return true;
  });

  const columns: ColumnDef<ClientListRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Клиент",
      cell: ({ row }) => (
        <div>
          <span className="block font-medium">{row.original.name}</span>
          <span className="block text-xs text-muted-foreground">
            {[row.original.phone, row.original.inn && `ИНН ${row.original.inn}`].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
    },
    { accessorKey: "type", header: "Тип", cell: ({ row }) => <Badge tone={row.original.type === "wholesale" ? "gold" : "neutral"}>{CLIENT_TYPE_LABEL[row.original.type]}</Badge> },
    { accessorKey: "manager_name", header: "Менеджер" },
    {
      accessorKey: "debt",
      header: "Долг",
      meta: { className: "num" },
      cell: ({ row }) => (
        <span className={row.original.overdue > 0 ? "font-semibold text-destructive" : row.original.debt < 0 ? "text-success" : undefined}>
          {row.original.debt < 0 ? `аванс ${formatMoney(-row.original.debt)}` : formatMoney(row.original.debt)}
        </span>
      ),
    },
    { accessorKey: "last_order_at", header: "Последний заказ", cell: ({ getValue }) => formatDate(getValue() as string | null) },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="Тип клиента" className="md:w-40">
          <option value="">Опт и розница</option>
          <option value="wholesale">Опт</option>
          <option value="retail">Розница</option>
        </NativeSelect>
        <NativeSelect value={manager} onChange={(e) => setManager(e.target.value)} aria-label="Менеджер" className="md:w-48">
          <option value="">Все менеджеры</option>
          <option value="me">Мои клиенты</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || "Без имени"}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Фильтр" className="md:w-44">
          <option value="active">Активные</option>
          <option value="debt">С долгом</option>
          <option value="overdue">С просрочкой</option>
          <option value="all">Все</option>
        </NativeSelect>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Имя, телефон, ИНН"
        searchKeys={["name", "legal_name", "phone", "inn", "email"]}
        onRowClick={(r) => router.push(`/clients/${r.id}`)}
        renderCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.phone ?? r.inn ?? CLIENT_TYPE_LABEL[r.type]}</p>
            </div>
            <span className={r.overdue > 0 ? "num text-sm font-semibold text-destructive" : "num text-sm"}>{formatMoney(r.debt)}</span>
          </div>
        )}
        toolbar={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportXlsx(`Клиенты ${todayISO()}.xlsx`, [
                  {
                    name: "Клиенты",
                    columns: [
                      { header: "Клиент", key: "name", width: 30 },
                      { header: "Юр. название", key: "legal_name", width: 30 },
                      { header: "ИНН", key: "inn", width: 14 },
                      { header: "Телефон", key: "phone", width: 18 },
                      { header: "E-mail", key: "email", width: 24 },
                      { header: "Менеджер", key: "manager_name", width: 20 },
                      { header: "Долг", key: "debt", numFmt: MONEY_FMT, width: 14 },
                      { header: "Просрочено", key: "overdue", numFmt: MONEY_FMT, width: 14 },
                      { header: "Последний заказ", key: "last_order_at", numFmt: DATE_FMT, width: 14 },
                    ],
                    rows: filtered,
                  },
                ])
              }
            >
              <Download aria-hidden /> Экспорт
            </Button>
            <Button size="sm" asChild>
              <Link href="/clients/new">
                <Plus aria-hidden /> Клиент
              </Link>
            </Button>
          </>
        }
      />
    </>
  );
}
