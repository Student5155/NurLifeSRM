"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

const METHOD_ACCOUNT: Record<PaymentMethod, string> = { cash: "cash", card: "card", bank_transfer: "bank", online: "card" };

/** Входящий платёж: по заказу (излишек — аванс) или аванс клиента. */
export function PaymentDialog({
  open,
  onOpenChange,
  accounts,
  orderId,
  clientId,
  defaultAmount,
  title,
  allowOverpay = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { id: string; name: string; type: string }[];
  orderId?: string | null;
  clientId?: string | null;
  defaultAmount?: number;
  title: string;
  allowOverpay?: boolean;
}) {
  const { run, pending } = useAction();
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [account, setAccount] = React.useState("");
  const [comment, setComment] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAmount(defaultAmount ? String(defaultAmount) : "");
      setComment("");
      setMethod("cash");
    }
  }, [open, defaultAmount]);

  React.useEffect(() => {
    const match = accounts.find((a) => a.type === METHOD_ACCOUNT[method]);
    if (match) setAccount(match.id);
    else if (!account && accounts[0]) setAccount(accounts[0].id);
  }, [method, accounts, account]);

  const value = parseNumber(amount);
  const tooMuch = !allowOverpay && defaultAmount !== undefined && value !== null && value > defaultAmount;

  async function submit() {
    if (value === null || value <= 0 || !account) return;
    const ok = await run(
      () =>
        rpc(createClient(), "register_payment", {
          p_client_id: clientId ?? null,
          p_order_id: orderId ?? null,
          p_amount: value,
          p_method: method,
          p_cash_account_id: account,
          p_comment: comment || null,
        }),
      { success: `Платёж ${formatMoney(value)} принят` },
    );
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {defaultAmount !== undefined && defaultAmount > 0 && <DialogDescription>Остаток к оплате: {formatMoney(defaultAmount)}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Сумма, ₽"
            htmlFor="pay-amount"
            required
            className="sm:col-span-2"
            error={tooMuch ? "Сумма больше остатка — для покупателя без карточки переплата невозможна" : undefined}
            hint={allowOverpay && orderId ? "Излишек станет авансом клиента и зачтётся в следующие заказы" : undefined}
          >
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus aria-invalid={tooMuch} />
          </Field>
          <Field label="Способ" htmlFor="pay-method">
            <NativeSelect id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Касса" htmlFor="pay-account">
            <NativeSelect id="pay-account" value={account} onChange={(e) => setAccount(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Комментарий" htmlFor="pay-comment" className="sm:col-span-2">
            <Input id="pay-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending} disabled={value === null || value <= 0 || !account || tooMuch}>
            Принять {value ? formatMoney(value) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
