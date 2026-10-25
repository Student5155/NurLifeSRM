"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientPicker, useClients, type PickerClient } from "@/components/client-picker";
import {
  computeLines,
  linesToPayload,
  OrderLinesEditor,
  TotalsBlock,
  usePricingContext,
  type Line,
} from "@/components/order-lines-editor";
import { useCatalog } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { formatMoney } from "@/lib/format";
import type { PriceType } from "@/lib/pricing";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

export interface OrderDraft {
  id: string;
  client: PickerClient | null;
  price_type: PriceType;
  delivery_address: string | null;
  comment: string | null;
  lines: Line[];
}

export function OrderEditor({ isOwner, initial, presetClientId }: { isOwner: boolean; initial?: OrderDraft; presetClientId?: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const clients = useClients();
  const { items: products } = useCatalog();

  const [client, setClient] = React.useState<PickerClient | null>(initial?.client ?? null);
  const [priceType, setPriceType] = React.useState<PriceType>(initial?.price_type ?? "retail");
  const [lines, setLines] = React.useState<Line[]>(initial?.lines ?? []);
  const [address, setAddress] = React.useState(initial?.delivery_address ?? "");
  const [comment, setComment] = React.useState(initial?.comment ?? "");

  // Клиент из адреса (?client=…) — когда загрузится список.
  React.useEffect(() => {
    if (!initial && presetClientId && !client) {
      const c = clients.find((x) => x.id === presetClientId);
      if (c) {
        setClient(c);
        setPriceType(c.type);
      }
    }
  }, [clients, presetClientId, initial, client]);

  const ctx = usePricingContext(client?.id ?? null);
  const computed = computeLines(lines, ctx, priceType, isOwner);
  const invalid = computed.some((c) => c.qtyError || c.overLimit);

  React.useEffect(() => {
    if (ctx?.client?.address && !address && !initial) setAddress(ctx.client.address);
  }, [ctx, address, initial]);

  function chooseClient(c: PickerClient | null) {
    setClient(c);
    setPriceType(c?.type ?? "retail");
  }

  async function save() {
    if (priceType === "wholesale" && !client) {
      toast.error("Для оптового заказа выберите клиента");
      return;
    }
    if (lines.length === 0) {
      toast.error("Добавьте товары");
      return;
    }
    const id = await run(
      () =>
        rpc(createClient(), "save_order", {
          p_order_id: initial?.id ?? null,
          p_payload: {
            client_id: client?.id ?? null,
            price_type: priceType,
            delivery_address: address,
            comment,
            items: linesToPayload(computed),
          },
        }),
      { success: initial ? "Заказ сохранён" : "Заказ создан", refresh: false },
    );
    if (id) {
      router.push(`/orders/${id}`);
      router.refresh();
    }
  }

  const debt = ctx?.client?.debt ?? 0;
  const limit = ctx?.client?.credit_limit ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Клиент</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_200px]">
            <ClientPicker clients={clients} value={client} onChange={chooseClient} />
            <NativeSelect aria-label="Тип цены" value={priceType} onChange={(e) => setPriceType(e.target.value as PriceType)}>
              <option value="retail">Розничные цены</option>
              <option value="wholesale">Оптовые цены</option>
            </NativeSelect>
            {ctx?.client && (
              <p className="text-sm text-muted-foreground md:col-span-2">
                Скидка клиента: {Number(ctx.client.discount_percent)}% · {debt < 0 ? `аванс ${formatMoney(-debt)}` : `долг ${formatMoney(debt)}`}
                {limit !== null && ` · кредитный лимит ${formatMoney(limit)}`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Товары</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderLinesEditor products={products} lines={lines} onChange={setLines} ctx={ctx} priceType={priceType} isOwner={isOwner} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Доставка и комментарий</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Адрес доставки" htmlFor="order-address">
              <Input id="order-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Комментарий" htmlFor="order-comment">
              <Textarea id="order-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
        <Card className="lg:sticky lg:top-24">
          <CardContent className="flex flex-col gap-4 pt-5">
            <TotalsBlock computed={computed} />
            {!isOwner && ctx && <p className="text-xs text-muted-foreground">Ваш лимит скидки: {Number(ctx.settings.seller_max_discount)}%</p>}
            <Button size="lg" onClick={save} loading={pending} disabled={invalid || lines.length === 0}>
              {initial ? "Сохранить заказ" : "Создать заказ"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
