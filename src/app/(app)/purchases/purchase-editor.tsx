"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductPicker, useCatalog, type PickerProduct } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { formatMoney } from "@/lib/format";
import { round2 } from "@/lib/pricing";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

export interface PurchaseLine {
  key: string;
  product_id: string;
  name: string;
  sku: string;
  unit_code: string;
  is_fractional: boolean;
  qty: string;
  unit_cost: string;
}

export function PurchaseEditor({
  suppliers,
  initial,
}: {
  suppliers: { id: string; name: string }[];
  initial?: { id?: string; supplier_id: string; supplier_invoice: string; lines: PurchaseLine[] };
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const { items } = useCatalog(true);
  const [supplierId, setSupplierId] = React.useState(initial?.supplier_id ?? suppliers[0]?.id ?? "");
  const [invoice, setInvoice] = React.useState(initial?.supplier_invoice ?? "");
  const [lines, setLines] = React.useState<PurchaseLine[]>(initial?.lines ?? []);
  const [costs, setCosts] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    createClient()
      .from("products")
      .select("id, purchase_price")
      .then(({ data }) => setCosts(Object.fromEntries((data ?? []).map((p) => [p.id, Number(p.purchase_price ?? 0)]))));
  }, []);

  function add(p: PickerProduct) {
    if (lines.some((l) => l.product_id === p.id)) {
      toast.info("Товар уже в закупке");
      return;
    }
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        product_id: p.id!,
        name: p.name ?? "",
        sku: p.sku ?? "",
        unit_code: p.unit_code ?? "",
        is_fractional: !!p.is_fractional,
        qty: "1",
        unit_cost: String(costs[p.id!] ?? 0),
      },
    ]);
  }

  const parsed = lines.map((l) => ({ ...l, q: parseNumber(l.qty) ?? 0, c: parseNumber(l.unit_cost) ?? -1 }));
  const errors = parsed.map((l) =>
    l.q <= 0 ? "Количество > 0" : !l.is_fractional && !Number.isInteger(l.q) ? "Целое число" : l.c < 0 ? "Укажите цену" : null,
  );
  const total = round2(parsed.reduce((a, l) => a + round2(l.q * Math.max(l.c, 0)), 0));

  async function save() {
    if (!supplierId) {
      toast.error("Выберите поставщика");
      return;
    }
    const id = await run(
      () =>
        rpc(createClient(), "save_purchase", {
          p_id: initial?.id ?? null,
          p_payload: {
            supplier_id: supplierId,
            supplier_invoice: invoice,
            items: parsed.map((l) => ({ product_id: l.product_id, qty: l.q, unit_cost: l.c })),
          },
        }),
      { success: "Закупка сохранена", refresh: false },
    );
    if (id) {
      router.push(`/purchases/${id}`);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Товары</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ProductPicker items={items} onPick={add} showStock placeholder="Добавить товар" />
          {lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Добавьте товары</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {parsed.map((l, i) => (
                <li key={l.key} className="grid gap-2 p-3 md:grid-cols-[1fr_110px_130px_120px_auto] md:items-end">
                  <div className="min-w-0">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.sku}</p>
                    {errors[i] && <p className="text-xs text-destructive">{errors[i]}</p>}
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Кол-во, {l.unit_code}
                    <Input inputMode="decimal" className="text-right" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Цена закупки, ₽
                    <Input inputMode="decimal" className="text-right" value={l.unit_cost} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, unit_cost: e.target.value } : x)))} />
                  </label>
                  <p className="num pb-2 font-semibold">{formatMoney(round2(l.q * Math.max(l.c, 0)))}</p>
                  <Button variant="ghost" size="icon" aria-label={`Удалить ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="h-fit lg:sticky lg:top-24">
        <CardContent className="flex flex-col gap-4 pt-5">
          <Field label="Поставщик" htmlFor="p-supplier" required>
            <NativeSelect id="p-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.length === 0 && <option value="">Сначала добавьте поставщика</option>}
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Счёт поставщика №" htmlFor="p-invoice">
            <Input id="p-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </Field>
          <p className="flex justify-between text-lg font-bold">
            <span>Итого</span>
            <span className="num text-primary">{formatMoney(total)}</span>
          </p>
          <Button size="lg" onClick={save} loading={pending} disabled={!lines.length || errors.some(Boolean) || !supplierId}>
            Сохранить черновик
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
