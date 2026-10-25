-- =====================================================================
-- NurLife CRM · 08 · Поставщики и закупки (только owner)
-- =====================================================================

create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) > 0),
  inn                text check (inn is null or inn ~ '^\d{10}(\d{2})?$'),
  contact_name       text,
  phone              text,
  email              text,
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  notes              text,
  is_active          boolean not null default true
);

create index suppliers_name_trgm_idx on public.suppliers using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
create table public.purchases (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  supplier_id      uuid not null references public.suppliers (id) on delete restrict,
  status           public.purchase_status not null default 'draft',
  supplier_invoice text,
  total            numeric(12,2) not null default 0 check (total >= 0),
  paid_amount      numeric(12,2) not null default 0 check (paid_amount >= 0),
  received_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  check (status <> 'received' or received_at is not null)
);

comment on column public.purchases.number is 'П-ГГГГ-000001, присваивается триггером';

create trigger purchases_assign_number
  before insert or update of number on public.purchases
  for each row execute function public.assign_document_number('П');

create index purchases_supplier_id_idx on public.purchases (supplier_id);
create index purchases_created_by_idx  on public.purchases (created_by);
create index purchases_status_idx      on public.purchases (status, created_at desc);

-- ---------------------------------------------------------------------
create table public.purchase_items (
  id           uuid primary key default gen_random_uuid(),
  purchase_id  uuid not null references public.purchases (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete restrict,
  qty          numeric(12,3) not null check (qty > 0),
  qty_received numeric(12,3) not null default 0 check (qty_received >= 0),
  unit_cost    numeric(12,2) not null check (unit_cost >= 0),
  line_total   numeric(12,2) not null check (line_total >= 0),
  check (qty_received <= qty)
);

comment on column public.purchase_items.qty_received is 'Принято на склад — для частичной приёмки';

create index purchase_items_purchase_id_idx on public.purchase_items (purchase_id);
create index purchase_items_product_id_idx  on public.purchase_items (product_id);

create trigger purchase_items_check_qty_unit
  before insert or update of qty, qty_received, product_id on public.purchase_items
  for each row execute function public.check_qty_matches_unit('qty', 'qty_received');
