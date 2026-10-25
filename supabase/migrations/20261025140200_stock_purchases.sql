-- =====================================================================
-- NurLife CRM · 18 · Склад и закупки (только owner)
-- rpc: save_stock_document, post_adjustment, post_inventory,
--      save_purchase, set_purchase_status, post_receipt
-- =====================================================================

-- ---------------------------------------------------------------------
-- Черновик корректировки / инвентаризации
-- payload: {type, reason, items: [{product_id, qty_actual}]}
-- ---------------------------------------------------------------------
create or replace function public.save_stock_document(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc  public.stock_adjustments%rowtype;
  v_id   uuid;
  v_item jsonb;
begin
  perform public._require_owner();

  if p_id is null then
    insert into public.stock_adjustments (type, reason)
    values (coalesce(p_payload ->> 'type', 'adjustment'), nullif(trim(p_payload ->> 'reason'), ''))
    returning id into v_id;
  else
    select * into v_doc from public.stock_adjustments where id = p_id for update;
    if not found then
      raise exception 'Документ не найден' using errcode = 'P0002';
    end if;
    if v_doc.status <> 'draft' then
      raise exception 'Проведённый документ изменить нельзя' using errcode = 'P0001';
    end if;
    v_id := p_id;
    update public.stock_adjustments set reason = nullif(trim(p_payload ->> 'reason'), '') where id = v_id;
    delete from public.stock_adjustment_items where adjustment_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
    insert into public.stock_adjustment_items (adjustment_id, product_id, qty_expected, qty_actual)
    select v_id, s.product_id, s.qty_on_hand, (v_item ->> 'qty_actual')::numeric
      from public.stock s
     where s.product_id = (v_item ->> 'product_id')::uuid
    on conflict (adjustment_id, product_id) do update set qty_actual = excluded.qty_actual;
  end loop;

  return v_id;
end;
$$;

-- Проведение: фактический остаток = qty_actual; движение на разницу.
create or replace function public._post_stock_document(p_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc      public.stock_adjustments%rowtype;
  v_item     record;
  v_expected numeric;
  v_avg      numeric;
begin
  perform public._require_owner();

  select * into v_doc from public.stock_adjustments where id = p_id for update;
  if not found then
    raise exception 'Документ не найден' using errcode = 'P0002';
  end if;
  if v_doc.type <> p_type then
    raise exception 'Неверный тип документа' using errcode = 'P0001';
  end if;
  if v_doc.status <> 'draft' then
    raise exception 'Документ уже проведён' using errcode = 'P0001';
  end if;
  if p_type = 'adjustment' and nullif(trim(v_doc.reason), '') is null then
    raise exception 'Укажите причину корректировки' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.stock_adjustment_items where adjustment_id = p_id) then
    raise exception 'В документе нет товаров' using errcode = 'P0001';
  end if;

  for v_item in select i.id, i.product_id, i.qty_actual from public.stock_adjustment_items i
                 where i.adjustment_id = p_id order by i.product_id loop
    select s.qty_on_hand, s.avg_cost into v_expected, v_avg
      from public.stock s where s.product_id = v_item.product_id for update;

    update public.stock_adjustment_items set qty_expected = v_expected where id = v_item.id;

    if v_item.qty_actual <> v_expected then
      perform public._stock_apply(v_item.product_id, p_type::public.movement_type,
                                  v_item.qty_actual - v_expected, 0, v_avg, 'adjustment', p_id);
    end if;
  end loop;

  update public.stock_adjustments
     set status = 'posted', posted_by = auth.uid(), posted_at = now()
   where id = p_id;
end;
$$;

create or replace function public.post_adjustment(p_id uuid)
returns void language sql security definer set search_path = ''
as $$ select public._post_stock_document(p_id, 'adjustment') $$;

create or replace function public.post_inventory(p_id uuid)
returns void language sql security definer set search_path = ''
as $$ select public._post_stock_document(p_id, 'inventory') $$;

-- Проведённый документ неизменяем.
create or replace function public.guard_posted_stock_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'stock_adjustments' then
    if old.status = 'posted' then
      raise exception 'Проведённый документ изменить нельзя' using errcode = 'P0001';
    end if;
  elsif exists (select 1 from public.stock_adjustments a
                 where a.id = coalesce(new.adjustment_id, old.adjustment_id) and a.status = 'posted') then
    raise exception 'Проведённый документ изменить нельзя' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger stock_adjustments_guard_posted
  before update or delete on public.stock_adjustments
  for each row execute function public.guard_posted_stock_document();

create trigger stock_adjustment_items_guard_posted
  before insert or update or delete on public.stock_adjustment_items
  for each row execute function public.guard_posted_stock_document();

-- ---------------------------------------------------------------------
-- Закупки
-- payload: {supplier_id, supplier_invoice, items: [{product_id, qty, unit_cost}]}
-- ---------------------------------------------------------------------
create or replace function public._recalc_purchase(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.purchases p
     set total = coalesce((select sum(i.line_total) from public.purchase_items i where i.purchase_id = p_id), 0),
         paid_amount = coalesce((select sum(pm.amount) from public.payments pm
                                  where pm.purchase_id = p_id and pm.direction = 'out' and not pm.is_void), 0)
   where p.id = p_id
$$;

create or replace function public.save_purchase(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
  v_id       uuid;
  v_item     jsonb;
  v_qty      numeric;
  v_cost     numeric;
begin
  perform public._require_owner();

  if jsonb_typeof(p_payload -> 'items') <> 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'Добавьте в закупку хотя бы один товар' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.purchases (supplier_id, supplier_invoice)
    values ((p_payload ->> 'supplier_id')::uuid, nullif(trim(p_payload ->> 'supplier_invoice'), ''))
    returning id into v_id;
  else
    select * into v_purchase from public.purchases where id = p_id for update;
    if not found then
      raise exception 'Закупка не найдена' using errcode = 'P0002';
    end if;
    if v_purchase.status <> 'draft' then
      raise exception 'Изменять можно только черновик закупки' using errcode = 'P0001';
    end if;
    v_id := p_id;
    update public.purchases
       set supplier_id = (p_payload ->> 'supplier_id')::uuid,
           supplier_invoice = nullif(trim(p_payload ->> 'supplier_invoice'), '')
     where id = v_id;
    delete from public.purchase_items where purchase_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    v_qty  := (v_item ->> 'qty')::numeric;
    v_cost := round((v_item ->> 'unit_cost')::numeric, 2);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Количество должно быть больше нуля' using errcode = 'P0001';
    end if;
    if v_cost is null or v_cost < 0 then
      raise exception 'Укажите закупочную цену' using errcode = 'P0001';
    end if;
    insert into public.purchase_items (purchase_id, product_id, qty, unit_cost, line_total)
    values (v_id, (v_item ->> 'product_id')::uuid, v_qty, v_cost, round(v_qty * v_cost, 2));
  end loop;

  perform public._recalc_purchase(v_id);
  return v_id;
end;
$$;

-- draft → ordered → (received через post_receipt); draft/ordered → cancelled;
-- ordered → draft, если ничего не принято.
create or replace function public.set_purchase_status(p_id uuid, p_status public.purchase_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
  v_received boolean;
begin
  perform public._require_owner();

  select * into v_purchase from public.purchases where id = p_id for update;
  if not found then
    raise exception 'Закупка не найдена' using errcode = 'P0002';
  end if;

  v_received := exists (select 1 from public.purchase_items i where i.purchase_id = p_id and i.qty_received > 0);

  if p_status = 'received' then
    raise exception 'Для приёмки используйте «Принять товар»' using errcode = 'P0001';
  elsif p_status = 'ordered' and v_purchase.status = 'draft' then
    null;
  elsif p_status = 'draft' and v_purchase.status = 'ordered' and not v_received then
    null;
  elsif p_status = 'cancelled' and v_purchase.status in ('draft', 'ordered') and not v_received then
    null;
  else
    raise exception 'Нельзя перевести закупку из «%» в «%»%', v_purchase.status, p_status,
      case when v_received then ' — часть товара уже принята' else '' end
      using errcode = 'P0001';
  end if;

  update public.purchases set status = p_status where id = p_id;
end;
$$;

-- Приёмка (полная или частичная). p_items: [{item_id, qty}] или NULL — всё оставшееся.
create or replace function public.post_receipt(p_purchase_id uuid, p_items jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
  v_item     record;
  v_qty      numeric;
  v_any      boolean := false;
begin
  perform public._require_owner();

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'Закупка не найдена' using errcode = 'P0002';
  end if;
  if v_purchase.status not in ('draft', 'ordered') then
    raise exception 'Закупку в статусе «%» принять нельзя', v_purchase.status using errcode = 'P0001';
  end if;

  for v_item in
    select i.id, i.product_id, i.qty, i.qty_received, i.unit_cost
      from public.purchase_items i
     where i.purchase_id = p_purchase_id
     order by i.product_id, i.id
       for update
  loop
    if p_items is null then
      v_qty := v_item.qty - v_item.qty_received;
    else
      select coalesce(sum((e ->> 'qty')::numeric), 0) into v_qty
        from jsonb_array_elements(p_items) e
       where (e ->> 'item_id')::uuid = v_item.id;
    end if;

    continue when v_qty = 0;
    if v_qty < 0 or v_qty > v_item.qty - v_item.qty_received then
      raise exception 'Принимаемое количество больше оставшегося (%)', v_item.qty - v_item.qty_received
        using errcode = 'P0001';
    end if;

    perform public._stock_apply(v_item.product_id, 'receipt', v_qty, 0, v_item.unit_cost,
                                'purchase', p_purchase_id,
                                public._moving_avg(v_item.product_id, v_qty, v_item.unit_cost));
    update public.purchase_items set qty_received = qty_received + v_qty where id = v_item.id;
    update public.products set purchase_price = v_item.unit_cost where id = v_item.product_id;
    v_any := true;
  end loop;

  if not v_any then
    raise exception 'Нечего принимать' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.purchase_items i
                  where i.purchase_id = p_purchase_id and i.qty_received < i.qty) then
    update public.purchases set status = 'received', received_at = now() where id = p_purchase_id;
  elsif v_purchase.status = 'draft' then
    update public.purchases set status = 'ordered' where id = p_purchase_id;
  end if;
end;
$$;

-- Защита: принятые количества и закрытые закупки меняются только через rpc
-- (rpc работают от имени владельца функции и проходят проверку).
grant execute on function public.save_stock_document(uuid, jsonb) to authenticated;
grant execute on function public.post_adjustment(uuid) to authenticated;
grant execute on function public.post_inventory(uuid) to authenticated;
grant execute on function public.save_purchase(uuid, jsonb) to authenticated;
grant execute on function public.set_purchase_status(uuid, public.purchase_status) to authenticated;
grant execute on function public.post_receipt(uuid, jsonb) to authenticated;
