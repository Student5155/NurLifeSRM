import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell
      user={{
        id: session.userId,
        fullName: session.profile.full_name,
        email: session.email,
        isOwner: session.isOwner,
      }}
    >
      {children}
    </AppShell>
  );
}
