import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientsList, type ClientListRow } from "./clients-list";

export const metadata: Metadata = { title: "Клиенты" };

export default async function ClientsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: clients }, { data: overview }, { data: managers }] = await Promise.all([
    supabase.from("clients").select("id, type, name, legal_name, inn, phone, email, discount_percent, manager_id, is_active").order("name"),
    supabase.rpc("clients_overview"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const ov = new Map((overview ?? []).map((o) => [o.client_id, o]));
  const names = new Map((managers ?? []).map((m) => [m.id, m.full_name]));
  const rows: ClientListRow[] = (clients ?? []).map((c) => ({
    ...c,
    discount_percent: Number(c.discount_percent),
    manager_name: c.manager_id ? (names.get(c.manager_id) ?? "") : "",
    debt: Number(ov.get(c.id)?.debt ?? 0),
    overdue: Number(ov.get(c.id)?.overdue ?? 0),
    last_order_at: ov.get(c.id)?.last_order_at ?? null,
  }));

  return (
    <>
      <PageHeader title="Клиенты" description={`${rows.length} клиентов`} />
      <ClientsList rows={rows} managers={managers ?? []} currentUserId={session.userId} />
    </>
  );
}
