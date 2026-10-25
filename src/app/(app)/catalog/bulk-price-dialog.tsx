"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

/** Массовое изменение цен у отфильтрованных товаров (owner). */
export function BulkPriceDialog({
  open,
  onOpenChange,
  products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string }[];
}) {
  const { run, pending } = useAction();
  const [field, setField] = React.useState("retail_price");
  const [mode, setMode] = React.useState("percent");
  const [value, setValue] = React.useState("");
  const [rounding, setRounding] = React.useState("1");
  const numeric = parseNumber(value);

  async function apply() {
    if (numeric === null) return;
    const count = await run(
      () =>
        rpc(createClient(), "bulk_update_prices", {
          p_product_ids: products.map((p) => p.id),
          p_field: field,
          p_mode: mode,
          p_value: numeric,
          p_round: Number(rounding),
        }),
      { success: "Цены обновлены" },
    );
    if (count !== undefined) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить цены</DialogTitle>
          <DialogDescription>Будет изменено товаров: {products.length} (все, что сейчас в списке с учётом фильтров).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Цена" htmlFor="bulk-field">
            <NativeSelect id="bulk-field" value={field} onChange={(e) => setField(e.target.value)}>
              <option value="retail_price">Розничная</option>
              <option value="wholesale_price">Оптовая</option>
              <option value="purchase_price">Закупочная</option>
            </NativeSelect>
          </Field>
          <Field label="Как изменить" htmlFor="bulk-mode">
            <NativeSelect id="bulk-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="percent">На процент (±%)</option>
              <option value="add">На сумму (±₽)</option>
              <option value="set">Установить (=₽)</option>
            </NativeSelect>
          </Field>
          <Field label={mode === "percent" ? "Процент" : "Сумма, ₽"} htmlFor="bulk-value" hint={mode === "percent" ? "Например, 10 или −5" : undefined}>
            <Input id="bulk-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Округлять до" htmlFor="bulk-round">
            <NativeSelect id="bulk-round" value={rounding} onChange={(e) => setRounding(e.target.value)}>
              <option value="0.01">копеек</option>
              <option value="1">рубля</option>
              <option value="10">10 ₽</option>
              <option value="50">50 ₽</option>
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={apply} loading={pending} disabled={numeric === null || products.length === 0}>
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
