/**
 * Расчёт цены — та же логика, что в Postgres (_calc_price,
 * _check_seller_discount, _line_total). Интерфейс считает заранее,
 * база перепроверяет при сохранении.
 *
 * Автоцена: индивидуальная цена клиента → оптовая ступень по количеству
 * (только для опта) → базовая опт/розница → скидка клиента
 * (к индивидуальной цене скидка клиента не применяется).
 */

export type PriceType = "wholesale" | "retail";
export type PriceSource = "client_price" | "tier" | "wholesale" | "retail" | "manual";

export interface PricingProduct {
  retail_price: number;
  wholesale_price: number;
  tiers?: { min_qty: number; price: number }[];
}

export interface PricingClient {
  discount_percent: number;
  /** product_id → индивидуальная цена */
  prices?: Record<string, number>;
}

export interface AutoPrice {
  unitPrice: number;
  source: Exclude<PriceSource, "manual">;
  discountPercent: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function autoPrice(
  productId: string,
  product: PricingProduct,
  qty: number,
  priceType: PriceType,
  client?: PricingClient | null,
): AutoPrice {
  const individual = client?.prices?.[productId];
  if (individual !== undefined && individual !== null) {
    return { unitPrice: Number(individual), source: "client_price", discountPercent: 0 };
  }

  const discount = Number(client?.discount_percent ?? 0);

  if (priceType === "wholesale" && product.tiers?.length) {
    const tier = [...product.tiers]
      .filter((t) => Number(t.min_qty) <= qty)
      .sort((a, b) => Number(b.min_qty) - Number(a.min_qty))[0];
    if (tier) return { unitPrice: Number(tier.price), source: "tier", discountPercent: discount };
  }

  return {
    unitPrice: Number(priceType === "wholesale" ? product.wholesale_price : product.retail_price),
    source: priceType,
    discountPercent: discount,
  };
}

/** Сумма строки до копеек: qty × цена × (1 − скидка). */
export function lineTotal(qty: number, unitPrice: number, discountPercent: number): number {
  return round2(qty * unitPrice * (1 - discountPercent / 100));
}

/**
 * Снижение относительно автоцены, %: учитывает и скидку, и ручную цену.
 * Скидка клиента, заданная владельцем, в лимит продавца не входит.
 */
export function sellerReduction(auto: AutoPrice, unitPrice: number, discountPercent: number): number {
  const autoFinal = auto.unitPrice * (1 - auto.discountPercent / 100);
  if (autoFinal <= 0) return 0;
  const final = unitPrice * (1 - discountPercent / 100);
  return round2((1 - final / autoFinal) * 100);
}

export function exceedsSellerLimit(
  auto: AutoPrice,
  unitPrice: number,
  discountPercent: number,
  limitPercent: number,
): boolean {
  return sellerReduction(auto, unitPrice, discountPercent) > limitPercent;
}

/** Максимальная скидка продавца в поле «Скидка, %» для строки. */
export function maxSellerDiscount(auto: AutoPrice, unitPrice: number, limitPercent: number): number {
  if (unitPrice <= 0) return 100;
  const autoFinal = auto.unitPrice * (1 - auto.discountPercent / 100);
  const maxFinalReduction = 1 - (autoFinal * (1 - limitPercent / 100)) / unitPrice;
  return Math.max(0, Math.min(100, Math.floor(maxFinalReduction * 10000 + 1e-6) / 100));
}

export interface OrderTotals {
  subtotal: number;
  total: number;
  discountTotal: number;
}

export function orderTotals(lines: { qty: number; unitPrice: number; discountPercent: number }[]): OrderTotals {
  let subtotal = 0;
  let total = 0;
  for (const l of lines) {
    subtotal += round2(l.qty * l.unitPrice);
    total += lineTotal(l.qty, l.unitPrice, l.discountPercent);
  }
  subtotal = round2(subtotal);
  total = round2(total);
  return { subtotal, total, discountTotal: round2(subtotal - total) };
}
