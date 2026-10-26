import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/** Клиент Supabase для серверных компонентов и Route Handlers (от имени пользователя, с RLS). */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  // Без generic-параметров у @supabase/ssr (см. client.ts), результат типизируем явно.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Вызов из серверного компонента: куки обновит middleware.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}

/**
 * Клиент с service role — обходит RLS. Только для Route Handlers владельца
 * (приглашение и блокировка сотрудников). Ключ никогда не попадает в браузер.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
