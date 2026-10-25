"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().trim().email("Введите корректный e-mail"),
  password: z.string().min(1, "Введите пароль"),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [resetMode, setResetMode] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Неверный e-mail или пароль" : error.message);
      return;
    }
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(target);
    router.refresh();
  }

  async function sendReset() {
    const email = form.getValues("email");
    if (!z.string().email().safeParse(email).success) {
      form.setError("email", { message: "Введите e-mail, на который придёт ссылка" });
      return;
    }
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/set-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Ссылка для смены пароля отправлена на почту");
    setResetMode(false);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...form.register("email")}
        />
      </Field>
      {!resetMode && (
        <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
        </Field>
      )}
      {resetMode ? (
        <>
          <Button type="button" onClick={sendReset}>
            Отправить ссылку
          </Button>
          <Button type="button" variant="ghost" onClick={() => setResetMode(false)}>
            Назад ко входу
          </Button>
        </>
      ) : (
        <>
          <Button type="submit" loading={isSubmitting}>
            Войти
          </Button>
          <Button type="button" variant="link" className="self-center" onClick={() => setResetMode(true)}>
            Забыли пароль?
          </Button>
        </>
      )}
    </form>
  );
}
