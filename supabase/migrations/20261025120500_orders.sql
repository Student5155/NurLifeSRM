-- =====================================================================
-- NurLife CRM · 06 · Заказы, позиции, история статусов
-- =====================================================================

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  client_id        uuid references public.clients (id) on delete restrict,
  price_type       public.client_type not null,
  status           public.order_status not null default 'new',
  payment_status   public.payment_status not null default 'unpaid',
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total   numeric(12,2) not null default 0 check (discount_total >= 0),
  total            numeric(12,2) not null default 0 check (total >= 0),
  paid_amount      numeric(12,2) not null default 0 check (paid_amount >= 0),
  delivery_address text,
  due_date         date,
  manager_id       uuid references public.profiles (id) on delete set null default auth.uid(),
  comment          text,
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  confirmed_at     timestamptz,
  shipped_at       timestamptz,

  -- Оптовый заказ всегда с клиентом; розничный (быстрая продажа) — можно без.
  constraint orders_wholesale_needs_client
    check (client_id is not null or price_type = 'retail'),
  constraint orders_cancel_reason_required
    check (status <> 'cancelled' or nullif(trim(cancel_reason), '') is not null),
  constraint orders_shipped_at_required
    check (status not in ('shipped', 'paid') or shipped_at is not null),
  constraint orders_total_consistent
    check (total = subtotal - discount_total)
);

comment on column public.orders.number is 'З-ГГГГ-000001, присваивается триггером';
comment on column public.orders.client_id is 'NULL — анонимная розничная продажа';

create trigger orders_assign_number
  before insert or update of number on public.orders
  for each row execute function public.assign_document_number('З');

create index orders_client_id_idx  on public.orders (client_id);
create index orders_manager_id_idx on public.orders (manager_id);
create index orders_status_idx     on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_shipped_at_idx on public.orders (shipped_at) where shipped_at is not null;
create index orders_due_date_idx   on public.orders (due_date) where payment_status <> 'paid';

-- ---------------------------------------------------------------------
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid not null references public.products (id) on delete restrict,
  qty              numeric(12,3) not null check (qty > 0),
  unit_price       numeric(12,2) not null check (unit_price >= 0),
  price_source     text not null
                     check (price_source in ('client_price', 'tier', 'wholesale', 'retail', 'manual')),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  line_total       numeric(12,2) not null check (line_total >= 0),
  cost_price       numeric(12,2) check (cost_price >= 0)
);

comment on column public.order_items.cost_price is 'Себестоимость единицы на момент отгрузки (avg_cost) — только owner';

create index order_items_order_id_idx   on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

create trigger order_items_check_qty_unit
  before insert or update of qty, product_id on public.order_items
  for each row execute function public.check_qty_matches_unit('qty');

-- ---------------------------------------------------------------------
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  changed_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  comment     text,
  created_at  timestamptz not null default now()
);

create index order_status_history_order_id_idx   on public.order_status_history (order_id, created_at);
create index order_status_history_changed_by_idx on public.order_status_history (changed_by);
