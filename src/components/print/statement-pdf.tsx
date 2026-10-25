"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";
import { closingText, type StatementPrint } from "./statement-document";

const GOLD = "#B08D2A";
const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, padding: 32, color: "#000" },
  title: { fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  center: { textAlign: "center", marginBottom: 10 },
  table: { borderWidth: 0.6, borderColor: "#000" },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#000" },
  cell: { padding: 3, borderRightWidth: 0.6, borderRightColor: "#000" },
  num: { width: 90, textAlign: "right" },
  bold: { fontWeight: 700 },
});

export function StatementPdf({ data }: { data: StatementPrint }) {
  const company = data.company.legal_name || data.company.company_name;
  const client = data.client.legal_name || data.client.name;
  const m = (v: number) => (v ? formatMoney(v, false) : "");
  const Row = ({ date, doc, debit, credit, bold }: { date: string; doc: string; debit: string; credit: string; bold?: boolean }) => (
    <View style={s.tr} wrap={false}>
      <Text style={[s.cell, { width: 60 }, bold ? s.bold : {}]}>{date}</Text>
      <Text style={[s.cell, { flex: 1 }, bold ? s.bold : {}]}>{doc}</Text>
      <Text style={[s.cell, s.num, bold ? s.bold : {}]}>{debit}</Text>
      <Text style={[s.cell, s.num, { borderRightWidth: 0 }, bold ? s.bold : {}]}>{credit}</Text>
    </View>
  );

  return (
    <Document title={`Акт сверки ${client}`} author="NurLife" language="ru">
      <Page size="A4" style={s.page}>
        <Text style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 6 }}>NurLife</Text>
        <View style={{ borderBottomWidth: 0.8, borderBottomColor: GOLD, marginBottom: 12 }} />
        <Text style={s.title}>Акт сверки взаимных расчётов</Text>
        <Text style={s.center}>
          за период с {formatDate(data.from)} по {formatDate(data.to)} между {company} и {client}
          {data.client.inn ? ` (ИНН ${data.client.inn})` : ""}
        </Text>
        <View style={s.table}>
          <Row date="Дата" doc="Документ" debit="Дебет" credit="Кредит" bold />
          <Row date="" doc="Сальдо начальное" debit={data.opening > 0 ? m(data.opening) : ""} credit={data.opening < 0 ? m(-data.opening) : ""} bold />
          {data.rows.map((r, i) => (
            <Row key={i} date={formatDate(r.date)} doc={r.doc} debit={m(r.debit)} credit={m(r.credit)} />
          ))}
          <Row date="" doc="Обороты за период" debit={m(data.debit)} credit={m(data.credit)} bold />
          <Row date="" doc="Сальдо конечное" debit={data.closing > 0 ? m(data.closing) : ""} credit={data.closing < 0 ? m(-data.closing) : ""} bold />
        </View>
        <Text style={[s.bold, { marginTop: 10 }]}>{closingText(data)}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 30, borderTopWidth: 0.8, borderTopColor: GOLD, paddingTop: 16 }}>
          <View style={{ width: "45%" }}>
            <Text>От {company}</Text>
            <Text style={{ marginTop: 20 }}>________________ / {data.signer} /</Text>
          </View>
          <View style={{ width: "45%" }}>
            <Text>От {client}</Text>
            <Text style={{ marginTop: 20 }}>________________ / ________________ /</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
