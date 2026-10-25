"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

/**
 * Обёртка для мутаций: блокирует повторный клик, показывает ошибку
 * на русском и обновляет серверные данные страницы.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async <T,>(fn: () => Promise<T>, opts?: { success?: string; refresh?: boolean }): Promise<T | undefined> => {
      setPending(true);
      try {
        const result = await fn();
        if (opts?.success) toast.success(opts.success);
        if (opts?.refresh !== false) router.refresh();
        return result;
      } catch (e) {
        toast.error(errorMessage(e instanceof Error ? e.message : e));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending };
}

/** Выбрасывает ошибку Supabase, если она есть. */
export function check<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw new Error(errorMessage(res.error));
  return res.data as NonNullable<T>;
}
