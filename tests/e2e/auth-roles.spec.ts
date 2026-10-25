import { expect, test } from "@playwright/test";
import { login, owner, seller } from "./helpers";

test.describe("вход и роли", () => {
  test("неверный пароль — понятная ошибка", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(seller.email);
    await page.getByLabel("Пароль").fill("wrong-password");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный e-mail или пароль")).toBeVisible();
  });

  test("без входа — перенаправление на /login", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("продавец не видит разделы владельца и закупочные цены", async ({ page }) => {
    await login(page, seller);
    await expect(page.getByRole("link", { name: "Настройки" })).toHaveCount(0);
    await page.goto("/settings");
    await expect(page).toHaveURL(/error=forbidden/);
    await expect(page.getByText("Этот раздел доступен только владельцу")).toBeVisible();

    await page.goto("/catalog");
    await expect(page.getByRole("columnheader", { name: "Закупка" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Розница" })).toBeVisible();
  });

  test("владелец видит закупочные цены и счётчик продавцов", async ({ page }) => {
    await login(page, owner);
    await page.goto("/catalog");
    await expect(page.getByRole("columnheader", { name: "Закупка" })).toBeVisible();
    await page.goto("/users");
    await expect(page.getByText(/из 5/)).toBeVisible();
  });
});
