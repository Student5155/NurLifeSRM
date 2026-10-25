"use client";

import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { ProductPicker, type PickerProduct } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRICE_SOURCE_LABEL } from "@/lib/constants";
import { formatMoney, formatQty } from "@/lib/format";
import {
  autoPrice,
  lineTotal,
  maxSellerDiscount,
  orderTotals,
  sellerReduction,
  type PriceType,
  type PricingClient,
} from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { cn, parseNumber } from "@/lib/utils";

export interface Line {
  key: string;
  product: PickerProduct;
  qty: string;
  /** Ручная цена (строка из поля) или null — автоцена. */
  manualPrice: string | null;
  /** Скидка строки, %; null — скидка клиента по умолчанию. */
  discount: string | null;
}

export interface PricingContext {
  settings: { seller_max_discount: number; allow_negative_stock: boolean };
  tiers: Record<string, { min_qty: number; price: number }[]>;
  client: (PricingClient & { id: string; name: string; type: PriceType; credit_limit: number | null; address: string | null; debt: number }) | null;
}

/** Контекст цен: лимит скидки, ступени, индивидуальные цены и скидка клиента. */
export function usePricingContext(clientId: string | null) {
  const [ctx, setCtx] = React.useState<PricingContext | null>(null);
  React.useEffect(() => {
    let alive = true;
    createClient()
      .rpc("pricing_context", { p_client_id: clientId as string })
      .then(({ data }) => alive && setCtx(data as unknown as PricingContext));
    return () => {
      alive = false;
    };
  }, [clientId]);
  return ctx;
}

export interface ComputedLine {
  line: Line;
  qty: number;
  unitPrice: number;
  autoUnitPrice: number;
  discount: number;
  source: string;
  total: number;
  reduction: number;
  maxDiscount: number;
  overLimit: boolean;
  qtyError: string | null;
  stockWarning: boolean;
}

export function computeLines(lines: Line[], ctx: PricingContext | null, priceType: PriceType, isOwner: boolean): ComputedLine[] {
  const limit = Number(ctx?.settings.seller_max_discount ?? 10);
  return lines.map((line) => {
    const qty = parseNumber(line.qty) ?? 0;
    const p = line.product;
    const auto = autoPrice(
      p.id!,
      { retail_price: Number(p.retail_price), wholesale_price: Number(p.wholesale_price), tiers: ctx?.tiers[p.id!] ?? [] },
      qty,
      priceType,
      ctx?.client ?? null,
    );
    const manual = line.manualPrice !== null ? parseNumber(line.manualPrice) : null;
    const unitPrice = manual ?? auto.unitPrice;
    const discount = line.discount !== null ? (parseNumber(line.discount) ?? 0) : auto.discountPercent;
    const reduction = sellerReduction(auto, unitPrice, discount);
    let qtyError: string | null = null;
    if (qty <= 0) qtyError = "Укажите количество";
    else if (!p.is_fractional && !Number.isInteger(qty)) qtyError = `Для «${p.unit_code}» только целое число`;
    return {
      line,
      qty,
      unitPrice,
      autoUnitPrice: auto.unitPrice,
      discount,
      source: manual !== null && manual !== auto.unitPrice ? "manual" : auto.source,
      total: lineTotal(qty, unitPrice, discount),
      reduction,
      maxDiscount: isOwner ? 100 : maxSellerDiscount(auto, unitPrice, limit),
      overLimit: !isOwner && reduction > limit,
      qtyError,
      stockWarning: qty > Number(p.qty_available ?? 0),
    };
  });
}

export function linesToPayload(computed: ComputedLine[]) {
  return computed.map((c) => ({
    product_id: c.line.product.id,
    qty: c.qty,
    ...(c.source === "manual" ? { unit_price: c.unitPrice } : {}),
    discount_percent: c.discount,
  }));
}

export function totalsOf(computed: ComputedLine[]) {
  return orderTotals(computed.map((c) => ({ qty: c.qty, unitPrice: c.unitPrice, discountPercent: c.discount })));
}

