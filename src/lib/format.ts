/**
 * Форматирование для интерфейса и печатных форм.
 * Даты — ДД.ММ.ГГГГ в часовом поясе бизнеса, деньги — «1 234,56 ₽».
 */

export const APP_TIMEZONE = "Asia/Yekaterinburg";

const NBSP = " ";

const moneyFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
const percentFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Разделитель групп — обычный неразрывный пробел (Intl может дать узкий). */
function normalizeSpaces(s: string) {
  return s.replace(/[  ]/g, NBSP);
}

/** 1234.5 → «1 234,50 ₽» */
export function formatMoney(value: number | string | null | undefined, withCurrency = true): string {
  const n = Number(value ?? 0);
  const s = normalizeSpaces(moneyFmt.format(Number.isFinite(n) ? n : 0));
  return withCurrency ? `${s}${NBSP}₽` : s;
}

/** 2.5 → «2,5»; 3 → «3» */
export function formatQty(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return normalizeSpaces(qtyFmt.format(Number.isFinite(n) ? n : 0));
}

export function formatPercent(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${normalizeSpaces(percentFmt.format(Number.isFinite(n) ? n : 0))}${NBSP}%`;
}

function parts(date: Date) {
  const f = new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return p as Record<string, string>;
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // «ГГГГ-ММ-ДД» без времени — календарная дата, не сдвигаем по поясу.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  return new Date(value);
}

/** «25.10.2026» */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const p = parts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

/** «25.10.2026 14:05» */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const p = parts(date);
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.day}.${p.month}.${p.year} ${hour}:${p.minute}`;
}

/** Сегодня в часовом поясе бизнеса, «ГГГГ-ММ-ДД». */
export function todayISO(offsetDays = 0): string {
  const p = parts(new Date(Date.now() + offsetDays * 86_400_000));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Первый день текущего месяца, «ГГГГ-ММ-ДД». */
export function monthStartISO(): string {
  const p = parts(new Date());
  return `${p.year}-${p.month}-01`;
}

/** «ДД.ММ.ГГГГ» → «ГГГГ-ММ-ДД» (для полей ввода). */
export function ruDateToISO(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Последние 10 цифр телефона — для поиска дублей. */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}
