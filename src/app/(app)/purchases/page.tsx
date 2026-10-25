import type { Metadata } from "next";
import Link from "next/link";
import { Factory, Plus } from "lucide-react";
import { PageHeader, PurchaseStatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Закупки" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const { supplier } = await searchParams;
  await requireOwner();
  const supabase = await createClient();
  let q = supabase
    .from("purchases")
    .select("id, number, status, supplier_invoice, total, paid_amount, created_at, received_at, suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (supplier) q = q.eq("supplier_id", supplier);
  const { data: purchases } = await q;

  return (
    <>
      <PageHeader
        title="Закупки"
        description="Черновик → Заказана → Принята (полностью или частями)"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/suppliers">
                <Factory aria-hidden /> Поставщики
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/purchases/new?from=low">Из «Нужно заказать»</Link>
            </Button>
            <Button asChild>
              <Link href="/purchases/new">
                <Plus aria-hidden /> Закупка
              </Link>
            </Button>
          </>
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Закупка</TableHead>
              <TableHead>Поставщик</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="num">Сумма</TableHead>
              <TableHead className="num hidden md:table-cell">Оплачено</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(purchases ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Закупок пока нет
                </TableCell>
              </TableRow>
            )}
            {(purchases ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/purchases/${p.id}`} className="font-medium text-primary hover:underline">
                    {p.number}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(p.created_at)}
                    {p.supplier_invoice ? ` · счёт ${p.supplier_invoice}` : ""}
                  </span>
                </TableCell>
                <TableCell>{(p.suppliers as { name: string } | null)?.name}</TableCell>
                <TableCell>
                  <PurchaseStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="num">{formatMoney(p.total)}</TableCell>
                <TableCell className="num hidden md:table-cell">{formatMoney(p.paid_amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
