"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { check, useAction } from "@/hooks/use-action";
import type { Tables } from "@/lib/database.types";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

const optionalDigits = (lengths: number[], label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && lengths.includes(v.length)), `${label}: ${lengths.join(" или ")} цифр`);

const schema = z.object({
  type: z.enum(["wholesale", "retail"]),
  name: z.string().trim().min(2, "Укажите имя или название"),
  legal_name: z.string().trim(),
  inn: optionalDigits([10, 12], "ИНН"),
  kpp: optionalDigits([9], "КПП"),
  phone: z.string().trim().max(32),
  email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Некорректный e-mail"),
  address: z.string().trim(),
  discount_percent: z.coerce.number({ invalid_type_error: "Число" }).min(0, "0–100").max(100, "0–100"),
  credit_limit: z.string().trim().refine((v) => v === "" || (Number(v.replace(",", ".")) >= 0 && !Number.isNaN(Number(v.replace(",", ".")))), "Число ≥ 0 или пусто"),
  payment_terms_days: z.coerce.number({ invalid_type_error: "Число" }).int("Целое число").min(0).max(365, "До 365 дней"),
  manager_id: z.string(),
  notes: z.string().trim(),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function ClientForm({
  client,
  managers,
  isOwner,
  currentUserId,
}: {
  client?: Tables<"clients">;
  managers: { id: string; full_name: string; is_active: boolean }[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: client?.type ?? "retail",
      name: client?.name ?? "",
      legal_name: client?.legal_name ?? "",
      inn: client?.inn ?? "",
      kpp: client?.kpp ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      discount_percent: client ? Number(client.discount_percent) : 0,
      credit_limit: client?.credit_limit !== null && client?.credit_limit !== undefined ? String(client.credit_limit) : "",
      payment_terms_days: client?.payment_terms_days ?? 0,
      manager_id: client ? (client.manager_id ?? "") : currentUserId,
      notes: client?.notes ?? "",
      is_active: client?.is_active ?? true,
    },
  });
  const e = form.formState.errors;
  const type = form.watch("type");

  async function onSubmit(v: Values) {
    const supabase = createClient();

    // Проверка дублей по телефону и ИНН
    if (v.phone || v.inn) {
      const dups = await rpc(supabase, "find_client_duplicates", { p_phone: v.phone || null, p_inn: v.inn || null, p_exclude: client?.id ?? null }).catch(
        () => [],
      );
      if (dups.length > 0) {
        const list = dups.map((d) => `• ${d.name}${d.phone ? `, ${d.phone}` : ""}${d.inn ? `, ИНН ${d.inn}` : ""}`).join("\n");
        if (!confirm(`Похожие клиенты уже есть:\n${list}\n\nВсё равно сохранить?`)) return;
      }
    }

    const row = {
      type: v.type,
      name: v.name,
      legal_name: v.legal_name || null,
      inn: v.inn || null,
      kpp: v.kpp || null,
      phone: v.phone || null,
      email: v.email || null,
      address: v.address || null,
      manager_id: v.manager_id || null,
      notes: v.notes || null,
      is_active: v.is_active,
      // Скидку, лимит и отсрочку меняет только владелец (проверяется и в БД).
      ...(isOwner
        ? {
            discount_percent: v.discount_percent,
            credit_limit: v.credit_limit === "" ? null : Number(v.credit_limit.replace(",", ".")),
            payment_terms_days: v.payment_terms_days,
          }
        : {}),
    };

    const id = await run(
      async () => {
        if (client) {
          check(await supabase.from("clients").update(row).eq("id", client.id));
          return client.id;
        }
        return check(await supabase.from("clients").insert(row).select("id").single()).id;
      },
      { success: "Клиент сохранён" },
    );
    if (id && !client) router.replace(`/clients/${id}`);
  }

  async function remove() {
    if (!client || !confirm(`Удалить клиента «${client.name}»? Клиента с заказами удалить нельзя — сделайте его неактивным.`)) return;
    const ok = await run(async () => check(await createClient().from("clients").delete().eq("id", client.id)), { refresh: false });
    if (ok !== undefined) {
      toast.success("Клиент удалён");
      router.replace("/clients");
      router.refresh();
    }
  }

  const txt = (name: keyof Values, label: string, opts?: { inputMode?: "numeric" | "tel" | "email"; type?: string; required?: boolean; className?: string }) => (
    <Field label={label} htmlFor={`c-${name}`} error={e[name]?.message} required={opts?.required} className={opts?.className}>
      <Input id={`c-${name}`} type={opts?.type} inputMode={opts?.inputMode} aria-invalid={!!e[name]} {...form.register(name)} />
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Основное</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Тип" htmlFor="c-type">
            <NativeSelect id="c-type" {...form.register("type")}>
              <option value="retail">Розница</option>
              <option value="wholesale">Опт</option>
            </NativeSelect>
          </Field>
          {txt("name", "Имя / название", { required: true })}
          {txt("phone", "Телефон", { inputMode: "tel", type: "tel" })}
          {txt("email", "E-mail", { inputMode: "email", type: "email" })}
          {txt("address", "Адрес доставки", { className: "md:col-span-2" })}
          <Field label="Менеджер" htmlFor="c-manager">
            <NativeSelect id="c-manager" {...form.register("manager_id")}>
              <option value="">Не назначен</option>
              {managers
                .filter((m) => m.is_active || m.id === client?.manager_id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || "Без имени"}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <label className="flex min-h-11 items-center gap-3 self-end text-sm">
            <Checkbox {...form.register("is_active")} /> Активный клиент
          </label>
        </CardContent>
      </Card>

      {(type === "wholesale" || client?.inn) && (
        <Card>
          <CardHeader>
            <CardTitle>Реквизиты</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {txt("legal_name", "Юридическое название", { className: "md:col-span-3" })}
            {txt("inn", "ИНН", { inputMode: "numeric" })}
            {txt("kpp", "КПП", { inputMode: "numeric" })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Условия</CardTitle>
          {!isOwner && <CardDescription>Скидку, кредитный лимит и отсрочку устанавливает владелец.</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Скидка клиента, %" htmlFor="c-discount_percent" error={e.discount_percent?.message}>
            <Input id="c-discount_percent" type="number" step="0.01" min={0} max={100} inputMode="decimal" disabled={!isOwner} {...form.register("discount_percent")} />
          </Field>
          <Field label="Кредитный лимит, ₽" htmlFor="c-credit_limit" error={e.credit_limit?.message} hint="Пусто — без ограничения">
            <Input id="c-credit_limit" inputMode="decimal" disabled={!isOwner} {...form.register("credit_limit")} />
          </Field>
          <Field label="Отсрочка платежа, дней" htmlFor="c-payment_terms_days" error={e.payment_terms_days?.message}>
            <Input id="c-payment_terms_days" type="number" min={0} max={365} inputMode="numeric" disabled={!isOwner} {...form.register("payment_terms_days")} />
          </Field>
          <Field label="Заметки" htmlFor="c-notes" className="md:col-span-3">
            <Textarea id="c-notes" {...form.register("notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        {client && isOwner ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
            Удалить клиента
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" loading={pending}>
          {client ? "Сохранить" : "Создать клиента"}
        </Button>
      </div>
    </form>
  );
}
