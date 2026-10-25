"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PrintOrderData } from "@/lib/print-data";
import { downloadBlob } from "@/lib/xlsx";

/** Панель над печатной формой: печать, PDF, формат (A4 / 80 мм). При печати скрыта. */
export function PrintToolbar({ data, format, orderId }: { data: PrintOrderData; format: "a4" | "80mm"; orderId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = React.useState(false);

  function setFormat(f: "a4" | "80mm") {
    const sp = new URLSearchParams(params.toString());
    sp.set("format", f);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  async function pdf() {
    setBusy(true);
    try {
      const [{ pdf: render }, docs] = await Promise.all([import("@react-pdf/renderer"), import("./pdf-documents")]);
      docs.registerPdfFonts(window.location.origin);
      const element = format === "80mm" ? <docs.Receipt80Pdf data={data} /> : <docs.OrderPdf data={data} />;
      const blob = await render(element).toBlob();
      downloadBlob(blob, `${data.title} ${data.number}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Не удалось сформировать PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-4">
      <Button variant="outline" asChild className="bg-white text-black">
        <Link href={`/orders/${orderId}`}>
          <ArrowLeft aria-hidden /> К заказу
        </Link>
      </Button>
      {data.kind === "receipt" && (
        <div className="flex gap-1" role="group" aria-label="Формат">
          <Button variant={format === "a4" ? "default" : "outline"} className={format === "a4" ? "" : "bg-white text-black"} onClick={() => setFormat("a4")} aria-pressed={format === "a4"}>
            A4
          </Button>
          <Button variant={format === "80mm" ? "default" : "outline"} className={format === "80mm" ? "" : "bg-white text-black"} onClick={() => setFormat("80mm")} aria-pressed={format === "80mm"}>
            80 мм
          </Button>
        </div>
      )}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" className="bg-white text-black" onClick={pdf} loading={busy}>
          <Download aria-hidden /> PDF
        </Button>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden /> Печать
        </Button>
      </div>
    </div>
  );
}
