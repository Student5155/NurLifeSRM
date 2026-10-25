import Link from "next/link";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="ornament-field absolute inset-0" aria-hidden />
      <div className="relative flex flex-col items-center gap-4">
        <Logo />
        <h1 className="font-display text-3xl font-bold">Страница не найдена</h1>
        <p className="text-muted-foreground">Возможно, запись удалена или ссылка устарела.</p>
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
