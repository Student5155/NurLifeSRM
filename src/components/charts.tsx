"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatMoney } from "@/lib/format";

const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 };

function shortMoney(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} тыс`;
  return String(v);
}

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium">{label ? formatDate(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="num">{formatMoney(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export interface RevenuePoint {
  date: string;
  retail?: number;
  wholesale?: number;
  revenue?: number;
}

/** Столбчатая диаграмма выручки по дням/периодам (опт и розница — стопкой). */
export function RevenueChart({ data, split = false, height = 260 }: { data: RevenuePoint[]; split?: boolean; height?: number }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Нет продаж за период</p>;
  }
  return (
    <div style={{ height }} role="img" aria-label="Диаграмма выручки">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d).slice(0, 5)} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={shortMoney} tick={axisStyle} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--accent)", opacity: 0.4 }} />
          {split ? (
            <>
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
              <Bar dataKey="wholesale" name="Опт" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="retail" name="Розница" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </>
          ) : (
            <Bar dataKey="revenue" name="Выручка" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
