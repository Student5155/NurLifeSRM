"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { check, useAction } from "@/hooks/use-action";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow } from "../catalog-list";

const MAX_DEPTH = 3;

type Edit = { mode: "create"; parentId: string | null } | { mode: "rename"; category: CategoryRow };

export function CategoryTree({ categories, counts }: { categories: CategoryRow[]; counts: Record<string, number> }) {
  const { run, pending } = useAction();
  const [edit, setEdit] = React.useState<Edit | null>(null);
  const [name, setName] = React.useState("");

  const children = (parent: string | null) =>
    categories.filter((c) => c.parent_id === parent).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"));

  function open(e: Edit) {
    setEdit(e);
    setName(e.mode === "rename" ? e.category.name : "");
  }

  async function save() {
    if (!edit || !name.trim()) return;
    const supabase = createClient();
    const ok = await run(
      async () => {
        if (edit.mode === "create") {
          const siblings = children(edit.parentId);
          check(
            await supabase.from("categories").insert({
              name: name.trim(),
              parent_id: edit.parentId,
              sort_order: siblings.length ? Math.max(...siblings.map((s) => s.sort_order)) + 1 : 0,
            }),
          );
        } else {
          check(await supabase.from("categories").update({ name: name.trim() }).eq("id", edit.category.id));
        }
        return true;
      },
      { success: "Сохранено" },
    );
    if (ok) setEdit(null);
  }

  async function move(c: CategoryRow, dir: -1 | 1) {
    const list = children(c.parent_id);
    const i = list.findIndex((x) => x.id === c.id);
    const other = list[i + dir];
    if (!other) return;
    const supabase = createClient();
    await run(async () => {
      // Порядок без уникального ограничения — просто пересчитываем всем соседям.
      const reordered = [...list];
      [reordered[i], reordered[i + dir]] = [reordered[i + dir], reordered[i]];
      for (const [idx, item] of reordered.entries()) {
        if (item.sort_order !== idx) check(await supabase.from("categories").update({ sort_order: idx }).eq("id", item.id));
      }
    });
  }

  async function toggle(c: CategoryRow) {
    await run(async () => check(await createClient().from("categories").update({ is_active: !c.is_active }).eq("id", c.id)));
  }

  async function remove(c: CategoryRow) {
    if (!confirm(`Удалить категорию «${c.name}»?`)) return;
    await run(async () => check(await createClient().from("categories").delete().eq("id", c.id)), { success: "Категория удалена" });
  }

  function render(parent: string | null, depth: number): React.ReactNode {
    const list = children(parent);
    if (!list.length) return null;
    return (
      <ul className={depth ? "ml-4 border-l border-border pl-3 md:ml-6" : ""}>
        {list.map((c, i) => (
          <li key={c.id}>
            <div className="flex flex-wrap items-center gap-1 py-1.5">
              <span className="mr-auto flex min-w-0 items-center gap-2">
                <span className={c.is_active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{c.name}</span>
                <Badge>{counts[c.id] ?? 0} тов.</Badge>
              </span>
              <Button size="icon" variant="ghost" onClick={() => move(c, -1)} disabled={i === 0 || pending} aria-label="Выше">
                <ArrowUp />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(c, 1)} disabled={i === list.length - 1 || pending} aria-label="Ниже">
                <ArrowDown />
              </Button>
              {depth + 1 < MAX_DEPTH && (
                <Button size="icon" variant="ghost" onClick={() => open({ mode: "create", parentId: c.id })} aria-label={`Подкатегория в «${c.name}»`}>
                  <FolderPlus />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => open({ mode: "rename", category: c })} aria-label="Переименовать">
                <Pencil />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => toggle(c)} aria-label={c.is_active ? "Скрыть" : "Показать"}>
                {c.is_active ? <EyeOff /> : <Eye />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Удалить">
                <Trash2 />
              </Button>
            </div>
            {render(c.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Button onClick={() => open({ mode: "create", parentId: null })}>
          <Plus aria-hidden /> Категория
        </Button>
      </div>
      <Card>
        <CardContent className="pt-4 md:pt-5">
          {categories.length === 0 ? <p className="py-6 text-center text-muted-foreground">Категорий пока нет</p> : render(null, 0)}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.mode === "rename" ? "Переименовать" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Название" htmlFor="cat-name">
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Отмена
              </Button>
              <Button type="submit" loading={pending} disabled={!name.trim()}>
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
