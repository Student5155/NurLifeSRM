-- =====================================================================
-- NurLife CRM · 02 · Служебные функции и счётчики номеров документов
-- Все функции: set search_path = '' и полностью квалифицированные имена.
-- =====================================================================

-- Часовой пояс бизнеса: от него зависит год в номерах документов
-- (З-ГГГГ-000001) и граница суток в отчётах.
create or replace function public.app_timezone()
returns text
language sql
immutable
set search_path = ''
as $$ select 'Asia/Yekaterinburg'::text $$;

comment on function public.app_timezone() is 'Часовой пояс бизнеса для номеров документов и отчётов';

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Неизменяемые таблицы (stock_movements, audit_log)
-- ---------------------------------------------------------------------
create or replace function public.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Записи таблицы % неизменяемы: % запрещён', tg_table_name, tg_op
    using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- Нумерация документов: <префикс>-<ГГГГ>-<000001>, отдельный счётчик
-- на каждый префикс и год. Счётчик в таблице (а не sequence), поэтому
-- при откате транзакции номер не «сгорает» — нумерация без пропусков.
-- ---------------------------------------------------------------------
create table public.document_counters (
  prefix     text    not null,
  year       integer not null,
  last_value integer not null check (last_value > 0),
  primary key (prefix, year)
);

comment on table public.document_counters is 'Служебная: счётчики номеров документов по префиксу и году';

create or replace function public.next_document_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year  integer := extract(year from (now() at time zone public.app_timezone()))::integer;
  v_value integer;
begin
  insert into public.document_counters as c (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
    do update set last_value = c.last_value + 1
  returning c.last_value into v_value;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_value::text, 6, '0');
end;
$$;

-- Триггер: номер присваивается при вставке и не меняется потом.
-- TG_ARGV[0] — префикс. Для stock_adjustments префикс зависит от type.
create or replace function public.assign_document_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
begin
  if tg_op = 'UPDATE' then
    if new.number is distinct from old.number then
      raise exception 'Номер документа % нельзя изменить', old.number using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_table_name = 'stock_adjustments' then
    v_prefix := case new.type when 'inventory' then 'И' else 'К' end;
  else
    v_prefix := tg_argv[0];
  end if;

  new.number := public.next_document_number(v_prefix);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Дробные количества: для единиц с is_fractional = false количество
-- должно быть целым. TG_ARGV — имена проверяемых колонок.
-- ---------------------------------------------------------------------
create or replace function public.check_qty_matches_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        jsonb := to_jsonb(new);
  v_fractional boolean;
  v_unit       text;
  v_col        text;
  v_qty        numeric;
begin
  select u.is_fractional, u.code
    into v_fractional, v_unit
    from public.products p
    join public.units u on u.id = p.unit_id
   where p.id = new.product_id;

  if v_fractional then
    return new;
  end if;

  foreach v_col in array tg_argv loop
    v_qty := (v_row ->> v_col)::numeric;
    if v_qty is not null and v_qty <> trunc(v_qty) then
      raise exception 'Количество % для единицы «%» должно быть целым', v_qty, v_unit
        using errcode = 'P0001';
    end if;
  end loop;

  return new;
end;
$$;

-- Служебные функции не должны вызываться через API (rpc).
revoke execute on function public.next_document_number(text) from public, anon, authenticated;
