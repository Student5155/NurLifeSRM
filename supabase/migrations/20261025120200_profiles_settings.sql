-- =====================================================================
-- NurLife CRM · 03 · Профили пользователей и настройки
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  role       public.user_role not null default 'seller',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Сотрудники: один owner, до 5 активных seller';

-- Ровно один владелец в системе.
create unique index profiles_single_owner_uidx
  on public.profiles ((true))
  where role = 'owner';

create index profiles_role_active_idx on public.profiles (role, is_active);

-- Лимит активных продавцов — 5. Advisory lock исключает гонку двух
-- одновременных приглашений.
create or replace function public.enforce_seller_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limit constant integer := 5;
  v_count integer;
begin
  if new.role = 'seller' and new.is_active
     and (tg_op = 'INSERT' or old.role <> 'seller' or not old.is_active) then

    perform pg_advisory_xact_lock(hashtext('nurlife.enforce_seller_limit'));

    select count(*) into v_count
      from public.profiles
     where role = 'seller' and is_active and id <> new.id;

    if v_count >= c_limit then
      raise exception 'Достигнут лимит активных продавцов: % из %', v_count, c_limit
        using errcode = 'P0001',
              hint = 'Деактивируйте одного из продавцов, чтобы добавить нового';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_seller_limit
  before insert or update of role, is_active on public.profiles
  for each row execute function public.enforce_seller_limit();

-- Новый пользователь auth.users → профиль seller.
-- ФИО и телефон берутся из metadata (inviteUserByEmail(..., { data })).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role, is_active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'seller',
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- settings (ровно одна строка)
-- ---------------------------------------------------------------------
create table public.settings (
  id                   boolean primary key default true check (id),
  company_name         text not null default '',
  inn                  text check (inn is null or inn ~ '^\d{10}(\d{2})?$'),
  address              text,
  phone                text,
  allow_negative_stock boolean not null default false,
  seller_max_discount  numeric(5,2) not null default 10
                         check (seller_max_discount between 0 and 100),
  low_stock_notify     boolean not null default true,
  currency             text not null default 'RUB'
);

comment on table  public.settings is 'Настройки компании, одна строка (id = true)';
comment on column public.settings.seller_max_discount is 'Максимальная скидка продавца, %';

create or replace function public.prevent_settings_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Строку настроек нельзя удалить' using errcode = 'P0001';
end;
$$;

create trigger settings_prevent_delete
  before delete on public.settings
  for each row execute function public.prevent_settings_delete();
