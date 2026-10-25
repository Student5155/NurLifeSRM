-- =====================================================================
-- NurLife CRM · 05 · Клиенты, контакты, индивидуальные цены
-- =====================================================================

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  type               public.client_type not null,
  name               text not null check (length(trim(name)) > 0),
  legal_name         text,
  inn                text check (inn is null or inn ~ '^\d{10}(\d{2})?$'),
  kpp                text check (kpp is null or kpp ~ '^\d{9}$'),
  phone              text,
  email              text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address            text,
  discount_percent   numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  credit_limit       numeric(12,2) check (credit_limit >= 0),
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  manager_id         uuid references public.profiles (id) on delete set null,
  notes              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

comment on column public.clients.credit_limit is 'Кредитный лимит; NULL — без ограничения';
comment on column public.clients.payment_terms_days is 'Отсрочка платежа, дней (для due_date заказа)';

create index clients_manager_id_idx on public.clients (manager_id);
create index clients_type_idx       on public.clients (type);
create index clients_name_trgm_idx  on public.clients using gin (name  extensions.gin_trgm_ops);
create index clients_phone_trgm_idx on public.clients using gin (phone extensions.gin_trgm_ops);
create index clients_inn_trgm_idx   on public.clients using gin (inn   extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
create table public.client_contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  position   text,
  phone      text,
  email      text,
  telegram   text,
  is_primary boolean not null default false
);

create index client_contacts_client_id_idx on public.client_contacts (client_id);
create unique index client_contacts_one_primary_uidx
  on public.client_contacts (client_id) where is_primary;

-- ---------------------------------------------------------------------
create table public.client_prices (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  price      numeric(12,2) not null check (price >= 0),
  unique (client_id, product_id)
);

create index client_prices_product_id_idx on public.client_prices (product_id);
