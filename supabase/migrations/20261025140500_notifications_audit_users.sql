-- =====================================================================
-- NurLife CRM · 21 · Уведомления, аудит, пользователи, каталог, фото
-- =====================================================================

-- ---------------------------------------------------------------------
-- Уведомления: одна строка на получателя (своё is_read у каждого)
-- ---------------------------------------------------------------------
create or replace function public._notify(
  p_user_id uuid, p_type text, p_title text, p_body text default null, p_link text default null)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user_id, p_type, p_title, p_body, p_link
   where p_user_id is not null
     and exists (select 1 from public.profiles p where p.id = p_user_id and p.is_active)
$$;

create or replace function public._notify_owner(
  p_type text, p_title text, p_body text default null, p_link text default null)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
    from public.profiles p
   where p.role = 'owner' and p.is_active
$$;

create or replace function public._status_label(p_status public.order_status)
returns text language sql immutable set search_path = ''
as $$
  select case p_status
    when 'new' then 'Новый' when 'confirmed' then 'Подтверждён' when 'assembled' then 'Собран'
    when 'shipped' then 'Отгружен' when 'paid' then 'Оплачен' when 'cancelled' then 'Отменён' end
$$;

create or replace function public.orders_notify()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  uuid := auth.uid();
  v_client text;
  v_link   text := '/orders/' || new.id;
begin
  select c.name into v_client from public.clients c where c.id = new.client_id;

  if tg_op = 'INSERT' then
    if v_actor is distinct from (select p.id from public.profiles p where p.role = 'owner' limit 1) then
      perform public._notify_owner('new_order', 'Новый заказ ' || new.number,
        coalesce(v_client, 'Розничный покупатель'), v_link);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    -- ответственному продавцу, если статус сменил кто-то другой
    if new.manager_id is distinct from v_actor then
      perform public._notify(new.manager_id, 'status_change',
        'Заказ ' || new.number || ': ' || public._status_label(new.status),
        coalesce(v_client, 'Розничный покупатель'), v_link);
    end if;
    -- владельцу — о действиях продавцов и автоматической оплате
    if public.current_user_role() is distinct from 'owner'
       and (new.manager_id is distinct from (select p.id from public.profiles p where p.role = 'owner' limit 1)
            or v_actor is null) then
      perform public._notify_owner('status_change',
        'Заказ ' || new.number || ': ' || public._status_label(new.status),
        coalesce(v_client, 'Розничный покупатель'), v_link);
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_notify
  after insert or update of status on public.orders
  for each row execute function public.orders_notify();

-- Ежедневные: низкий остаток (owner) и просроченные долги (owner + менеджер клиента).
create or replace function public.notify_low_stock()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  v_names text;
begin
  if not coalesce((select s.low_stock_notify from public.settings s), true) then
    return 0;
  end if;

  select count(*), string_agg(x.name, ', ' order by x.name)
    into v_count, v_names
    from (select p.name from public.products p join public.stock s on s.product_id = p.id
           where p.is_active and p.min_stock > 0 and s.qty_available < p.min_stock
           order by p.name limit 50) x;

  if v_count > 0 then
    perform public._notify_owner('low_stock', 'Нужно заказать: ' || v_count || ' тов.',
      left(v_names, 500), '/stock?filter=low');
  end if;
  return v_count;
end;
$$;

create or replace function public.notify_overdue_debts()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_row   record;
  v_count integer := 0;
  v_today date := (now() at time zone public.app_timezone())::date;
  v_body  text;
begin
  for v_row in
    select c.id, c.name, c.manager_id, sum(o.total - o.paid_amount) as rest, min(o.due_date) as oldest
      from public.orders o join public.clients c on c.id = o.client_id
     where o.status = 'shipped' and o.due_date < v_today and o.paid_amount < o.total
     group by c.id, c.name, c.manager_id
  loop
    v_body := 'Просрочено ' || to_char(v_row.rest, 'FM999G999G990D00') || ' ₽ с ' || to_char(v_row.oldest, 'DD.MM.YYYY');
    perform public._notify_owner('overdue_debt', 'Просроченный долг: ' || v_row.name, v_body, '/clients/' || v_row.id);
    if v_row.manager_id is not null
       and not exists (select 1 from public.profiles p where p.id = v_row.manager_id and p.role = 'owner') then
      perform public._notify(v_row.manager_id, 'overdue_debt', 'Просроченный долг: ' || v_row.name, v_body,
                             '/clients/' || v_row.id);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql security definer set search_path = ''
