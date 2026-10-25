import { expect, test } from "@playwright/test";
import { login, seller } from "./helpers";

test.describe("телефон 360 px", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1000) > 400, "только для мобильного проекта");

  test("нижняя навигация, без горизонтальной прокрутки, кнопки ≥ 44 px", async ({ page }) => {
    await login(page, seller);
    const nav = page.getByRole("navigation", { name: "Быстрое меню" });
    await expect(nav).toBeVisible();

    for (const path of ["/", "/sale", "/orders", "/clients", "/catalog", "/stock", "/payments", "/reports"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `горизонтальная прокрутка на ${path}`).toBeLessThanOrEqual(1);
    }

    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button, main a[href], nav button, nav a[href]"))
        .filter((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 44 && !(el as HTMLElement).closest("table");
        })
        .map((el) => (el as HTMLElement).innerText || el.getAttribute("aria-label")),
    );
    expect(small, "интерактивные элементы ниже 44 px").toEqual([]);
  });

  test("таблицы превращаются в карточки", async ({ page }) => {
    await login(page, seller);
    await page.goto("/catalog");
    await expect(page.locator("main table")).toBeHidden();
    await expect(page.locator("main ul li button").first()).toBeVisible();
  });
});
