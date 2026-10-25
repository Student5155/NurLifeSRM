import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoRow, PageHeader, PurchaseStatusBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PurchaseEditor } from "../purchase-editor";
import { PurchaseActions } from "./purchase-actions";

export const metadata: Metadata = { title: "Закупка" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwner();
  const supabase = await createClient();

  const [{ data: purchase }, { data: items }, { data: payments }, { data: suppliers }, { data: accounts }] = await Promise.all([
    supabase.from("purchases").select("*, suppliers(name, inn, phone)").eq("id", id).maybeSingle(),
    supabase.from("purchase_items").select("*, products(name, sku, units(code, is_fractional))").eq("purchase_id", id),
    supabase.from("payments").select("id, amount, method, paid_at, comment, is_void").eq("purchase_id", id).order("paid_at"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("cash_accounts").select("id, name, type").eq("is_active", true).order("name"),
  ]);
  if (!purchase) notFound();

  type Item = NonNullable<typeof items>[number] & { products: { name: string; sku: string; units: { code: string; is_fractional: boolean } | null } | null };
  const rows = (items ?? []) as unknown as Item[];
  const supplier = purchase.suppliers as { name: string; inn: string | null; phone: string | null } | null;
  const receivedValue = rows.reduce((a, i) => a + Number(i.qty_received) * Number(i.unit_cost), 0);

  return (
    <>
      <PageHeader
        title={`Закупка ${purchase.number}`}
        description={
          <span className="inline-flex items-center gap-2">
            <PurchaseStatusBadge status={purchase.status} /> {supplier?.name}
          </span>
        }
        back={{ href: "/purchases", label: "Закупки" }}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <PurchaseActions
          purchase={{ id: purchase.id, number: purchase.number, status: purchase.status, supplier_id: purchase.supplier_id, rest: Math.max(Number(purchase.total) - Number(purchase.paid_amount), 0) }}
          items={rows.map((i) => ({
            id: i.id,
            name: i.products?.name ?? "",
            unit_code: i.products?.units?.code ?? "",
            remaining: Number(i.qty) - Number(i.qty_received),
          }))}
          accounts={accounts ?? []}
          hasReceived={rows.some((i) => Number(i.qty_received) > 0)}
        />
      </div>

      {purchase.status === "draft" ? (
        <PurchaseEditor
          suppliers={suppliers ?? []}
          initial={{
            id: purchase.id,
            supplier_id: purchase.supplier_id,
            supplier_invoice: purchase.supplier_invoice ?? "",
            lines: rows.map((i) => ({
              key: i.id,
              product_id: i.product_id,
              name: i.products?.name ?? "",
              sku: i.products?.sku ?? "",
              unit_code: i.products?.units?.code ?? "",
              is_fractional: !!i.products?.units?.is_fractional,
              qty: String(i.qty),
              unit_cost: String(i.unit_cost),
            })),
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Товары</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Товар</TableHead>
                    <TableHead className="num">Заказано</TableHead>
                    <TableHead className="num">Принято</TableHead>
                    <TableHead className="num">Цена</TableHead>
                    <TableHead className="num">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <span className="block font-medium">{i.products?.name}</span>
                        <span className="block text-xs text-muted-foreground">{i.products?.sku}</span>
                      </TableCell>
                      <TableCell className="num">
                        {formatQty(i.qty)} {i.products?.units?.code}
                      </TableCell>
                      <TableCell className={Number(i.qty_received) < Number(i.qty) ? "num text-warning" : "num text-success"}>{formatQty(i.qty_received)}</TableCell>
                      <TableCell className="num">{formatMoney(i.unit_cost)}</TableCell>
                      <TableCell className="num">{formatMoney(i.line_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="text-right">
                      Итого
                    </TableCell>
                    <TableCell className="num">{formatMoney(purchase.total)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Детали</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <InfoRow label="Поставщик">{supplier?.name}</InfoRow>
                  <InfoRow label="Счёт поставщика">{purchase.supplier_invoice}</InfoRow>
                  <InfoRow label="Создана">{formatDateTime(purchase.created_at)}</InfoRow>
                  <InfoRow label="Принята полностью">{formatDateTime(purchase.received_at)}</InfoRow>
                  <InfoRow label="Принято товара на">{formatMoney(receivedValue)}</InfoRow>
                  <InfoRow label="Оплачено">{formatMoney(purchase.paid_amount)}</InfoRow>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Оплаты поставщику</CardTitle>
              </CardHeader>
              <CardContent>
                {(payments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Оплат нет</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {(payments ?? []).map((p) => (
                      <li key={p.id} className={p.is_void ? "text-muted-foreground line-through" : undefined}>
                        {formatDate(p.paid_at)} · {PAYMENT_METHOD_LABEL[p.method]} — <span className="num">{formatMoney(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
