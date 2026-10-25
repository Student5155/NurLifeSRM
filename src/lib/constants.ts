import type { Enums } from "@/lib/database.types";

export type OrderStatus = Enums<"order_status">;
export type PaymentStatus = Enums<"payment_status">;
export type PurchaseStatus = Enums<"purchase_status">;
export type PaymentMethod = Enums<"payment_method">;
export type ClientType = Enums<"client_type">;
export type MovementType = Enums<"movement_type">;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  assembled: "Собран",
  shipped: "Отгружен",
  paid: "Оплачен",
  cancelled: "Отменён",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = ["new", "confirmed", "assembled", "shipped", "paid", "cancelled"];

/** Варианты бейджа для статусов (см. components/ui/badge). */
export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "warning" | "gold" | "success" | "danger"> = {
  new: "neutral",
  confirmed: "info",
  assembled: "warning",
  shipped: "gold",
  paid: "success",
  cancelled: "danger",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Не оплачен",
  partial: "Частично",
  paid: "Оплачен",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, "danger" | "warning" | "success"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  draft: "Черновик",
  ordered: "Заказана",
  received: "Принята",
  cancelled: "Отменена",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  bank_transfer: "Безнал",
  online: "Онлайн",
};

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  wholesale: "Опт",
  retail: "Розница",
};

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  receipt: "Приход",
  reserve: "Резерв",
  unreserve: "Снятие резерва",
  write_off_sale: "Продажа",
  adjustment: "Корректировка",
  inventory: "Инвентаризация",
  return: "Возврат",
};

export const PRICE_SOURCE_LABEL: Record<string, string> = {
  client_price: "Индивидуальная",
  tier: "Оптовая ступень",
  wholesale: "Опт",
  retail: "Розница",
  manual: "Вручную",
};

export const MAX_SELLERS = 5;
export const MAX_PRODUCT_IMAGES = 10;
export const IMAGE_MAX_SIDE = 1600;
export const PRODUCT_IMAGES_BUCKET = "product-images";
