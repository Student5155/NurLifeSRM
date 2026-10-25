import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Настройки" };

export default async function SettingsPage() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data: settings }, { data: units }] = await Promise.all([
    supabase.from("settings").select("*").single(),
    supabase.from("units").select("*").order("code"),
  ]);

  return (
    <>
      <PageHeader title="Настройки" description="Реквизиты для печатных форм, лимит скидки продавцов, правила склада" />
      {settings ? <SettingsForm settings={settings} units={units ?? []} /> : <p>Строка настроек не найдена — примените миграции.</p>}
    </>
  );
}
