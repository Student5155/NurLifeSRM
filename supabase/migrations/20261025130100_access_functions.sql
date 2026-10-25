-- =====================================================================
-- NurLife CRM · 13 · Функции доступа и защитные триггеры
-- =====================================================================

-- Роль текущего пользователя; NULL — если не вошёл или деактивирован.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from public.profiles p
   where p.id = auth.uid()
     and p.is_active
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.is_active
  )
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'owner', false)
$$;

comment on function public.current_user_role() is 'Роль активного пользователя или NULL';
comment on function public.is_active_user()   is 'Пользователь вошёл и не деактивирован';
comment on function public.is_owner()         is 'Текущий пользователь — активный владелец';

-- ---------------------------------------------------------------------
-- Клиенты: скидку, кредитный лимит и отсрочку задаёт только owner.
-- Без auth.uid() (SQL Editor, service role) ограничение не действует.
-- ---------------------------------------------------------------------
create or replace function public.guard_client_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.discount_percent <> 0 or new.credit_limit is not null or new.payment_terms_days <> 0 then
      raise exception 'Скидку, кредитный лимит и отсрочку клиента устанавливает только владелец'
        using errcode = '42501';
    end if;
  elsif new.discount_percent   is distinct from old.discount_percent
     or new.credit_limit       is distinct from old.credit_limit
     or new.payment_terms_days is distinct from old.payment_terms_days then
    raise exception 'Скидку, кредитный лимит и отсрочку клиента изменяет только владелец'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger clients_guard_owner_fields
  before insert or update on public.clients
  for each row execute function public.guard_client_owner_fields();

-- Новый клиент по умолчанию закрепляется за создавшим его сотрудником.
alter table public.clients alter column manager_id set default auth.uid();

-- ---------------------------------------------------------------------
-- Владелец не может через приложение снять с себя роль или
-- деактивироваться. Передача прав — только SQL от имени postgres.
-- ---------------------------------------------------------------------
create or replace function public.guard_owner_lockout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and old.role = 'owner'
     and (new.role <> 'owner' or not new.is_active) then
    raise exception 'Владельца нельзя деактивировать или лишить роли' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_owner_lockout
  before update of role, is_active on public.profiles
  for each row execute function public.guard_owner_lockout();
