import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireOwner } from "@/lib/auth";
import { MAX_SELLERS } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { UsersManager, type UserRow } from "./users-manager";

export const metadata: Metadata = { title: "Сотрудники" };

export default async function UsersPage() {
  await requireOwner();
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");

  // E-mail и дата последнего входа есть только в Auth — читаем сервисным ключом на сервере.
  const emails = new Map<string, { email: string; last: string | null; confirmed: boolean }>();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    for (const u of data.users) {
      emails.set(u.id, { email: u.email ?? "", last: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at });
    }
  } catch {
    // Без service role ключа список покажем без e-mail.
  }

  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
  const { data: clientCounts } = await supabase.from("clients").select("manager_id");

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    phone: p.phone,
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    email: emails.get(p.id)?.email ?? "",
    last_sign_in_at: emails.get(p.id)?.last ?? null,
    invited: emails.has(p.id) && !emails.get(p.id)?.confirmed,
    clients: (clientCounts ?? []).filter((c) => c.manager_id === p.id).length,
  }));

  const activeSellers = rows.filter((r) => r.role === "seller" && r.is_active).length;

  return (
    <>
      <PageHeader
        title="Сотрудники"
        description={`Активных продавцов: ${activeSellers} из ${MAX_SELLERS}. Всего клиентов: ${count ?? 0}.`}
      />
      <UsersManager rows={rows} activeSellers={activeSellers} />
    </>
  );
}
