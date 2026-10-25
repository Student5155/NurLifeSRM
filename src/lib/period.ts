import { monthStartISO, todayISO } from "@/lib/format";

/** Период из адресной строки (?from=ГГГГ-ММ-ДД&to=…); по умолчанию — текущий месяц. */
export function resolvePeriod(sp: { from?: string; to?: string }) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return {
    from: sp.from && iso.test(sp.from) ? sp.from : monthStartISO(),
    to: sp.to && iso.test(sp.to) ? sp.to : todayISO(),
  };
}
