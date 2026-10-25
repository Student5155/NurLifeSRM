import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Role = Profile["role"];

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
  isOwner: boolean;
}

/** Текущий сотрудник (кэш на запрос). null — не вошёл или деактивирован. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;

  return { userId: user.id, email: user.email ?? "", profile, isOwner: profile.role === "owner" };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (!session.isOwner) redirect("/?error=forbidden");
  return session;
}
