import { ACTION_LABEL, AuditDiff } from "@/components/audit-diff";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Json } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";

interface Row {
  id: number;
  action: string;
  old_data: Json | null;
  new_data: Json | null;
  changed_by: string | null;
  created_at: string;
}

export function HistoryTable({ rows, managers }: { rows: Row[]; managers: { id: string; full_name: string }[] }) {
  const names = new Map(managers.map((m) => [m.id, m.full_name]));
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Когда</TableHead>
            <TableHead>Кто</TableHead>
            <TableHead>Что изменилось</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                Изменений нет
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
              <TableCell>{r.changed_by ? (names.get(r.changed_by) ?? "—") : "Система"}</TableCell>
              <TableCell>
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">{ACTION_LABEL[r.action] ?? r.action}</span>
                <AuditDiff action={r.action} oldData={r.old_data} newData={r.new_data} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
