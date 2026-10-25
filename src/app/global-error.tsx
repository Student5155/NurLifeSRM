"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ background: "#0B0B0B", color: "#F5F0E1", fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1>Ошибка приложения</h1>
        <p>Обновите страницу. Если ошибка повторяется, сообщите владельцу.</p>
      </body>
    </html>
  );
}
