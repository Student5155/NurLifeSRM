"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { MAX_SELLERS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export interface UserRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: "owner" | "seller";
  is_active: boolean;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  invited: boolean;
  clients: number;
}

const inviteSchema = z.object({
  full_name: z.string().trim().min(2, "Укажите ФИО"),
  email: z.string().trim().email("Некорректный e-mail"),
  phone: z.string().trim().optional(),
});
type InviteValues = z.infer<typeof inviteSchema>;

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Ошибка сервера");
  return json;
}

export function UsersManager({ rows, activeSellers }: { rows: UserRow[]; activeSellers: number }) {
  const { run, pending } = useAction();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [deactivating, setDeactivating] = React.useState<UserRow | null>(null);
  const [reassignTo, setReassignTo] = React.useState("");
  const limitReached = activeSellers >= MAX_SELLERS;

  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { full_name: "", email: "", phone: "" } });

  async function invite(values: InviteValues) {
    const ok = await run(() => postJson("/api/users/invite", values), { success: `Приглашение отправлено на ${values.email}` });
    if (ok) {
      setInviteOpen(false);
      form.reset();
    }
  }

  async function setActive(user: UserRow, active: boolean, reassign?: string) {
    const ok = await run(() => postJson(`/api/users/${user.id}/status`, { active, reassignTo: reassign || null }), {
      success: active ? "Сотрудник активирован" : "Сотрудник деактивирован",
    });
    if (ok) setDeactivating(null);
  }

  const activeOthers = rows.filter((r) => r.is_active && r.id !== deactivating?.id);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setInviteOpen(true)} disabled={limitReached} aria-describedby="seller-limit">
          <UserPlus aria-hidden /> Пригласить продавца
        </Button>
        <span id="seller-limit" className="text-sm text-muted-foreground">
          {activeSellers} из {MAX_SELLERS}
          {limitReached && " — лимит достигнут, деактивируйте продавца, чтобы добавить нового"}
        </span>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Сотрудник</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead className="hidden md:table-cell">Клиентов</TableHead>
              <TableHead className="hidden lg:table-cell">Последний вход</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <span className="block font-medium">{u.full_name || "Без имени"}</span>
                  <span className="block text-xs text-muted-foreground md:hidden">{u.email}</span>
                  <span className="block text-xs text-muted-foreground">{u.phone}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={u.role === "owner" ? "gold" : "neutral"}>{u.role === "owner" ? "Владелец" : "Продавец"}</Badge>
                    {!u.is_active && <Badge tone="danger">Отключён</Badge>}
                    {u.invited && u.is_active && <Badge tone="info">Приглашён</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{u.clients}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : `Создан ${formatDate(u.created_at)}`}
                </TableCell>
                <TableCell className="text-right">
                  {u.role === "seller" &&
                    (u.is_active ? (
                      <Button size="sm" variant="outline" onClick={() => setDeactivating(u)}>
                        Деактивировать
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={limitReached || pending} onClick={() => setActive(u, true)}>
                        Активировать
                      </Button>
                    ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пригласить продавца</DialogTitle>
            <DialogDescription>На почту придёт ссылка: сотрудник задаст пароль и сможет войти.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(invite)} className="flex flex-col gap-4" noValidate>
            <Field label="ФИО" htmlFor="inv-name" required error={form.formState.errors.full_name?.message}>
              <Input id="inv-name" autoComplete="name" aria-invalid={!!form.formState.errors.full_name} {...form.register("full_name")} />
            </Field>
            <Field label="E-mail" htmlFor="inv-email" required error={form.formState.errors.email?.message}>
              <Input id="inv-email" type="email" inputMode="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
            </Field>
            <Field label="Телефон" htmlFor="inv-phone">
              <Input id="inv-phone" type="tel" inputMode="tel" {...form.register("phone")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={pending}>
                Отправить приглашение
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Деактивировать {deactivating?.full_name || deactivating?.email}?</DialogTitle>
            <DialogDescription>
              Сотрудник больше не сможет войти. Его заказы и история сохранятся.
              {deactivating && deactivating.clients > 0 && ` Клиентов за ним: ${deactivating.clients} — выберите, кому их передать.`}
            </DialogDescription>
          </DialogHeader>
          {deactivating && deactivating.clients > 0 && (
            <Field label="Передать клиентов" htmlFor="reassign">
              <NativeSelect id="reassign" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Владельцу (мне)</option>
                {activeOthers
                  .filter((r) => r.role === "seller")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name || r.email}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivating(null)}>
              Отмена
            </Button>
            <Button variant="destructive" loading={pending} onClick={() => deactivating && setActive(deactivating, false, reassignTo)}>
              Деактивировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