/** Таблица позиций заказа: подбор товара, количество, цена, скидка, сумма. */
export function OrderLinesEditor({
  products,
  lines,
  onChange,
  ctx,
  priceType,
  isOwner,
  autoFocusPicker,
}: {
  products: PickerProduct[];
  lines: Line[];
  onChange: (lines: Line[]) => void;
  ctx: PricingContext | null;
  priceType: PriceType;
  isOwner: boolean;
  autoFocusPicker?: boolean;
}) {
  const computed = computeLines(lines, ctx, priceType, isOwner);
  const limit = Number(ctx?.settings.seller_max_discount ?? 10);

  function update(key: string, patch: Partial<Line>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function add(p: PickerProduct) {
    const existing = lines.find((l) => l.product.id === p.id);
    if (existing) {
      update(existing.key, { qty: String((parseNumber(existing.qty) ?? 0) + 1) });
      return;
    }
    onChange([...lines, { key: crypto.randomUUID(), product: p, qty: "1", manualPrice: null, discount: null }]);
  }

  function step(l: Line, delta: number) {
    const next = Math.max(0, (parseNumber(l.qty) ?? 0) + delta);
    update(l.key, { qty: String(next) });
  }

  return (
    <div className="flex flex-col gap-3">
      <ProductPicker items={products} onPick={add} priceType={priceType} autoFocus={autoFocusPicker} />

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Добавьте товары через поиск или сканер штрихкода</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {computed.map((c, index) => {
            const l = c.line;
            const id = `line-${l.key}`;
            return (
              <li key={l.key} className="grid gap-3 p-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="text-muted-foreground">{index + 1}. </span>
                    {l.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.product.sku} · {PRICE_SOURCE_LABEL[c.source]} · доступно {formatQty(l.product.qty_available)} {l.product.unit_code}
                  </p>
                  {c.stockWarning && !c.qtyError && (
                    <p className="text-xs text-warning">Больше, чем доступно на складе — при подтверждении будет проверка остатка</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" onClick={() => step(l, -1)} aria-label="Меньше">
                    <Minus />
                  </Button>
                  <Input
                    id={`${id}-qty`}
                    aria-label={`Количество, ${l.product.unit_code}`}
                    aria-invalid={!!c.qtyError}
                    inputMode="decimal"
                    className="w-20 text-center"
                    value={l.qty}
                    onChange={(e) => update(l.key, { qty: e.target.value })}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => step(l, 1)} aria-label="Больше">
                    <Plus />
                  </Button>
                </div>

                <label className="flex flex-col gap-1 text-xs text-muted-foreground md:w-28">
                  Цена, ₽
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    value={l.manualPrice ?? String(c.unitPrice)}
                    onChange={(e) => update(l.key, { manualPrice: e.target.value })}
                    onBlur={() => {
                      const v = parseNumber(l.manualPrice);
                      if (l.manualPrice !== null && (v === null || v === c.autoUnitPrice)) update(l.key, { manualPrice: null });
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-muted-foreground md:w-24">
                  Скидка, %
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    aria-invalid={c.overLimit}
                    aria-describedby={c.overLimit ? `${id}-limit` : undefined}
                    value={l.discount ?? String(c.discount)}
                    max={c.maxDiscount}
                    onChange={(e) => update(l.key, { discount: e.target.value })}
                  />
                </label>

                <p className="num text-right font-semibold md:w-32">{formatMoney(c.total)}</p>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
                  aria-label={`Удалить ${l.product.name}`}
                  className="justify-self-end"
                >
                  <Trash2 />
                </Button>

                {(c.qtyError || c.overLimit) && (
                  <p id={`${id}-limit`} role="alert" className="text-sm text-destructive md:col-span-6">
                    {c.qtyError ??
                      `Снижение цены ${c.reduction.toLocaleString("ru-RU")}% больше лимита продавца ${limit}%. Максимальная скидка для этой строки — ${c.maxDiscount.toLocaleString("ru-RU")}%.`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TotalsBlock({ computed, className }: { computed: ComputedLine[]; className?: string }) {
  const t = totalsOf(computed);
  return (
    <dl className={cn("flex flex-col gap-1 text-sm", className)}>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Сумма без скидки</dt>
        <dd className="num">{formatMoney(t.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Скидка</dt>
        <dd className="num">{formatMoney(t.discountTotal)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
        <dt>Итого</dt>
        <dd className="num text-primary">{formatMoney(t.total)}</dd>
      </div>
    </dl>
  );
}
