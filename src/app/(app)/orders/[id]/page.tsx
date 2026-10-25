import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Printer, Receipt, Truck } from "lucide-react";
import { InfoRow, Money, OrderStatusBadge, PageHeader, PaymentStatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PRICE_SOURCE_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, formatPercent, formatQty, todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Заказ" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: order }, { data: lines }, { data: history }, { data: allocations }, { data: accounts }, { data: profiles }] = await Promise.all([
    supabase.from("orders").select("*, clients(id, name, phone, inn, type, address)").eq("id", id).maybeSingle(),
    supabase.from("order_lines").select("*").eq("order_id", id),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase
      .from("payment_allocations")
      .select("id, amount, created_at, payments(id, paid_at, method, is_void, amount, comment)")
      .eq("order_id", id)
      .order("created_at"),
    supabase.from("cash_accounts").select("id, name, type").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (!order) notFound();

  const client = order.clients as { id: string; name: string; phone: string | null; inn: string | null; type: string; address: string | null } | null;
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const rest = Number(order.total) - Number(order.paid_amount);
  const overdue = order.status === "shipped" && order.due_date && order.due_date < todayISO();

  return (
    <>
      <PageHeader
        title={`Заказ ${order.number}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
            от {formatDateTime(order.created_at)}
          </span>
        }
        back={{ href: "/orders", label: "Заказы" }}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <OrderActions
          order={{
            id: order.id,
            number: order.number,
            status: order.status,
            client_id: order.client_id,
            rest,
            total: Number(order.total),
          }}
          isOwner={session.isOwner}
          accounts={accounts ?? []}
        />
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <Button variant="outline" asChild>
            <Link href={`/print/order/${order.id}?doc=receipt`} target="_blank">
              <Receipt aria-hidden /> Товарный чек
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/print/order/${order.id}?doc=invoice`} target="_blank">
              <FileText aria-hidden /> Счёт
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/print/order/${order.id}?doc=waybill`} target="_blank">
              <Truck aria-hidden /> Накладная
            </Link>
          </Button>
        </div>
      </div>

      {order.status === "cancelled" && order.cancel_reason && (
        <p className="mb-4 rounded-md border border-destructive/60 px-3 py-2 text-sm">Причина отмены: {order.cancel_reason}</p>
      )}

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
                  <TableHead className="num">Кол-во</TableHead>
                  <TableHead className="num">Цена</TableHead>
                  <TableHead className="num hidden md:table-cell">Скидка</TableHead>
                  <TableHead className="num">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lines ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link href={`/catalog/${l.product_id}`} className="block font-medium hover:text-primary">
                        {l.product_name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {l.sku} · {PRICE_SOURCE_LABEL[l.price_source ?? ""] ?? l.price_source}
                      </span>
                    </TableCell>
                    <TableCell className="num">
                      {formatQty(l.qty)} {l.unit_code}
                    </TableCell>
                    <TableCell className="num">{formatMoney(l.unit_price)}</TableCell>
                    <TableCell className="num hidden md:table-cell">{Number(l.discount_percent) ? formatPercent(l.discount_percent) : "—"}</TableCell>
                    <TableCell className="num font-medium">{formatMoney(l.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right text-muted-foreground">
                    Без скидки {formatMoney(order.subtotal)} · скидка {formatMoney(order.discount_total)}
                  </TableCell>
                  <TableCell className="num text-lg text-primary">{formatMoney(order.total)}</TableCell>
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
                <InfoRow label="Клиент">
                  {client ? (
                    <Link href={`/clients/${client.id}`} className="text-primary hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    "Розничный покупатель"
                  )}
                </InfoRow>
                {client?.phone && <InfoRow label="Телефон">{client.phone}</InfoRow>}
                <InfoRow label="Цены">{order.price_type === "wholesale" ? "Оптовые" : "Розничные"}</InfoRow>
                <InfoRow label="Менеджер">{order.manager_id ? names.get(order.manager_id) || "—" : "—"}</InfoRow>
                <InfoRow label="Адрес доставки">{order.delivery_address}</InfoRow>
                <InfoRow label="Подтверждён">{formatDateTime(order.confirmed_at)}</InfoRow>
                <InfoRow label="Отгружен">{formatDateTime(order.shipped_at)}</InfoRow>
                <InfoRow label="Срок оплаты">
                  <span className={overdue ? "font-semibold text-destructive" : undefined}>
                    {formatDate(order.due_date)}
                    {overdue && " — просрочен"}
                  </span>
                </InfoRow>
              </dl>
              {order.comment && <p className="mt-3 whitespace-pre-line text-sm">{order.comment}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Оплата</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="Сумма заказа">
                  <Money value={order.total} />
                </InfoRow>
                <InfoRow label="Оплачено">
                  <Money value={order.paid_amount} />
                </InfoRow>
                <InfoRow label="Осталось">
                  <Money value={Math.max(rest, 0)} className={rest > 0 ? "font-semibold text-destructive" : undefined} />
                </InfoRow>
              </dl>
              {(allocations ?? []).length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {(allocations ?? []).map((a) => {
                    const p = a.payments as { paid_at: string; method: PaymentMethod; is_void: boolean; amount: number; comment: string | null } | null;
                    return (
                      <li key={a.id} className={p?.is_void ? "text-muted-foreground line-through" : undefined}>
                        {p ? `${formatDate(p.paid_at)} · ${PAYMENT_METHOD_LABEL[p.method]}` : ""} — <span className="num">{formatMoney(a.amount)}</span>
                        {p && Number(p.amount) !== Number(a.amount) && <span className="text-xs text-muted-foreground"> (из {formatMoney(p.amount)})</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>История статусов</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2 text-sm">
                {(history ?? []).map((h) => (
                  <li key={h.id} className="border-l-2 border-primary/60 pl-3">
                    <span className="font-medium">
                      {h.from_status ? `${ORDER_STATUS_LABEL[h.from_status]} → ` : ""}
                      {ORDER_STATUS_LABEL[h.to_status]}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(h.created_at)} · {h.changed_by ? names.get(h.changed_by) || "—" : "Система"}
                    </span>
                    {h.comment && <span className="block text-xs">{h.comment}</span>}
                  </li>
                ))}
                {(history ?? []).length === 0 && <li className="text-muted-foreground">Заказ создан {formatDateTime(order.created_at)}</li>}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
