import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuickSale } from "./quick-sale";

export const metadata: Metadata = { title: "Быстрая продажа" };

export default async function SalePage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("cash_accounts").select("id, name, type").eq("is_active", true).order("name");
  return (
    <>
      <PageHeader title="Быстрая продажа" description="Розница: товар отгружается и оплачивается сразу" />
      <QuickSale isOwner={session.isOwner} accounts={accounts ?? []} />
    </>
  );
}
