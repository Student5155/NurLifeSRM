import { createClient } from "@supabase/supabase-js";

/**
 * Подготовка тестового стенда (НЕ запускать на боевой базе!):
 * товар E2E-001 с остатком 1000 шт. Нужен SUPABASE_SERVICE_ROLE_KEY.
 */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Для e2e нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY тестового стенда");
  if (process.env.E2E_ALLOW_SEED !== "1") throw new Error("Установите E2E_ALLOW_SEED=1, чтобы подтвердить, что это тестовая база");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: unit } = await admin.from("units").select("id").eq("code", "шт").single();
  const { data: product, error } = await admin
    .from("products")
    .upsert({ sku: "E2E-001", name: "E2E Тестовый товар", unit_id: unit!.id, retail_price: 100, wholesale_price: 80, min_stock: 0, is_active: true }, { onConflict: "sku" })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("stock").update({ qty_on_hand: 1000, avg_cost: 60 }).eq("product_id", product!.id);
  await admin.from("settings").update({ seller_max_discount: 10 }).eq("id", true);
}
