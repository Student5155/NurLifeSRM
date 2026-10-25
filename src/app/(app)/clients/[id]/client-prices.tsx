"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { ProductPicker, useCatalog } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { check, useAction } from "@/hooks/use-action";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

interface PriceRow {
  id: string;
  product_id: string;
  price: number;
  sku: string;
  name: string;
  base: number;
}

/** Индивидуальные цены клиента: меняет только владелец, продавец видит. */
export function ClientPrices({ clientId, prices, isOwner }: { clientId: string; prices: PriceRow[]; isOwner: boolean }) {
  const { run, pending } = useAction();
  const { items } = useCatalog();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  async function add(productId: string, price: number) {
    await run(
      async () => check(await createClient().from("client_prices").upsert({ client_id: clientId, product_id: productId, price }, { onConflict: "client_id,product_id" })),
      { success: "Цена добавлена" },
    );
  }

  async function save(row: PriceRow) {
    const value = parseNumber(drafts[row.id]);
    if (value === null || value < 0) return;
    await run(async () => check(await createClient().from("client_prices").update({ price: value }).eq("id", row.id)), { success: "Цена сохранена" });
    setDrafts((d) => {
      const next = { ...d };
      delete next[row.id];
      return next;
    });
  }

  async function remove(row: PriceRow) {
    await run(async () => check(await createClient().from("client_prices").delete().eq("id", row.id)), { success: "Цена удалена" });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Индивидуальная цена важнее оптовых ступеней; скидка клиента к ней не применяется.
        {!isOwner && " Изменять цены может только владелец."}
      </p>
      {isOwner && (
        <ProductPicker
          items={items.filter((i) => !prices.some((p) => p.product_id === i.id))}
          onPick={(p) => add(p.id!, Number(p.wholesale_price))}
          placeholder="Добавить товар с индивидуальной ценой"
          priceType="wholesale"
          showStock={false}
        />
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Товар</TableHead>
              <TableHead className="num hidden md:table-cell">Базовая</TableHead>
              <TableHead className="num">Цена клиента</TableHead>
              {isOwner && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Индивидуальных цен нет
                </TableCell>
              </TableRow>
            )}
            {prices.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.sku}</span>
                </TableCell>
                <TableCell className="num hidden md:table-cell">{formatMoney(p.base)}</TableCell>
                <TableCell className="num">
                  {isOwner ? (
                    <Input
                      aria-label={`Цена для ${p.name}`}
                      inputMode="decimal"
                      className="ml-auto w-32 text-right"
                      value={drafts[p.id] ?? String(p.price)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      onBlur={() => drafts[p.id] !== undefined && save(p)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      disabled={pending}
                    />
                  ) : (
                    formatMoney(p.price)
                  )}
                </TableCell>
                {isOwner && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(p)} aria-label="Удалить цену">
                      <Trash2 />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
