import { InfoRow } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Views } from "@/lib/database.types";
import { formatMoney, formatQty } from "@/lib/format";
import { productImageUrl } from "@/lib/storage";

/** Карточка товара для продавца: только цены продажи и остатки. */
export function ProductView({
  item,
  tiers,
  images,
}: {
  item: Views<"catalog_items">;
  tiers: { id: string; min_qty: number; price: number }[];
  images: { id: string; storage_path: string }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Цены и остатки</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Розничная цена">{formatMoney(item.retail_price)}</InfoRow>
            <InfoRow label="Оптовая цена">{formatMoney(item.wholesale_price)}</InfoRow>
            {tiers.map((t) => (
              <InfoRow key={t.id} label={`Опт от ${formatQty(t.min_qty)} ${item.unit_code}`}>
                {formatMoney(t.price)}
              </InfoRow>
            ))}
            <InfoRow label="На складе">
              {formatQty(item.qty_on_hand)} {item.unit_code}
            </InfoRow>
            <InfoRow label="В резерве">
              {formatQty(item.qty_reserved)} {item.unit_code}
            </InfoRow>
            <InfoRow label="Доступно">
              <span className={item.is_low_stock ? "font-semibold text-destructive" : "font-semibold"}>
                {formatQty(item.qty_available)} {item.unit_code}
              </span>
            </InfoRow>
            <InfoRow label="Категория">{item.category_name}</InfoRow>
            <InfoRow label="Штрихкод">{item.barcode}</InfoRow>
            <InfoRow label="Статус">{item.is_active ? <Badge tone="success">В продаже</Badge> : <Badge tone="danger">Снят</Badge>}</InfoRow>
          </dl>
          {item.description && <p className="mt-4 whitespace-pre-line text-sm">{item.description}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Фото</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {images.length === 0 && <p className="col-span-2 text-sm text-muted-foreground">Фото нет</p>}
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={productImageUrl(img.storage_path) ?? ""} alt={item.name ?? ""} className="aspect-square w-full rounded-md border border-border object-cover" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
