import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/set-password"];
const OWNER_PATHS = ["/settings", "/users", "/suppliers", "/purchases", "/audit", "/cash", "/stock/documents", "/stock/movements"];

function isPublic(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Обновляет сессию, пускает только активных сотрудников и закрывает
 * разделы владельца для продавцов. Данные дополнительно защищены RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Без generic-параметров у @supabase/ssr (см. client.ts), результат типизируем явно.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user) {
    if (isPublic(path)) return response;
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }
    return redirectTo(request, "/login", path !== "/" ? { next: path } : undefined);
  }

  if (path === "/set-password" || path.startsWith("/auth/")) return response;

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    const out = redirectTo(request, "/login", { error: "inactive" });
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
  }

  if (path === "/login") return redirectTo(request, "/");

  if (profile.role !== "owner" && OWNER_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return redirectTo(request, "/", { error: "forbidden" });
  }

  return response;
}
