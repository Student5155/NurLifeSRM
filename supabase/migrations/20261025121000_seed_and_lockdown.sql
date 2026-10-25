-- =====================================================================
-- NurLife CRM · 11 · Справочные данные и включение RLS
-- Демо-данных нет: только единицы, кассы и строка настроек.
-- =====================================================================

insert into public.units (code, name, is_fractional) values
  ('шт',   'Штука',     false),
  ('кг',   'Килограмм', true),
  ('м',    'Метр',      true),
  ('упак', 'Упаковка',  false),
  ('л',    'Литр',      true)
on conflict (code) do nothing;

insert into public.cash_accounts (name, type) values
  ('Наличные',       'cash'),
  ('Расчётный счёт', 'bank'),
  ('Эквайринг',      'card')
on conflict (name) do nothing;

insert into public.settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- RLS включается сразу на всех таблицах. Политик пока нет, поэтому
-- через API (anon/authenticated) доступ закрыт полностью до шага 2.
-- ---------------------------------------------------------------------
alter table public.document_counters      enable row level security;
alter table public.profiles               enable row level security;
alter table public.settings               enable row level security;
alter table public.units                  enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_price_tiers    enable row level security;
alter table public.product_images         enable row level security;
alter table public.clients                enable row level security;
alter table public.client_contacts        enable row level security;
alter table public.client_prices          enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_status_history   enable row level security;
alter table public.stock                  enable row level security;
alter table public.stock_movements        enable row level security;
alter table public.stock_adjustments      enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.suppliers              enable row level security;
alter table public.purchases              enable row level security;
alter table public.purchase_items         enable row level security;
alter table public.cash_accounts          enable row level security;
alter table public.payments               enable row level security;
alter table public.cash_operations        enable row level security;
alter table public.notifications          enable row level security;
alter table public.audit_log              enable row level security;

-- Страховка: если какая-то таблица в public осталась без RLS — ошибка.
do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ')
    into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'RLS не включён на таблицах: %', v_missing;
  end if;
end;
$$;
