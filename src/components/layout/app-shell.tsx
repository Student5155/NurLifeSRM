"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Moon, Sun, UserCircle } from "lucide-react";
import { Logo } from "@/components/common";
import { NotificationBell } from "@/components/layout/notification-bell";
import { isActivePath, navForRole } from "@/components/layout/nav-items";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface ShellUser {
  id: string;
  fullName: string;
  email: string;
  isOwner: boolean;
}

function useTheme() {
  const [light, setLight] = React.useState(false);
  React.useEffect(() => setLight(document.documentElement.classList.contains("light")), []);
  const toggle = () => {
    const next = !light;
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("nurlife-theme", next ? "light" : "dark");
    } catch {
      /* приватный режим */
    }
    setLight(next);
  };
  return { light, toggle };
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navForRole(user.isOwner);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { light, toggle } = useTheme();

  React.useEffect(() => setMenuOpen(false), [pathname]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navList = (
    <nav aria-label="Основное меню">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <item.icon className={cn("size-5", active && "text-primary")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      {/* Боковое меню (компьютер) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" aria-label="NurLife — на главную">
            <Logo />
          </Link>
        </div>
        <div className="ornament-band mx-3" aria-hidden />
        <div className="flex-1 overflow-y-auto px-3 py-4">{navList}</div>
        <div className="flex min-h-0 gap-0 px-3 pb-2" aria-hidden>
          <div className="ornament-column h-16" />
          <div className="flex-1" />
          <div className="ornament-column h-16" />
        </div>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          {user.fullName || user.email}
          <br />
          {user.isOwner ? "Владелец" : "Продавец"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Шапка */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 md:h-16 md:px-6">
            <Link href="/" className="md:hidden" aria-label="NurLife — на главную">
              <Logo />
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={toggle}
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={light ? "Тёмная тема" : "Светлая тема"}
              >
                {light ? <Moon className="size-5" /> : <Sun className="size-5" />}
              </button>
              <NotificationBell userId={user.id} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label="Профиль"
                >
                  <UserCircle className="size-6" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <span className="block text-sm text-foreground">{user.fullName || "Без имени"}</span>
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/set-password")}>Сменить пароль</DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut}>
                    <LogOut className="size-4" aria-hidden /> Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="ornament-band" aria-hidden />
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-28 md:px-6 md:py-6 md:pb-10">{children}</main>
      </div>

      {/* Нижняя навигация (телефон) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Быстрое меню"
      >
        <ul className="grid grid-cols-5">
          {items
            .filter((i) => i.mobile)
            .map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                      active && "text-primary",
                    )}
                  >
                    <item.icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="size-5" aria-hidden />
              Ещё
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent>
          <DialogTitle className="mb-3">Меню</DialogTitle>
          {navList}
        </DialogContent>
      </Dialog>
    </div>
  );
}
