"use client";

import * as React from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import { Stat } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field, Input, NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { check, useAction } from "@/hooks/use-action";
import type { Tables } from "@/lib/database.types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { parseNumber } from "@/lib/utils";

const CATEGORIES_OUT = ["Аренда", "Зарплата", "Коммунальные услуги", "Доставка", "Реклама", "Хозрасходы", "Инкассация", "Прочее"];
const CATEGORIES_IN = ["Внесение наличных", "Возврат от поставщика", "Прочее"];
const ACCOUNT_TYPE: Record<string, string> = { cash: "Наличные", bank: "Банк", card: "Карты" };

interface Op {
  id: string;
  created_at: string;
  direction: "in" | "out";
  amount: number;
  category: string;
  comment: string | null;
  account: string;
}

export function CashManager({
  balances,
  accounts,
  operations,
  period,
}: {
  balances: { cash_account_id: string; name: string; type: string; is_active: boolean; balance: number }[];
  accounts: Tables<"cash_accounts">[];
  operations: Op[];
  period: React.ReactNode;
}) {
  const { run, pending } = useAction();
  const [opDir, setOpDir] = React.useState<"in" | "out" | null>(null);
  const [opAccount, setOpAccount] = React.useState("");
  const [opAmount, setOpAmount] = React.useState("");
  const [opCategory, setOpCategory] = React.useState("");
  const [opComment, setOpComment] = React.useState("");
  const [acc, setAcc] = React.useState<Tables<"cash_accounts"> | "new" | null>(null);
  const [accName, setAccName] = React.useState("");
  const [accType, setAccType] = React.useState("cash");
  const [accActive, setAccActive] = React.useState(true);

  const total = balances.reduce((a, b) => a + b.balance, 0);

  function openOp(dir: "in" | "out") {
    setOpDir(dir);
    setOpAccount(accounts.find((a) => a.is_active)?.id ?? "");
    setOpAmount("");
    setOpCategory(dir === "out" ? CATEGORIES_OUT[0] : CATEGORIES_IN[0]);
    setOpComment("");
  }

  async function saveOp() {
    const amount = parseNumber(opAmount);
    if (!opDir || !amount || amount <= 0) return;
    const ok = await run(
      async () =>
        check(
          await createClient().from("cash_operations").insert({
            cash_account_id: opAccount,
            direction: opDir,
            amount,
            category: opCategory,
            comment: opComment || null,
          }),
        ),
      { success: opDir === "out" ? "Расход записан" : "Приход записан" },
    );
    if (ok !== undefined) setOpDir(null);
  }

  function openAcc(a: Tables<"cash_accounts"> | "new") {
    setAcc(a);
    setAccName(a === "new" ? "" : a.name);
    setAccType(a === "new" ? "cash" : a.type);
    setAccActive(a === "new" ? true : a.is_active);
  }

  async function saveAcc() {
    const supabase = createClient();
    const ok = await run(
      async () => {
        if (acc === "new") check(await supabase.from("cash_accounts").insert({ name: accName.trim(), type: accType }));
        else if (acc) check(await supabase.from("cash_accounts").update({ name: accName.trim(), type: accType, is_active: accActive }).eq("id", acc.id));
        return true;
      },
      { success: "Касса сохранена" },
    );
    if (ok) setAcc(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Балансы" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat arch label="Всего" value={formatMoney(total)} tone="gold" />
        {balances.map((b) => (
          <Stat key={b.cash_account_id} arch label={b.name} value={formatMoney(b.balance)} tone={b.balance < 0 ? "danger" : undefined} hint={b.is_active ? ACCOUNT_TYPE[b.type] : "Неактивна"} />
        ))}
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Прочие операции</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openOp("in")}>
              <Plus aria-hidden /> Приход
            </Button>
            <Button onClick={() => openOp("out")}>
              <Minus aria-hidden /> Расход
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {period}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Дата</TableHead>
                <TableHead>Статья</TableHead>
                <TableHead className="hidden md:table-cell">Касса</TableHead>
                <TableHead className="num">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Операций за период нет
                  </TableCell>
                </TableRow>
              )}
              {operations.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(o.created_at)}</TableCell>
                  <TableCell>
                    {o.category}
                    {o.comment && <span className="block text-xs text-muted-foreground">{o.comment}</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{o.account}</TableCell>
                  <TableCell className={o.direction === "in" ? "num text-success" : "num text-destructive"}>
                    {o.direction === "in" ? "+" : "−"}
                    {formatMoney(o.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Кассы и счета</CardTitle>
          <Button variant="outline" size="sm" onClick={() => openAcc("new")}>
            <Plus aria-hidden /> Касса
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {a.name} <span className="text-sm text-muted-foreground">· {ACCOUNT_TYPE[a.type]}</span> {!a.is_active && <Badge tone="danger">Неактивна</Badge>}
                </span>
                <Button size="icon" variant="ghost" onClick={() => openAcc(a)} aria-label={`Изменить ${a.name}`}>
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={!!opDir} onOpenChange={(o) => !o && setOpDir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opDir === "out" ? "Расход" : "Приход"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сумма, ₽" htmlFor="op-amount" required>
              <Input id="op-amount" inputMode="decimal" value={opAmount} onChange={(e) => setOpAmount(e.target.value)} autoFocus />
            </Field>
            <Field label="Касса" htmlFor="op-account">
              <NativeSelect id="op-account" value={opAccount} onChange={(e) => setOpAccount(e.target.value)}>
                {accounts
                  .filter((a) => a.is_active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Статья" htmlFor="op-category" className="sm:col-span-2">
              <Input id="op-category" list="op-categories" value={opCategory} onChange={(e) => setOpCategory(e.target.value)} />
              <datalist id="op-categories">
                {(opDir === "out" ? CATEGORIES_OUT : CATEGORIES_IN).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Комментарий" htmlFor="op-comment" className="sm:col-span-2">
              <Input id="op-comment" value={opComment} onChange={(e) => setOpComment(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpDir(null)}>
              Отмена
            </Button>
            <Button onClick={saveOp} loading={pending} disabled={!parseNumber(opAmount) || !opAccount || !opCategory.trim()}>
              Записать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!acc} onOpenChange={(o) => !o && setAcc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acc === "new" ? "Новая касса" : "Касса"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Название" htmlFor="acc-name">
              <Input id="acc-name" value={accName} onChange={(e) => setAccName(e.target.value)} />
            </Field>
            <Field label="Тип" htmlFor="acc-type">
              <NativeSelect id="acc-type" value={accType} onChange={(e) => setAccType(e.target.value)}>
                <option value="cash">Наличные</option>
                <option value="bank">Банк</option>
                <option value="card">Карты / эквайринг</option>
              </NativeSelect>
            </Field>
            {acc !== "new" && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox checked={accActive} onChange={(e) => setAccActive(e.target.checked)} /> Активна
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcc(null)}>
              Отмена
            </Button>
            <Button onClick={saveAcc} loading={pending} disabled={!accName.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
