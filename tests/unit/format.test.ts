import { describe, expect, it } from "vitest";
import { amountInWords, numberToWords } from "@/lib/amount-in-words";
import { formatDate, formatDateTime, formatMoney, formatQty, phoneDigits, ruDateToISO } from "@/lib/format";

const nb = (s: string) => s.replace(/ /g, " ");

describe("форматирование", () => {
  it("деньги: «1 234,56 ₽»", () => {
    expect(formatMoney(1234.56)).toBe(nb("1 234,56 ₽"));
    expect(formatMoney(0)).toBe(nb("0,00 ₽"));
    expect(formatMoney("1000000")).toBe(nb("1 000 000,00 ₽"));
    expect(formatMoney(-5.5, false)).toBe("-5,50");
  });

  it("количество без лишних нулей", () => {
    expect(formatQty(3)).toBe("3");
    expect(formatQty(2.5)).toBe("2,5");
    expect(formatQty(1.125)).toBe("1,125");
  });

  it("даты ДД.ММ.ГГГГ в часовом поясе Екатеринбурга", () => {
    expect(formatDate("2026-10-25")).toBe("25.10.2026");
    // 20:30 UTC = 01:30 следующего дня в Екатеринбурге (UTC+5)
    expect(formatDate("2026-12-31T20:30:00Z")).toBe("01.01.2027");
    expect(formatDateTime("2026-10-25T09:05:00Z")).toBe("25.10.2026 14:05");
    expect(formatDate(null)).toBe("—");
  });

  it("ввод даты и телефоны", () => {
    expect(ruDateToISO("05.03.2026")).toBe("2026-03-05");
    expect(ruDateToISO("5.3.26")).toBeNull();
    expect(phoneDigits("+7 (912) 345-67-89")).toBe("9123456789");
    expect(phoneDigits("8 912 345 67 89")).toBe("9123456789");
  });
});

describe("сумма прописью", () => {
  it("числа", () => {
    expect(numberToWords(0)).toBe("ноль");
    expect(numberToWords(21)).toBe("двадцать один");
    expect(numberToWords(1002)).toBe("одна тысяча два");
    expect(numberToWords(2_345_678)).toBe("два миллиона триста сорок пять тысяч шестьсот семьдесят восемь");
    expect(numberToWords(11_000)).toBe("одиннадцать тысяч");
  });

  it("рубли и копейки с правильными окончаниями", () => {
    expect(amountInWords(1234.5)).toBe("Одна тысяча двести тридцать четыре рубля 50 копеек");
    expect(amountInWords(1)).toBe("Один рубль 00 копеек");
    expect(amountInWords(21.01)).toBe("Двадцать один рубль 01 копейка");
    expect(amountInWords(5.22)).toBe("Пять рублей 22 копейки");
    expect(amountInWords(112)).toBe("Сто двенадцать рублей 00 копеек");
  });
});
