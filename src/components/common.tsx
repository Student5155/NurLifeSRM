import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  PURCHASE_STATUS_LABEL,
  type OrderStatus,
  type PaymentStatus,
  type PurchaseStatus,
} from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:min-h-0"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Money({ value, className }: { value: number | string | null | undefined; className?: string }) {
  return <span className={cn("num", className)}>{formatMoney(value)}</span>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const tone = status === "received" ? "success" : status === "ordered" ? "info" : status === "cancelled" ? "danger" : "neutral";
  return <Badge tone={tone}>{PURCHASE_STATUS_LABEL[status]}</Badge>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="max-w-md text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Строка «подпись — значение» для карточек сущностей. */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children ?? "—"}</dd>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  arch,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "danger" | "success" | "gold";
  arch?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card p-4 pt-6",
        arch && "arch",
      )}
    >
      {arch && <div className="gold-rule absolute inset-x-8 top-2" aria-hidden />}
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "num text-left font-display text-2xl font-bold",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
          tone === "gold" && "text-primary",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="arch-frame inline-flex h-9 w-8 items-end justify-center pb-1 font-display text-lg font-bold text-primary" aria-hidden>
        N
      </span>
      {!compact && <span className="font-display text-xl font-bold tracking-wide text-primary">NurLife</span>}
    </span>
  );
}
