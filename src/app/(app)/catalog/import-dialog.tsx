"use client";

import * as React from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { exportXlsx, readXlsx } from "@/lib/xlsx";

const HEADERS: Record<string, string> = {
  артикул: "sku",
  sku: "sku",
  наименование: "name",
  название: "name",
  штрихкод: "barcode",
  категория: "category",
  единица: "unit",
  "ед.": "unit",
  "розничная цена": "retail_price",
  розница: "retail_price",
  "оптовая цена": "wholesale_price",
  опт: "wholesale_price",
  "закупочная цена": "purchase_price",
  закупка: "purchase_price",
  "мин. остаток": "min_stock",
  "минимальный остаток": "min_stock",
  описание: "description",
  активен: "is_active",
};

interface ImportResult {
  errors: { row: number; message: string }[];
  created: number;
  updated: number;
  dry_run: boolean;
}

function normalizeRows(rows: Record<string, string>[]) {
  return rows.map((r) => {
    const out: Record<string, string | boolean> = { ...r };
    if (typeof r.is_active === "string" && r.is_active !== "") {
      out.is_active = !/^(нет|no|false|0)$/i.test(r.is_active);
    } else {
      delete out.is_active;
    }
    return out;
  });
}

/** Импорт товаров из XLSX: разбор в браузере → проверка в БД → предпросмотр ошибок → запись. */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { run, pending } = useAction();
  const [rows, setRows] = React.useState<Record<string, string | boolean>[]>([]);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [fileName, setFileName] = React.useState("");

  function reset() {
    setRows([]);
    setResult(null);
    setFileName("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const parsed = normalizeRows(await readXlsx(file, (h) => HEADERS[h.toLowerCase()] ?? null));
      if (parsed.length === 0) {
        toast.error("В файле нет строк с товарами. Первая строка — заголовки (Артикул, Наименование, …)");
        return;
      }
      setRows(parsed);
      const check = await run(() => rpc(createClient(), "import_products", { p_rows: parsed, p_dry_run: true }), { refresh: false });
      if (check) setResult(check as unknown as ImportResult);
    } catch {
      toast.error("Не удалось прочитать файл. Нужен формат .xlsx");
    }
  }

  async function confirm() {
    const done = await run(() => rpc(createClient(), "import_products", { p_rows: rows, p_dry_run: false }));
    if (done) {
      const r = done as unknown as ImportResult;
      toast.success(`Импорт завершён: создано ${r.created}, обновлено ${r.updated}`);
      reset();
      onOpenChange(false);
    }
  }

  async function template() {
    await exportXlsx("Шаблон импорта NurLife.xlsx", [
      {
        name: "Товары",
        columns: [
          { header: "Артикул", key: "sku", width: 14 },
          { header: "Наименование", key: "name", width: 36 },
          { header: "Штрихкод", key: "barcode", width: 16 },
          { header: "Категория", key: "category", width: 20 },
          { header: "Единица", key: "unit", width: 9 },
          { header: "Розничная цена", key: "retail", width: 15 },
          { header: "Оптовая цена", key: "wholesale", width: 15 },
          { header: "Закупочная цена", key: "purchase", width: 15 },
          { header: "Мин. остаток", key: "min", width: 12 },
          { header: "Описание", key: "description", width: 30 },
          { header: "Активен", key: "active", width: 9 },
        ],
        rows: [
          { sku: "A-001", name: "Пример товара", barcode: "", category: "Основная", unit: "шт", retail: "150", wholesale: "120", purchase: "90", min: "10", description: "", active: "Да" },
        ],
      },
    ]);
  }

  const hasErrors = (result?.errors.length ?? 0) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Импорт товаров из Excel</DialogTitle>
          <DialogDescription>
            Товары сопоставляются по артикулу: существующие обновляются, новые создаются. Единицы: шт, кг, м, упак, л. Неизвестные категории будут созданы.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <span className="sr-only">Файл XLSX</span>
              <Input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <Button type="button" variant="link" onClick={template}>
              <FileSpreadsheet aria-hidden /> Скачать шаблон
            </Button>
          </div>

          {fileName && rows.length > 0 && <p className="text-sm text-muted-foreground">«{fileName}»: строк — {rows.length}</p>}

          {result && !hasErrors && (
            <p className="rounded-md border border-success/60 px-3 py-2 text-sm">
              Ошибок нет. Будет создано: {result.created}, обновлено: {result.updated}.
            </p>
          )}

          {hasErrors && (
            <div className="rounded-md border border-destructive/60">
              <p className="border-b border-border px-3 py-2 text-sm font-medium">
                Найдено ошибок: {result!.errors.length}. Исправьте файл и загрузите снова — ничего не записано.
              </p>
              <ul className="max-h-64 overflow-y-auto px-3 py-2 text-sm">
                {result!.errors.map((e, i) => (
                  <li key={i} className="py-0.5">
                    Строка {e.row + 1}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={confirm} disabled={!result || hasErrors} loading={pending}>
            Импортировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
