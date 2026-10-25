"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Check, CreditCard, PackageCheck, Pencil, Truck, Undo2 } from "lucide-react";
import { PaymentDialog } from "@/components/payment-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/constants";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

interface Props {
  order: { id: string; number: string; status: OrderStatus; client_id: string | null; rest: number; total: number };
  isOwner: boolean;
  accounts: { id: string; name: string; type: string }[];
}

/** Кнопки смены статуса по правилам роли (окончательная проверка — в rpc change_order_status). */
export function OrderActions({ order, isOwner, accounts }: Props) {
  const { run, pending } = useAction();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [payOpen, setPayOpen] = React.useState(false);

  async function go(to: OrderStatus) {
    await run(() => rpc(createClient(), "change_order_status", { p_order_id: order.id, p_to_status: to }), {
      success: `Статус: ${ORDER_STATUS_LABEL[to]}`,
    });
  }

  async function cancel() {
    const ok = await run(
      () => rpc(createClient(), "change_order_status", { p_order_id: order.id, p_to_status: "cancelled", p_cancel_reason: reason }),
      { success: order.status === "shipped" ? "Возврат оформлен, товар вернулся на склад" : "Заказ отменён" },
    );
    if (ok !== undefined) setCancelOpen(false);
  }

  const s = order.status;
  const canCancel = ["new", "confirmed", "assembled"].includes(s) || (s === "shipped" && isOwner);

  return (
    <>
      {s === "new" && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/orders/${order.id}/edit`}>
              <Pencil aria-hidden /> Изменить
            </Link>
          </Button>
          <Button onClick={() => go("confirmed")} loading={pending}>
            <Check aria-hidden /> Подтвердить
          </Button>
        </>
      )}
      {s === "confirmed" && (
        <>
          <Button variant="secondary" onClick={() => go("assembled")} loading={pending}>
            <PackageCheck aria-hidden /> Собран
          </Button>
          <Button onClick={() => go("shipped")} loading={pending}>
            <Truck aria-hidden /> Отгрузить
          </Button>
          {isOwner && (
            <Button variant="ghost" onClick={() => go("new")} disabled={pending}>
              <Undo2 aria-hidden /> В «Новый»
            </Button>
          )}
        </>
      )}
      {s === "assembled" && (
        <>
          <Button onClick={() => go("shipped")} loading={pending}>
            <Truck aria-hidden /> Отгрузить
          </Button>
          {isOwner && (
            <Button variant="ghost" onClick={() => go("confirmed")} disabled={pending}>
              <Undo2 aria-hidden /> В «Подтверждён»
            </Button>
          )}
        </>
      )}
      {s !== "cancelled" && order.rest > 0 && (
        <Button variant="secondary" onClick={() => setPayOpen(true)}>
          <CreditCard aria-hidden /> Принять оплату
        </Button>
      )}
      {canCancel && (
        <Button variant="ghost" className="text-destructive" onClick={() => setCancelOpen(true)}>
          <Ban aria-hidden /> {s === "shipped" ? "Возврат" : "Отменить"}
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s === "shipped" ? `Возврат по заказу ${order.number}` : `Отменить заказ ${order.number}?`}</DialogTitle>
            <DialogDescription>
              {s === "shipped"
                ? "Товар вернётся на склад, отгрузка исключится из долга клиента. Внесённая оплата станет авансом клиента."
                : s === "new"
                  ? "Заказ будет отменён."
                  : "Резерв будет снят. Внесённая оплата станет авансом клиента."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Причина" htmlFor="cancel-reason" required>
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Назад
            </Button>
            <Button variant="destructive" onClick={cancel} loading={pending} disabled={!reason.trim()}>
              {s === "shipped" ? "Оформить возврат" : "Отменить заказ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        accounts={accounts}
        orderId={order.id}
        clientId={order.client_id}
        defaultAmount={order.rest}
        title={`Оплата по заказу ${order.number}`}
        allowOverpay={!!order.client_id}
      />
    </>
  );
}
