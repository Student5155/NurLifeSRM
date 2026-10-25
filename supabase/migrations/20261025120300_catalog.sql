-- =====================================================================
-- NurLife CRM · 04 · Каталог: единицы, категории, товары, цены, фото
-- =====================================================================

-- ---------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------
create table public.units (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (length(trim(code)) > 0),
  name          text not null check (length(trim(name)) > 0),
  is_fractional boolean not null default false
);

-- ---------------------------------------------------------------------
-- categories (до 3 уровней)
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories (id) on delete restrict,
  name       text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_id_idx on public.categories (parent_id);
create unique index categories_name_per_parent_uidx
  on public.categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Глубина дерева ≤ 3 и отсутствие циклов (с учётом поддерева при переносе).
create or replace function public.check_category_tree()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_depth constant integer := 3;
  v_depth   integer := 1;
  v_parent  uuid    := new.parent_id;
  v_height  integer;
begin
  while v_parent is not null loop
    if v_parent = new.id then
      raise exception 'Категория не может быть вложена сама в себя' using errcode = 'P0001';
    end if;
    v_depth := v_depth + 1;
    if v_depth > c_max_depth then
      raise exception 'Допускается не более % уровней категорий', c_max_depth using errcode = 'P0001';
    end if;
    select c.parent_id into v_parent from public.categories c where c.id = v_parent;
  end loop;

  if tg_op = 'UPDATE' then
    with recursive sub as (
      select c.id, 1 as lvl from public.categories c where c.parent_id = new.id
      union all
      select c.id, s.lvl + 1 from public.categories c join sub s on c.parent_id = s.id
       where s.lvl < c_max_depth + 1
    )
    select coalesce(max(lvl), 0) into v_height from sub;

    if v_depth + v_height > c_max_depth then
      raise exception 'После переноса глубина дерева превысит % уровня', c_max_depth using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger categories_check_tree
  before insert or update of parent_id on public.categories
  for each row execute function public.check_category_tree();

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique check (length(trim(sku)) > 0),
  barcode         text,
  name            text not null check (length(trim(name)) > 0),
  description     text,
  category_id     uuid references public.categories (id) on delete restrict,
  unit_id         uuid not null references public.units (id) on delete restrict,
  retail_price    numeric(12,2) not null default 0 check (retail_price >= 0),
  wholesale_price numeric(12,2) not null default 0 check (wholesale_price >= 0),
  purchase_price  numeric(12,2) check (purchase_price >= 0),
  min_stock       numeric(12,3) not null default 0 check (min_stock >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.products.purchase_price is 'Закупочная цена — видна только owner';

create index products_category_id_idx on public.products (category_id);
create index products_unit_id_idx     on public.products (unit_id);
create index products_barcode_idx     on public.products (barcode) where barcode is not null;
create index products_is_active_idx   on public.products (is_active);
create index products_name_trgm_idx   on public.products using gin (name extensions.gin_trgm_ops);
create index products_sku_trgm_idx    on public.products using gin (sku  extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- product_price_tiers — оптовые ступени «от N → цена»
-- ---------------------------------------------------------------------
create table public.product_price_tiers (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  min_qty    numeric(12,3) not null check (min_qty > 0),
  price      numeric(12,2) not null check (price >= 0),
  unique (product_id, min_qty)
);

-- product_id — ведущая колонка уникального индекса, отдельный индекс FK не нужен.

-- ---------------------------------------------------------------------
-- product_images (до 10 на товар, sort_order 0 = главное)
-- ---------------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  sort_order   integer not null default 0 check (sort_order between 0 and 9),
  constraint product_images_order_uniq unique (product_id, sort_order)
    deferrable initially deferred
);

create or replace function public.enforce_product_images_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limit constant integer := 10;
  v_count integer;
begin
  -- Блокируем товар, чтобы параллельные загрузки не обошли лимит.
  perform 1 from public.products p where p.id = new.product_id for update;

  select count(*) into v_count
    from public.product_images i
   where i.product_id = new.product_id;

  if v_count >= c_limit then
    raise exception 'У товара может быть не более % фото', c_limit using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger product_images_limit
  before insert on public.product_images
  for each row execute function public.enforce_product_images_limit();
