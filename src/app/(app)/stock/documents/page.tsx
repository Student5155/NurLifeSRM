import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { NewDocumentButtons } from "./new-document-buttons";

export const metadata: Metadata = { title: "Корректировки и инвентаризация" };

export default async function StockDocumentsPage() {
  await requireOwner();
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("stock_adjustments")
    .select("id, number, type, status, reason, created_at, posted_at, stock_adjustment_items(count)")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <>
      <PageHeader
        title="Корректировки и инвентаризация"
        description="Черновик можно править; после проведения остатки меняются, документ закрывается"
        back={{ href: "/stock", label: "Склад" }}
        actions={<NewDocumentButtons />}
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Документ</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="hidden md:table-cell">Причина</TableHead>
              <TableHead className="num">Позиций</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(docs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Документов пока нет
                </TableCell>
              </TableRow>
            )}
            {(docs ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link href={`/stock/documents/${d.id}`} className="font-medium text-primary hover:underline">
                    {d.type === "inventory" ? "Инвентаризация" : "Корректировка"} {d.number}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(d.posted_at ?? d.created_at)}</span>
                </TableCell>
                <TableCell>{d.status === "posted" ? <Badge tone="success">Проведён</Badge> : <Badge tone="warning">Черновик</Badge>}</TableCell>
                <TableCell className="hidden md:table-cell">{d.reason ?? "—"}</TableCell>
                <TableCell className="num">{(d.stock_adjustment_items as unknown as { count: number }[])[0]?.count ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
