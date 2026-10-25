"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, FolderTree, ImageOff, Percent, Plus, Upload } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { formatMoney, formatQty, todayISO } from "@/lib/format";
import { productImageUrl } from "@/lib/storage";
import { exportXlsx, MONEY_FMT, QTY_FMT } from "@/lib/xlsx";
import { BulkPriceDialog } from "./bulk-price-dialog";
import { ImportDialog } from "./import-dialog";

export interface CatalogRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  category_name: string | null;
  unit_code: string;
  retail_price: number;
  wholesale_price: number;
  purchase_price: number | null;
  qty_available: number;
  qty_on_hand: number;
  min_stock: number;
  is_low_stock: boolean;
  is_active: boolean;
  main_image: string | null;
  description: string | null;
}

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
}

/** Плоский список категорий с отступами по уровню (для выпадающих списков). */
export function categoryOptions(categories: CategoryRow[]) {
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    categories
      .filter((c) => c.parent_id === parent)
      .forEach((c) => {
        out.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}`, depth });
        walk(c.id, depth + 1);
      });
  };
  walk(null, 0);
  return out;
}

/** id категории и всех её потомков. */
export function categoryWithChildren(categories: CategoryRow[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function CatalogList({ rows, categories, isOwner }: { rows: CatalogRow[]; categories: CategoryRow[]; isOwner: boolean }) {
  const router = useRouter();
  const [category, setCategory] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "all" | "inactive" | "low">("active");
  const [importOpen, setImportOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const cats = category ? categoryWithChildren(categories, category) : null;
    return rows.filter((r) => {
      if (cats && (!r.category_id || !cats.has(r.category_id))) return false;
      if (status === "active" && !r.is_active) return false;
      if (status === "inactive" && r.is_active) return false;
      if (status === "low" && !r.is_low_stock) return false;
      return true;
    });
  }, [rows, categories, category, status]);

  const columns = React.useMemo<ColumnDef<CatalogRow, unknown>[]>(() => {
    const cols: ColumnDef<CatalogRow, unknown>[] = [
      {
        id: "image",
        header: "",
        enableSorting: false,
        meta: { className: "w-14" },
        cell: ({ row }) => <Thumb path={row.original.main_image} />,
      },
      {
        accessorKey: "name",
        header: "Товар",
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="block font-medium">{row.original.name}</span>
            <span className="block text-xs text-muted-foreground">
              {row.original.sku}
              {row.original.category_name ? ` · ${row.original.category_name}` : ""}
            </span>
          </div>
        ),
      },
      { accessorKey: "retail_price", header: "Розница", meta: { className: "num" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
      { accessorKey: "wholesale_price", header: "Опт", meta: { className: "num" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    ];
    if (isOwner) {
      cols.push({
        accessorKey: "purchase_price",
        header: "Закупка",
        meta: { className: "num" },
        cell: ({ getValue }) => (getValue() === null ? "—" : formatMoney(getValue() as number)),
      });
    }
    cols.push({
      accessorKey: "qty_available",
      header: "Доступно",
      meta: { className: "num" },
      cell: ({ row }) => (
        <span className={row.original.is_low_stock ? "font-semibold text-destructive" : undefined}>
          {formatQty(row.original.qty_available)} {row.original.unit_code}
        </span>
      ),
    });
    cols.push({
      id: "state",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (!row.original.is_active ? <Badge tone="danger">Снят</Badge> : row.original.is_low_stock ? <Badge tone="warning">Мало</Badge> : null),
    });
    return cols;
  }, [isOwner]);

  async function exportCatalog() {
    await exportXlsx(`Каталог NurLife ${todayISO()}.xlsx`, [
      {
        name: "Товары",
        columns: [
          { header: "Артикул", key: "sku", width: 14 },
          { header: "Наименование", key: "name", width: 40 },
          { header: "Штрихкод", key: "barcode", width: 16 },
          { header: "Категория", key: "category_name", width: 22 },
          { header: "Единица", key: "unit_code", width: 9 },
          { header: "Розничная цена", key: "retail_price", numFmt: MONEY_FMT, width: 15 },
          { header: "Оптовая цена", key: "wholesale_price", numFmt: MONEY_FMT, width: 15 },
          ...(isOwner ? [{ header: "Закупочная цена", key: "purchase_price" as const, numFmt: MONEY_FMT, width: 15 }] : []),
          { header: "Мин. остаток", key: "min_stock", numFmt: QTY_FMT, width: 12 },
          { header: "Доступно", key: "qty_available", numFmt: QTY_FMT, width: 12 },
          { header: "Описание", key: "description", width: 30 },
        ],
        rows: filtered,
      },
    ]);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Категория" className="md:w-56">
          <option value="">Все категории</option>
          {categoryOptions(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Статус" className="md:w-48">
          <option value="active">Активные</option>
          <option value="low">Нужно заказать</option>
          <option value="inactive">Снятые с продажи</option>
          <option value="all">Все</option>
        </NativeSelect>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Название, артикул, штрихкод"
        searchKeys={["name", "sku", "barcode", "category_name"]}
        onRowClick={(r) => router.push(`/catalog/${r.id}`)}
        renderCard={(r) => (
          <div className="flex gap-3">
            <Thumb path={r.main_image} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.sku}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                <span>Розн. {formatMoney(r.retail_price)}</span>
                <span>Опт {formatMoney(r.wholesale_price)}</span>
              </p>
            </div>
            <span className={r.is_low_stock ? "num text-sm font-semibold text-destructive" : "num text-sm"}>
              {formatQty(r.qty_available)} {r.unit_code}
            </span>
          </div>
        )}
        toolbar={
          <>
            <Button variant="outline" size="sm" onClick={exportCatalog}>
              <Download aria-hidden /> Экспорт
            </Button>
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload aria-hidden /> Импорт
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} disabled={filtered.length === 0}>
                  <Percent aria-hidden /> Цены
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/catalog/categories">
                    <FolderTree aria-hidden /> Категории
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/catalog/new">
                    <Plus aria-hidden /> Товар
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      {isOwner && (
        <>
          <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
          <BulkPriceDialog open={bulkOpen} onOpenChange={setBulkOpen} products={filtered} />
        </>
      )}
    </>
  );
}

function Thumb({ path }: { path: string | null }) {
  const url = productImageUrl(path);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className="size-11 shrink-0 rounded-md border border-border object-cover" />
  ) : (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground" aria-hidden>
      <ImageOff className="size-4" />
    </span>
  );
}
