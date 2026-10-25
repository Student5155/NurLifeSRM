"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListPlus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { formatQty } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";
import { cn, parseNumber } from "@/lib/utils";

interface CatalogItem {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit_code: string;
  is_fractional: boolean;
  qty_on_hand: number;
  is_active: boolean;
}

interface Props {
  doc: { id: string; type: "adjustment" | "inventory"; status: "draft" | "posted"; reason: string };
  items: { product_id: string; qty_actual: number; qty_expected: number; qty_diff: number }[];
  catalog: CatalogItem[];
}

/**
 * Черновик корректировки/инвентаризации. Для телефона: крупные поля, поиск
 * и сканер штрихкода (Enter прокручивает к товару и ставит курсор в поле).
 */
export function StockDocumentEditor({ doc, items, catalog }: Props) {
  const router = useRouter();
  const { run, pending } = useAction();
  const posted = doc.status === "posted";
  const byId = React.useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const [reason, setReason] = React.useState(doc.reason);
  const [counts, setCounts] = React.useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.product_id, String(i.qty_actual)])));
  const [query, setQuery] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const inputs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const ids = Object.keys(counts);
  const visible = (posted ? items.map((i) => i.product_id) : ids).filter((id) => {
    const c = byId.get(id);
    if (!c) return false;
    const q = query.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.sku.toLowerCase().includes(q) || c.barcode === query.trim();
  });

  const candidates = query.trim()
    ? catalog.filter((c) => !(c.id in counts) && (c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.sku.toLowerCase().includes(query.trim().toLowerCase()) || c.barcode === query.trim())).slice(0, 8)
    : [];

  function setCount(id: string, value: string) {
    setCounts((c) => ({ ...c, [id]: value }));
    setDirty(true);
  }

  function addProduct(c: CatalogItem) {
    setCount(c.id, String(c.qty_on_hand));
    setQuery("");
    setTimeout(() => inputs.current[c.id]?.focus(), 50);
  }

  function fillAll() {
    setCounts((prev) => {
      const next = { ...prev };
      for (const c of catalog) if (c.is_active && !(c.id in next)) next[c.id] = String(c.qty_on_hand);
      return next;
    });
    setDirty(true);
    toast.success("Добавлены все активные товары с текущими остатками — впишите фактические количества");
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    const hit = catalog.find((c) => c.barcode === q || c.sku.toLowerCase() === q.toLowerCase());
    if (!hit) {
      if (candidates[0]) addProduct(candidates[0]);
      return;
    }
    if (hit.id in counts) {
      setQuery("");
      inputs.current[hit.id]?.focus();
      inputs.current[hit.id]?.select();
    } else addProduct(hit);
  }

  function validate(): string | null {
    for (const [id, v] of Object.entries(counts)) {
      const n = parseNumber(v);
      const c = byId.get(id);
      if (n === null || n < 0) return `«${c?.name}»: укажите количество ≥ 0`;
      if (c && !c.is_fractional && !Number.isInteger(n)) return `«${c.name}»: для «${c.unit_code}» только целое число`;
    }
    return null;
  }

  async function save(silent = false) {
    const err = validate();
    if (err) {
      toast.error(err);
      return false;
    }
    const ok = await run(
      () =>
        rpc(createClient(), "save_stock_document", {
          p_id: doc.id,
          p_payload: {
            reason,
            items: Object.entries(counts).map(([product_id, v]) => ({ product_id, qty_actual: parseNumber(v) })),
          },
        }),
      { success: silent ? undefined : "Черновик сохранён" },
    );
    if (ok) setDirty(false);
    return !!ok;
  }

  async function post() {
    if (doc.type === "adjustment" && !reason.trim()) {
      toast.error("Укажите причину корректировки");
      return;
    }
    if (ids.length === 0) {
      toast.error("Добавьте товары");
      return;
    }
    if (!confirm("Провести документ? Остатки изменятся, документ станет недоступен для правки.")) return;
    if (!(await save(true))) return;
    const ok = await run(() => rpc(createClient(), doc.type === "inventory" ? "post_inventory" : "post_adjustment", { p_id: doc.id }), {
      success: "Документ проведён, остатки обновлены",
    });
    if (ok !== undefined) router.refresh();
  }

  async function removeDraft() {
    if (!confirm("Удалить черновик?")) return;
    const res = await createClient().from("stock_adjustments").delete().eq("id", doc.id);
    if (res.error) toast.error(res.error.message);
    else {
      router.replace("/stock/documents");
      router.refresh();
    }
  }

  const postedMap = new Map(items.map((i) => [i.product_id, i]));
  const totalDiff = posted ? items.reduce((a, i) => a + Math.abs(i.qty_diff), 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-[1fr_auto]">
          <Field label={doc.type === "adjustment" ? "Причина" : "Комментарий"} htmlFor="doc-reason" required={doc.type === "adjustment"}>
            <Textarea id="doc-reason" rows={2} value={reason} disabled={posted} onChange={(e) => (setReason(e.target.value), setDirty(true))} placeholder={doc.type === "adjustment" ? "Бой, порча, пересорт, найдено…" : ""} />
          </Field>
          {!posted && (
            <div className="flex flex-wrap items-end gap-2">
              {doc.type === "inventory" && (
                <Button variant="outline" onClick={fillAll}>
                  <ListPlus aria-hidden /> Все товары
                </Button>
              )}
              <Button variant="outline" onClick={() => save()} loading={pending} disabled={!dirty}>
                <Save aria-hidden /> Сохранить
              </Button>
              <Button onClick={post} disabled={pending}>
                <CheckCircle2 aria-hidden /> Провести
              </Button>
              <Button variant="ghost" className="text-destructive" onClick={removeDraft} aria-label="Удалить черновик">
                <Trash2 />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{posted ? `Позиции · отклонений ${formatQty(totalDiff)}` : "Фактические количества"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-12 pl-9 text-base"
              placeholder={posted ? "Поиск по документу" : "Найти или отсканировать товар"}
              aria-label="Поиск товара"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={posted ? undefined : onSearchKey}
            />
            {!posted && candidates.length > 0 && (
              <ul className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-xl" role="listbox">
                {candidates.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-3 text-left hover:bg-accent" onClick={() => addProduct(c)}>
                      <span className="truncate">{c.name}</span>
                      <span className="num text-xs text-muted-foreground">
                        {formatQty(c.qty_on_hand)} {c.unit_code}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{ids.length === 0 ? "Добавьте товары через поиск" : "Ничего не найдено"}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {visible.map((id) => {
                const c = byId.get(id)!;
                const p = postedMap.get(id);
                const expected = posted ? (p?.qty_expected ?? 0) : c.qty_on_hand;
                const actual = posted ? (p?.qty_actual ?? 0) : (parseNumber(counts[id]) ?? 0);
                const diff = actual - expected;
                return (
                  <li key={id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.sku} · {posted ? "было" : "в учёте"} {formatQty(expected)} {c.unit_code}
                      </p>
                    </div>
                    <span className={cn("num w-20 text-sm", diff < 0 && "text-destructive", diff > 0 && "text-success")}>
                      {diff > 0 ? "+" : ""}
                      {formatQty(diff)}
                    </span>
                    {posted ? (
                      <span className="num w-28 font-semibold">
                        {formatQty(actual)} {c.unit_code}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Input
                          ref={(el) => {
                            inputs.current[id] = el;
                          }}
                          aria-label={`Факт: ${c.name}, ${c.unit_code}`}
                          inputMode="decimal"
                          className="h-12 w-28 text-right text-lg"
                          value={counts[id]}
                          onChange={(e) => setCount(id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Убрать ${c.name}`}
                          onClick={() => {
                            setCounts((prev) => {
                              const next = { ...prev };
                              delete next[id];
                              return next;
                            });
                            setDirty(true);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
