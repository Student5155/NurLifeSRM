import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SuppliersManager } from "./suppliers-manager";

export const metadata: Metadata = { title: "Поставщики" };

export default async function SuppliersPage() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data: suppliers }, { data: balances }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.rpc("supplier_balances"),
  ]);
  const b = new Map((balances ?? []).map((x) => [x.supplier_id, x]));
  return (
    <>
      <PageHeader title="Поставщики" back={{ href: "/purchases", label: "Закупки" }} />
      <SuppliersManager
        rows={(suppliers ?? []).map((s) => ({
          ...s,
          received: Number(b.get(s.id)?.received ?? 0),
          paid: Number(b.get(s.id)?.paid ?? 0),
          debt: Number(b.get(s.id)?.debt ?? 0),
        }))}
      />
    </>
  );
}
