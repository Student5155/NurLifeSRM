import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Бейдж: цвет — только рамка и точка, текст всегда основного цвета (контраст). */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium text-foreground",
  {
    variants: {
      tone: {
        neutral: "border-input",
        info: "border-info/70 [--dot:var(--info)]",
        warning: "border-warning/70 [--dot:var(--warning)]",
        gold: "border-primary/70 [--dot:var(--primary)]",
        success: "border-success/70 [--dot:var(--success)]",
        danger: "border-destructive/70 [--dot:var(--destructive)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      <span className="size-1.5 rounded-full bg-[var(--dot,var(--muted-foreground))]" aria-hidden />
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
