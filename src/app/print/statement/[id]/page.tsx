import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatementDocument, type StatementPrint } from "@/components/print/statement-document";
import { StatementToolbar } from "@/components/print/statement-toolbar";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { companyFrom } from "@/lib/print-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Акт сверки" };

export default async function PrintStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await requireSession();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.from && iso.test(sp.from) ? sp.from : `${todayISO().slice(0, 4)}-01-01`;
  const to = sp.to && iso.test(sp.to) ? sp.to : todayISO();

  const supabase = await createClient();
  const [{ data: statement }, { data: settings }] = await Promise.all([
    supabase.rpc("client_statement", { p_client_id: id, p_from: from, p_to: to }),
    supabase.from("settings").select("*").single(),
  ]);
  if (!statement || !settings) notFound();

  const data = {
    ...(statement as unknown as Omit<StatementPrint, "company" | "signer">),
    company: companyFrom(settings),
    signer: settings.director_name || session.profile.full_name,
  } as StatementPrint;
  if (!data.client) notFound();

  return (
    <>
      <StatementToolbar data={data} clientId={id} />
      <StatementDocument data={data} />
    </>
  );
}
