"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { ClientPicker, useClients, type PickerClient } from "@/components/client-picker";
import { computeLines, linesToPayload, OrderLinesEditor, totalsOf, TotalsBlock, usePricingContext, type Line } from "@/components/order-lines-editor";
import { useCatalog } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

const METHOD_ACCOUNT: Record<PaymentMethod, string> = { cash: "cash", card: "card", bank_transfer: "bank", online: "card" };

export function QuickSale({ isOwner, accounts }: { isOwner: boolean; accounts: { id: string; name: string; type: string }[] }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const { items: products } = useCatalog();
  const clients = useClients();

  const [client, setClient] = React.useState<PickerClient | null>(null);
  const [lines, setLines] = React.useState<Line[]>([]);
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [account, setAccount] = React.useState("");
  const [received, setReceived] = React.useState("");
  const [done, setDone] = React.useState<{ id: string; total: number } | null>(null);

  const ctx = usePricingContext(client?.id ?? null);
  const computed = computeLines(lines, ctx, "retail", isOwner);
  const totals = totalsOf(computed);
  const invalid = computed.some((c) => c.qtyError || c.overLimit);

  React.useEffect(() => {
    const match = accounts.find((a) => a.type === METHOD_ACCOUNT[method]);
    setAccount(match?.id ?? accounts[0]?.id ?? "");
  }, [method, accounts]);

  const cash = parseNumber(received);
  const change = method === "cash" && cash !== null ? cash - totals.total : null;

  async function sell() {
    if (!lines.length) {
      toast.error("Добавьте товары");
      return;
    }
    if (!account) {
      toast.error("Нет активной кассы — добавьте её в разделе «Касса»");
      return;
    }
    const id = await run(
      () =>
        rpc(createClient(), "quick_sale", {
          p_payload: {
            client_id: client?.id ?? null,
            items: linesToPayload(computed),
            payment: { method, cash_account_id: account },
          },
        }),
      { success: "Продажа проведена" },
    );
    if (id) {
      setDone({ id: id as string, total: totals.total });
      setLines([]);
      setClient(null);
      setReceived("");
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-14 text-success" aria-hidden />
          <p className="font-display text-2xl font-bold">Продано на {formatMoney(done.total)}</p>
          <div className="flex w-full flex-col gap-2">
            <Button asChild size="lg">
              <Link href={`/print/order/${done.id}?doc=receipt&format=80mm`} target="_blank">
                <Printer aria-hidden /> Товарный чек
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/orders/${done.id}`}>Открыть заказ</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDone(null);
                router.refresh();
              }}
            >
              Новая продажа
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Товары</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderLinesEditor products={products} lines={lines} onChange={setLines} ctx={ctx} priceType="retail" isOwner={isOwner} autoFocusPicker />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Покупатель</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientPicker clients={clients} value={client} onChange={setClient} />
            {ctx?.client && Number(ctx.client.discount_percent) > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">Скидка клиента {Number(ctx.client.discount_percent)}% применена</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-24">
          <CardContent className="flex flex-col gap-4 pt-5">
            <TotalsBlock computed={computed} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Оплата" htmlFor="qs-method">
                <NativeSelect id="qs-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {(["cash", "card", "online", "bank_transfer"] as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Касса" htmlFor="qs-account">
                <NativeSelect id="qs-account" value={account} onChange={(e) => setAccount(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {method === "cash" && (
              <Field label="Получено от покупателя, ₽" htmlFor="qs-received" hint={change !== null && change >= 0 ? `Сдача: ${formatMoney(change)}` : undefined} error={change !== null && change < 0 ? "Недостаточно" : undefined}>
                <Input id="qs-received" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} />
              </Field>
            )}
            <Button size="lg" onClick={sell} loading={pending} disabled={invalid || !lines.length || totals.total < 0}>
              Продать {lines.length ? formatMoney(totals.total) : ""}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
