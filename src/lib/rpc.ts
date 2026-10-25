import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { errorMessage } from "@/lib/utils";

type Fn = Database["public"]["Functions"];

/**
 * Вызов rpc с понятной ошибкой на русском. Аргументы допускают null
 * (Postgres-функции принимают NULL, а сгенерированные типы — нет).
 */
export async function rpc<K extends keyof Fn>(
  supabase: SupabaseClient<Database>,
  name: K,
  args: { [P in keyof Fn[K]["Args"]]?: Fn[K]["Args"][P] | null },
): Promise<Fn[K]["Returns"]> {
  // Типы аргументов проверены сигнатурой выше; supabase-js не знает про NULL.
  const { data, error } = await (supabase.rpc as unknown as (
    n: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>)(name as string, args as Record<string, unknown>);
  if (error) throw new Error(errorMessage(error));
  return data as Fn[K]["Returns"];
}
