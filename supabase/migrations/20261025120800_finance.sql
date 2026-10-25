-- =====================================================================
-- NurLife CRM · 09 · Кассы, платежи, прочие операции
-- =====================================================================

create table public.cash_accounts (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique check (length(trim(name)) > 0),
  type      text not null check (type in ('cash', 'bank', 'card')),
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  direction       text not null check (direction in ('in', 'out')),
  amount          numeric(12,2) not null check (amount > 0),
  method          public.payment_method not null,
  cash_account_id uuid not null references public.cash_accounts (id) on delete restrict,
  client_id       uuid references public.clients (id) on delete restrict,
  order_id        uuid references public.orders (id) on delete restrict,
  supplier_id     uuid references public.suppliers (id) on delete restrict,
  purchase_id     uuid references public.purchases (id) on delete restrict,
  paid_at         timestamptz not null default now(),
  comment         text,
  is_void         boolean not null default false,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),

  -- Платёж относится либо к клиенту/заказу, либо к поставщику/закупке.
  constraint payments_single_counterparty check (
    not ((client_id is not null or order_id is not null)
     and (supplier_id is not null or purchase_id is not null))
  ),
  -- Входящий — всегда от клиента или по заказу.
  constraint payments_in_from_client check (
    direction <> 'in' or client_id is not null or order_id is not null
  ),
  -- Оплата закупки всегда с указанием поставщика.
  constraint payments_purchase_needs_supplier check (
    purchase_id is null or supplier_id is not null
  )
);

comment on column public.payments.order_id is 'NULL при входящем платеже — аванс клиента';
comment on column public.payments.is_void  is 'Сторно (только owner); сторнированный платёж не учитывается';

create index payments_cash_account_id_idx on public.payments (cash_account_id);
create index payments_client_id_idx       on public.payments (client_id);
create index payments_order_id_idx        on public.payments (order_id);
create index payments_supplier_id_idx     on public.payments (supplier_id);
create index payments_purchase_id_idx     on public.payments (purchase_id);
create index payments_created_by_idx      on public.payments (created_by);
create index payments_paid_at_idx         on public.payments (paid_at desc);

-- ---------------------------------------------------------------------
create table public.cash_operations (
  id              uuid primary key default gen_random_uuid(),
  cash_account_id uuid not null references public.cash_accounts (id) on delete restrict,
  direction       text not null check (direction in ('in', 'out')),
  amount          numeric(12,2) not null check (amount > 0),
  category        text not null check (length(trim(category)) > 0),
  comment         text,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

comment on table public.cash_operations is 'Прочие приходы/расходы касс (аренда, зарплата, внесение и т. п.)';

create index cash_operations_cash_account_id_idx on public.cash_operations (cash_account_id);
create index cash_operations_created_by_idx      on public.cash_operations (created_by);
create index cash_operations_created_at_idx      on public.cash_operations (created_at desc);
