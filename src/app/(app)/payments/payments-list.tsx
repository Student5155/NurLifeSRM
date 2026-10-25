"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus, Undo2 } from "lucide-react";
import { ClientPicker, useClients, type PickerClient } from "@/components/client-picker";
import { DataTable } from "@/components/data-table";
import { PaymentDialog } from "@/components/payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatDateTime, formatMoney, todayISO } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { exportXlsx, MONEY_FMT } from "@/lib/xlsx";

export interface PaymentRow {
  id: string;
  direction: "in" | "out";
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  comment: string | null;
  is_void: boolean;
  account: string;
  counterparty: string;
  counterparty_href: string | null;
  document: string;
  document_href: string | null;
  user: string;
}

export function PaymentsList({ rows, accounts, isOwner }: { rows: PaymentRow[]; accounts: { id: string; name: string; type: string }[]; isOwner: boolean }) {
  const { run, pending } = useAction();
  const clients = useClients();
  const [direction, setDirection] = React.useState("");
  const [voiding, setVoiding] = React.useState<PaymentRow | null>(null);
  const [reason, setReason] = React.useState("");
  const [pickOpen, setPickOpen] = React.useState(false);
  const [client, setClient] = React.useState<PickerClient | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);

  const filtered = rows.filter((r) => (direction === "void" ? r.is_void : direction ? r.direction === direction && !r.is_void : true));
  const sumIn = filtered.filter((r) => r.direction === "in" && !r.is_void).reduce((a, r) => a + r.amount, 0);
  const sumOut = filtered.filter((r) => r.direction === "out" && !r.is_void).reduce((a, r) => a + r.amount, 0);

  async function doVoid() {
    if (!voiding) return;
    const ok = await run(() => rpc(createClient(), "void_payment", { p_payment_id: voiding.id, p_reason: reason }), { success: "Платёж сторнирован" });
    if (ok !== undefined) setVoiding(null);
  }

  const columns: ColumnDef<PaymentRow, unknown>[] = [
    { accessorKey: "paid_at", header: "Дата", cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDateTime(getValue() as string)}</span> },
    {
      accessorKey: "counterparty",
      header: "Контрагент",
      cell: ({ row }) =>
        row.original.counterparty_href ? (
          <Link href={row.original.counterparty_href} className="text-primary hover:underline">
            {row.original.counterparty}
          </Link>
        ) : (
          row.original.counterparty
        ),
    },
    {
      accessorKey: "document",
      header: "Документ",
      cell: ({ row }) =>
        row.original.document_href ? (
          <Link href={row.original.document_href} className="text-primary hover:underline">
            {row.original.document}
          </Link>
        ) : (
          row.original.document
        ),
    },
    { accessorKey: "method", header: "Способ", cell: ({ row }) => `${PAYMENT_METHOD_LABEL[row.original.method]} · ${row.original.account}` },
    {
      accessorKey: "amount",
      header: "Сумма",
      meta: { className: "num" },
      cell: ({ row }) => (
        <span className={row.original.is_void ? "text-muted-foreground line-through" : row.original.direction === "in" ? "text-success" : "text-destructive"}>
          {row.original.direction === "in" ? "+" : "−"}
          {formatMoney(row.original.amount)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.is_void ? (
          <Badge tone="danger">Сторно</Badge>
        ) : isOwner ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setReason("");
              setVoiding(row.original);
            }}
          >
            <Undo2 aria-hidden /> Сторно
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <NativeSelect value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Направление" className="md:w-48">
          <option value="">Все платежи</option>
          <option value="in">Входящие</option>
          {isOwner && <option value="out">Исходящие</option>}
          <option value="void">Сторнированные</option>
        </NativeSelect>
        <span className="text-sm">
          Пришло: <span className="num font-semibold text-success">{formatMoney(sumIn)}</span>
          {isOwner && (
            <>
              {" "}
              · ушло: <span className="num font-semibold text-destructive">{formatMoney(sumOut)}</span>
            </>
          )}
        </span>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Клиент, поставщик, документ, комментарий"
        searchKeys={["counterparty", "document", "comment", "account", "user"]}
        renderCard={(r) => (
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{r.counterparty}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(r.paid_at)} · {PAYMENT_METHOD_LABEL[r.method]} · {r.document}
              </p>
            </div>
            <span className={r.is_void ? "num text-muted-foreground line-through" : r.direction === "in" ? "num text-success" : "num text-destructive"}>
              {r.direction === "in" ? "+" : "−"}
              {formatMoney(r.amount)}
            </span>
          </div>
        )}
        toolbar={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportXlsx(`Платежи ${todayISO()}.xlsx`, [
                  {
                    name: "Платежи",
                    columns: [
                      { header: "Дата", key: "date", width: 18 },
                      { header: "Направление", key: "dir", width: 12 },
                      { header: "Контрагент", key: "counterparty", width: 30 },
                      { header: "Документ", key: "document", width: 16 },
                      { header: "Способ", key: "method_label", width: 12 },
                      { header: "Касса", key: "account", width: 18 },
                      { header: "Сумма", key: "amount", numFmt: MONEY_FMT, width: 14 },
                      { header: "Сторно", key: "void", width: 8 },
                      { header: "Комментарий", key: "comment", width: 30 },
                    ],
                    rows: filtered.map((r) => ({
                      ...r,
                      date: formatDateTime(r.paid_at),
                      dir: r.direction === "in" ? "Приход" : "Расход",
                      method_label: PAYMENT_METHOD_LABEL[r.method],
                      void: r.is_void ? "да" : "",
                    })),
                  },
                ])
              }
            >
              <Download aria-hidden /> Экспорт
            </Button>
            <Button size="sm" onClick={() => setPickOpen(true)}>
              <Plus aria-hidden /> Аванс клиента
            </Button>
          </>
        }
      />

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Платёж от клиента</DialogTitle>
            <DialogDescription>Сумма автоматически зачтётся в неоплаченные заказы клиента (сначала самые ранние), остаток станет авансом.</DialogDescription>
          </DialogHeader>
          <ClientPicker clients={clients} value={client} onChange={setClient} allowEmpty={false} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={!client}
              onClick={() => {
                setPickOpen(false);
                setPayOpen(true);
              }}
            >
              Далее
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} accounts={accounts} clientId={client?.id ?? null} title={`Платёж: ${client?.name ?? ""}`} />

      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сторнировать платёж?</DialogTitle>
            <DialogDescription>
              {voiding && `${voiding.counterparty}, ${formatMoney(voiding.amount)}. `}Платёж останется в журнале с пометкой «Сторно», заказы и долги пересчитаются.
            </DialogDescription>
          </DialogHeader>
          <Field label="Причина" htmlFor="void-reason" required>
            <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoiding(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={doVoid} loading={pending} disabled={!reason.trim()}>
              Сторнировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
