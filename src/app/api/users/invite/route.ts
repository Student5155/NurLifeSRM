import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { MAX_SELLERS } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный e-mail"),
  full_name: z.string().trim().min(2, "Укажите ФИО"),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
});

/** Приглашение продавца (только owner). Service role используется только здесь, на сервере. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.isOwner) {
    return NextResponse.json({ error: "Только владелец может приглашать сотрудников" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Неверные данные" }, { status: 400 });
  }

  // Быстрая проверка лимита (окончательная — триггер enforce_seller_limit в БД).
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "seller")
    .eq("is_active", true);
  if ((count ?? 0) >= MAX_SELLERS) {
    return NextResponse.json({ error: `Достигнут лимит: ${MAX_SELLERS} активных продавцов` }, { status: 409 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name, phone: parsed.data.phone || null },
    redirectTo: `${origin}/auth/confirm?next=/set-password`,
  });

  if (error) {
    const message = /limit|продавцов/i.test(error.message)
      ? `Достигнут лимит: ${MAX_SELLERS} активных продавцов`
      : /already/i.test(error.message)
        ? "Пользователь с таким e-mail уже есть"
        : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id });
}
