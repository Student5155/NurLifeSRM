import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Текст ошибки Supabase/Postgres для показа пользователю. */
export function errorMessage(error: unknown): string {
  if (!error) return "Неизвестная ошибка";
  if (typeof error === "string") return error;
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  if (e.code === "42501" && !e.message?.match(/[а-яё]/i)) return "Недостаточно прав для этого действия";
  if (e.code === "23505") return "Такая запись уже существует";
  if (e.code === "23503") return "Запись используется в других документах";
  const parts = [e.message, e.hint].filter(Boolean);
  return parts.length ? parts.join(". ") : "Неизвестная ошибка";
}

/** Безопасное число из строки с запятой или точкой. */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
