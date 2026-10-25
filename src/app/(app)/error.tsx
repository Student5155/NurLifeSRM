"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Что-то пошло не так</h1>
      <p className="text-muted-foreground">Ошибка уже записана. Попробуйте ещё раз; если повторится — сообщите владельцу.</p>
      {error.digest && <p className="text-xs text-muted-foreground">Код: {error.digest}</p>}
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
