import { defineConfig, devices } from "@playwright/test";

// Переменные тестового стенда из .env.local (Node ≥ 20.12).
try {
  process.loadEnvFile(".env.local");
} catch {
  /* файла нет — берём из окружения */
}

/**
 * Сценарии на тестовом стенде (локальный Supabase + `npm run dev` или
 * preview на Vercel). Учётные записи — в .env.local (см. .env.example).
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "ru-RU",
    timezoneId: "Asia/Yekaterinburg",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 760 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
