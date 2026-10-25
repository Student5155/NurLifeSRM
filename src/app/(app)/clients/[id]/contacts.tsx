"use client";

import * as React from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { check, useAction } from "@/hooks/use-action";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type Contact = Tables<"client_contacts">;

const schema = z.object({
  name: z.string().trim().min(2, "Укажите имя"),
  position: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Некорректный e-mail"),
  telegram: z.string().trim(),
  is_primary: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function Contacts({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = React.useState<Contact | "new" | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const e = form.formState.errors;

  function open(c: Contact | "new") {
    setEditing(c);
    form.reset(
      c === "new"
        ? { name: "", position: "", phone: "", email: "", telegram: "", is_primary: contacts.length === 0 }
        : { name: c.name, position: c.position ?? "", phone: c.phone ?? "", email: c.email ?? "", telegram: c.telegram ?? "", is_primary: c.is_primary },
    );
  }

  async function save(v: Values) {
    const supabase = createClient();
    const row = {
      client_id: clientId,
      name: v.name,
      position: v.position || null,
      phone: v.phone || null,
      email: v.email || null,
      telegram: v.telegram || null,
      is_primary: v.is_primary,
    };
    const ok = await run(
      async () => {
        // Основной контакт один — снимаем отметку у остальных.
        if (v.is_primary) check(await supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId).eq("is_primary", true));
        if (editing === "new") check(await supabase.from("client_contacts").insert(row));
        else if (editing) check(await supabase.from("client_contacts").update(row).eq("id", editing.id));
        return true;
      },
      { success: "Контакт сохранён" },
    );
    if (ok) setEditing(null);
  }

  async function remove(c: Contact) {
    if (!confirm(`Удалить контакт «${c.name}»?`)) return;
    await run(async () => check(await createClient().from("client_contacts").delete().eq("id", c.id)), { success: "Контакт удалён" });
  }

  return (
    <>
      <div className="mb-3">
        <Button onClick={() => open("new")}>
          <Plus aria-hidden /> Контакт
        </Button>
      </div>
      {contacts.length === 0 ? (
        <p className="text-muted-foreground">Контактных лиц нет</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-2 pt-4 md:pt-5">
                  <div className="min-w-0 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {c.name}
                      {c.is_primary && (
                        <Badge tone="gold">
                          <Star className="size-3" aria-hidden /> Основной
                        </Badge>
                      )}
                    </p>
                    {c.position && <p className="text-muted-foreground">{c.position}</p>}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="block text-primary hover:underline">
                        {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="block text-primary hover:underline">
                        {c.email}
                      </a>
                    )}
                    {c.telegram && <p>Telegram: {c.telegram}</p>}
                  </div>
                  <div className="flex">
                    <Button size="icon" variant="ghost" onClick={() => open(c)} aria-label="Изменить">
                      <Pencil />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Удалить">
                      <Trash2 />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Новый контакт" : "Контакт"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Имя" htmlFor="ct-name" required error={e.name?.message} className="sm:col-span-2">
              <Input id="ct-name" {...form.register("name")} />
            </Field>
            <Field label="Должность" htmlFor="ct-position">
              <Input id="ct-position" {...form.register("position")} />
            </Field>
            <Field label="Телефон" htmlFor="ct-phone">
              <Input id="ct-phone" type="tel" inputMode="tel" {...form.register("phone")} />
            </Field>
            <Field label="E-mail" htmlFor="ct-email" error={e.email?.message}>
              <Input id="ct-email" type="email" inputMode="email" {...form.register("email")} />
            </Field>
            <Field label="Telegram" htmlFor="ct-telegram">
              <Input id="ct-telegram" {...form.register("telegram")} />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
              <Checkbox {...form.register("is_primary")} /> Основной контакт
            </label>
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
