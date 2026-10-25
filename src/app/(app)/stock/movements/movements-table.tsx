"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { MOVEMENT_TYPE_LABEL, type MovementType } from "@/lib/constants";
import { formatDateTime, formatMoney, formatQty, todayISO } from "@/lib/format";
import { exportXlsx, MONEY_FMT, QTY_FMT } from "@/lib/xlsx";

export interface MovementRow {
  id: string;
  created_at: string;
  product: string;
  sku: string;
  type: MovementType;
  qty: number;
  unit_cost: number | null;
  balance_after: number;
  ref_type: string | null;
  ref_id: string | null;
  ref_number: string;
  user: string;
}

function refHref(r: MovementRow) {
  if (!r.ref_id) return null;
  if (r.ref_type === "order") return `/orders/${r.ref_id}`;
  if (r.ref_type === "purchase") return `/purchases/${r.ref_id}`;
  if (r.ref_type === "adjustment") return `/stock/documents/${r.ref_id}`;
  return null;
}

export function MovementsTable({ rows }: { rows: MovementRow[] }) {
  const [type, setType] = React.useState("");
  const filtered = type ? rows.filter((r) => r.type === type) : rows;

  const columns: ColumnDef<MovementRow, unknown>[] = [
    { accessorKey: "created_at", header: "Когда", cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDateTime(getValue() as string)}</span> },
    {
      accessorKey: "product",
      header: "Товар",
      cell: ({ row }) => (
        <div>
          <span className="block">{row.original.product}</span>
          <span className="block text-xs text-muted-foreground">{row.original.sku}</span>
        </div>
      ),
    },
    { accessorKey: "type", header: "Операция", cell: ({ row }) => MOVEMENT_TYPE_LABEL[row.original.type] },
    {
      accessorKey: "qty",
      header: "Кол-во",
      meta: { className: "num" },
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? "text-destructive" : "text-success"}>
          {row.original.qty > 0 ? "+" : ""}
          {formatQty(row.original.qty)}
        </span>
      ),
    },
    { accessorKey: "balance_after", header: "Остаток", meta: { className: "num" }, cell: ({ getValue }) => formatQty(getValue() as number) },
    { accessorKey: "unit_cost", header: "Себест.", meta: { className: "num" }, cell: ({ getValue }) => (getValue() === null ? "—" : formatMoney(getValue() as number)) },
    {
      accessorKey: "ref_number",
      header: "Документ",
      cell: ({ row }) => {
        const href = refHref(row.original);
        return href ? (
          <Link href={href} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.original.ref_number || "открыть"}
          </Link>
        ) : (
          "—"
        );
      },
    },
    { accessorKey: "user", header: "Кто" },
  ];

  return (
    <>
      <div className="mb-3">
        <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="Операция" className="md:w-56">
          <option value="">Все операции</option>
          {Object.entries(MOVEMENT_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        pageSize={50}
        searchPlaceholder="Товар, артикул, документ"
        searchKeys={["product", "sku", "ref_number", "user"]}
        renderCard={(r) => (
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{r.product}</p>
              <p className="text-xs text-muted-foreground">
                {MOVEMENT_TYPE_LABEL[r.type]} · {formatDateTime(r.created_at)} {r.ref_number && `· ${r.ref_number}`}
              </p>
            </div>
            <span className={r.qty < 0 ? "num text-destructive" : "num text-success"}>
              {r.qty > 0 ? "+" : ""}
              {formatQty(r.qty)}
            </span>
          </div>
        )}
        toolbar={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportXlsx(`Движения ${todayISO()}.xlsx`, [
                {
                  name: "Движения",
                  columns: [
                    { header: "Когда", key: "created_at_text", width: 18 },
                    { header: "Артикул", key: "sku", width: 14 },
                    { header: "Товар", key: "product", width: 36 },
                    { header: "Операция", key: "type_text", width: 16 },
                    { header: "Кол-во", key: "qty", numFmt: QTY_FMT },
                    { header: "Остаток", key: "balance_after", numFmt: QTY_FMT },
                    { header: "Себестоимость", key: "unit_cost", numFmt: MONEY_FMT, width: 14 },
                    { header: "Документ", key: "ref_number", width: 16 },
                    { header: "Кто", key: "user", width: 20 },
                  ],
                  rows: filtered.map((r) => ({ ...r, created_at_text: formatDateTime(r.created_at), type_text: MOVEMENT_TYPE_LABEL[r.type] })),
                },
              ])
            }
          >
            <Download aria-hidden /> Экспорт
          </Button>
        }
      />
    </>
  );
}
