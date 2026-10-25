import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { amountInWords } from "@/lib/amount-in-words";
import type { Database, Tables } from "@/lib/database.types";

export type PrintDocKind = "receipt" | "invoice" | "waybill";

export interface PrintCompany {
  company_name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  bank_name: string | null;
  bik: string | null;
  bank_account: string | null;
  corr_account: string | null;
  director_name: string | null;
}

export interface PrintLine {
  n: number;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
}

export interface PrintOrderData {
  kind: PrintDocKind;
  title: string;
  number: string;
  date: string;
  company: PrintCompany;
  sellerName: string;
  buyer: { name: string; legal_name: string | null; inn: string | null; kpp: string | null; phone: string | null; address: string | null } | null;
  deliveryAddress: string | null;
  dueDate: string | null;
  lines: PrintLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  paid: number;
  amountWords: string;
}

export const DOC_TITLE: Record<PrintDocKind, string> = {
  receipt: "Товарный чек",
  invoice: "Счёт на оплату",
  waybill: "Расходная накладная",
};

export function companyFrom(s: Tables<"settings">): PrintCompany {
  return {
    company_name: s.company_name,
    legal_name: s.legal_name,
    inn: s.inn,
    kpp: s.kpp,
    ogrn: s.ogrn,
    address: s.address,
    phone: s.phone,
    bank_name: s.bank_name,
    bik: s.bik,
    bank_account: s.bank_account,
    corr_account: s.corr_account,
    director_name: s.director_name,
  };
}

/** Данные для печатной формы заказа (с RLS текущего пользователя). */
export async function loadOrderPrintData(
  supabase: SupabaseClient<Database>,
  orderId: string,
  kind: PrintDocKind,
): Promise<PrintOrderData | null> {
  const [{ data: order }, { data: lines }, { data: settings }] = await Promise.all([
    supabase.from("orders").select("*, clients(name, legal_name, inn, kpp, phone, address)").eq("id", orderId).maybeSingle(),
    supabase.from("order_lines").select("*").eq("order_id", orderId),
    supabase.from("settings").select("*").single(),
  ]);
  if (!order || !settings) return null;

  const { data: manager } = order.manager_id
    ? await supabase.from("profiles").select("full_name").eq("id", order.manager_id).maybeSingle()
    : { data: null };

  const client = order.clients as PrintOrderData["buyer"];
  // Дата документа: чек и накладная — по отгрузке (если была), счёт — по созданию.
  const date = kind !== "invoice" && order.shipped_at ? order.shipped_at : order.created_at;

  return {
    kind,
    title: DOC_TITLE[kind],
    number: order.number,
    date,
    company: companyFrom(settings),
    sellerName: manager?.full_name ?? "",
    buyer: client,
    deliveryAddress: order.delivery_address,
    dueDate: order.due_date,
    lines: (lines ?? [])
      .sort((a, b) => (a.product_name ?? "").localeCompare(b.product_name ?? "", "ru"))
      .map((l, i) => ({
        n: i + 1,
        name: l.product_name ?? "",
        sku: l.sku ?? "",
        unit: l.unit_code ?? "",
        qty: Number(l.qty),
        price: Number(l.unit_price),
        discount: Number(l.discount_percent),
        total: Number(l.line_total),
      })),
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discount_total),
    total: Number(order.total),
    paid: Number(order.paid_amount),
    amountWords: amountInWords(Number(order.total)),
  };
}
