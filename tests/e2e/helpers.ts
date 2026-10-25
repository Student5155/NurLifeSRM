import { expect, type Page } from "@playwright/test";

export const owner = { email: process.env.E2E_OWNER_EMAIL ?? "", password: process.env.E2E_OWNER_PASSWORD ?? "" };
export const seller = { email: process.env.E2E_SELLER_EMAIL ?? "", password: process.env.E2E_SELLER_PASSWORD ?? "" };

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Пароль").fill(who.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function addProduct(page: Page, query = "E2E-001") {
  const search = page.getByRole("combobox", { name: /Найти товар/ });
  await search.fill(query);
  await page.getByRole("option").first().click();
}
