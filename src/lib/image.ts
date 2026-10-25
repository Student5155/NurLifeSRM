"use client";

import { IMAGE_MAX_SIDE } from "@/lib/constants";

/**
 * Сжатие фото в браузере: длинная сторона ≤ 1600 px, WebP (или JPEG,
 * если браузер не умеет WebP). Возвращает Blob и расширение файла.
 */
export async function compressImage(
  file: File,
  maxSide = IMAGE_MAX_SIDE,
  quality = 0.85,
): Promise<{ blob: Blob; ext: "webp" | "jpg"; type: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не поддерживает обработку изображений");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", type: "image/webp" };
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Не удалось сжать изображение");
  return { blob: jpeg, ext: "jpg", type: "image/jpeg" };
}
