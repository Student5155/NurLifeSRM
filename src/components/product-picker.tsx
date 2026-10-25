"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Views } from "@/lib/database.types";
import { formatMoney, formatQty } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type PickerProduct = Pick<
  Views<"catalog_items">,
  "id" | "sku" | "barcode" | "name" | "unit_code" | "is_fractional" | "retail_price" | "wholesale_price" | "qty_available" | "is_active" | "category_name"
>;

/** Загрузка активных товаров для подбора (≈150 позиций — грузим один раз). */
export function useCatalog(includeInactive = false) {
  const [items, setItems] = React.useState<PickerProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    let q = createClient()
      .from("catalog_items")
      .select("id, sku, barcode, name, unit_code, is_fractional, retail_price, wholesale_price, qty_available, is_active, category_name")
      .order("name");
    if (!includeInactive) q = q.eq("is_active", true);
    q.then(({ data }) => {
      if (alive) {
        setItems(data ?? []);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [includeInactive]);
  return { items, loading };
}

/**
 * Поиск товара по названию, артикулу или штрихкоду (сканер вводит штрихкод
 * и Enter — товар добавляется сразу). Клавиатура: ↑ ↓ Enter Esc.
 */
export function ProductPicker({
  items,
  onPick,
  priceType = "retail",
  placeholder = "Найти товар: название, артикул, штрихкод",
  autoFocus,
  showStock = true,
}: {
  items: PickerProduct[];
  onPick: (product: PickerProduct) => void;
  priceType?: "retail" | "wholesale";
  placeholder?: string;
  autoFocus?: boolean;
  showStock?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const exact = items.filter((i) => i.barcode === query.trim() || i.sku?.toLowerCase() === q);
    const words = q.split(/\s+/);
    const fuzzy = items.filter(
      (i) => !exact.includes(i) && words.every((w) => `${i.name} ${i.sku} ${i.barcode ?? ""} ${i.category_name ?? ""}`.toLowerCase().includes(w)),
    );
    return [...exact, ...fuzzy].slice(0, 12);
  }, [items, query]);

  function pick(p: PickerProduct) {
    onPick(p);
    setQuery("");
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label={placeholder}
        placeholder={placeholder}
        className="pl-9"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-xl">
          {results.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-1.5", i === active && "bg-accent text-accent-foreground")}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.sku}</span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="num block">{formatMoney(priceType === "wholesale" ? p.wholesale_price : p.retail_price)}</span>
                {showStock && (
                  <span className={cn("num block text-xs", Number(p.qty_available) <= 0 ? "text-destructive" : "text-muted-foreground")}>
                    {formatQty(p.qty_available)} {p.unit_code}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <p className="absolute z-40 mt-1 w-full rounded-md border border-border bg-popover px-3 py-3 text-sm text-muted-foreground">Ничего не найдено</p>
      )}
    </div>
  );
}
