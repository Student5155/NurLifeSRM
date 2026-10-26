"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let client: SupabaseClient<Database> | undefined;

/** Клиент Supabase для браузера (одна сессия на вкладку). */
export function createClient(): SupabaseClient<Database> {
  if (!client) {
    // Без generic-параметров у @supabase/ssr: его типы могут не совпадать
    // с версией supabase-js, поэтому типизируем результат явно.
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ) as unknown as SupabaseClient<Database>;
  }
  return client;
}
