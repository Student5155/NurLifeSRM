-- =====================================================================
-- NurLife CRM · 20 · Отчёты, балансы, сверки, представления для списков
--
-- Выручка — по shipped_at (отгруженные и оплаченные заказы).
-- Seller видит только свои продажи и своих клиентов; маржа, прибыль,
-- стоимость склада и поставщики — только owner.
-- Периоды: даты ДД.ММ.ГГГГ в часовом поясе app_timezone(), включительно.
-- =====================================================================

create or replace function public._ts_from(p_date date)
returns timestamptz language sql stable set search_path = ''
as $$ select (p_date::timestamp) at time zone public.app_timezone() $$;

create or replace function public._ts_to(p_date date)
returns timestamptz language sql stable set search_path = ''
as $$ select ((p_date + 1)::timestamp) at time zone public.app_timezone() $$;

-- Видит ли текущий пользователь данные продавца p_manager_id.
create or replace function public._sees_manager(p_manager_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner() or p_manager_id = auth.uid() $$;

-- ---------------------------------------------------------------------
-- Представления для экранов (фильтр — активный пользователь)
-- ---------------------------------------------------------------------
create view public.catalog_items
with (security_barrier = true)
as
select p.id,
       p.sku,
       p.barcode,
       p.name,
       p.description,
       p.category_id,
       c.name  as category_name,
       p.unit_id,
       u.code  as unit_code,
       u.is_fractional,
       p.retail_price,
       p.wholesale_price,
       p.min_stock,
       p.is_active,
       coalesce(s.qty_on_hand, 0)   as qty_on_hand,
       coalesce(s.qty_reserved, 0)  as qty_reserved,
       coalesce(s.qty_available, 0) as qty_available,
       (p.min_stock > 0 and coalesce(s.qty_available, 0) < p.min_stock) as is_low_stock,
       (select i.storage_path from public.product_images i
         where i.product_id = p.id order by i.sort_order limit 1) as main_image,
       p.created_at,
       p.updated_at
  from public.products p
  join public.units u on u.id = p.unit_id
  left join public.categories c on c.id = p.category_id
  left join public.stock s on s.product_id = p.id
 where public.is_active_user();

comment on view public.catalog_items is 'Каталог с остатками без закупочных цен — для списков и подбора товара';

create view public.order_lines
with (security_barrier = true)
as
select i.id,
       i.order_id,
       i.product_id,
       p.sku,
       p.name as product_name,
       u.code as unit_code,
       i.qty,
       i.unit_price,
       i.price_source,
       i.discount_percent,
       i.line_total
  from public.order_items i
  join public.products p on p.id = i.product_id
  join public.units u on u.id = p.unit_id
 where public.is_active_user();

comment on view public.order_lines is 'Позиции заказа с наименованием и артикулом, без себестоимости';

revoke all on public.catalog_items, public.order_lines from anon, authenticated;
grant select on public.catalog_items, public.order_lines to authenticated;

-- ---------------------------------------------------------------------
-- Клиенты: долг, просрочка, последняя покупка (для списка и карточки)
-- ---------------------------------------------------------------------
create or replace function public.clients_overview()
returns table (client_id uuid, debt numeric, overdue numeric, last_order_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  return query
  select c.id,
         public._client_debt(c.id),
         coalesce((select sum(o.total - o.paid_amount) from public.orders o
                    where o.client_id = c.id and o.status = 'shipped'
                      and o.due_date < (now() at time zone public.app_timezone())::date), 0),
         (select max(o.created_at) from public.orders o where o.client_id = c.id and o.status <> 'cancelled')
    from public.clients c;
end;
$$;

create or replace function public.find_client_duplicates(p_phone text, p_inn text, p_exclude uuid default null)
returns table (id uuid, name text, phone text, inn text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  perform public._require_active();
  return query
  select c.id, c.name, c.phone, c.inn
    from public.clients c
   where (p_exclude is null or c.id <> p_exclude)
     and ((length(v_digits) = 10 and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = v_digits)
          or (nullif(trim(p_inn), '') is not null and c.inn = trim(p_inn)))
   limit 10;
end;
$$;

-- Акт сверки: сальдо на начало, отгрузки (дебет), оплаты (кредит), сальдо на конец.
create or replace function public.client_statement(p_client_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from    timestamptz := public._ts_from(p_from);
  v_to      timestamptz := public._ts_to(p_to);
  v_opening numeric;
  v_rows    jsonb;
  v_debit   numeric;
  v_credit  numeric;
begin
  perform public._require_active();

  select coalesce((select sum(o.total) from public.orders o
                    where o.client_id = p_client_id and o.status in ('shipped', 'paid') and o.shipped_at < v_from), 0)
       - coalesce((select sum(p.amount) from public.payments p
                    where p.client_id = p_client_id and p.direction = 'in' and not p.is_void and p.paid_at < v_from), 0)
    into v_opening;

  with r as (
    select o.shipped_at as at, 'Отгрузка по заказу ' || o.number as doc, o.total as debit, 0::numeric as credit
      from public.orders o
     where o.client_id = p_client_id and o.status in ('shipped', 'paid')
       and o.shipped_at >= v_from and o.shipped_at < v_to
    union all
    select p.paid_at, 'Оплата' || coalesce(' (' || p.comment || ')', ''), 0, p.amount
      from public.payments p
     where p.client_id = p_client_id and p.direction = 'in' and not p.is_void
       and p.paid_at >= v_from and p.paid_at < v_to
  )
  select coalesce(jsonb_agg(jsonb_build_object('date', r.at, 'doc', r.doc, 'debit', r.debit, 'credit', r.credit)
                            order by r.at), '[]'::jsonb),
         coalesce(sum(r.debit), 0), coalesce(sum(r.credit), 0)
    into v_rows, v_debit, v_credit
    from r;

  return jsonb_build_object(
    'client', (select jsonb_build_object('id', c.id, 'name', c.name, 'legal_name', c.legal_name, 'inn', c.inn)
                 from public.clients c where c.id = p_client_id),
    'from', p_from, 'to', p_to,
    'opening', v_opening, 'debit', v_debit, 'credit', v_credit,
    'closing', v_opening + v_debit - v_credit,
    'rows', v_rows);
end;
$$;

-- ---------------------------------------------------------------------
-- Дашборд
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_owner   boolean;
  v_from    timestamptz := public._ts_from(p_from);
  v_to      timestamptz := public._ts_to(p_to);
  v_today   date := (now() at time zone public.app_timezone())::date;
  v_result  jsonb;
begin
  perform public._require_active();
  v_owner := public.is_owner();

  with shipped as (
    select o.* from public.orders o
     where o.status in ('shipped', 'paid') and o.shipped_at >= v_from and o.shipped_at < v_to
       and public._sees_manager(o.manager_id)
  ),
  created as (
    select o.* from public.orders o
     where o.status <> 'cancelled' and o.created_at >= v_from and o.created_at < v_to
       and public._sees_manager(o.manager_id)
  ),
  margin as (
    select coalesce(sum(i.line_total), 0) as revenue,
           coalesce(sum(round(i.qty * coalesce(i.cost_price, 0), 2)), 0) as cost
      from public.order_items i join shipped s on s.id = i.order_id
  ),
  debts as (
    select c.id, public._client_debt(c.id) as debt
      from public.clients c
     where v_owner or c.manager_id = auth.uid()
  ),
  days as (
    select (s.shipped_at at time zone public.app_timezone())::date as d, sum(s.total) as revenue, count(*) as orders
      from shipped s group by 1
  ),
  expenses as (
    select coalesce(sum(co.amount), 0) as amount from public.cash_operations co
     where co.direction = 'out' and co.created_at >= v_from and co.created_at < v_to
  )
  select jsonb_build_object(
    'revenue',        (select coalesce(sum(total), 0) from shipped),
    'shipped_count',  (select count(*) from shipped),
    'orders_count',   (select count(*) from created),
    'avg_check',      (select case when count(*) = 0 then 0 else round(sum(total) / count(*), 2) end from shipped),
    'retail_revenue', (select coalesce(sum(total), 0) from shipped where price_type = 'retail'),
    'wholesale_revenue', (select coalesce(sum(total), 0) from shipped where price_type = 'wholesale'),
    'gross_profit',   case when v_owner then (select revenue - cost from margin) end,
    'margin_percent', case when v_owner then (select case when revenue = 0 then 0
                                                     else round((revenue - cost) / revenue * 100, 2) end from margin) end,
    'expenses',       case when v_owner then (select amount from expenses) end,
    'net_profit',     case when v_owner then (select revenue - cost from margin) - (select amount from expenses) end,
    'receivables',    (select coalesce(sum(debt), 0) from debts where debt > 0),
    'overdue',        (select coalesce(sum(o.total - o.paid_amount), 0) from public.orders o
                        join public.clients c on c.id = o.client_id
                       where o.status = 'shipped' and o.due_date < v_today
                         and (v_owner or c.manager_id = auth.uid())),
    'low_stock',      (select count(*) from public.products p join public.stock s on s.product_id = p.id
                        where p.is_active and p.min_stock > 0 and s.qty_available < p.min_stock),
    'open_orders',    (select count(*) from public.orders o
                        where o.status in ('new', 'confirmed', 'assembled') and public._sees_manager(o.manager_id)),
    'by_day',         (select coalesce(jsonb_agg(jsonb_build_object('date', d, 'revenue', revenue, 'orders', orders)
                                                 order by d), '[]'::jsonb) from days)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- Продажи по периодам (день / неделя / месяц), опт и розница
-- ---------------------------------------------------------------------
create or replace function public.report_sales(p_from date, p_to date, p_group text default 'day')
returns table (period date, retail numeric, wholesale numeric, total numeric, orders bigint)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  if p_group not in ('day', 'week', 'month') then
    raise exception 'Группировка: day, week или month' using errcode = 'P0001';
  end if;
  return query
  select date_trunc(p_group, o.shipped_at at time zone public.app_timezone())::date,
         coalesce(sum(o.total) filter (where o.price_type = 'retail'), 0),
         coalesce(sum(o.total) filter (where o.price_type = 'wholesale'), 0),
         coalesce(sum(o.total), 0),
         count(*)
    from public.orders o
   where o.status in ('shipped', 'paid')
     and o.shipped_at >= public._ts_from(p_from) and o.shipped_at < public._ts_to(p_to)
     and public._sees_manager(o.manager_id)
   group by 1
   order by 1;
end;
$$;

-- Маржа по товарам или категориям (owner)
create or replace function public.report_margin(p_from date, p_to date, p_by text default 'product')
returns table (key uuid, name text, qty numeric, revenue numeric, cost numeric, profit numeric, margin_percent numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_owner();
  return query
  with lines as (
    select case when p_by = 'category' then p.category_id else p.id end as key,
           case when p_by = 'category' then coalesce(c.name, 'Без категории') else p.name end as name,
           i.qty, i.line_total, round(i.qty * coalesce(i.cost_price, 0), 2) as cost
      from public.order_items i
      join public.orders o on o.id = i.order_id
      join public.products p on p.id = i.product_id
      left join public.categories c on c.id = p.category_id
     where o.status in ('shipped', 'paid')
       and o.shipped_at >= public._ts_from(p_from) and o.shipped_at < public._ts_to(p_to)
  )
  select l.key, l.name, sum(l.qty), sum(l.line_total), sum(l.cost), sum(l.line_total) - sum(l.cost),
         case when sum(l.line_total) = 0 then 0
              else round((sum(l.line_total) - sum(l.cost)) / sum(l.line_total) * 100, 2) end
    from lines l
   group by l.key, l.name
   order by 6 desc;
end;
$$;

create or replace function public.report_top_products(p_from date, p_to date, p_limit integer default 20)
returns table (product_id uuid, sku text, name text, qty numeric, revenue numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  return query
  select p.id, p.sku, p.name, sum(i.qty), sum(i.line_total)
    from public.order_items i
    join public.orders o on o.id = i.order_id
    join public.products p on p.id = i.product_id
   where o.status in ('shipped', 'paid')
     and o.shipped_at >= public._ts_from(p_from) and o.shipped_at < public._ts_to(p_to)
     and public._sees_manager(o.manager_id)
   group by p.id, p.sku, p.name
   order by 5 desc
   limit p_limit;
end;
$$;

create or replace function public.report_top_clients(p_from date, p_to date, p_limit integer default 20)
returns table (client_id uuid, name text, orders bigint, revenue numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  return query
  select c.id, c.name, count(*), sum(o.total)
    from public.orders o
    join public.clients c on c.id = o.client_id
   where o.status in ('shipped', 'paid')
     and o.shipped_at >= public._ts_from(p_from) and o.shipped_at < public._ts_to(p_to)
     and public._sees_manager(o.manager_id)
   group by c.id, c.name
   order by 4 desc
   limit p_limit;
end;
$$;

-- Возраст дебиторки по неоплаченным отгруженным заказам.
create or replace function public.report_receivables_aging()
returns table (client_id uuid, name text, manager_name text, not_due numeric,
               d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone public.app_timezone())::date;
begin
  perform public._require_active();
  return query
  with r as (
    select o.client_id, o.total - o.paid_amount as rest,
           v_today - coalesce(o.due_date, v_today) as days
      from public.orders o
     where o.status = 'shipped' and o.client_id is not null and o.paid_amount < o.total
  )
  select c.id, c.name, m.full_name,
         coalesce(sum(r.rest) filter (where r.days <= 0), 0),
         coalesce(sum(r.rest) filter (where r.days between 1 and 30), 0),
         coalesce(sum(r.rest) filter (where r.days between 31 and 60), 0),
         coalesce(sum(r.rest) filter (where r.days between 61 and 90), 0),
         coalesce(sum(r.rest) filter (where r.days > 90), 0),
         sum(r.rest)
    from r
    join public.clients c on c.id = r.client_id
    left join public.profiles m on m.id = c.manager_id
   where public.is_owner() or c.manager_id = auth.uid()
   group by c.id, c.name, m.full_name
   order by 9 desc;
end;
$$;

create or replace function public.report_sales_by_manager(p_from date, p_to date)
returns table (manager_id uuid, full_name text, orders bigint, revenue numeric, avg_check numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  return query
  select m.id, coalesce(nullif(m.full_name, ''), 'Без имени'), count(*), sum(o.total), round(avg(o.total), 2)
    from public.orders o
    left join public.profiles m on m.id = o.manager_id
   where o.status in ('shipped', 'paid')
     and o.shipped_at >= public._ts_from(p_from) and o.shipped_at < public._ts_to(p_to)
     and public._sees_manager(o.manager_id)
   group by m.id, m.full_name
   order by 4 desc;
end;
$$;

create or replace function public.report_stock_value()
returns table (product_id uuid, sku text, name text, category_name text, qty numeric, avg_cost numeric, value numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_owner();
  return query
  select p.id, p.sku, p.name, c.name, s.qty_on_hand, s.avg_cost, round(greatest(s.qty_on_hand, 0) * s.avg_cost, 2)
    from public.products p
    join public.stock s on s.product_id = p.id
    left join public.categories c on c.id = p.category_id
   where s.qty_on_hand <> 0
   order by 7 desc;
end;
$$;

-- ABC по выручке: A — до 80 % накопленной доли, B — до 95 %, C — остальное.
create or replace function public.report_abc(p_from date, p_to date)
returns table (product_id uuid, sku text, name text, revenue numeric, share numeric, cumulative numeric, abc text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  return query
  with s as (
    select p.id, p.sku, p.name, sum(i.line_total) as revenue
      from public.order_items i
      join public.orders o on o.id = i.order_id
      join public.products p on p.id = i.product_id
     where o.status in ('shipped', 'paid')
       and o.shipped_at >= public._ts_from(p_from) and o.shipped_at < public._ts_to(p_to)
       and public._sees_manager(o.manager_id)
     group by p.id, p.sku, p.name
  ), t as (
    select s.*, s.revenue / nullif(sum(s.revenue) over (), 0) * 100 as share,
           sum(s.revenue) over (order by s.revenue desc, s.id rows unbounded preceding)
             / nullif(sum(s.revenue) over (), 0) * 100 as cumulative
      from s
  )
  select t.id, t.sku, t.name, t.revenue, round(t.share, 2), round(t.cumulative, 2),
         case when t.cumulative - t.share < 80 then 'A' when t.cumulative - t.share < 95 then 'B' else 'C' end
    from t
   order by t.revenue desc;
end;
$$;

create or replace function public.low_stock_products()
returns table (product_id uuid, sku text, name text, unit_code text, qty_available numeric,
               min_stock numeric, need numeric, purchase_price numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_active();
  return query
  select p.id, p.sku, p.name, u.code, s.qty_available, p.min_stock,
         case when u.is_fractional then p.min_stock - s.qty_available
              else ceil(p.min_stock - s.qty_available) end,
         case when public.is_owner() then coalesce(p.purchase_price, s.avg_cost) end
    from public.products p
    join public.stock s on s.product_id = p.id
    join public.units u on u.id = p.unit_id
   where p.is_active and p.min_stock > 0 and s.qty_available < p.min_stock
   order by p.name;
end;
$$;

-- ---------------------------------------------------------------------
-- Поставщики (owner)
-- Долг = принятый товар по закупочной цене − несторнированные оплаты.
-- ---------------------------------------------------------------------
create or replace function public.supplier_balances()
returns table (supplier_id uuid, name text, received numeric, paid numeric, debt numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_owner();
  return query
  select s.id, s.name, x.received, y.paid, x.received - y.paid
    from public.suppliers s
    cross join lateral (
      select coalesce(sum(round(i.qty_received * i.unit_cost, 2)), 0) as received
        from public.purchase_items i join public.purchases p on p.id = i.purchase_id
       where p.supplier_id = s.id and p.status <> 'cancelled') x
    cross join lateral (
      select coalesce(sum(pm.amount), 0) as paid from public.payments pm
       where pm.supplier_id = s.id and pm.direction = 'out' and not pm.is_void) y
   order by s.name;
end;
$$;

create or replace function public.purchase_price_history(p_product_id uuid)
returns table (received_at timestamptz, purchase_number text, supplier_name text, qty numeric, unit_cost numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_owner();
  return query
  select coalesce(p.received_at, p.created_at), p.number, s.name, i.qty_received, i.unit_cost
    from public.purchase_items i
    join public.purchases p on p.id = i.purchase_id
    join public.suppliers s on s.id = p.supplier_id
   where i.product_id = p_product_id and i.qty_received > 0
   order by 1 desc;
end;
$$;

grant execute on function public.clients_overview() to authenticated;
grant execute on function public.find_client_duplicates(text, text, uuid) to authenticated;
grant execute on function public.client_statement(uuid, date, date) to authenticated;
grant execute on function public.dashboard_stats(date, date) to authenticated;
grant execute on function public.report_sales(date, date, text) to authenticated;
grant execute on function public.report_margin(date, date, text) to authenticated;
grant execute on function public.report_top_products(date, date, integer) to authenticated;
grant execute on function public.report_top_clients(date, date, integer) to authenticated;
grant execute on function public.report_receivables_aging() to authenticated;
grant execute on function public.report_sales_by_manager(date, date) to authenticated;
grant execute on function public.report_stock_value() to authenticated;
grant execute on function public.report_abc(date, date) to authenticated;
grant execute on function public.low_stock_products() to authenticated;
grant execute on function public.supplier_balances() to authenticated;
grant execute on function public.purchase_price_history(uuid) to authenticated;
