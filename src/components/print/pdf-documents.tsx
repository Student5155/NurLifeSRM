"use client";

/**
 * PDF печатных форм (@react-pdf/renderer, в браузере). Шрифт Inter с
 * кириллицей лежит в /public/fonts. Белый фон, чёрный текст, золотые линии.
 */
import { Document, Font, Page, StyleSheet, Text, View, Path, Svg } from "@react-pdf/renderer";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import type { PrintCompany, PrintOrderData } from "@/lib/print-data";

let fontsRegistered = false;
export function registerPdfFonts(origin: string) {
  if (fontsRegistered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: `${origin}/fonts/Inter-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/Inter-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const GOLD = "#B08D2A";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, color: "#000", padding: 32, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 0.8, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 12 },
  logo: { flexDirection: "row", alignItems: "center", gap: 6 },
  logoText: { fontSize: 18, fontWeight: 700, color: GOLD },
  companySmall: { width: "60%", textAlign: "right", fontSize: 8 },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 80, fontWeight: 700 },
  value: { flex: 1 },
  table: { borderWidth: 0.6, borderColor: "#000", marginTop: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#000" },
  th: { padding: 3, fontWeight: 700, borderRightWidth: 0.6, borderRightColor: "#000" },
  td: { padding: 3, borderRightWidth: 0.6, borderRightColor: "#000" },
  right: { textAlign: "right" },
  totals: { marginTop: 6, marginLeft: "auto", width: 220 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  bold: { fontWeight: 700 },
  signs: { flexDirection: "row", justifyContent: "space-between", marginTop: 28, borderTopWidth: 0.8, borderTopColor: GOLD, paddingTop: 18 },
  sign: { width: "45%", flexDirection: "row", alignItems: "flex-end" },
  signLine: { flex: 1, borderBottomWidth: 0.6, borderBottomColor: "#000", marginHorizontal: 4, height: 10 },
  note: { marginTop: 18, textAlign: "center", fontSize: 7, color: "#444" },
  bank: { borderWidth: 0.6, borderColor: "#000", marginBottom: 10 },
});

function Logo() {
  return (
    <View style={s.logo}>
      <Svg width={20} height={24} viewBox="0 0 30 36">
        <Path d="M3 35V15a12 12 0 0 1 24 0v20" stroke={GOLD} strokeWidth={1.5} fill="none" />
        <Path d="M15 8l4 5-4 5-4-5z" stroke={GOLD} strokeWidth={1.2} fill="none" />
      </Svg>
      <Text style={s.logoText}>NurLife</Text>
    </View>
  );
}

function companyLine(c: PrintCompany) {
  return [c.legal_name || c.company_name, c.inn && `ИНН ${c.inn}`, c.kpp && `КПП ${c.kpp}`, c.ogrn && `ОГРН ${c.ogrn}`, c.address, c.phone && `тел. ${c.phone}`]
    .filter(Boolean)
    .join(", ");
}

function buyerLine(b: PrintOrderData["buyer"]) {
  if (!b) return "Розничный покупатель";
  return [b.legal_name || b.name, b.inn && `ИНН ${b.inn}`, b.kpp && `КПП ${b.kpp}`, b.address, b.phone && `тел. ${b.phone}`].filter(Boolean).join(", ");
}

function Sign({ label, name }: { label: string; name?: string | null }) {
  return (
    <View style={s.sign}>
      <Text>{label}</Text>
      <View style={s.signLine} />
      {name ? <Text>/ {name} /</Text> : null}
    </View>
  );
}

const COLS = [
  { key: "n", title: "№", width: 22, right: false },
  { key: "name", title: "Наименование", width: 0, right: false },
  { key: "sku", title: "Артикул", width: 62, right: false },
  { key: "unit", title: "Ед.", width: 30, right: false },
  { key: "qty", title: "Кол-во", width: 44, right: true },
  { key: "price", title: "Цена", width: 62, right: true },
  { key: "discount", title: "Скидка", width: 40, right: true },
  { key: "total", title: "Сумма", width: 70, right: true },
] as const;

export function OrderPdf({ data }: { data: PrintOrderData }) {
  const c = data.company;
  const hasDiscount = data.lines.some((l) => l.discount > 0);
  const cols = COLS.filter((col) => hasDiscount || col.key !== "discount");
  const cell = (key: (typeof COLS)[number]["key"], l: PrintOrderData["lines"][number]) => {
    switch (key) {
      case "n":
        return String(l.n);
      case "name":
        return l.name;
      case "sku":
        return l.sku;
      case "unit":
        return l.unit;
      case "qty":
        return formatQty(l.qty);
      case "price":
        return formatMoney(l.price, false);
      case "discount":
        return l.discount ? formatPercent(l.discount) : "";
      case "total":
        return formatMoney(l.total, false);
    }
  };

  return (
    <Document title={`${data.title} ${data.number}`} author="NurLife" language="ru">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Logo />
          <Text style={s.companySmall}>{companyLine(c)}</Text>
        </View>

        {data.kind === "invoice" && (
          <View style={s.bank}>
            <View style={s.tr}>
              <Text style={[s.td, { flex: 1 }]}>Банк получателя: {c.bank_name || "—"}</Text>
              <Text style={[s.td, { width: 160, borderRightWidth: 0 }]}>БИК {c.bik || "—"}{"\n"}Сч. № {c.corr_account || "—"}</Text>
            </View>
            <View style={[s.tr, { borderBottomWidth: 0 }]}>
              <Text style={[s.td, { flex: 1 }]}>
                Получатель: {c.legal_name || c.company_name}
                {"\n"}ИНН {c.inn || "—"} КПП {c.kpp || "—"}
              </Text>
              <Text style={[s.td, { width: 160, borderRightWidth: 0 }]}>Сч. № {c.bank_account || "—"}</Text>
            </View>
          </View>
        )}

        <Text style={s.title}>
          {data.title} № {data.number} от {formatDate(data.date)}
        </Text>

        <View style={s.row}>
          <Text style={s.label}>{data.kind === "invoice" ? "Поставщик:" : "Продавец:"}</Text>
          <Text style={s.value}>
            {companyLine(c)}
            {data.kind === "receipt" && data.sellerName ? `\nСотрудник: ${data.sellerName}` : ""}
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>{data.kind === "waybill" ? "Получатель:" : "Покупатель:"}</Text>
          <Text style={s.value}>{buyerLine(data.buyer)}</Text>
        </View>
        {data.kind === "waybill" && data.deliveryAddress ? (
          <View style={s.row}>
            <Text style={s.label}>Адрес:</Text>
            <Text style={s.value}>{data.deliveryAddress}</Text>
          </View>
        ) : null}

        <View style={s.table}>
          <View style={s.tr} fixed>
            {cols.map((col, i) => (
              <Text
                key={col.key}
                style={[s.th, col.width ? { width: col.width } : { flex: 1 }, col.right ? s.right : {}, i === cols.length - 1 ? { borderRightWidth: 0 } : {}]}
              >
                {col.title}
              </Text>
            ))}
          </View>
          {data.lines.map((l, r) => (
            <View key={l.n} style={[s.tr, r === data.lines.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
              {cols.map((col, i) => (
                <Text
                  key={col.key}
                  style={[s.td, col.width ? { width: col.width } : { flex: 1 }, col.right ? s.right : {}, i === cols.length - 1 ? { borderRightWidth: 0 } : {}]}
                >
                  {cell(col.key, l)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={s.totals}>
          {data.discountTotal > 0 && (
            <>
              <View style={s.totalLine}>
                <Text>Сумма без скидки:</Text>
                <Text>{formatMoney(data.subtotal)}</Text>
              </View>
              <View style={s.totalLine}>
                <Text>Скидка:</Text>
                <Text>{formatMoney(data.discountTotal)}</Text>
              </View>
            </>
          )}
          <View style={s.totalLine}>
            <Text style={s.bold}>Итого:</Text>
            <Text style={s.bold}>{formatMoney(data.total)}</Text>
          </View>
          {data.kind === "invoice" && <Text style={s.right}>Без налога (НДС)</Text>}
        </View>

        <Text style={{ marginTop: 8 }}>
          Всего наименований {data.lines.length}, на сумму {formatMoney(data.total)}
        </Text>
        <Text style={[s.bold, { marginTop: 2 }]}>{data.amountWords}</Text>
        {data.kind === "invoice" && data.dueDate ? <Text style={{ marginTop: 6 }}>Оплатить до {formatDate(data.dueDate)}.</Text> : null}

        <View style={s.signs}>
          {data.kind === "receipt" && (
            <>
              <Sign label="Продавец" name={data.sellerName || c.director_name} />
              <Sign label="Покупатель" />
            </>
          )}
          {data.kind === "invoice" && (
            <>
              <Sign label="Руководитель" name={c.director_name} />
              <Sign label="Бухгалтер" name={c.director_name} />
            </>
          )}
          {data.kind === "waybill" && (
            <>
              <Sign label="Отпустил" name={data.sellerName || c.director_name} />
              <Sign label="Получил" />
            </>
          )}
        </View>
        {data.kind === "receipt" && <Text style={s.note}>Нефискальный документ. Спасибо за покупку!</Text>}
      </Page>
    </Document>
  );
}

/** Чек на ленту 80 мм (ширина 226 pt, высота по содержимому). */
export function Receipt80Pdf({ data }: { data: PrintOrderData }) {
  const c = data.company;
  const height = 260 + data.lines.length * 34;
  const center = { textAlign: "center" as const };
  return (
    <Document title={`Товарный чек ${data.number}`} author="NurLife" language="ru">
      <Page size={[226, height]} style={{ fontFamily: "Inter", fontSize: 8, padding: 10, color: "#000" }}>
        <View style={{ alignItems: "center", marginBottom: 4 }}>
          <Logo />
        </View>
        <Text style={center}>{c.legal_name || c.company_name}</Text>
        {c.inn ? <Text style={center}>ИНН {c.inn}</Text> : null}
        {c.address ? <Text style={center}>{c.address}</Text> : null}
        <View style={{ borderBottomWidth: 0.6, borderBottomColor: GOLD, marginVertical: 5 }} />
        <Text style={[center, s.bold]}>Товарный чек № {data.number}</Text>
        <Text style={center}>от {formatDate(data.date)}</Text>
        <Text style={{ marginTop: 3 }}>Покупатель: {data.buyer?.name ?? "Розничный покупатель"}</Text>
        <View style={{ borderBottomWidth: 0.6, borderBottomColor: GOLD, marginVertical: 5 }} />
        {data.lines.map((l) => (
          <View key={l.n} style={{ marginBottom: 4 }}>
            <Text>
              {l.n}. {l.name}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>
                {formatQty(l.qty)} {l.unit} × {formatMoney(l.price, false)}
                {l.discount ? ` −${formatPercent(l.discount)}` : ""}
              </Text>
              <Text>{formatMoney(l.total, false)}</Text>
            </View>
          </View>
        ))}
        <View style={{ borderBottomWidth: 0.6, borderBottomColor: GOLD, marginVertical: 5 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[s.bold, { fontSize: 10 }]}>ИТОГО</Text>
          <Text style={[s.bold, { fontSize: 10 }]}>{formatMoney(data.total)}</Text>
        </View>
        <Text style={{ marginTop: 3, fontSize: 7 }}>{data.amountWords}</Text>
        <Text style={{ marginTop: 8 }}>Продавец: {data.sellerName} ________</Text>
        <Text style={[center, { marginTop: 8, fontSize: 7 }]}>Нефискальный документ. Спасибо за покупку!</Text>
      </Page>
    </Document>
  );
}
