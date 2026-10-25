"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { check, useAction } from "@/hooks/use-action";
import type { Tables } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Row = Tables<"suppliers"> & { received: number; paid: number; debt: number };

const schema = z.object({
  name: z.string().trim().min(2, "Укажите название"),
  inn: z.string().trim().refine((v) => v === "" || /^\d{10}(\d{2})?$/.test(v), "ИНН: 10 или 12 цифр"),
  contact_name: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim(),
  payment_terms_days: z.coerce.number({ invalid_type_error: "Число" }).int().min(0).max(365),
  notes: z.string().trim(),
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function SuppliersManager({ rows }: { rows: Row[] }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = React.useState<Row | "new" | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const e = form.formState.errors;

  function open(r: Row | "new") {
    setEditing(r);
    form.reset(
      r === "new"
        ? { name: "", inn: "", contact_name: "", phone: "", email: "", payment_terms_days: 0, notes: "", is_active: true }
        : {
            name: r.name,
            inn: r.inn ?? "",
            contact_name: r.contact_name ?? "",
            phone: r.phone ?? "",
            email: r.email ?? "",
            payment_terms_days: r.payment_terms_days,
            notes: r.notes ?? "",
            is_active: r.is_active,
          },
    );
  }

  async function save(v: Values) {
    const row = {
      name: v.name,
      inn: v.inn || null,
      contact_name: v.contact_name || null,
      phone: v.phone || null,
      email: v.email || null,
      payment_terms_days: v.payment_terms_days,
      notes: v.notes || null,
      is_active: v.is_active,
    };
    const supabase = createClient();
    const ok = await run(
      async () => {
        if (editing === "new") check(await supabase.from("suppliers").insert(row));
        else if (editing) check(await supabase.from("suppliers").update(row).eq("id", editing.id));
        return true;
      },
      { success: "Поставщик сохранён" },
    );
    if (ok) setEditing(null);
  }

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Поставщик",
      cell: ({ row }) => (
        <div>
          <span className="block font-medium">{row.original.name}</span>
          <span className="block text-xs text-muted-foreground">{[row.original.contact_name, row.original.phone].filter(Boolean).join(" · ")}</span>
        </div>
      ),
    },
    { accessorKey: "received", header: "Принято товара", meta: { className: "num" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { accessorKey: "paid", header: "Оплачено", meta: { className: "num" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    {
      accessorKey: "debt",
      header: "Наш долг",
      meta: { className: "num" },
      cell: ({ getValue }) => <span className={(getValue() as number) > 0 ? "font-semibold text-destructive" : undefined}>{formatMoney(getValue() as number)}</span>,
    },
    { id: "state", header: "", cell: ({ row }) => (!row.original.is_active ? <Badge tone="danger">Неактивен</Badge> : null) },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Название, ИНН, контакт"
        searchKeys={["name", "inn", "contact_name", "phone"]}
        onRowClick={(r) => open(r)}
        renderCard={(r) => (
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.phone}</p>
            </div>
            <span className={r.debt > 0 ? "num font-semibold text-destructive" : "num"}>{formatMoney(r.debt)}</span>
          </div>
        )}
        toolbar={
          <Button size="sm" onClick={() => open("new")}>
            <Plus aria-hidden /> Поставщик
          </Button>
        }
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Новый поставщик" : "Поставщик"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Название" htmlFor="s-name" required error={e.name?.message} className="sm:col-span-2">
              <Input id="s-name" {...form.register("name")} />
            </Field>
            <Field label="ИНН" htmlFor="s-inn" error={e.inn?.message}>
              <Input id="s-inn" inputMode="numeric" {...form.register("inn")} />
            </Field>
            <Field label="Отсрочка, дней" htmlFor="s-terms" error={e.payment_terms_days?.message}>
              <Input id="s-terms" type="number" min={0} {...form.register("payment_terms_days")} />
            </Field>
            <Field label="Контактное лицо" htmlFor="s-contact">
              <Input id="s-contact" {...form.register("contact_name")} />
            </Field>
            <Field label="Телефон" htmlFor="s-phone">
              <Input id="s-phone" type="tel" {...form.register("phone")} />
            </Field>
            <Field label="E-mail" htmlFor="s-email" className="sm:col-span-2">
              <Input id="s-email" type="email" {...form.register("email")} />
            </Field>
            <Field label="Заметки" htmlFor="s-notes" className="sm:col-span-2">
              <Textarea id="s-notes" {...form.register("notes")} />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox {...form.register("is_active")} /> Активен
            </label>
            {editing && editing !== "new" && (
              <Link href={`/purchases?supplier=${editing.id}`} className="self-center text-sm text-primary hover:underline">
                Закупки поставщика
              </Link>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={pending}>
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
