"use client";

import * as React from "react";
import { Ban, PackageCheck, Send, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PurchaseStatus } from "@/lib/constants";
import { formatMoney, formatQty } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

interface Props {
  purchase: { id: string; number: string; status: PurchaseStatus; supplier_id: string; rest: number };
  items: { id: string; name: string; unit_code: string; remaining: number }[];
  accounts: { id: string; name: string; type: string }[];
  hasReceived: boolean;
}

export function PurchaseActions({ purchase, items, accounts, hasReceived }: Props) {
  const { run, pending } = useAction();
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("bank_transfer");
  const [account, setAccount] = React.useState(accounts.find((a) => a.type === "bank")?.id ?? accounts[0]?.id ?? "");

  const s = purchase.status;
  const open = s === "draft" || s === "ordered";

  async function setStatus(to: PurchaseStatus) {
    await run(() => rpc(createClient(), "set_purchase_status", { p_id: purchase.id, p_status: to }), { success: "Статус обновлён" });
  }

  function openReceive() {
    setQty(Object.fromEntries(items.filter((i) => i.remaining > 0).map((i) => [i.id, String(i.remaining)])));
    setReceiveOpen(true);
  }

  async function receive() {
    const payload = Object.entries(qty)
      .map(([item_id, v]) => ({ item_id, qty: parseNumber(v) ?? 0 }))
      .filter((x) => x.qty > 0);
    const ok = await run(() => rpc(createClient(), "post_receipt", { p_purchase_id: purchase.id, p_items: payload }), { success: "Товар принят на склад" });
    if (ok !== undefined) setReceiveOpen(false);
  }

  async function pay() {
    const value = parseNumber(amount);
    if (!value || value <= 0) return;
    const ok = await run(
      () =>
        rpc(createClient(), "register_supplier_payment", {
          p_supplier_id: purchase.supplier_id,
          p_purchase_id: purchase.id,
          p_amount: value,
          p_method: method,
          p_cash_account_id: account,
        }),
      { success: "Оплата поставщику проведена" },
    );
    if (ok) setPayOpen(false);
  }

  return (
    <>
      {s === "draft" && (
        <Button onClick={() => setStatus("ordered")} loading={pending}>
          <Send aria-hidden /> Оформить заказ поставщику
        </Button>
      )}
      {open && items.some((i) => i.remaining > 0) && (
        <Button variant={s === "draft" ? "outline" : "default"} onClick={openReceive}>
          <PackageCheck aria-hidden /> Принять товар
        </Button>
      )}
      {s === "ordered" && !hasReceived && (
        <Button variant="ghost" onClick={() => setStatus("draft")} disabled={pending}>
          <Undo2 aria-hidden /> В черновик
        </Button>
      )}
      {s !== "cancelled" && (
        <Button
          variant="secondary"
          onClick={() => {
            setAmount(purchase.rest ? String(purchase.rest) : "");
            setPayOpen(true);
          }}
        >
          <Wallet aria-hidden /> Оплатить поставщику
        </Button>
      )}
      {open && !hasReceived && (
        <Button variant="ghost" className="text-destructive" onClick={() => confirm("Отменить закупку?") && setStatus("cancelled")} disabled={pending}>
          <Ban aria-hidden /> Отменить
        </Button>
      )}

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Приёмка по закупке {purchase.number}</DialogTitle>
            <DialogDescription>Можно принять частично — остаток будет ждать следующей приёмки. Себестоимость пересчитается по скользящей средней.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col divide-y divide-border">
            {items
              .filter((i) => i.remaining > 0)
              .map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{i.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      осталось принять {formatQty(i.remaining)} {i.unit_code}
                    </span>
                  </span>
                  <Input
                    aria-label={`Принять: ${i.name}`}
                    inputMode="decimal"
                    className="w-28 text-right"
                    value={qty[i.id] ?? ""}
                    onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                  />
                </li>
              ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReceiveOpen(false)}>
              Отмена
            </Button>
            <Button onClick={receive} loading={pending}>
              Принять на склад
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оплата поставщику</DialogTitle>
            <DialogDescription>Не оплачено по закупке: {formatMoney(purchase.rest)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сумма, ₽" htmlFor="sp-amount" className="sm:col-span-2">
              <Input id="sp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Способ" htmlFor="sp-method">
              <NativeSelect id="sp-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Касса" htmlFor="sp-account">
              <NativeSelect id="sp-account" value={account} onChange={(e) => setAccount(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Отмена
            </Button>
            <Button onClick={pay} loading={pending} disabled={!parseNumber(amount) || !account}>
              Оплатить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
