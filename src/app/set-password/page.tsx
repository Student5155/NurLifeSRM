"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "Не менее 8 символов"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Пароли не совпадают" });
type Values = z.infer<typeof schema>;

export default function SetPasswordPage() {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit({ password }: Values) {
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Пароль сохранён");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="ornament-field absolute inset-0" aria-hidden />
      <div className="arch relative w-full max-w-sm rounded-b-lg border border-border bg-card px-6 pb-8 pt-10">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <h1 className="mb-6 text-center font-display text-2xl font-bold">Новый пароль</h1>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Пароль" htmlFor="password" error={errors.password?.message} hint="Не менее 8 символов">
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
          </Field>
          <Field label="Повторите пароль" htmlFor="confirm" error={errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
          </Field>
          <Button type="submit" loading={isSubmitting}>
            Сохранить
          </Button>
        </form>
      </div>
    </div>
  );
}
