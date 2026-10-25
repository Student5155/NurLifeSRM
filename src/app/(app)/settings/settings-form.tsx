"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { check, useAction } from "@/hooks/use-action";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

const digits = (len: number[], label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && len.includes(v.length)), `${label}: ${len.join(" или ")} цифр`);

const schema = z.object({
  company_name: z.string().trim().min(1, "Укажите название"),
  legal_name: z.string().trim(),
  inn: digits([10, 12], "ИНН"),
  kpp: digits([9], "КПП"),
  ogrn: digits([13, 15], "ОГРН/ОГРНИП"),
  address: z.string().trim(),
  phone: z.string().trim(),
  director_name: z.string().trim(),
  bank_name: z.string().trim(),
  bik: digits([9], "БИК"),
  bank_account: digits([20], "Расчётный счёт"),
  corr_account: digits([20], "Корр. счёт"),
  seller_max_discount: z.coerce.number({ invalid_type_error: "Введите число" }).min(0, "От 0 до 100").max(100, "От 0 до 100"),
  allow_negative_stock: z.boolean(),
  low_stock_notify: z.boolean(),
});
type Values = z.infer<typeof schema>;

const empty = (v: string) => (v.trim() === "" ? null : v.trim());

export function SettingsForm({ settings, units }: { settings: Tables<"settings">; units: Tables<"units">[] }) {
  const { run, pending } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: settings.company_name,
      legal_name: settings.legal_name ?? "",
      inn: settings.inn ?? "",
      kpp: settings.kpp ?? "",
      ogrn: settings.ogrn ?? "",
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      director_name: settings.director_name ?? "",
      bank_name: settings.bank_name ?? "",
      bik: settings.bik ?? "",
      bank_account: settings.bank_account ?? "",
      corr_account: settings.corr_account ?? "",
      seller_max_discount: Number(settings.seller_max_discount),
      allow_negative_stock: settings.allow_negative_stock,
      low_stock_notify: settings.low_stock_notify,
    },
  });
  const e = form.formState.errors;

  async function onSubmit(v: Values) {
    await run(
      async () =>
        check(
          await createClient()
            .from("settings")
            .update({
              company_name: v.company_name,
              legal_name: empty(v.legal_name),
              inn: empty(v.inn),
              kpp: empty(v.kpp),
              ogrn: empty(v.ogrn),
              address: empty(v.address),
              phone: empty(v.phone),
              director_name: empty(v.director_name),
              bank_name: empty(v.bank_name),
              bik: empty(v.bik),
              bank_account: empty(v.bank_account),
              corr_account: empty(v.corr_account),
              seller_max_discount: v.seller_max_discount,
              allow_negative_stock: v.allow_negative_stock,
              low_stock_notify: v.low_stock_notify,
            })
            .eq("id", true),
        ),
      { success: "Настройки сохранены" },
    );
  }

  const text = (name: keyof Values, label: string, opts?: { hint?: string; inputMode?: "numeric" | "tel"; required?: boolean }) => (
    <Field label={label} htmlFor={name} error={e[name]?.message} hint={opts?.hint} required={opts?.required}>
      <Input id={name} inputMode={opts?.inputMode} aria-invalid={!!e[name]} {...form.register(name)} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Продажи и склад</CardTitle>
            <CardDescription>Правила, которые проверяются и в интерфейсе, и в базе данных.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field
              label="Максимальная скидка продавца, %"
              htmlFor="seller_max_discount"
              error={e.seller_max_discount?.message}
              hint="Включает ручное снижение цены. Скидки клиентов из карточки не учитываются. Владелец — без ограничений."
            >
              <Input id="seller_max_discount" type="number" step="0.01" min={0} max={100} inputMode="decimal" {...form.register("seller_max_discount")} />
            </Field>
            <div className="flex flex-col gap-3 pt-6">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox {...form.register("allow_negative_stock")} />
                Разрешить отгрузку при нехватке товара (отрицательный остаток)
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox {...form.register("low_stock_notify")} />
                Ежедневное уведомление о низких остатках
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Реквизиты компании</CardTitle>
            <CardDescription>Печатаются в товарном чеке, счёте и накладной.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {text("company_name", "Название (коротко)", { required: true })}
            {text("legal_name", "Полное наименование", { hint: "ИП Иванов Иван Иванович или ООО «Нур Лайф»" })}
            {text("inn", "ИНН", { inputMode: "numeric" })}
            {text("kpp", "КПП", { inputMode: "numeric", hint: "Только для ООО" })}
            {text("ogrn", "ОГРН / ОГРНИП", { inputMode: "numeric" })}
            {text("phone", "Телефон", { inputMode: "tel" })}
            {text("address", "Адрес")}
            {text("director_name", "Руководитель / ИП", { hint: "Для подписи в документах" })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Банк</CardTitle>
            <CardDescription>Для счёта на оплату.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {text("bank_name", "Банк")}
            {text("bik", "БИК", { inputMode: "numeric" })}
            {text("bank_account", "Расчётный счёт", { inputMode: "numeric" })}
            {text("corr_account", "Корр. счёт", { inputMode: "numeric" })}
          </CardContent>
        </Card>

        <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
          <Button type="submit" size="lg" loading={pending}>
            Сохранить настройки
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Единицы измерения</CardTitle>
          <CardDescription>Для «дробных» единиц можно продавать нецелое количество (например, 1,5 кг).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Код</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Дробная</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.code}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.is_fractional ? "Да" : "Нет"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
