-- =====================================================================
-- NurLife CRM · 17 · Расчёт цены, заказы, статусы, быстрая продажа
--
-- Внутренние функции начинаются с «_» и не открыты через API.
-- Публичные rpc: calc_price, save_order, change_order_status,
-- quick_sale, client_debt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Проверки доступа
-- ---------------------------------------------------------------------
create or replace function public._require_active()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'Нет доступа: войдите в систему' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._require_owner()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Действие доступно только владельцу' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Автоцена
--   1) индивидуальная цена клиента (client_price) — окончательная,
--      скидка клиента к ней не применяется;
--   2) для оптового заказа — оптовая ступень по количеству (tier);
--   3) базовая оптовая или розничная цена;
--   4) к 2–3 применяется скидка клиента (discount_percent).
-- ---------------------------------------------------------------------
create or replace function public._calc_price(
  p_product_id uuid,
  p_qty        numeric,
  p_price_type public.client_type,
  p_client_id  uuid default null
)
returns table (unit_price numeric, price_source text, discount_percent numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_product record;
  v_price   numeric;
  v_source  text;
  v_disc    numeric := 0;
begin
  select pr.retail_price, pr.wholesale_price
    into v_product
    from public.products pr
   where pr.id = p_product_id;

  if not found then
    raise exception 'Товар не найден' using errcode = 'P0002';
  end if;

  if p_client_id is not null then
    select cp.price into v_price
      from public.client_prices cp
     where cp.client_id = p_client_id and cp.product_id = p_product_id;
    if found then
      v_source := 'client_price';
    end if;

    select coalesce(c.discount_percent, 0) into v_disc
      from public.clients c
     where c.id = p_client_id;
  end if;

  if v_source is null and p_price_type = 'wholesale' then
    select t.price into v_price
      from public.product_price_tiers t
     where t.product_id = p_product_id and t.min_qty <= p_qty
     order by t.min_qty desc
     limit 1;
    if found then
      v_source := 'tier';
    end if;
  end if;

  if v_source is null then
    v_price  := case p_price_type when 'wholesale' then v_product.wholesale_price else v_product.retail_price end;
    v_source := p_price_type::text;
  end if;

  if v_source = 'client_price' then
    v_disc := 0;
  end if;

  return query select v_price::numeric, v_source, coalesce(v_disc, 0)::numeric;
end;
$$;

create or replace function public.calc_price(
  p_product_id uuid,
  p_qty        numeric,
  p_price_type public.client_type,
  p_client_id  uuid default null
)
returns table (unit_price numeric, price_source text, discount_percent numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_active();
  return query select * from public._calc_price(p_product_id, p_qty, p_price_type, p_client_id);
end;
$$;

-- Сумма строки: qty × цена × (1 − скидка), до копеек.
create or replace function public._line_total(p_qty numeric, p_price numeric, p_discount numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$ select round(p_qty * p_price * (1 - p_discount / 100), 2) $$;

-- ---------------------------------------------------------------------
-- Лимит скидки продавца
-- Снижение = 1 − (цена × (1 − скидка)) / (автоцена × (1 − скидка клиента)).
-- Скидка клиента, заданная владельцем, в лимит продавца не входит.
-- ---------------------------------------------------------------------
create or replace function public._check_seller_discount(
  p_client_id  uuid,
  p_price_type public.client_type,
  p_product_id uuid,
  p_qty        numeric,
  p_unit_price numeric,
  p_discount   numeric
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit      numeric;
  v_auto       record;
  v_auto_final numeric;
  v_final      numeric;
  v_reduction  numeric;
begin
  if public.current_user_role() is distinct from 'seller' then
    return;  -- owner без ограничений; системные вызовы без пользователя
  end if;

  select s.seller_max_discount into v_limit from public.settings s;

  select * into v_auto from public._calc_price(p_product_id, p_qty, p_price_type, p_client_id);
  v_auto_final := v_auto.unit_price * (1 - v_auto.discount_percent / 100);
  if v_auto_final <= 0 then
    return;
  end if;

  v_final     := p_unit_price * (1 - coalesce(p_discount, 0) / 100);
  v_reduction := round((1 - v_final / v_auto_final) * 100, 2);

  if v_reduction > v_limit then
    raise exception 'Скидка %%% превышает лимит продавца %%%', v_reduction, v_limit
      using errcode = 'P0001',
            hint = 'Большую скидку может дать только владелец';
  end if;
end;
$$;

-- Триггер на позиции заказа: та же проверка при любой записи цены/скидки.
create or replace function public.order_items_check_discount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  select o.client_id, o.price_type into v_order from public.orders o where o.id = new.order_id;
  perform public._check_seller_discount(
    v_order.client_id, v_order.price_type, new.product_id, new.qty, new.unit_price, new.discount_percent);
  return new;
end;
$$;

create trigger order_items_check_discount
  before insert or update of unit_price, discount_percent, qty, product_id on public.order_items
  for each row execute function public.order_items_check_discount();

-- ---------------------------------------------------------------------
-- Долг клиента = отгруженные неотменённые заказы − несторнированные
-- входящие платежи. Отрицательное значение — аванс.
-- ---------------------------------------------------------------------
create or replace function public._client_debt(p_client_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(o.total) from public.orders o
                    where o.client_id = p_client_id and o.status in ('shipped', 'paid')), 0)
       - coalesce((select sum(p.amount) from public.payments p
                    where p.client_id = p_client_id and p.direction = 'in' and not p.is_void), 0)
$$;

create or replace function public.client_debt(p_client_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_active();
  return public._client_debt(p_client_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Итоги заказа
-- ---------------------------------------------------------------------
create or replace function public._recalc_order_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal numeric;
  v_total    numeric;
begin
  select coalesce(sum(round(i.qty * i.unit_price, 2)), 0), coalesce(sum(i.line_total), 0)
    into v_subtotal, v_total
    from public.order_items i
   where i.order_id = p_order_id;

  update public.orders
     set subtotal = v_subtotal,
         total = v_total,
         discount_total = v_subtotal - v_total
   where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Склад: единственная точка изменения stock + запись в журнал.
--   p_onhand_delta   — изменение физического остатка
--   p_reserved_delta — изменение резерва
--   p_new_avg        — новая себестоимость (приход/возврат), иначе NULL
-- Возвращает себестоимость ДО движения.
-- ---------------------------------------------------------------------
create or replace function public._stock_apply(
  p_product_id     uuid,
  p_type           public.movement_type,
  p_onhand_delta   numeric,
  p_reserved_delta numeric,
  p_unit_cost      numeric,
  p_ref_type       text,
  p_ref_id         uuid,
  p_new_avg        numeric default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock        public.stock%rowtype;
  v_allow_neg    boolean;
  v_new_onhand   numeric;
  v_new_reserved numeric;
  v_name         text;
  v_mov_qty      numeric;
begin
  select * into v_stock from public.stock s where s.product_id = p_product_id for update;
  if not found then
    insert into public.stock (product_id) values (p_product_id);
    select * into v_stock from public.stock s where s.product_id = p_product_id for update;
  end if;

  select s.allow_negative_stock into v_allow_neg from public.settings s;

  v_new_onhand   := v_stock.qty_on_hand + p_onhand_delta;
  v_new_reserved := greatest(v_stock.qty_reserved + p_reserved_delta, 0);

  if not v_allow_neg then
    select p.name into v_name from public.products p where p.id = p_product_id;
    if v_new_onhand < 0 then
      raise exception 'Недостаточно товара «%»: на складе %, требуется %',
        v_name, v_stock.qty_on_hand, -p_onhand_delta using errcode = 'P0001';
    end if;
    if (p_reserved_delta > 0 or p_type in ('adjustment', 'inventory')) and v_new_onhand < v_new_reserved then
      raise exception 'Недостаточно товара «%»: доступно %, требуется %',
        v_name, v_stock.qty_on_hand - v_stock.qty_reserved,
        case when p_reserved_delta > 0 then p_reserved_delta else v_new_reserved - v_new_onhand end
        using errcode = 'P0001';
    end if;
  end if;

  update public.stock
     set qty_on_hand  = v_new_onhand,
         qty_reserved = v_new_reserved,
         avg_cost     = coalesce(p_new_avg, avg_cost)
   where product_id = p_product_id;

  v_mov_qty := case when p_type in ('reserve', 'unreserve') then p_reserved_delta else p_onhand_delta end;
  if v_mov_qty <> 0 then
    insert into public.stock_movements (product_id, type, qty, unit_cost, ref_type, ref_id, balance_after)
    values (p_product_id, p_type, v_mov_qty, p_unit_cost, p_ref_type, p_ref_id, v_new_onhand);
  end if;

  return v_stock.avg_cost;
end;
$$;

-- Скользящая средняя при поступлении qty по цене cost.
create or replace function public._moving_avg(p_product_id uuid, p_qty numeric, p_cost numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when greatest(s.qty_on_hand, 0) + p_qty <= 0 then p_cost
           else round((greatest(s.qty_on_hand, 0) * s.avg_cost + p_qty * p_cost)
                      / (greatest(s.qty_on_hand, 0) + p_qty), 2)
         end
    from public.stock s
   where s.product_id = p_product_id
$$;

-- ---------------------------------------------------------------------
-- Оплата заказа: paid_amount по распределениям несторнированных
-- платежей; авто-переход shipped → paid и обратно при сторно.
-- ---------------------------------------------------------------------
create or replace function public._refresh_order_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_paid  numeric;
  v_pstat public.payment_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return;
  end if;

  select coalesce(sum(a.amount), 0) into v_paid
    from public.payment_allocations a
    join public.payments p on p.id = a.payment_id
   where a.order_id = p_order_id and not p.is_void;

  v_pstat := case
               when v_paid >= v_order.total and v_order.total > 0 then 'paid'
               when v_paid > 0 then 'partial'
               when v_order.total = 0 and v_order.status in ('shipped', 'paid') then 'paid'
               else 'unpaid'
             end;

  update public.orders
     set paid_amount = v_paid, payment_status = v_pstat
   where id = p_order_id;

  if v_order.status = 'shipped' and v_pstat = 'paid' then
    update public.orders set status = 'paid' where id = p_order_id;
    insert into public.order_status_history (order_id, from_status, to_status, comment)
    values (p_order_id, 'shipped', 'paid', 'Автоматически: заказ оплачен');
  elsif v_order.status = 'paid' and v_pstat <> 'paid' then
    update public.orders set status = 'shipped' where id = p_order_id;
    insert into public.order_status_history (order_id, from_status, to_status, comment)
    values (p_order_id, 'paid', 'shipped', 'Автоматически: оплата сторнирована');
  end if;
end;
$$;

create or replace function public.payment_allocations_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public._refresh_order_payment(old.order_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.order_id <> old.order_id or new.amount <> old.amount) then
    perform public._refresh_order_payment(new.order_id);
  end if;
  return null;
end;
$$;

create trigger payment_allocations_refresh
  after insert or update or delete on public.payment_allocations
  for each row execute function public.payment_allocations_refresh();

-- ---------------------------------------------------------------------
-- Распределение свободных сумм платежей клиента по заказам (FIFO):
-- старые платежи → в самые ранние неоплаченные подтверждённые/
-- отгруженные заказы. Новые (редактируемые) заказы не участвуют.
-- ---------------------------------------------------------------------
create or replace function public._allocate_client(p_client_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay   record;
  v_order record;
  v_free  numeric;
  v_amt   numeric;
  v_total numeric := 0;
begin
  if p_client_id is null then
    return 0;
  end if;

  for v_pay in
    select p.id,
           p.amount - coalesce((select sum(a.amount) from public.payment_allocations a
                                 where a.payment_id = p.id), 0) as free
      from public.payments p
     where p.client_id = p_client_id and p.direction = 'in' and not p.is_void
     order by p.paid_at, p.created_at
       for update of p
  loop
    v_free := v_pay.free;
    while v_free > 0 loop
      select o.id, o.total - o.paid_amount as due
        into v_order
        from public.orders o
       where o.client_id = p_client_id
         and o.status in ('confirmed', 'assembled', 'shipped')
         and o.paid_amount < o.total
       order by coalesce(o.shipped_at, o.confirmed_at, o.created_at), o.created_at
       limit 1
         for update;
      exit when not found;

      v_amt := least(v_free, v_order.due);
      insert into public.payment_allocations (payment_id, order_id, amount)
      values (v_pay.id, v_order.id, v_amt)
      on conflict (payment_id, order_id)
        do update set amount = public.payment_allocations.amount + excluded.amount;

      v_free  := v_free - v_amt;
      v_total := v_total + v_amt;
    end loop;
  end loop;

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- Создание / изменение заказа (только статус «Новый»)
-- payload: {client_id, price_type, delivery_address, comment, manager_id,
--           items: [{product_id, qty, unit_price?, discount_percent?}]}
-- unit_price задаётся только при ручной цене; иначе — автоцена.
-- discount_percent по умолчанию — скидка клиента.
-- ---------------------------------------------------------------------
create or replace function public.save_order(p_order_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order      public.orders%rowtype;
  v_id         uuid;
  v_client_id  uuid := nullif(p_payload ->> 'client_id', '')::uuid;
  v_price_type public.client_type;
  v_client     public.clients%rowtype;
  v_manager    uuid;
  v_item       jsonb;
  v_product    uuid;
  v_qty        numeric;
  v_price      numeric;
  v_disc       numeric;
  v_source     text;
  v_auto       record;
  v_active     boolean;
begin
  perform public._require_active();

  if v_client_id is not null then
    select * into v_client from public.clients where id = v_client_id;
    if not found then
      raise exception 'Клиент не найден' using errcode = 'P0002';
    end if;
    if not v_client.is_active then
      raise exception 'Клиент «%» неактивен', v_client.name using errcode = 'P0001';
    end if;
  end if;

  v_price_type := coalesce(nullif(p_payload ->> 'price_type', '')::public.client_type, v_client.type, 'retail');

  if jsonb_typeof(p_payload -> 'items') <> 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'Добавьте в заказ хотя бы один товар' using errcode = 'P0001';
  end if;

  v_manager := case
                 when public.is_owner() then coalesce(nullif(p_payload ->> 'manager_id', '')::uuid, auth.uid())
                 else auth.uid()
               end;

  if p_order_id is null then
    insert into public.orders (client_id, price_type, delivery_address, comment, manager_id)
    values (v_client_id, v_price_type,
            coalesce(nullif(p_payload ->> 'delivery_address', ''), v_client.address),
            nullif(p_payload ->> 'comment', ''), v_manager)
    returning id into v_id;
  else
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then
      raise exception 'Заказ не найден' using errcode = 'P0002';
    end if;
    if v_order.status <> 'new' then
      raise exception 'Изменять можно только заказ в статусе «Новый»' using errcode = 'P0001';
    end if;
    v_id := p_order_id;

    update public.orders
       set client_id = v_client_id,
           price_type = v_price_type,
           delivery_address = nullif(p_payload ->> 'delivery_address', ''),
           comment = nullif(p_payload ->> 'comment', ''),
           manager_id = case when public.is_owner() then v_manager else manager_id end
     where id = v_id;

    delete from public.order_items where order_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    v_product := (v_item ->> 'product_id')::uuid;
    v_qty     := (v_item ->> 'qty')::numeric;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Количество должно быть больше нуля' using errcode = 'P0001';
    end if;

    select p.is_active into v_active from public.products p where p.id = v_product;
    if not found then
      raise exception 'Товар не найден' using errcode = 'P0002';
    end if;
    if not v_active then
      raise exception 'Товар снят с продажи' using errcode = 'P0001';
    end if;

    select * into v_auto from public._calc_price(v_product, v_qty, v_price_type, v_client_id);

    if nullif(v_item ->> 'unit_price', '') is not null
       and (v_item ->> 'unit_price')::numeric <> v_auto.unit_price then
      v_price  := round((v_item ->> 'unit_price')::numeric, 2);
      v_source := 'manual';
    else
      v_price  := v_auto.unit_price;
      v_source := v_auto.price_source;
    end if;

    v_disc := coalesce(nullif(v_item ->> 'discount_percent', '')::numeric, v_auto.discount_percent);
    if v_disc < 0 or v_disc > 100 then
      raise exception 'Скидка должна быть от 0 до 100%%' using errcode = 'P0001';
    end if;

    perform public._check_seller_discount(v_client_id, v_price_type, v_product, v_qty, v_price, v_disc);

    insert into public.order_items (order_id, product_id, qty, unit_price, price_source, discount_percent, line_total)
    values (v_id, v_product, v_qty, v_price, v_source, v_disc, public._line_total(v_qty, v_price, v_disc));
  end loop;

  perform public._recalc_order_totals(v_id);

  if (select o.paid_amount > o.total from public.orders o where o.id = v_id) then
    raise exception 'Сумма заказа меньше уже внесённой оплаты' using errcode = 'P0001';
  end if;
  perform public._refresh_order_payment(v_id);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Смена статуса (внутренняя: без проверки ролей, кроме переданного флага)
-- ---------------------------------------------------------------------
create or replace function public._order_transition(
  p_order_id      uuid,
  p_to            public.order_status,
  p_is_owner      boolean,
  p_comment       text default null,
  p_cancel_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders%rowtype;
  v_from   public.order_status;
  v_item   record;
  v_cost   numeric;
  v_client public.clients%rowtype;
  v_debt   numeric;
  v_ok     boolean := false;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'P0002';
  end if;
  v_from := v_order.status;

  if v_from = p_to then
    raise exception 'Заказ уже в этом статусе' using errcode = 'P0001';
  end if;
  if p_to = 'paid' then
    raise exception 'Статус «Оплачен» ставится автоматически после полной оплаты отгруженного заказа'
      using errcode = 'P0001';
  end if;

  -- допустимые переходы
  v_ok := case
    when v_from = 'new'       and p_to = 'confirmed'                then true
    when v_from = 'confirmed' and p_to in ('assembled', 'shipped')  then true
    when v_from = 'assembled' and p_to = 'shipped'                  then true
    when v_from in ('new', 'confirmed', 'assembled') and p_to = 'cancelled' then true
    when v_from = 'shipped'   and p_to = 'cancelled'                then p_is_owner
    when v_from = 'confirmed' and p_to = 'new'                      then p_is_owner
    when v_from = 'assembled' and p_to in ('new', 'confirmed')      then p_is_owner
    else false
  end;

  if not v_ok then
    if v_from = 'shipped' and p_to = 'cancelled' then
      raise exception 'Отменить отгруженный заказ (оформить возврат) может только владелец' using errcode = '42501';
    elsif p_to in ('new', 'confirmed') and v_from in ('confirmed', 'assembled') then
      raise exception 'Возвращать заказ на предыдущий статус может только владелец' using errcode = '42501';
    end if;
    raise exception 'Переход из статуса «%» в «%» невозможен', v_from, p_to using errcode = 'P0001';
  end if;

  if p_to = 'cancelled' and nullif(trim(p_cancel_reason), '') is null then
    raise exception 'Укажите причину отмены' using errcode = 'P0001';
  end if;

  -- подтверждение: проверка кредитного лимита и резерв
  if v_from = 'new' and p_to = 'confirmed' then
    if not exists (select 1 from public.order_items where order_id = p_order_id) then
      raise exception 'В заказе нет товаров' using errcode = 'P0001';
    end if;

    if v_order.client_id is not null and not p_is_owner then
      select * into v_client from public.clients where id = v_order.client_id;
      if v_client.credit_limit is not null then
        v_debt := public._client_debt(v_order.client_id);
        if v_debt + v_order.total - v_order.paid_amount > v_client.credit_limit then
          raise exception 'Превышен кредитный лимит клиента: долг % + заказ % > лимит %',
            v_debt, v_order.total - v_order.paid_amount, v_client.credit_limit
            using errcode = 'P0001', hint = 'Нужна предоплата или решение владельца';
        end if;
      end if;
    end if;

    for v_item in select i.product_id, sum(i.qty) as qty from public.order_items i
                   where i.order_id = p_order_id group by i.product_id order by i.product_id loop
      perform public._stock_apply(v_item.product_id, 'reserve', 0, v_item.qty, null, 'order', p_order_id);
    end loop;

    update public.orders set confirmed_at = now() where id = p_order_id;
  end if;

  -- откат на «Новый»: снять резерв
  if v_from in ('confirmed', 'assembled') and p_to in ('new', 'cancelled') then
    for v_item in select i.product_id, sum(i.qty) as qty from public.order_items i
                   where i.order_id = p_order_id group by i.product_id order by i.product_id loop
      perform public._stock_apply(v_item.product_id, 'unreserve', 0, -v_item.qty, null, 'order', p_order_id);
    end loop;
    if p_to = 'new' then
      update public.orders set confirmed_at = null where id = p_order_id;
    end if;
  end if;

  -- отгрузка: списание с резерва по средней себестоимости
  if p_to = 'shipped' then
    for v_item in select i.id, i.product_id, i.qty from public.order_items i
                   where i.order_id = p_order_id order by i.product_id, i.id loop
      select s.avg_cost into v_cost from public.stock s where s.product_id = v_item.product_id for update;
      perform public._stock_apply(v_item.product_id, 'write_off_sale', -v_item.qty, -v_item.qty,
                                  coalesce(v_cost, 0), 'order', p_order_id);
      update public.order_items set cost_price = coalesce(v_cost, 0) where id = v_item.id;
    end loop;

    update public.orders o
       set shipped_at = now(),
           due_date = case
                        when o.client_id is null then (now() at time zone public.app_timezone())::date
                        else (now() at time zone public.app_timezone())::date
                             + coalesce((select c.payment_terms_days from public.clients c where c.id = o.client_id), 0)
                      end
     where o.id = p_order_id;
  end if;

  -- возврат отгруженного: товар на склад по себестоимости продажи
  if v_from = 'shipped' and p_to = 'cancelled' then
    for v_item in select i.product_id, i.qty, coalesce(i.cost_price, 0) as cost from public.order_items i
                   where i.order_id = p_order_id order by i.product_id, i.id loop
      perform public._stock_apply(v_item.product_id, 'return', v_item.qty, 0, v_item.cost, 'order', p_order_id,
                                  public._moving_avg(v_item.product_id, v_item.qty, v_item.cost));
    end loop;
  end if;

  update public.orders
     set status = p_to,
         cancel_reason = case when p_to = 'cancelled' then trim(p_cancel_reason) else cancel_reason end
   where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, comment)
  values (p_order_id, v_from, p_to, coalesce(nullif(trim(p_comment), ''), nullif(trim(p_cancel_reason), '')));

  -- отменённый заказ освобождает оплату: она становится авансом клиента
  if p_to = 'cancelled' then
    delete from public.payment_allocations where order_id = p_order_id;
    perform public._allocate_client(v_order.client_id);
  end if;

  if p_to in ('confirmed', 'shipped') then
    perform public._allocate_client(v_order.client_id);
    perform public._refresh_order_payment(p_order_id);
  end if;
end;
$$;

create or replace function public.change_order_status(
  p_order_id      uuid,
  p_to_status     public.order_status,
  p_comment       text default null,
  p_cancel_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_active();
  perform public._order_transition(p_order_id, p_to_status, public.is_owner(), p_comment, p_cancel_reason);
end;
$$;

-- ---------------------------------------------------------------------
-- Приём входящего платежа (внутренняя)
-- ---------------------------------------------------------------------
create or replace function public._register_incoming(
  p_client_id       uuid,
  p_order_id        uuid,
  p_amount          numeric,
  p_method          public.payment_method,
  p_cash_account_id uuid,
  p_paid_at         timestamptz,
  p_comment         text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders%rowtype;
  v_client uuid := p_client_id;
  v_id     uuid;
  v_alloc  numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма платежа должна быть больше нуля' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.cash_accounts a where a.id = p_cash_account_id and a.is_active) then
    raise exception 'Касса не найдена или неактивна' using errcode = 'P0001';
  end if;

  if p_order_id is not null then
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then
      raise exception 'Заказ не найден' using errcode = 'P0002';
    end if;
    if v_order.status = 'cancelled' then
      raise exception 'Заказ отменён' using errcode = 'P0001';
    end if;
    if v_client is not null and v_order.client_id is distinct from v_client then
      raise exception 'Заказ принадлежит другому клиенту' using errcode = 'P0001';
    end if;
    v_client := v_order.client_id;
    if v_client is null and p_amount > v_order.total - v_order.paid_amount then
      raise exception 'Сумма больше остатка к оплате (%)', v_order.total - v_order.paid_amount
        using errcode = 'P0001';
    end if;
  elsif v_client is null then
    raise exception 'Укажите клиента или заказ' using errcode = 'P0001';
  end if;

  insert into public.payments (direction, amount, method, cash_account_id, client_id, order_id, paid_at, comment)
  values ('in', round(p_amount, 2), p_method, p_cash_account_id, v_client, p_order_id,
          coalesce(p_paid_at, now()), nullif(trim(p_comment), ''))
  returning id into v_id;

  if p_order_id is not null then
    v_alloc := least(round(p_amount, 2), v_order.total - v_order.paid_amount);
    if v_alloc > 0 then
      insert into public.payment_allocations (payment_id, order_id, amount) values (v_id, p_order_id, v_alloc);
    end if;
  end if;

  perform public._allocate_client(v_client);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Быстрая розничная продажа одной транзакцией:
-- заказ → подтверждение → отгрузка → оплата.
-- payload: {client_id?, comment?, items: [...], payment: {method, cash_account_id, amount?}}
-- ---------------------------------------------------------------------
create or replace function public.quick_sale(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_total  numeric;
  v_amount numeric;
  v_pay    jsonb := p_payload -> 'payment';
begin
  perform public._require_active();

  v_id := public.save_order(null, (p_payload - 'payment') || jsonb_build_object('price_type', 'retail'));

  perform public._order_transition(v_id, 'confirmed', true, 'Быстрая продажа');
  perform public._order_transition(v_id, 'shipped',   true, 'Быстрая продажа');

  select o.total - o.paid_amount into v_total from public.orders o where o.id = v_id;

  if v_pay is not null and v_total > 0 then
    v_amount := coalesce(nullif(v_pay ->> 'amount', '')::numeric, v_total);
    perform public._register_incoming(
      nullif(p_payload ->> 'client_id', '')::uuid, v_id, least(v_amount, v_total),
      (v_pay ->> 'method')::public.payment_method,
      (v_pay ->> 'cash_account_id')::uuid, now(), 'Быстрая продажа');
  end if;

  return v_id;
end;
$$;

grant execute on function public.calc_price(uuid, numeric, public.client_type, uuid) to authenticated;
grant execute on function public.client_debt(uuid) to authenticated;
grant execute on function public.save_order(uuid, jsonb) to authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, text, text) to authenticated;
grant execute on function public.quick_sale(jsonb) to authenticated;
