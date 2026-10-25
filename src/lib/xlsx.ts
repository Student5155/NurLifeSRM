"use client";

/**
 * Импорт/экспорт XLSX в браузере (exceljs загружается только по требованию).
 */

export interface XlsxColumn<T> {
  header: string;
  key: keyof T & string;
  width?: number;
  /** Формат Excel, например '#,##0.00' для денег или 'dd.mm.yyyy' для дат. */
  numFmt?: string;
}

export interface XlsxSheet<T> {
  name: string;
  columns: XlsxColumn<T>[];
  rows: T[];
  title?: string;
}

async function loadExcel() {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

export const MONEY_FMT = '#,##0.00 "₽"';
export const QTY_FMT = "#,##0.###";
export const DATE_FMT = "dd.mm.yyyy";

export async function exportXlsx<T extends object>(filename: string, sheets: XlsxSheet<T>[]) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "NurLife";
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31));
    let startRow = 1;
    if (sheet.title) {
      ws.getCell(1, 1).value = sheet.title;
      ws.getCell(1, 1).font = { bold: true, size: 13 };
      startRow = 3;
    }
    sheet.columns.forEach((c, i) => {
      const cell = ws.getCell(startRow, i + 1);
      cell.value = c.header;
      cell.font = { bold: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB08D2A" } } };
      ws.getColumn(i + 1).width = c.width ?? Math.max(12, c.header.length + 2);
      if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
    });
    sheet.rows.forEach((row, r) => {
      sheet.columns.forEach((c, i) => {
        const raw = (row as Record<string, unknown>)[c.key];
        let value: unknown = raw ?? null;
        if (c.numFmt === DATE_FMT && typeof raw === "string") value = new Date(raw);
        else if ((c.numFmt === MONEY_FMT || c.numFmt === QTY_FMT) && raw !== null && raw !== undefined) value = Number(raw);
        ws.getCell(startRow + 1 + r, i + 1).value = value as never;
      });
    });
    ws.views = [{ state: "frozen", ySplit: startRow }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Первый лист → массив объектов по строке заголовков (ключи через mapHeader). */
export async function readXlsx(
  file: File,
  mapHeader: (header: string) => string | null,
): Promise<Record<string, string>[]> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const keys: (string | null)[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    keys[col] = mapHeader(String(cell.text ?? "").trim());
  });

  const rows: Record<string, string>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, index) => {
    if (index === 1) return;
    const obj: Record<string, string> = {};
    let any = false;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = keys[col];
      if (!key) return;
      const text = String(cell.text ?? "").trim();
      if (text) any = true;
      obj[key] = text;
    });
    if (any) rows.push(obj);
  });
  return rows;
}
