import { expect, test } from "@playwright/test";
import { addProduct, login, owner, seller } from "./helpers";

test.describe("продажи", () => {
  test("быстрая продажа: товар → оплата → товарный чек", async ({ page }) => {
    await login(page, seller);
    await page.goto("/sale");
    await addProduct(page);
    await expect(page.getByText("E2E Тестовый товар")).toBeVisible();
    await page.getByRole("button", { name: /Продать/ }).click();
    await expect(page.getByText(/Продано на/)).toBeVisible();

    const [receipt] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Товарный чек" }).click()]);
    await expect(receipt.getByRole("heading", { name: /Товарный чек № З-/ })).toBeVisible();
    await expect(receipt.getByText(/рубл/)).toBeVisible();
  });

  test("лимит скидки продавца: 11% — нельзя, 10% — можно", async ({ page }) => {
    await login(page, seller);
    await page.goto("/orders/new");
    await addProduct(page);
    const discount = page.getByLabel("Скидка, %");
    await discount.fill("11");
    await expect(page.getByRole("alert").filter({ hasText: "больше лимита продавца" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать заказ" })).toBeDisabled();
    await discount.fill("10");
    await expect(page.getByRole("button", { name: "Создать заказ" })).toBeEnabled();
  });

  test("владелец: заказ → подтверждение → отгрузка → оплата = «Оплачен»", async ({ page }) => {
    await login(page, owner);
    await page.goto("/orders/new");
    await addProduct(page);
    await page.getByLabel("Скидка, %").fill("25");
    await page.getByRole("button", { name: "Создать заказ" }).click();
    await expect(page.getByRole("heading", { name: /Заказ З-/ })).toBeVisible();

    await page.getByRole("button", { name: "Подтвердить" }).click();
    await expect(page.getByText("Подтверждён").first()).toBeVisible();
    await page.getByRole("button", { name: "Отгрузить" }).click();
    await expect(page.getByText("Отгружен").first()).toBeVisible();

    await page.getByRole("button", { name: "Принять оплату" }).click();
    await page.getByRole("button", { name: /^Принять/ }).last().click();
    await expect(page.getByText("Оплачен").first()).toBeVisible();
  });
});
