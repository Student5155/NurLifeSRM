"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { monthStartISO, todayISO } from "@/lib/format";

const PRESETS = [
  { key: "today", label: "Сегодня", from: () => todayISO(), to: () => todayISO() },
  { key: "7d", label: "7 дней", from: () => todayISO(-6), to: () => todayISO() },
  { key: "month", label: "Месяц", from: () => monthStartISO(), to: () => todayISO() },
  { key: "30d", label: "30 дней", from: () => todayISO(-29), to: () => todayISO() },
];

/** Период «с — по» в адресной строке (?from=ГГГГ-ММ-ДД&to=…). */
export function PeriodFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(nextFrom: string, nextTo: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("from", nextFrom);
    sp.set("to", nextTo);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Быстрый выбор периода">
        {PRESETS.map((p) => (
          <Button key={p.key} type="button" size="sm" variant={from === p.from() && to === p.to() ? "secondary" : "ghost"} onClick={() => apply(p.from(), p.to())}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="period-from" className="text-xs text-muted-foreground">
            С
          </Label>
          <Input id="period-from" type="date" value={from} max={to} onChange={(e) => e.target.value && apply(e.target.value, to)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="period-to" className="text-xs text-muted-foreground">
            По
          </Label>
          <Input id="period-to" type="date" value={to} min={from} onChange={(e) => e.target.value && apply(from, e.target.value)} className="w-40" />
        </div>
      </div>
    </div>
  );
}

