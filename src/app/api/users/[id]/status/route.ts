import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";

const schema = z.object({
  active: z.boolean(),
  reassignTo: z.string().uuid().nullable().optional(),
});

/**
 * Деактивация (с переназначением клиентов) или повторная активация
 * продавца. Профиль меняется от имени владельца (RLS + триггер лимита),
 * а вход блокируется в Supabase Auth (ban), чтобы сессия не продлевалась.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.isOwner) {
    return NextResponse.json({ error: "Только владелец может менять сотрудников" }, { status: 403 });
  }
  if (id === session.userId) {
    return NextResponse.json({ error: "Нельзя деактивировать себя" }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

  const supabase = await createClient();
  if (parsed.data.active) {
    const { error } = await supabase.from("profiles").update({ is_active: true }).eq("id", id);
    if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  } else {
    const { error } = await supabase.rpc("deactivate_user", {
      p_user_id: id,
      p_reassign_to: parsed.data.reassignTo ?? session.userId,
    });
    if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: parsed.data.active ? "none" : "876000h",
  });
  if (banError) {
    return NextResponse.json({ error: `Профиль обновлён, но вход не заблокирован: ${banError.message}` }, { status: 207 });
  }

  return NextResponse.json({ ok: true });
}
