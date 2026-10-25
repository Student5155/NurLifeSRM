"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { exportXlsx, MONEY_FMT, DATE_FMT } from "@/lib/xlsx";

export interface StatementData {
  client: { id: string; name: string; legal_name: string | null; inn: string | null };
  from: string;
  to: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  rows: { date: string; doc: string; debit: number; credit: number }[];
}

/** Акт сверки за период: просмотр, XLSX и печать/PDF. */
export function Statement({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { run, pending } = useAction();
  const [from, setFrom] = React.useState(`${todayISO().slice(0, 4)}-01-01`);
  const [to, setTo] = React.useState(todayISO());
  const [data, setData] = React.useState<StatementData | null>(null);

  async function load() {
    const res = await run(() => rpc(createClient(), "client_statement", { p_client_id: clientId, p_from: from, p_to: to }), { refresh: false });
    if (res) setData(res as unknown as StatementData);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toXlsx() {
    if (!data) return;
    const rows = [
      { date: null, doc: "Сальдо на начало", debit: data.opening > 0 ? data.opening : null, credit: data.opening < 0 ? -data.opening : null },
      ...data.rows.map((r) => ({ date: r.date, doc: r.doc, debit: r.debit || null, credit: r.credit || null })),
      { date: null, doc: "Обороты за период", debit: data.debit, credit: data.credit },
      { date: null, doc: "Сальдо на конец", debit: data.closing > 0 ? data.closing : null, credit: data.closing < 0 ? -data.closing : null },
    ];
    await exportXlsx(`Акт сверки ${clientName} ${formatDate(from)}-${formatDate(to)}.xlsx`, [
      {
        name: "Акт сверки",
        title: `Акт сверки с ${clientName} за ${formatDate(from)} — ${formatDate(to)}`,
        columns: [
          { header: "Дата", key: "date", numFmt: DATE_FMT, width: 12 },
          { header: "Документ", key: "doc", width: 40 },
          { header: "Дебет (отгружено)", key: "debit", numFmt: MONEY_FMT, width: 18 },
          { header: "Кредит (оплачено)", key: "credit", numFmt: MONEY_FMT, width: 18 },
        ],
        rows,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="st-from">С</Label>
          <Input id="st-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="st-to">По</Label>
          <Input id="st-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={load} loading={pending}>
          Сформировать
        </Button>
        <Button variant="outline" onClick={toXlsx} disabled={!data}>
          <Download aria-hidden /> XLSX
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/print/statement/${clientId}?from=${from}&to=${to}`} target="_blank">
            <Printer aria-hidden /> Печать / PDF
          </Link>
        </Button>
      </div>

      {data && (
        <Card>
          <CardContent className="p-0 md:p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Дата</TableHead>
                  <TableHead>Документ</TableHead>
                  <TableHead className="num">Дебет</TableHead>
                  <TableHead className="num">Кредит</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Сальдо на {formatDate(from)}
                  </TableCell>
                  <TableCell className="num">{data.opening > 0 ? formatMoney(data.opening) : ""}</TableCell>
                  <TableCell className="num">{data.opening < 0 ? formatMoney(-data.opening) : ""}</TableCell>
                </TableRow>
                {data.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell>{r.doc}</TableCell>
                    <TableCell className="num">{r.debit ? formatMoney(r.debit) : ""}</TableCell>
                    <TableCell className="num">{r.credit ? formatMoney(r.credit) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2}>Обороты</TableCell>
                  <TableCell className="num">{formatMoney(data.debit)}</TableCell>
                  <TableCell className="num">{formatMoney(data.credit)}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2}>
                    Сальдо на {formatDate(to)} {data.closing > 0 ? "(долг клиента)" : data.closing < 0 ? "(аванс клиента)" : ""}
                  </TableCell>
                  <TableCell className="num">{data.closing > 0 ? formatMoney(data.closing) : ""}</TableCell>
                  <TableCell className="num">{data.closing < 0 ? formatMoney(-data.closing) : ""}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
