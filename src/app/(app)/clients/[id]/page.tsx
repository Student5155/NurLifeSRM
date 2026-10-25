import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Money, OrderStatusBadge, PageHeader, PaymentStatusBadge, Stat } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireSession } from "@/lib/auth";
import { CLIENT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../client-form";
import { ClientPrices } from "./client-prices";
import { Contacts } from "./contacts";
import { HistoryTable } from "./history-table";
import { Statement } from "./statement";

export const metadata: Metadata = { title: "Клиент" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: managers } = await supabase.from("profiles").select("id, full_name, is_active").order("full_name");

  if (id === "new") {
    return (
      <>
        <PageHeader title="Новый клиент" back={{ href: "/clients", label: "Клиенты" }} />
        <ClientForm managers={managers ?? []} isOwner={session.isOwner} currentUserId={session.userId} />
      </>
    );
  }

  const [{ data: client }, { data: contacts }, { data: prices }, { data: orders }, { data: payments }, { data: overview }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("client_contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }).order("name"),
      supabase.from("client_prices").select("id, product_id, price").eq("client_id", id),
      supabase
        .from("orders")
        .select("id, number, status, payment_status, total, paid_amount, created_at, shipped_at, due_date")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("id, amount, method, paid_at, comment, is_void, orders(number)")
        .eq("client_id", id)
        .eq("direction", "in")
        .order("paid_at", { ascending: false })
        .limit(200),
      supabase.rpc("clients_overview"),
    ]);
  if (!client) notFound();

  const productIds = (prices ?? []).map((p) => p.product_id);
  const { data: priceProducts } = productIds.length
    ? await supabase.from("catalog_items").select("id, sku, name, retail_price, wholesale_price").in("id", productIds)
    : { data: [] };
  const { data: history } = session.isOwner
    ? await supabase.from("audit_log").select("id, action, old_data, new_data, changed_by, created_at").eq("table_name", "clients").eq("record_id", id).order("created_at", { ascending: false }).limit(50)
    : { data: null };

  const ov = (overview ?? []).find((o) => o.client_id === id);
  const debt = Number(ov?.debt ?? 0);
  const overdue = Number(ov?.overdue ?? 0);
  const productMap = new Map((priceProducts ?? []).map((p) => [p.id!, p]));

  return (
    <>
      <PageHeader
        title={client.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={client.type === "wholesale" ? "gold" : "neutral"}>{CLIENT_TYPE_LABEL[client.type]}</Badge>
            {!client.is_active && <Badge tone="danger">Неактивен</Badge>}
            {client.phone}
          </span>
        }
        back={{ href: "/clients", label: "Клиенты" }}
        actions={
          <Button asChild>
            <Link href={`/orders/new?client=${client.id}`}>Новый заказ</Link>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={debt < 0 ? "Аванс" : "Долг"} value={formatMoney(Math.abs(debt))} tone={debt > 0 ? "danger" : debt < 0 ? "success" : undefined} />
        <Stat label="Просрочено" value={formatMoney(overdue)} tone={overdue > 0 ? "danger" : undefined} />
        <Stat label="Кредитный лимит" value={client.credit_limit === null ? "Без лимита" : formatMoney(client.credit_limit)} />
        <Stat label="Скидка / отсрочка" value={`${Number(client.discount_percent)}% · ${client.payment_terms_days} дн.`} />
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Карточка</TabsTrigger>
          <TabsTrigger value="contacts">Контакты</TabsTrigger>
          <TabsTrigger value="prices">Цены</TabsTrigger>
          <TabsTrigger value="orders">Заказы</TabsTrigger>
          <TabsTrigger value="payments">Платежи</TabsTrigger>
          <TabsTrigger value="statement">Акт сверки</TabsTrigger>
          {session.isOwner && <TabsTrigger value="history">История</TabsTrigger>}
        </TabsList>

        <TabsContent value="info">
          <ClientForm client={client} managers={managers ?? []} isOwner={session.isOwner} currentUserId={session.userId} />
        </TabsContent>

        <TabsContent value="contacts">
          <Contacts clientId={client.id} contacts={contacts ?? []} />
        </TabsContent>

        <TabsContent value="prices">
          <ClientPrices
            clientId={client.id}
            isOwner={session.isOwner}
            prices={(prices ?? []).map((p) => ({
              id: p.id,
              product_id: p.product_id,
              price: Number(p.price),
              sku: productMap.get(p.product_id)?.sku ?? "",
              name: productMap.get(p.product_id)?.name ?? "—",
              base: Number(client.type === "wholesale" ? productMap.get(p.product_id)?.wholesale_price : productMap.get(p.product_id)?.retail_price),
            }))}
          />
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Заказ</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="num">Сумма</TableHead>
                  <TableHead className="num hidden md:table-cell">Оплачено</TableHead>
                  <TableHead className="hidden md:table-cell">Срок оплаты</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Заказов нет
                    </TableCell>
                  </TableRow>
                )}
                {(orders ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">
                        {o.number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <OrderStatusBadge status={o.status} />
                        <PaymentStatusBadge status={o.payment_status} />
                      </div>
                    </TableCell>
                    <TableCell className="num">
                      <Money value={o.total} />
                    </TableCell>
                    <TableCell className="num hidden md:table-cell">
                      <Money value={o.paid_amount} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(o.due_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Дата</TableHead>
                  <TableHead>Способ</TableHead>
                  <TableHead className="hidden md:table-cell">Заказ / комментарий</TableHead>
                  <TableHead className="num">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Платежей нет
                    </TableCell>
                  </TableRow>
                )}
                {(payments ?? []).map((p) => (
                  <TableRow key={p.id} className={p.is_void ? "text-muted-foreground line-through" : undefined}>
                    <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {(p.orders as { number: string } | null)?.number ?? "Аванс"} {p.comment && `· ${p.comment}`}
                    </TableCell>
                    <TableCell className="num">{formatMoney(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="statement">
          <Statement clientId={client.id} clientName={client.name} />
        </TabsContent>

        {session.isOwner && (
          <TabsContent value="history">
            <HistoryTable rows={history ?? []} managers={managers ?? []} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
