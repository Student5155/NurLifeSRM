import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Wallet,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  /** Показывать в нижней панели на телефоне. */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Главная", icon: LayoutDashboard, mobile: true },
  { href: "/sale", label: "Продажа", icon: ShoppingCart, mobile: true },
  { href: "/orders", label: "Заказы", icon: ClipboardList, mobile: true },
  { href: "/clients", label: "Клиенты", icon: Users, mobile: true },
  { href: "/catalog", label: "Каталог", icon: Package },
  { href: "/stock", label: "Склад", icon: Boxes },
  { href: "/purchases", label: "Закупки", icon: Truck, ownerOnly: true },
  { href: "/payments", label: "Платежи", icon: Wallet },
  { href: "/cash", label: "Касса", icon: Landmark, ownerOnly: true },
  { href: "/reports", label: "Отчёты", icon: BarChart3 },
  { href: "/audit", label: "Аудит", icon: FileClock, ownerOnly: true },
  { href: "/users", label: "Сотрудники", icon: UserCog, ownerOnly: true },
  { href: "/settings", label: "Настройки", icon: Settings, ownerOnly: true },
];

export function navForRole(isOwner: boolean) {
  return NAV_ITEMS.filter((i) => isOwner || !i.ownerOnly);
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
