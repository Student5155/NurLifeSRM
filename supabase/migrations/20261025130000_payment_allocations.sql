-- =====================================================================
-- NurLife CRM · 12 · Распределение платежей по заказам
-- Входящий платёж (в т. ч. аванс) распределяется по заказам строками
-- payment_allocations. orders.paid_amount считается по распределениям
-- несторнированных платежей (триггер пересчёта — шаг 11).
-- =====================================================================

comment on column public.payments.order_id is
  'Заказ, при оплате которого принят платёж (необязательно). Фактическое распределение — payment_allocations';

create table public.payment_allocations (
  id         uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id   uuid not null references public.orders (id) on delete restrict,
  amount     numeric(12,2) not null check (amount > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (payment_id, order_id)
);

comment on table public.payment_allocations is 'Сколько из входящего платежа зачтено в оплату заказа';

-- payment_id — ведущая колонка уникального индекса.
create index payment_allocations_order_id_idx   on public.payment_allocations (order_id);
create index payment_allocations_created_by_idx on public.payment_allocations (created_by);

-- Сумма распределений ≤ сумме платежа; платёж входящий и не сторнирован;
-- клиент платежа совпадает с клиентом заказа.
create or replace function public.check_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order_client uuid;
  v_allocated numeric(12,2);
begin
  select * into v_payment from public.payments where id = new.payment_id for update;

  if v_payment.direction <> 'in' then
    raise exception 'Распределять по заказам можно только входящий платёж' using errcode = 'P0001';
  end if;
  if v_payment.is_void then
    raise exception 'Платёж сторнирован' using errcode = 'P0001';
  end if;

  select o.client_id into v_order_client from public.orders o where o.id = new.order_id;
  if v_payment.client_id is not null and v_order_client is distinct from v_payment.client_id then
    raise exception 'Заказ принадлежит другому клиенту' using errcode = 'P0001';
  end if;

  select coalesce(sum(a.amount), 0) into v_allocated
    from public.payment_allocations a
   where a.payment_id = new.payment_id
     and a.id <> new.id;

  if v_allocated + new.amount > v_payment.amount then
    raise exception 'Распределено больше суммы платежа: % из %', v_allocated + new.amount, v_payment.amount
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger payment_allocations_check
  before insert or update on public.payment_allocations
  for each row execute function public.check_payment_allocation();

alter table public.payment_allocations enable row level security;
