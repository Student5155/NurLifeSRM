/**
 * Сумма прописью для печатных форм:
 * 1234.5 → «Одна тысяча двести тридцать четыре рубля 50 копеек».
 */

const UNITS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UNITS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

type Scale = { forms: [string, string, string]; feminine: boolean };

const SCALES: Scale[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
];

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

function triad(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (h) words.push(HUNDREDS[h]);
  if (t === 1) {
    words.push(TEENS[u]);
  } else {
    if (t) words.push(TENS[t]);
    if (u) words.push((feminine ? UNITS_F : UNITS_M)[u]);
  }
  return words;
}

/** Целое число прописью (мужской род, если не указано иное). */
export function numberToWords(value: number, feminine = false): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "ноль";
  const words: string[] = [];
  let scale = 0;
  const groups: string[][] = [];
  while (n > 0 && scale < SCALES.length) {
    const part = n % 1000;
    if (part) {
      const s = SCALES[scale];
      const w = triad(part, scale === 0 ? feminine : s.feminine);
      if (scale > 0) w.push(plural(part, s.forms));
      groups.unshift(w);
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  for (const g of groups) words.push(...g);
  return words.join(" ");
}

export function amountInWords(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100);
  const rubles = Math.floor(rounded / 100);
  const kopecks = rounded % 100;
  const text = `${numberToWords(rubles)} ${plural(rubles, ["рубль", "рубля", "рублей"])} ${String(kopecks).padStart(2, "0")} ${plural(kopecks, ["копейка", "копейки", "копеек"])}`;
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return amount < 0 ? `Минус ${capitalized.charAt(0).toLowerCase()}${capitalized.slice(1)}` : capitalized;
}
