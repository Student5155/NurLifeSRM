import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA для палитры темы: читаем CSS-переменные прямо из globals.css,
 * чтобы правка цвета без проверки контраста ломала тест.
 */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["primary", "background"],
  ["primary", "card"],
  ["accent-foreground", "accent"],
  ["secondary-foreground", "secondary"],
  ["destructive", "card"],
  ["destructive-foreground", "destructive"],
  ["success", "card"],
  ["warning", "card"],
  ["info", "card"],
];

// Элементы управления (рамки полей, кольцо фокуса) — не ниже 3:1.
const UI_PAIRS: [string, string][] = [
  ["input", "background"],
  ["input", "card"],
  ["ring", "background"],
  ["ring", "card"],
];

for (const [name, selector] of [
  ["тёмная тема", ":root"],
  ["светлая тема", ".light"],
] as const) {
  describe(`контраст: ${name}`, () => {
    const t = tokens(selector);

    it("все токены найдены", () => {
      for (const [a, b] of [...TEXT_PAIRS, ...UI_PAIRS]) {
        expect(t[a], a).toBeTruthy();
        expect(t[b], b).toBeTruthy();
      }
    });

    for (const [a, b] of TEXT_PAIRS) {
      it(`текст ${a} на ${b} ≥ 4.5:1`, () => {
        expect(contrast(t[a], t[b])).toBeGreaterThanOrEqual(4.5);
      });
    }

    for (const [a, b] of UI_PAIRS) {
      it(`элемент ${a} на ${b} ≥ 3:1`, () => {
        expect(contrast(t[a], t[b])).toBeGreaterThanOrEqual(3);
      });
    }
  });
}

describe("фирменные цвета из ТЗ", () => {
  const t = tokens(":root");
  it("фон, карточки, золото, текст", () => {
    expect(t.background.toLowerCase()).toBe("#0b0b0b");
    expect(t.card.toLowerCase()).toBe("#151515");
    expect(t.primary.toLowerCase()).toBe("#d4af37");
    expect(t["primary-hover"].toLowerCase()).toBe("#e6c35c");
    expect(t.foreground.toLowerCase()).toBe("#f5f0e1");
  });
});
