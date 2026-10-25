"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { InfoRow } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { check, useAction } from "@/hooks/use-action";
import type { Tables } from "@/lib/database.types";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { categoryOptions, type CategoryRow } from "./catalog-list";
import { ProductImages } from "./product-images";

export type ProductData = Tables<"products"> & {
  tiers: { min_qty: number; price: number }[];
  images: { id: string; storage_path: string; sort_order: number }[];
};

const money = z.coerce.number({ invalid_type_error: "Введите число" }).min(0, "Не меньше 0");

const schema = z
  .object({
    sku: z.string().trim().min(1, "Укажите артикул").max(64),
    barcode: z.string().trim().max(64),
    name: z.string().trim().min(2, "Укажите наименование").max(255),
    description: z.string().trim().max(4000),
    category_id: z.string(),
    unit_id: z.string().min(1, "Выберите единицу"),
    retail_price: money,
    wholesale_price: money,
    purchase_price: z.string().trim().refine((v) => v === "" || (!Number.isNaN(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= 0), "Введите число ≥ 0"),
    min_stock: z.coerce.number({ invalid_type_error: "Введите число" }).min(0, "Не меньше 0"),
    is_active: z.boolean(),
    tiers: z.array(
      z.object({
        min_qty: z.coerce.number({ invalid_type_error: "Число" }).positive("Больше 0"),
        price: money,
      }),
    ),
  })
  .refine((v) => new Set(v.tiers.map((t) => t.min_qty)).size === v.tiers.length, {
    path: ["tiers"],
    message: "Количество в ступенях не должно повторяться",
  });
type Values = z.infer<typeof schema>;

interface Props {
  units: Tables<"units">[];
  categories: CategoryRow[];
  product?: ProductData;
  stock?: { qty_on_hand: number; qty_reserved: number; qty_available: number | null; avg_cost: number } | null;
  history?: { received_at: string; purchase_number: string; supplier_name: string; qty: number; unit_cost: number }[];
}

export function ProductForm({ units, categories, product, stock, history = [] }: Props) {
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      name: product?.name ?? "",
      description: product?.description ?? "",
      category_id: product?.category_id ?? "",
      unit_id: product?.unit_id ?? units.find((u) => u.code === "шт")?.id ?? "",
      retail_price: product ? Number(product.retail_price) : 0,
      wholesale_price: product ? Number(product.wholesale_price) : 0,
      purchase_price: product?.purchase_price !== null && product?.purchase_price !== undefined ? String(product.purchase_price) : "",
      min_stock: product ? Number(product.min_stock) : 0,
      is_active: product?.is_active ?? true,
      tiers: product?.tiers ?? [],
    },
  });
  const tiers = useFieldArray({ control: form.control, name: "tiers" });
  const e = form.formState.errors;

  async function onSubmit(v: Values) {
    const supabase = createClient();
    const row = {
      sku: v.sku,
      barcode: v.barcode || null,
      name: v.name,
      description: v.description || null,
      category_id: v.category_id || null,
      unit_id: v.unit_id,
      retail_price: v.retail_price,
      wholesale_price: v.wholesale_price,
      purchase_price: v.purchase_price === "" ? null : Number(v.purchase_price.replace(",", ".")),
      min_stock: v.min_stock,
      is_active: v.is_active,
    };

    const id = await run(
      async () => {
        let productId = product?.id;
        if (productId) {
          check(await supabase.from("products").update(row).eq("id", productId));
        } else {
          productId = check(await supabase.from("products").insert(row).select("id").single()).id;
        }
        check(await supabase.from("product_price_tiers").delete().eq("product_id", productId));
        if (v.tiers.length) {
          check(
            await supabase
              .from("product_price_tiers")
              .insert(v.tiers.map((t) => ({ product_id: productId!, min_qty: t.min_qty, price: t.price }))),
          );
        }
        return productId;
      },
      { success: "Товар сохранён" },
    );
    if (id && !product) router.replace(`/catalog/${id}`);
  }

  async function remove() {
    if (!product || !confirm(`Удалить товар «${product.name}»? Если по нему были продажи, удаление невозможно — снимите его с продажи.`)) return;
    const ok = await run(async () => check(await createClient().from("products").delete().eq("id", product.id)), { refresh: false });
    if (ok !== undefined) {
      toast.success("Товар удалён");
      router.replace("/catalog");
      router.refresh();
    }
  }

  const unitCode = units.find((u) => u.id === form.watch("unit_id"))?.code ?? "";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 lg:col-span-2" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Основное</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Наименование" htmlFor="name" required error={e.name?.message} className="md:col-span-2">
              <Input id="name" aria-invalid={!!e.name} {...form.register("name")} />
            </Field>
            <Field label="Артикул (SKU)" htmlFor="sku" required error={e.sku?.message}>
              <Input id="sku" aria-invalid={!!e.sku} {...form.register("sku")} />
            </Field>
            <Field label="Штрихкод" htmlFor="barcode" error={e.barcode?.message}>
              <Input id="barcode" inputMode="numeric" {...form.register("barcode")} />
            </Field>
            <Field label="Категория" htmlFor="category_id">
              <NativeSelect id="category_id" {...form.register("category_id")}>
                <option value="">Без категории</option>
                {categoryOptions(categories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Единица" htmlFor="unit_id" required error={e.unit_id?.message}>
              <NativeSelect id="unit_id" {...form.register("unit_id")}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Описание" htmlFor="description" className="md:col-span-2">
              <Textarea id="description" {...form.register("description")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Цены</CardTitle>
            <CardDescription>Закупочную цену видит только владелец.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Розничная цена, ₽" htmlFor="retail_price" required error={e.retail_price?.message}>
              <Input id="retail_price" type="number" step="0.01" min={0} inputMode="decimal" {...form.register("retail_price")} />
            </Field>
            <Field label="Оптовая цена, ₽" htmlFor="wholesale_price" required error={e.wholesale_price?.message}>
              <Input id="wholesale_price" type="number" step="0.01" min={0} inputMode="decimal" {...form.register("wholesale_price")} />
            </Field>
            <Field label="Закупочная цена, ₽" htmlFor="purchase_price" error={e.purchase_price?.message} hint="Обновляется при приёмке закупки">
              <Input id="purchase_price" inputMode="decimal" {...form.register("purchase_price")} />
            </Field>
            <Field label={`Минимальный остаток${unitCode ? `, ${unitCode}` : ""}`} htmlFor="min_stock" error={e.min_stock?.message} hint="Ниже — товар попадёт в «Нужно заказать»">
              <Input id="min_stock" type="number" step="0.001" min={0} inputMode="decimal" {...form.register("min_stock")} />
            </Field>

            <fieldset className="md:col-span-2">
              <legend className="mb-2 text-sm font-medium">Оптовые ступени</legend>
              <p className="mb-2 text-sm text-muted-foreground">«От N {unitCode || "шт"} — цена». Действуют в оптовых заказах.</p>
              <div className="flex flex-col gap-2">
                {tiers.fields.map((f, i) => (
                  <div key={f.id} className="flex items-end gap-2">
                    <Field label="От, кол-во" htmlFor={`tier-q-${i}`} error={e.tiers?.[i]?.min_qty?.message} className="flex-1">
                      <Input id={`tier-q-${i}`} type="number" step="0.001" inputMode="decimal" {...form.register(`tiers.${i}.min_qty`)} />
                    </Field>
                    <Field label="Цена, ₽" htmlFor={`tier-p-${i}`} error={e.tiers?.[i]?.price?.message} className="flex-1">
                      <Input id={`tier-p-${i}`} type="number" step="0.01" inputMode="decimal" {...form.register(`tiers.${i}.price`)} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" onClick={() => tiers.remove(i)} aria-label="Удалить ступень">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {e.tiers?.root?.message && <p className="text-sm text-destructive">{e.tiers.root.message}</p>}
                {typeof e.tiers?.message === "string" && <p className="text-sm text-destructive">{e.tiers.message}</p>}
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => tiers.append({ min_qty: 10, price: 0 })}>
                  <Plus aria-hidden /> Добавить ступень
                </Button>
              </div>
            </fieldset>

            <label className="flex min-h-11 items-center gap-3 text-sm md:col-span-2">
              <Checkbox {...form.register("is_active")} /> В продаже
            </label>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-between gap-2">
          {product ? (
            <Button type="button" variant="ghost" onClick={remove} className="text-destructive">
              <Trash2 aria-hidden /> Удалить
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={pending}>
            {product ? "Сохранить" : "Создать товар"}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-4">
        {product ? (
          <ProductImages productId={product.id} images={product.images} />
        ) : (
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">Фото можно добавить после сохранения товара.</CardContent>
          </Card>
        )}

        {stock && (
          <Card>
            <CardHeader>
              <CardTitle>Склад</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="На складе">{formatQty(stock.qty_on_hand)} {unitCode}</InfoRow>
                <InfoRow label="В резерве">{formatQty(stock.qty_reserved)} {unitCode}</InfoRow>
                <InfoRow label="Доступно">{formatQty(stock.qty_available)} {unitCode}</InfoRow>
                <InfoRow label="Себестоимость">{formatMoney(stock.avg_cost)}</InfoRow>
              </dl>
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Закупочные цены</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Дата</TableHead>
                    <TableHead>Поставщик</TableHead>
                    <TableHead className="num">Цена</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(h.received_at)}</TableCell>
                      <TableCell>
                        {h.supplier_name}
                        <span className="block text-xs text-muted-foreground">{h.purchase_number}</span>
                      </TableCell>
                      <TableCell className="num">{formatMoney(h.unit_cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
