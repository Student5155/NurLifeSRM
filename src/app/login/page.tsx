import type { Metadata } from "next";
import { Logo } from "@/components/common";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

const ERRORS: Record<string, string> = {
  inactive: "Учётная запись деактивирована. Обратитесь к владельцу.",
  link: "Ссылка недействительна или устарела. Попросите отправить приглашение ещё раз.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="ornament-field absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="arch rounded-b-lg border border-border bg-card px-6 pb-8 pt-10 shadow-2xl">
          <div className="mb-2 flex justify-center">
            <Logo className="scale-125" />
          </div>
          <div className="ornament-band my-5" aria-hidden />
          <h1 className="mb-1 text-center font-display text-2xl font-bold">Вход в систему</h1>
          <p className="mb-6 text-center text-sm text-muted-foreground">CRM для оптовой и розничной торговли</p>
          {error && ERRORS[error] && (
            <p role="alert" className="mb-4 rounded-md border border-destructive/60 px-3 py-2 text-sm">
              {ERRORS[error]}
            </p>
          )}
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
