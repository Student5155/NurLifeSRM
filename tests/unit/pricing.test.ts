import { describe, expect, it } from "vitest";
import {
  autoPrice,
  exceedsSellerLimit,
  lineTotal,
  maxSellerDiscount,
  orderTotals,
  sellerReduction,
  type PricingProduct,
} from "@/lib/pricing";

const product: PricingProduct = {
  retail_price: 100,
  wholesale_price: 80,
  tiers: [
    { min_qty: 10, price: 70 },
    { min_qty: 50, price: 65 },
  ],
};

describe("автоцена", () => {
  it("розница — базовая розничная цена", () => {
    expect(autoPrice("p", product, 1, "retail")).toEqual({ unitPrice: 100, source: "retail", discountPercent: 0 });
  });

  it("опт — базовая оптовая цена до первой ступени", () => {
    expect(autoPrice("p", product, 9, "wholesale").unitPrice).toBe(80);
  });

  it("оптовая ступень по количеству (берётся наибольшая подходящая)", () => {
    expect(autoPrice("p", product, 10, "wholesale")).toMatchObject({ unitPrice: 70, source: "tier" });
    expect(autoPrice("p", product, 120, "wholesale")).toMatchObject({ unitPrice: 65, source: "tier" });
  });

  it("ступени не действуют в рознице", () => {
    expect(autoPrice("p", product, 100, "retail").unitPrice).toBe(100);
  });

  it("индивидуальная цена клиента важнее ступени, скидка клиента к ней не применяется", () => {
    const client = { discount_percent: 5, prices: { p: 60 } };
    expect(autoPrice("p", product, 100, "wholesale", client)).toEqual({
      unitPrice: 60,
      source: "client_price",
      discountPercent: 0,
    });
  });

  it("скидка клиента применяется к ступени и базовой цене", () => {
    const client = { discount_percent: 5 };
    expect(autoPrice("p", product, 1, "wholesale", client)).toMatchObject({ unitPrice: 80, discountPercent: 5 });
    expect(autoPrice("p", product, 10, "wholesale", client)).toMatchObject({ unitPrice: 70, discountPercent: 5 });
  });
});

describe("суммы", () => {
  it("сумма строки округляется до копеек", () => {
    expect(lineTotal(3, 33.33, 0)).toBe(99.99);
    expect(lineTotal(1.5, 49.99, 10)).toBe(67.49);
    expect(lineTotal(2, 80, 5)).toBe(152);
  });

  it("итоги заказа: подытог, скидка, итого", () => {
    expect(
      orderTotals([
        { qty: 2, unitPrice: 100, discountPercent: 10 },
        { qty: 1, unitPrice: 50, discountPercent: 0 },
      ]),
    ).toEqual({ subtotal: 250, total: 230, discountTotal: 20 });
  });
});

describe("лимит скидки продавца", () => {
  const auto = autoPrice("p", product, 1, "retail");

  it("11% — превышение, 10% — допустимо", () => {
    expect(exceedsSellerLimit(auto, 100, 11, 10)).toBe(true);
    expect(exceedsSellerLimit(auto, 100, 10, 10)).toBe(false);
  });

  it("ручное снижение цены считается так же, как скидка", () => {
    expect(sellerReduction(auto, 89, 0)).toBe(11);
    expect(exceedsSellerLimit(auto, 89, 0, 10)).toBe(true);
    expect(exceedsSellerLimit(auto, 90, 0, 10)).toBe(false);
  });

  it("цена 95 и скидка 5% вместе дают 9,75% — в пределах лимита", () => {
    expect(sellerReduction(auto, 95, 5)).toBe(9.75);
  });

  it("после смены лимита на 15% скидка 15% допустима", () => {
    expect(exceedsSellerLimit(auto, 100, 15, 15)).toBe(false);
  });

  it("скидка клиента от владельца не входит в лимит продавца", () => {
    const withClient = autoPrice("p", product, 1, "wholesale", { discount_percent: 20 });
    expect(sellerReduction(withClient, 80, 20)).toBe(0);
    expect(exceedsSellerLimit(withClient, 80, 28, 10)).toBe(false);
    expect(exceedsSellerLimit(withClient, 80, 29, 10)).toBe(true);
  });

  it("подсказка максимальной скидки для поля ввода", () => {
    expect(maxSellerDiscount(auto, 100, 10)).toBe(10);
    expect(maxSellerDiscount(auto, 95, 10)).toBeCloseTo(5.26, 2);
  });
});