as $$
  update public.notifications set is_read = true
   where user_id = auth.uid() and not is_read
$$;

-- Realtime для колокольчика (публикация есть в Supabase; локально её может не быть).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- pg_cron: каждый день в 09:00 по Екатеринбургу (04:00 UTC).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('nurlife-low-stock',     '0 4 * * *', 'select public.notify_low_stock()');
    perform cron.schedule('nurlife-overdue-debts', '5 4 * * *', 'select public.notify_overdue_debts()');
  else
    raise notice 'pg_cron недоступен: ежедневные уведомления не запланированы';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Аудит
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  insert into public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id'),
          tg_op, v_old, v_new,
          (select p.id from public.profiles p where p.id = auth.uid()));
  return null;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'products', 'product_price_tiers', 'clients', 'client_prices', 'orders', 'order_items',
    'payments', 'purchases', 'stock_adjustments', 'profiles', 'settings']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      v_table || '_audit', v_table);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Пользователи
-- ---------------------------------------------------------------------
-- Деактивация продавца с переназначением его клиентов (owner).
create or replace function public.deactivate_user(p_user_id uuid, p_reassign_to uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_count   integer;
begin
  perform public._require_owner();

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Пользователь не найден' using errcode = 'P0002';
  end if;
  if v_profile.role = 'owner' then
    raise exception 'Владельца деактивировать нельзя' using errcode = '42501';
  end if;
  if p_reassign_to is not null and not exists (
       select 1 from public.profiles p where p.id = p_reassign_to and p.is_active and p.id <> p_user_id) then
    raise exception 'Новый ответственный должен быть активным сотрудником' using errcode = 'P0001';
  end if;

  update public.profiles set is_active = false where id = p_user_id;
  update public.clients set manager_id = coalesce(p_reassign_to, auth.uid()) where manager_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Каталог: массовое изменение цен и импорт (owner)
-- ---------------------------------------------------------------------
-- p_field: retail_price | wholesale_price | purchase_price
-- p_mode:  percent (±%) | add (±₽) | set (=₽)
create or replace function public.bulk_update_prices(
  p_product_ids uuid[], p_field text, p_mode text, p_value numeric, p_round numeric default 0.01)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
  v_expr  text;
begin
  perform public._require_owner();
  if p_field not in ('retail_price', 'wholesale_price', 'purchase_price') then
    raise exception 'Неизвестное поле цены' using errcode = 'P0001';
  end if;
  if p_mode not in ('percent', 'add', 'set') then
    raise exception 'Неизвестный режим' using errcode = 'P0001';
  end if;
  if coalesce(p_round, 0) <= 0 then
    p_round := 0.01;
  end if;

  v_expr := case p_mode
              when 'percent' then format('%I * (1 + $1 / 100)', p_field)
              when 'add'     then format('coalesce(%I, 0) + $1', p_field)
              else '$1' end;

  execute format(
    'update public.products set %I = greatest(round((%s) / $2) * $2, 0)
      where id = any($3) and (%L <> ''percent'' or %I is not null)',
    p_field, v_expr, p_mode, p_field)
  using p_value, p_round, p_product_ids;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Импорт из XLSX (строки уже разобраны в браузере).
-- Строка: {sku, name, barcode, category, unit, retail_price, wholesale_price,
--          purchase_price, min_stock, description, is_active}
-- Возвращает {errors: [{row, message}], created, updated}. При ошибках
-- или p_dry_run ничего не записывается.
create or replace function public.import_products(p_rows jsonb, p_dry_run boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row      jsonb;
  v_idx      integer := 0;
  v_errors   jsonb := '[]'::jsonb;
  v_unit     uuid;
  v_category uuid;
  v_created  integer := 0;
  v_updated  integer := 0;
  v_skus     text[] := '{}';
  v_sku      text;
  v_num      text;
  v_exists   boolean;
begin
  perform public._require_owner();

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Ожидается массив строк' using errcode = 'P0001';
  end if;

  -- проверка
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    v_sku := nullif(trim(v_row ->> 'sku'), '');

    if v_sku is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'message', 'Не указан артикул');
    elsif v_sku = any(v_skus) then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'message', 'Артикул повторяется в файле: ' || v_sku);
    else
      v_skus := v_skus || v_sku;
    end if;

    if nullif(trim(v_row ->> 'name'), '') is null then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'message', 'Не указано наименование');
    end if;

    if not exists (select 1 from public.units u where lower(u.code) = lower(trim(coalesce(v_row ->> 'unit', 'шт')))) then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'message', 'Неизвестная единица: ' || coalesce(v_row ->> 'unit', ''));
    end if;

    foreach v_num in array array['retail_price', 'wholesale_price', 'purchase_price', 'min_stock'] loop
      if nullif(trim(v_row ->> v_num), '') is not null
         and (replace(trim(v_row ->> v_num), ',', '.') !~ '^\d+(\.\d+)?$') then
        v_errors := v_errors || jsonb_build_object('row', v_idx,
          'message', 'Поле ' || v_num || ': ожидается неотрицательное число, получено «' || (v_row ->> v_num) || '»');
      end if;
    end loop;
  end loop;

  if jsonb_array_length(v_errors) > 0 or p_dry_run then
    select count(*) filter (where p.id is null), count(*) filter (where p.id is not null)
      into v_created, v_updated
      from unnest(v_skus) s(sku) left join public.products p on p.sku = s.sku;
    return jsonb_build_object('errors', v_errors, 'created', v_created, 'updated', v_updated, 'dry_run', true);
  end if;

  -- запись
  for v_row in select value from jsonb_array_elements(p_rows) loop
    select u.id into v_unit from public.units u where lower(u.code) = lower(trim(coalesce(v_row ->> 'unit', 'шт')));

    v_category := null;
    if nullif(trim(v_row ->> 'category'), '') is not null then
      select c.id into v_category from public.categories c
       where lower(c.name) = lower(trim(v_row ->> 'category')) order by c.parent_id nulls first limit 1;
      if v_category is null then
        insert into public.categories (name) values (trim(v_row ->> 'category')) returning id into v_category;
      end if;
    end if;

    v_exists := exists (select 1 from public.products p where p.sku = trim(v_row ->> 'sku'));

    insert into public.products as p (sku, name, barcode, description, category_id, unit_id,
                                      retail_price, wholesale_price, purchase_price, min_stock, is_active)
    values (trim(v_row ->> 'sku'), trim(v_row ->> 'name'), nullif(trim(v_row ->> 'barcode'), ''),
            nullif(trim(v_row ->> 'description'), ''), v_category, v_unit,
            coalesce(replace(nullif(trim(v_row ->> 'retail_price'), ''), ',', '.')::numeric, 0),
            coalesce(replace(nullif(trim(v_row ->> 'wholesale_price'), ''), ',', '.')::numeric, 0),
            replace(nullif(trim(v_row ->> 'purchase_price'), ''), ',', '.')::numeric,
            coalesce(replace(nullif(trim(v_row ->> 'min_stock'), ''), ',', '.')::numeric, 0),
            coalesce((v_row ->> 'is_active')::boolean, true))
    on conflict (sku) do update
       set name = excluded.name,
           barcode = coalesce(excluded.barcode, p.barcode),
           description = coalesce(excluded.description, p.description),
           category_id = coalesce(excluded.category_id, p.category_id),
           unit_id = excluded.unit_id,
           retail_price = excluded.retail_price,
           wholesale_price = excluded.wholesale_price,
           purchase_price = coalesce(excluded.purchase_price, p.purchase_price),
           min_stock = excluded.min_stock,
           is_active = excluded.is_active;

    if v_exists then v_updated := v_updated + 1; else v_created := v_created + 1; end if;
  end loop;

  return jsonb_build_object('errors', '[]'::jsonb, 'created', v_created, 'updated', v_updated, 'dry_run', false);
end;
$$;

-- ---------------------------------------------------------------------
-- Хранилище фото товаров: публичное чтение, запись — только owner.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$create policy "product images: owner insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'product-images' and public.is_owner())$p$;
    execute $p$create policy "product images: owner update" on storage.objects
      for update to authenticated using (bucket_id = 'product-images' and public.is_owner())$p$;
    execute $p$create policy "product images: owner delete" on storage.objects
      for delete to authenticated using (bucket_id = 'product-images' and public.is_owner())$p$;
  else
    raise notice 'Схема storage не найдена: бакет product-images не создан';
  end if;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.deactivate_user(uuid, uuid) to authenticated;
grant execute on function public.bulk_update_prices(uuid[], text, text, numeric, numeric) to authenticated;
grant execute on function public.import_products(jsonb, boolean) to authenticated;
