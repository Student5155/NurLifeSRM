-- =====================================================================
-- NurLife CRM · 07 · Склад: остатки, движения, корректировки
-- Один склад: одна строка stock на товар.
-- Остатки меняются только функциями post_receipt / post_adjustment /
-- post_inventory и rpc заказов (шаги 7, 9).
-- =====================================================================

create table public.stock (
  product_id    uuid primary key references public.products (id) on delete cascade,
  qty_on_hand   numeric(12,3) not null default 0,
  qty_reserved  numeric(12,3) not null default 0 check (qty_reserved >= 0),
  qty_available numeric(12,3) generated always as (qty_on_hand - qty_reserved) stored,
  avg_cost      numeric(12,2) not null default 0 check (avg_cost >= 0),
  updated_at    timestamptz not null default now()
);

comment on column public.stock.avg_cost is 'Себестоимость по скользящей средней — только owner';
comment on column public.stock.qty_on_hand is 'Может уйти в минус только при settings.allow_negative_stock (проверка в rpc)';

create index stock_qty_available_idx on public.stock (qty_available);

create trigger stock_set_updated_at
  before update on public.stock
  for each row execute function public.set_updated_at();

-- Строка остатков создаётся вместе с товаром.
create or replace function public.create_stock_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stock (product_id) values (new.id)
  on conflict (product_id) do nothing;
  return new;
end;
$$;

create trigger products_create_stock_row
  after insert on public.products
  for each row execute function public.create_stock_row();

-- ---------------------------------------------------------------------
-- stock_movements — неизменяемый журнал
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete restrict,
  type          public.movement_type not null,
  qty           numeric(12,3) not null check (qty <> 0),
  unit_cost     numeric(12,2) check (unit_cost >= 0),
  ref_type      text check (ref_type in ('order', 'purchase', 'adjustment')),
  ref_id        uuid,
  balance_after numeric(12,3) not null,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check ((ref_type is null) = (ref_id is null))
);

comment on column public.stock_movements.qty is 'Со знаком: + приход, − расход. Для reserve/unreserve — изменение резерва';
comment on column public.stock_movements.balance_after is 'qty_on_hand после движения';
comment on column public.stock_movements.unit_cost is 'Себестоимость — только owner';

create index stock_movements_product_id_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_ref_idx        on public.stock_movements (ref_type, ref_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);

create trigger stock_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function public.prevent_modification();

create trigger stock_movements_no_truncate
  before truncate on public.stock_movements
  for each statement execute function public.prevent_modification();

-- ---------------------------------------------------------------------
-- stock_adjustments — корректировки (К-…) и инвентаризации (И-…)
-- ---------------------------------------------------------------------
create table public.stock_adjustments (
  id         uuid primary key default gen_random_uuid(),
  number     text not null unique,
  type       text not null check (type in ('adjustment', 'inventory')),
  status     text not null default 'draft' check (status in ('draft', 'posted')),
  reason     text,
  posted_by  uuid references public.profiles (id) on delete set null,
  posted_at  timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((status = 'posted') = (posted_at is not null)),
  check (status = 'draft' or type = 'inventory' or nullif(trim(reason), '') is not null)
);

create trigger stock_adjustments_assign_number
  before insert or update of number on public.stock_adjustments
  for each row execute function public.assign_document_number();

create index stock_adjustments_posted_by_idx  on public.stock_adjustments (posted_by);
create index stock_adjustments_created_by_idx on public.stock_adjustments (created_by);
create index stock_adjustments_status_idx     on public.stock_adjustments (status, created_at desc);

-- ---------------------------------------------------------------------
create table public.stock_adjustment_items (
  id            uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.stock_adjustments (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete restrict,
  qty_expected  numeric(12,3) not null default 0,
  qty_actual    numeric(12,3) not null check (qty_actual >= 0),
  qty_diff      numeric(12,3) generated always as (qty_actual - qty_expected) stored,
  unique (adjustment_id, product_id)
);

create index stock_adjustment_items_product_id_idx on public.stock_adjustment_items (product_id);

create trigger stock_adjustment_items_check_qty_unit
  before insert or update of qty_actual, product_id on public.stock_adjustment_items
  for each row execute function public.check_qty_matches_unit('qty_actual');
