"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface PickerClient {
  id: string;
  name: string;
  phone: string | null;
  inn: string | null;
  type: "wholesale" | "retail";
}

export function useClients() {
  const [items, setItems] = React.useState<PickerClient[]>([]);
  React.useEffect(() => {
    createClient()
      .from("clients")
      .select("id, name, phone, inn, type")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setItems(data ?? []));
  }, []);
  return items;
}

/** Выбор клиента с поиском по имени, телефону, ИНН. value = null — без клиента. */
export function ClientPicker({
  clients,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "Розничный покупатель (без карточки)",
}: {
  clients: PickerClient[];
  value: PickerClient | null;
  onChange: (c: PickerClient | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return clients
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (digits.length >= 3 && ((c.phone ?? "").replace(/\D/g, "").includes(digits) || (c.inn ?? "").includes(digits))),
      )
      .slice(0, 10);
  }, [clients, query]);

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-input px-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">{value.name}</span>
          <span className="block text-xs text-muted-foreground">{value.phone ?? (value.inn ? `ИНН ${value.inn}` : "")}</span>
        </span>
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Сменить клиента">
          <X />
        </Button>
      </div>
    );
  }

  function pick(c: PickerClient) {
    onChange(c);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Клиент"
        className="pl-9"
        placeholder={allowEmpty ? `${emptyLabel} — или найдите клиента` : "Найдите клиента: имя, телефон, ИНН"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[active]) pick(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-xl">
          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("min-h-11 cursor-pointer rounded-sm px-3 py-1.5", i === active && "bg-accent text-accent-foreground")}
            >
              <span className="block font-medium">{c.name}</span>
              <span className="block text-xs text-muted-foreground">
                {c.type === "wholesale" ? "Опт" : "Розница"}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.inn ? ` · ИНН ${c.inn}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
