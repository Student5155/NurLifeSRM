import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
import { requireSession } from "@/lib/auth";
import { OrderEditor } from "../order-editor";

export const metadata: Metadata = { title: "Новый заказ" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const session = await requireSession();
  const { client } = await searchParams;
  return (
    <>
      <PageHeader title="Новый заказ" back={{ href: "/orders", label: "Заказы" }} />
      <OrderEditor isOwner={session.isOwner} presetClientId={client} />
    </>
  );
}
