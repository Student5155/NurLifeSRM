import type { Json } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";

const FIELD_LABELS: Record<string, string> = {
  name: "Название",
  sku: "Артикул",
  barcode: "Штрихкод",
  retail_price: "Розничная цена",
  wholesale_price: "Оптовая цена",
  purchase_price: "Закупочная цена",
  min_stock: "Мин. остаток",
  is_active: "Активен",
  category_id: "Категория",
  unit_id: "Единица",
  description: "Описание",
  price: "Цена",
  min_qty: "От количества",
  discount_percent: "Скидка, %",
  credit_limit: "Кредитный лимит",
  payment_terms_days: "Отсрочка, дней",
  manager_id: "Менеджер",
  phone: "Телефон",
  email: "E-mail",
  inn: "ИНН",
  kpp: "КПП",
  address: "Адрес",
  legal_name: "Юр. название",
  type: "Тип",
  notes: "Заметки",
  status: "Статус",
  payment_status: "Оплата",
  total: "Сумма",
  paid_amount: "Оплачено",
  is_void: "Сторно",
  amount: "Сумма",
  qty: "Количество",
  unit_price: "Цена",
  role: "Роль",
  full_name: "ФИО",
  seller_max_discount: "Лимит скидки продавца",
  allow_negative_stock: "Отрицательные остатки",
  reason: "Причина",
  comment: "Комментарий",
  cancel_reason: "Причина отмены",
};

const HIDDEN = new Set(["id", "created_at", "updated_at"]);

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Изменённые поля записи журнала аудита: «было → стало». */
export function changedFields(oldData: Json | null, newData: Json | null) {
  const o = (oldData ?? {}) as Record<string, unknown>;
  const n = (newData ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter((k) => !HIDDEN.has(k));
  return keys
    .filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    .map((k) => ({ key: k, label: FIELD_LABELS[k] ?? k, from: show(o[k]), to: show(n[k]) }));
}

export const ACTION_LABEL: Record<string, string> = { INSERT: "Создание", UPDATE: "Изменение", DELETE: "Удаление" };

export function AuditDiff({ action, oldData, newData }: { action: string; oldData: Json | null; newData: Json | null }) {
  const fields = changedFields(action === "INSERT" ? null : oldData, action === "DELETE" ? null : newData);
  if (action === "INSERT") {
    const n = (newData ?? {}) as Record<string, unknown>;
    return <span className="text-sm">{show(n.name ?? n.number ?? n.sku ?? "запись")}</span>;
  }
  if (action === "DELETE") {
    const o = (oldData ?? {}) as Record<string, unknown>;
    return <span className="text-sm">{show(o.name ?? o.number ?? o.sku ?? "запись")}</span>;
  }
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {fields.map((f) => (
        <li key={f.key}>
          <span className="text-muted-foreground">{f.label}:</span> <del className="text-muted-foreground">{f.from}</del> → <ins className="no-underline">{f.to}</ins>
        </li>
      ))}
    </ul>
  );
}

export function auditTime(value: string) {
  return formatDateTime(value);
}
