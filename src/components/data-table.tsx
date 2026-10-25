"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // className для ячеек и заголовков колонки (например, "num" — числа вправо).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Карточка строки для экранов < 768 px (таблица превращается в список). */
  renderCard?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  /** Поля для поиска; по умолчанию — все строковые значения строки. */
  searchKeys?: (keyof T)[];
  toolbar?: React.ReactNode;
  emptyText?: string;
  pageSize?: number;
  initialSorting?: SortingState;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  renderCard,
  onRowClick,
  searchPlaceholder = "Поиск…",
  searchKeys,
  toolbar,
  emptyText = "Ничего не найдено",
  pageSize = 25,
  initialSorting = [],
  footer,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value: string) => {
      const q = value.trim().toLowerCase();
      if (!q) return true;
      const original = row.original as Record<string, unknown>;
      const keys = (searchKeys as string[] | undefined) ?? Object.keys(original);
      return keys.some((k) => {
        const v = original[k];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:max-w-sm md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              table.setPageIndex(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
            type="search"
          />
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2 md:ml-auto">{toolbar}</div>}
      </div>

      {/* Телефон: карточки */}
      {renderCard && (
        <ul className="flex flex-col gap-2 md:hidden">
          {rows.length === 0 && <li className="py-8 text-center text-muted-foreground">{emptyText}</li>}
          {rows.map((row) => (
            <li key={row.id}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row.original)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary"
                >
                  {renderCard(row.original)}
                </button>
              ) : (
                <div className="rounded-lg border border-border bg-card p-3">{renderCard(row.original)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Компьютер: таблица */}
      <div className={cn("rounded-lg border border-border bg-card", renderCard && "hidden md:block")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as { className?: string } | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={meta?.className}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" && <ArrowUp className="size-3" aria-hidden />}
                          {sorted === "desc" && <ArrowDown className="size-3" aria-hidden />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <TableCell key={cell.id} className={meta?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
          {footer}
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm text-muted-foreground" aria-label="Страницы">
          <span>
            {pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min((pageIndex + 1) * table.getState().pagination.pageSize, total)} из {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Предыдущая страница">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Следующая страница">
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
