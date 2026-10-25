import type { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-neutral-200 py-4 text-black print:bg-white print:py-0">{children}</div>;
}
