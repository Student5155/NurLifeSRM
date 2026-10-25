"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

export function NewDocumentButtons() {
  const router = useRouter();
  const { run, pending } = useAction();

  async function create(type: "adjustment" | "inventory") {
    const id = await run(() => rpc(createClient(), "save_stock_document", { p_id: null, p_payload: { type, items: [] } }), { refresh: false });
    if (id) router.push(`/stock/documents/${id}`);
  }

  return (
    <>
      <Button variant="outline" onClick={() => create("adjustment")} disabled={pending}>
        <SlidersHorizontal aria-hidden /> Корректировка
      </Button>
      <Button onClick={() => create("inventory")} disabled={pending}>
        <ClipboardList aria-hidden /> Инвентаризация
      </Button>
    </>
  );
}
