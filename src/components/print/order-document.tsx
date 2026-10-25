import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import type { PrintCompany, PrintOrderData } from "@/lib/print-data";
import { cn } from "@/lib/utils";

/** Логотип для печати: золотая арка и название, без заливок. */
export function PrintLogo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2" style={{ color: "var(--print-gold)" }}>
      <svg width={small ? 22 : 30} height={small ? 26 : 36} viewBox="0 0 30 36" aria-hidden>
        <path d="M3 35V15a12 12 0 0 1 24 0v20" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 8l4 5-4 5-4-5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className={cn("font-display font-bold", small ? "text-lg" : "text-2xl")}>NurLife</span>
    </div>
  );
}

export function companyLine(c: PrintCompany) {
  return [
    c.legal_name || c.company_name,
    c.inn && `ИНН ${c.inn}`,
    c.kpp && `КПП ${c.kpp}`,
    c.ogrn && `ОГРН ${c.ogrn}`,
    c.address,
    c.phone && `тел. ${c.phone}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function buyerLine(b: PrintOrderData["buyer"]) {
  if (!b) return "Розничный покупатель";
  return [b.legal_name || b.name, b.inn && `ИНН ${b.inn}`, b.kpp && `КПП ${b.kpp}`, b.address, b.phone && `тел. ${b.phone}`].filter(Boolean).join(", ");
}

function Signature({ label, name }: { label: string; name?: string | null }) {
  return (
    <div className="flex items-end gap-2 text-sm">
      <span>{label}</span>
      <span className="min-w-36 flex-1 border-b border-black" />
      {name && <span>/ {name} /</span>}
    </div>
  );
}

/** Печатная форма заказа: товарный чек (A4 / 80 мм), счёт на оплату, расходная накладная. */
export function OrderDocument({ data, format }: { data: PrintOrderData; format: "a4" | "80mm" }) {
  if (format === "80mm") return <Receipt80 data={data} />;
  const c = data.company;
  const hasDiscount = data.lines.some((l) => l.discount > 0);

  return (
    <article className="print-sheet mx-auto max-w-[210mm] bg-white p-[12mm] text-[13px] leading-snug shadow-lg">
      <header className="mb-4 flex items-start justify-between gap-4 pb-3" style={{ borderBottom: "1px solid var(--print-gold)" }}>
        <PrintLogo />
        <div className="max-w-[60%] text-right text-xs">{companyLine(c)}</div>
      </header>

      {data.kind === "invoice" && (
        <table className="mb-4 text-xs">
          <tbody>
            <tr>
              <td colSpan={2} rowSpan={2} className="w-1/2">
                {c.bank_name || "—"}
                <br />
                <span className="text-[10px]">Банк получателя</span>
              </td>
              <td className="w-16">БИК</td>
              <td>{c.bik || "—"}</td>
            </tr>
            <tr>
              <td>Сч. №</td>
              <td>{c.corr_account || "—"}</td>
            </tr>
            <tr>
              <td>ИНН {c.inn || "—"}</td>
              <td>КПП {c.kpp || "—"}</td>
              <td rowSpan={2}>Сч. №</td>
              <td rowSpan={2}>{c.bank_account || "—"}</td>
            </tr>
            <tr>
              <td colSpan={2}>
                {c.legal_name || c.company_name}
                <br />
                <span className="text-[10px]">Получатель</span>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <h1 className="mb-3 font-display text-xl font-bold">
        {data.title} № {data.number} от {formatDate(data.date)}
      </h1>

      <dl className="mb-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-semibold">{data.kind === "invoice" ? "Поставщик:" : "Продавец:"}</dt>
        <dd>
          {companyLine(c)}
          {data.kind === "receipt" && data.sellerName && <span className="block">Сотрудник: {data.sellerName}</span>}
        </dd>
        <dt className="font-semibold">{data.kind === "invoice" ? "Покупатель:" : data.kind === "waybill" ? "Получатель:" : "Покупатель:"}</dt>
        <dd>{buyerLine(data.buyer)}</dd>
        {data.kind === "waybill" && data.deliveryAddress && (
          <>
            <dt className="font-semibold">Адрес:</dt>
            <dd>{data.deliveryAddress}</dd>
          </>
        )}
      </dl>

      <table className="mb-2 text-[12px]">
        <thead>
          <tr>
            <th className="w-8">№</th>
            <th>Наименование</th>
            <th className="w-24">Артикул</th>
            <th className="w-12">Ед.</th>
            <th className="w-16 text-right">Кол-во</th>
            <th className="w-24 text-right">Цена</th>
            {hasDiscount && <th className="w-16 text-right">Скидка</th>}
            <th className="w-28 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l) => (
            <tr key={l.n}>
              <td className="text-center">{l.n}</td>
              <td>{l.name}</td>
              <td>{l.sku}</td>
              <td className="text-center">{l.unit}</td>
              <td className="num">{formatQty(l.qty)}</td>
              <td className="num">{formatMoney(l.price, false)}</td>
              {hasDiscount && <td className="num">{l.discount ? formatPercent(l.discount) : ""}</td>}
              <td className="num">{formatMoney(l.total, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mb-3 w-72 text-sm">
        {data.discountTotal > 0 && (
          <>
            <div className="flex justify-between">
              <span>Сумма без скидки:</span>
              <span className="num">{formatMoney(data.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Скидка:</span>
              <span className="num">{formatMoney(data.discountTotal)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold">
          <span>Итого:</span>
          <span className="num">{formatMoney(data.total)}</span>
        </div>
        {data.kind === "invoice" && <div className="text-right text-xs">Без налога (НДС)</div>}
      </div>

      <p className="mb-1 text-sm">
        Всего наименований {data.lines.length}, на сумму {formatMoney(data.total)}
      </p>
      <p className="mb-5 text-sm font-semibold">{data.amountWords}</p>

      {data.kind === "invoice" && data.dueDate && <p className="mb-4 text-sm">Оплатить до {formatDate(data.dueDate)}.</p>}

      <div className="gold-line mt-6 grid grid-cols-2 gap-8 pt-6">
        {data.kind === "receipt" && (
          <>
            <Signature label="Продавец" name={data.sellerName || c.director_name} />
            <Signature label="Покупатель" />
          </>
        )}
        {data.kind === "invoice" && (
          <>
            <Signature label="Руководитель" name={c.director_name} />
            <Signature label="Бухгалтер" name={c.director_name} />
          </>
        )}
        {data.kind === "waybill" && (
          <>
            <Signature label="Отпустил" name={data.sellerName || c.director_name} />
            <Signature label="Получил" />
          </>
        )}
      </div>
      {data.kind === "receipt" && <p className="mt-6 text-center text-[10px] text-neutral-600">Нефискальный документ. Спасибо за покупку!</p>}
    </article>
  );
}

/** Товарный чек на ленту 80 мм. */
function Receipt80({ data }: { data: PrintOrderData }) {
  const c = data.company;
  return (
    <article className="print-sheet print-80mm mx-auto w-[80mm] bg-white p-[4mm] text-[11px] leading-tight shadow-lg">
      <div className="mb-2 flex justify-center">
        <PrintLogo small />
      </div>
      <p className="text-center">{c.legal_name || c.company_name}</p>
      {c.inn && <p className="text-center">ИНН {c.inn}</p>}
      {c.address && <p className="text-center">{c.address}</p>}
      {c.phone && <p className="text-center">тел. {c.phone}</p>}
      <div className="gold-line my-2" />
      <p className="text-center font-bold">
        Товарный чек № {data.number}
        <br />
        от {formatDate(data.date)}
      </p>
      <p className="mt-1">Покупатель: {data.buyer?.name ?? "Розничный покупатель"}</p>
      {data.buyer?.phone && <p>Тел.: {data.buyer.phone}</p>}
      <div className="gold-line my-2" />
      <ol className="flex flex-col gap-1.5">
        {data.lines.map((l) => (
          <li key={l.n}>
            <p>
              {l.n}. {l.name}
            </p>
            <p className="text-[10px] text-neutral-700">Арт. {l.sku}</p>
            <p className="flex justify-between">
              <span>
                {formatQty(l.qty)} {l.unit} × {formatMoney(l.price, false)}
                {l.discount ? ` −${formatPercent(l.discount)}` : ""}
              </span>
              <span className="num">{formatMoney(l.total, false)}</span>
            </p>
          </li>
        ))}
      </ol>
      <div className="gold-line my-2" />
      {data.discountTotal > 0 && (
        <p className="flex justify-between">
          <span>Скидка</span>
          <span className="num">{formatMoney(data.discountTotal)}</span>
        </p>
      )}
      <p className="flex justify-between text-sm font-bold">
        <span>ИТОГО</span>
        <span className="num">{formatMoney(data.total)}</span>
      </p>
      <p className="mt-1 text-[10px]">{data.amountWords}</p>
      <p className="mt-3">Продавец: {data.sellerName} ________</p>
      <p className="mt-3 text-center text-[10px]">Нефискальный документ. Спасибо за покупку!</p>
    </article>
  );
}
