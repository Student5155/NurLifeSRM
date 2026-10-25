import { formatDate, formatMoney } from "@/lib/format";
import type { PrintCompany } from "@/lib/print-data";
import { companyLine, PrintLogo } from "./order-document";

export interface StatementPrint {
  client: { id: string; name: string; legal_name: string | null; inn: string | null };
  from: string;
  to: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  rows: { date: string; doc: string; debit: number; credit: number }[];
  company: PrintCompany;
  signer: string;
}

export function closingText(d: StatementPrint) {
  const who = d.client.legal_name || d.client.name;
  if (d.closing > 0) return `Задолженность ${who} перед ${d.company.legal_name || d.company.company_name} на ${formatDate(d.to)} составляет ${formatMoney(d.closing)}.`;
  if (d.closing < 0) return `Задолженность ${d.company.legal_name || d.company.company_name} перед ${who} (аванс) на ${formatDate(d.to)} составляет ${formatMoney(-d.closing)}.`;
  return `Взаимная задолженность на ${formatDate(d.to)} отсутствует.`;
}

/** Акт сверки взаиморасчётов — печатный вариант. */
export function StatementDocument({ data }: { data: StatementPrint }) {
  const money = (v: number) => (v ? formatMoney(v, false) : "");
  return (
    <article className="print-sheet mx-auto max-w-[210mm] bg-white p-[12mm] text-[13px] leading-snug shadow-lg">
      <header className="mb-4 flex items-start justify-between gap-4 pb-3" style={{ borderBottom: "1px solid var(--print-gold)" }}>
        <PrintLogo />
        <div className="max-w-[60%] text-right text-xs">{companyLine(data.company)}</div>
      </header>
      <h1 className="mb-1 text-center font-display text-xl font-bold">Акт сверки взаимных расчётов</h1>
      <p className="mb-4 text-center">
        за период с {formatDate(data.from)} по {formatDate(data.to)}
        <br />
        между {data.company.legal_name || data.company.company_name} и {data.client.legal_name || data.client.name}
        {data.client.inn ? ` (ИНН ${data.client.inn})` : ""}
      </p>
      <table className="mb-4 text-[12px]">
        <thead>
          <tr>
            <th className="w-24">Дата</th>
            <th>Документ</th>
            <th className="w-32 text-right">Дебет</th>
            <th className="w-32 text-right">Кредит</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2} className="font-semibold">
              Сальдо начальное
            </td>
            <td className="num">{data.opening > 0 ? money(data.opening) : ""}</td>
            <td className="num">{data.opening < 0 ? money(-data.opening) : ""}</td>
          </tr>
          {data.rows.map((r, i) => (
            <tr key={i}>
              <td>{formatDate(r.date)}</td>
              <td>{r.doc}</td>
              <td className="num">{money(r.debit)}</td>
              <td className="num">{money(r.credit)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="font-semibold">
              Обороты за период
            </td>
            <td className="num font-semibold">{money(data.debit)}</td>
            <td className="num font-semibold">{money(data.credit)}</td>
          </tr>
          <tr>
            <td colSpan={2} className="font-semibold">
              Сальдо конечное
            </td>
            <td className="num font-semibold">{data.closing > 0 ? money(data.closing) : ""}</td>
            <td className="num font-semibold">{data.closing < 0 ? money(-data.closing) : ""}</td>
          </tr>
        </tbody>
      </table>
      <p className="mb-8 font-semibold">{closingText(data)}</p>
      <div className="grid grid-cols-2 gap-8 pt-6" style={{ borderTop: "1px solid var(--print-gold)" }}>
        <div className="text-sm">
          <p className="mb-6">От {data.company.legal_name || data.company.company_name}</p>
          <p>________________ / {data.signer} /</p>
        </div>
        <div className="text-sm">
          <p className="mb-6">От {data.client.legal_name || data.client.name}</p>
          <p>________________ / ________________ /</p>
        </div>
      </div>
    </article>
  );
}
