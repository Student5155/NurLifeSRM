"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { rpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

type Notification = Tables<"notifications">;

/** Колокольчик: последние уведомления + новые в реальном времени (Supabase Realtime). */
export function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = React.useState<Notification[]>([]);

  const load = React.useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
  }, [supabase]);

  React.useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 20));
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const unread = items.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await rpc(supabase, "mark_all_notifications_read", {}).catch(() => load());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label={unread ? `Уведомления: ${unread} новых` : "Уведомления"}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] font-bold leading-5 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)]">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>Уведомления</DropdownMenuLabel>
          {unread > 0 && (
            <button type="button" onClick={markAll} className="inline-flex min-h-9 items-center gap-1 px-3 text-xs text-primary hover:underline">
              <CheckCheck className="size-4" aria-hidden /> Прочитать все
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Пока нет уведомлений</p>}
          {items.map((n) => (
            <DropdownMenuItem key={n.id} asChild onSelect={() => markRead(n.id)}>
              <Link href={n.link ?? "#"} className="flex flex-col items-start gap-0.5 py-2">
                <span className="flex w-full items-center gap-2">
                  {!n.is_read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Новое" />}
                  <span className="font-medium">{n.title}</span>
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
