"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/input";

export function AuditFilters({
  tables,
  users,
  table,
  user,
}: {
  tables: Record<string, string>;
  users: { id: string; full_name: string }[];
  table: string;
  user: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <NativeSelect value={table} onChange={(e) => set("table", e.target.value)} aria-label="Объект" className="md:w-56">
        <option value="">Все объекты</option>
        {Object.entries(tables).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect value={user} onChange={(e) => set("user", e.target.value)} aria-label="Сотрудник" className="md:w-56">
        <option value="">Все сотрудники</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name || "Без имени"}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
