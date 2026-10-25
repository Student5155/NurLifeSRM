"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { downloadBlob } from "@/lib/xlsx";
import type { StatementPrint } from "./statement-document";

export function StatementToolbar({ data, clientId }: { data: StatementPrint; clientId: string }) {
  const [busy, setBusy] = React.useState(false);

  async function pdf() {
    setBusy(true);
    try {
      const [{ pdf: render }, docs, sdoc] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf-documents"),
        import("./statement-pdf"),
      ]);
      docs.registerPdfFonts(window.location.origin);
      const blob = await render(<sdoc.StatementPdf data={data} />).toBlob();
      downloadBlob(blob, `Акт сверки ${data.client.name} ${formatDate(data.from)}-${formatDate(data.to)}.pdf`);
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
        <Link href={`/clients/${clientId}`}>
          <ArrowLeft aria-hidden /> К клиенту
        </Link>
      </Button>
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
