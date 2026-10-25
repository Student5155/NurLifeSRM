"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ShoppingBasket } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { TableCell, TableFooter, TableRow } from "@/components/ui/table";
import { formatMoney, formatQty, todayISO } from "@/lib/format";
import { exportXlsx, MONEY_FMT, QTY_FMT } from "@/lib/xlsx";

export interface StockRow {
  id: string;
  sku: string;
  name: string;
  category_name: string | null;
  unit_code: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  min_stock: number;
  is_low_stock: boolean;
  is_active: boolean;
  avg_cost: number | null;
}

export function StockList({ rows, isOwner, initialFilter }: { rows: StockRow[]; isOwner: boolean; initialFilter: "all" | "low" }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<string>(initialFilter);

  const filtered = rows.filter((r) => {
    if (filter === "low") return r.is_low_stock && r.is_active;
    if (filter === "reserved") return r.qty_reserved > 0;
    if (filter === "zero") return r.qty_on_hand <= 0;
    if (filter === "negative") return r.qty_on_hand < 0;
    return r.is_active || r.qty_on_hand !== 0;
  });

  const value = filtered.reduce((a, r) => a + Math.max(r.qty_on_hand, 0) * (r.avg_cost ?? 0), 0);

  const columns: ColumnDef<StockRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Товар",
      cell: ({ row }) => (
        <div>
          <span className="block font-medium">{row.original.name}</span>
          <span className="block text-xs text-muted-foreground">
            {row.original.sku}
            {row.original.category_name ? ` · ${row.original.category_name}` : ""}
          </span>
        </div>
      ),
    },
    { accessorKey: "qty_on_hand", header: "На складе", meta: { className: "num" }, cell: ({ row }) => `${formatQty(row.original.qty_on_hand)} ${row.original.unit_code}` },
    { accessorKey: "qty_reserved", header: "Резерв", meta: { className: "num" }, cell: ({ row }) => formatQty(row.original.qty_reserved) },
    {
      accessorKey: "qty_available",
      header: "Доступно",
      meta: { className: "num" },
      cell: ({ row }) => <span className={row.original.is_low_stock ? "font-semibold text-destructive" : "font-semibold"}>{formatQty(row.original.qty_available)}</span>,
    },
    { accessorKey: "min_stock", header: "Минимум", meta: { className: "num" }, cell: ({ row }) => formatQty(row.original.min_stock) },
  ];
  if (isOwner) {
    columns.push(
      { accessorKey: "avg_cost", header: "Себестоимость", meta: { className: "num" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
      {
        id: "value",
        header: "Стоимость",
        meta: { className: "num" },
        accessorFn: (r) => Math.max(r.qty_on_hand, 0) * (r.avg_cost ?? 0),
        cell: ({ getValue }) => formatMoney(getValue() as number),
      },
    );
  }
  columns.push({ id: "badge", header: "", enableSorting: false, cell: ({ row }) => (row.original.is_low_stock ? <Badge tone="warning">Заказать</Badge> : null) });

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Фильтр остатков" className="md:w-56">
          <option value="all">Все товары</option>
          <option value="low">Нужно заказать</option>
          <option value="reserved">Есть резерв</option>
          <option value="zero">Нет в наличии</option>
          <option value="negative">Отрицательный остаток</option>
        </NativeSelect>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Название или артикул"
        searchKeys={["name", "sku", "category_name"]}
        onRowClick={(r) => router.push(`/catalog/${r.id}`)}
        renderCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.sku} · резерв {formatQty(r.qty_reserved)} · мин. {formatQty(r.min_stock)}
              </p>
            </div>
            <span className={r.is_low_stock ? "num font-semibold text-destructive" : "num font-semibold"}>
              {formatQty(r.qty_available)} {r.unit_code}
            </span>
          </div>
        )}
        footer={
          isOwner ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="text-right">
                  Стоимость склада по выборке
                </TableCell>
                <TableCell className="num">{formatMoney(value)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          ) : undefined
        }
        toolbar={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportXlsx(`Остатки ${todayISO()}.xlsx`, [
                  {
                    name: "Остатки",
                    columns: [
                      { header: "Артикул", key: "sku", width: 14 },
                      { header: "Товар", key: "name", width: 40 },
                      { header: "Ед.", key: "unit_code", width: 8 },
                      { header: "На складе", key: "qty_on_hand", numFmt: QTY_FMT },
                      { header: "Резерв", key: "qty_reserved", numFmt: QTY_FMT },
                      { header: "Доступно", key: "qty_available", numFmt: QTY_FMT },
                      { header: "Минимум", key: "min_stock", numFmt: QTY_FMT },
                      ...(isOwner ? [{ header: "Себестоимость", key: "avg_cost" as const, numFmt: MONEY_FMT, width: 15 }] : []),
                    ],
                    rows: filtered,
                  },
                ])
              }
            >
              <Download aria-hidden /> Экспорт
            </Button>
            {isOwner && filter === "low" && filtered.length > 0 && (
              <Button size="sm" asChild>
                <Link href="/purchases/new?from=low">
                  <ShoppingBasket aria-hidden /> Создать закупку
                </Link>
              </Button>
            )}
          </>
        }
      />
    </>
  );
}
