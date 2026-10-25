"use client";

import * as React from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { check, useAction } from "@/hooks/use-action";
import { MAX_PRODUCT_IMAGES, PRODUCT_IMAGES_BUCKET } from "@/lib/constants";
import { compressImage } from "@/lib/image";
import { rpc } from "@/lib/rpc";
import { productImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

interface Img {
  id: string;
  storage_path: string;
  sort_order: number;
}

/** До 10 фото, сжатие до 1600 px в браузере, первое (sort_order = 0) — главное. */
export function ProductImages({ productId, images }: { productId: string; images: Img[] }) {
  const { run, pending } = useAction();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const left = MAX_PRODUCT_IMAGES - images.length;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, left);
    if (files.length > left) toast.warning(`Можно добавить ещё ${left} фото`);
    const supabase = createClient();

    await run(
      async () => {
        const used = new Set(images.map((i) => i.sort_order));
        const nextOrder = () => {
          let n = 0;
          while (used.has(n)) n++;
          used.add(n);
          return n;
        };
        for (const file of list) {
          const { blob, ext, type } = await compressImage(file);
          const path = `${productId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, blob, { contentType: type, upsert: false });
          if (error) throw new Error(`Не удалось загрузить фото: ${error.message}`);
          const res = await supabase.from("product_images").insert({ product_id: productId, storage_path: path, sort_order: nextOrder() });
          if (res.error) {
            await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
            check(res);
          }
        }
      },
      { success: list.length > 1 ? "Фото загружены" : "Фото загружено" },
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  async function makeMain(img: Img) {
    await run(() => rpc(createClient(), "set_main_product_image", { p_image_id: img.id }), { success: "Главное фото изменено" });
  }

  async function remove(img: Img) {
    const supabase = createClient();
    await run(async () => {
      check(await supabase.from("product_images").delete().eq("id", img.id));
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([img.storage_path]);
    }, { success: "Фото удалено" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фото</CardTitle>
        <CardDescription>
          {images.length} из {MAX_PRODUCT_IMAGES}. Звёздочка — главное фото.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="grid grid-cols-2 gap-2">
          {images.map((img, i) => (
            <li key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productImageUrl(img.storage_path) ?? ""} alt={`Фото ${i + 1}`} className="aspect-square w-full rounded-md border border-border object-cover" />
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <Button
                  type="button"
                  size="icon"
                  variant={i === 0 ? "default" : "secondary"}
                  onClick={() => i !== 0 && makeMain(img)}
                  aria-label={i === 0 ? "Главное фото" : "Сделать главным"}
                  aria-pressed={i === 0}
                  disabled={pending}
                >
                  <Star />
                </Button>
                <Button type="button" size="icon" variant="secondary" onClick={() => remove(img)} aria-label="Удалить фото" disabled={pending}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" id="product-photo" onChange={(e) => upload(e.target.files)} />
        <Button type="button" variant="outline" disabled={left <= 0 || pending} loading={pending} onClick={() => inputRef.current?.click()}>
          <ImagePlus aria-hidden /> Добавить фото
        </Button>
      </CardContent>
    </Card>
  );
}
