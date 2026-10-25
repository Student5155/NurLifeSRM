-- =====================================================================
-- NurLife CRM · 22 · Вспомогательные rpc для интерфейса
-- =====================================================================

-- Главное фото товара: выбранное получает sort_order = 0, остальные
-- сдвигаются, порядок сохраняется. Одна команда — уникальность
-- (product_id, sort_order) проверяется в конце, без конфликтов.
create or replace function public.set_main_product_image(p_image_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_product uuid;
begin
  perform public._require_owner();

  select i.product_id into v_product from public.product_images i where i.id = p_image_id;
  if not found then
    raise exception 'Фото не найдено' using errcode = 'P0002';
  end if;

  with ordered as (
    select i.id,
           (row_number() over (order by case when i.id = p_image_id then -1 else i.sort_order end) - 1)::integer as rn
      from public.product_images i
     where i.product_id = v_product
  )
  update public.product_images i
     set sort_order = o.rn
    from ordered o
   where i.id = o.id and i.sort_order <> o.rn;
end;
$$;

-- Данные для подбора товаров в заказе / быстрой продаже / закупке:
-- цены, ступени и индивидуальные цены клиента одним запросом.
create or replace function public.pricing_context(p_client_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._require_active();
  return jsonb_build_object(
    'settings', (select jsonb_build_object('seller_max_discount', s.seller_max_discount,
                                           'allow_negative_stock', s.allow_negative_stock)
                   from public.settings s),
    'tiers', coalesce((select jsonb_object_agg(t.product_id, t.tiers)
                         from (select pt.product_id,
                                      jsonb_agg(jsonb_build_object('min_qty', pt.min_qty, 'price', pt.price)
                                                order by pt.min_qty) as tiers
                                 from public.product_price_tiers pt group by pt.product_id) t), '{}'::jsonb),
    'client', case when p_client_id is null then null else (
       select jsonb_build_object(
         'id', c.id, 'name', c.name, 'type', c.type, 'discount_percent', c.discount_percent,
         'credit_limit', c.credit_limit, 'address', c.address,
         'debt', public._client_debt(c.id),
         'prices', coalesce((select jsonb_object_agg(cp.product_id, cp.price)
                               from public.client_prices cp where cp.client_id = c.id), '{}'::jsonb))
         from public.clients c where c.id = p_client_id) end
  );
end;
$$;

grant execute on function public.set_main_product_image(uuid) to authenticated;
grant execute on function public.pricing_context(uuid) to authenticated;
