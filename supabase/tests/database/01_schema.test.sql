-- =====================================================================
-- NurLife CRM · Шаг 1 · Тесты схемы, триггеров и справочных данных
-- Запуск: npx supabase test db
-- Всё в транзакции с откатом: данные в базе не остаются.
-- =====================================================================
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

-- ---------------------------------------------------------------- seed
select ok((select count(*) from public.units) = 5, 'seed: 5 единиц измерения');
select ok((select is_fractional from public.units where code = 'кг'), 'seed: кг дробная');
select ok((select count(*) from public.cash_accounts) = 3, 'seed: 3 кассы');
select ok((select seller_max_discount from public.settings) = 10, 'seed: лимит скидки 10%');
select throws_like($$insert into public.settings (id) values (false)$$, '%violates check%', 'settings: вторая строка запрещена');
select throws_like($$update public.settings set seller_max_discount = 101$$, '%violates check%', 'settings: скидка > 100 запрещена');
select throws_like($$delete from public.settings$$, '%нельзя удалить%', 'settings: удаление запрещено');

-- ------------------------------------------------- профили и продавцы
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@test.local',  '{"full_name":"Владелец"}'),
  ('00000000-0000-0000-0000-0000000000a1', 's1@test.local', '{"full_name":"Продавец 1","phone":"+79000000001"}');

select ok(
  (select role = 'seller' and is_active and full_name = 'Продавец 1' and phone = '+79000000001'
     from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'профиль создаётся триггером (seller, ФИО и телефон из metadata)');

update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a0';
select throws_like($$update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a1'$$, '%profiles_single_owner_uidx%', 'второй owner запрещён');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 's2@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 's3@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 's4@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 's5@test.local');
select ok(
  (select count(*) from public.profiles where role = 'seller' and is_active) = 5, '5 активных продавцов — ок');

select throws_like($$insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a6', 's6@test.local')$$, '%лимит активных продавцов%', '6-й продавец отклонён');

update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a5';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a6', 's6@test.local');
select ok(true, 'после деактивации одного можно добавить нового');

select throws_like($$update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000a5'$$, '%лимит активных продавцов%', 'повторная активация сверх лимита отклонена');

-- ------------------------------------------------------- категории
insert into public.categories (id, parent_id, name) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Уровень 1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'Уровень 2'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c2', 'Уровень 3'),
  ('00000000-0000-0000-0000-0000000000d1', null, 'Другая ветка'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d1', 'Другая ветка 2');
select ok(true, 'категории: 3 уровня — ок');

select throws_like($$insert into public.categories (parent_id, name) values ('00000000-0000-0000-0000-0000000000c3', 'Уровень 4')$$, '%не более 3 уровней%', 'категории: 4-й уровень запрещён');
select throws_like($$update public.categories set parent_id = '00000000-0000-0000-0000-0000000000d2' where id = '00000000-0000-0000-0000-0000000000c2'$$, '%превысит%', 'категории: перенос поддерева глубже 3 уровней запрещён');
select throws_like($$update public.categories set parent_id = '00000000-0000-0000-0000-0000000000c3' where id = '00000000-0000-0000-0000-0000000000c1'$$, '%сама в себя%', 'категории: цикл запрещён');

-- ---------------------------------------------------- товары и склад
insert into public.products (id, sku, name, unit_id, retail_price, wholesale_price, category_id)
select '00000000-0000-0000-0000-0000000000f1', 'SKU-1', 'Товар штучный', id, 100, 80, '00000000-0000-0000-0000-0000000000c3'
  from public.units where code = 'шт';
insert into public.products (id, sku, name, unit_id, retail_price, wholesale_price)
select '00000000-0000-0000-0000-0000000000f2', 'SKU-2', 'Товар весовой', id, 50, 40
  from public.units where code = 'кг';

select ok(
  (select count(*) from public.stock where product_id in
     ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')) = 2,
  'строка stock создаётся вместе с товаром');
select throws_like($$insert into public.products (sku, name, unit_id) select 'SKU-1', 'Дубль', id from public.units limit 1$$, '%products_sku_key%', 'SKU уникален');

update public.products set name = 'Товар штучный (изм.)' where id = '00000000-0000-0000-0000-0000000000f1';
select ok(
  (select updated_at >= created_at from public.products where id = '00000000-0000-0000-0000-0000000000f1'),
  'updated_at обновляется');

-- фото: не больше 10
insert into public.product_images (product_id, storage_path, sort_order)
select '00000000-0000-0000-0000-0000000000f1', 'p/f1/' || g || '.webp', g from generate_series(0, 9) g;
select throws_like($$insert into public.product_images (product_id, storage_path, sort_order) values ('00000000-0000-0000-0000-0000000000f1', 'p/f1/x.webp', 0)$$, '%не более 10 фото%', 'фото: 11-е отклонено');

-- ---------------------------------------------------------- номера
insert into public.orders (id, price_type) values ('00000000-0000-0000-0000-0000000000e1', 'retail');
insert into public.orders (id, price_type) values ('00000000-0000-0000-0000-0000000000e2', 'retail');
select ok(
  (select number from public.orders where id = '00000000-0000-0000-0000-0000000000e1')
    = 'З-' || extract(year from now() at time zone public.app_timezone()) || '-000001',
  'номер заказа З-ГГГГ-000001');
select ok(
  (select number from public.orders where id = '00000000-0000-0000-0000-0000000000e2') like '%-000002',
  'номера идут подряд');
select throws_like($$update public.orders set number = 'З-1999-000001' where id = '00000000-0000-0000-0000-0000000000e1'$$, '%нельзя изменить%', 'номер заказа неизменяем');

insert into public.stock_adjustments (type, reason) values ('adjustment', 'Бой');
insert into public.stock_adjustments (type) values ('inventory');
select ok(
  (select count(*) from public.stock_adjustments where number like 'К-%-000001' or number like 'И-%-000001') = 2,
  'номера корректировки К-… и инвентаризации И-…');

insert into public.suppliers (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Поставщик');
insert into public.purchases (supplier_id) values ('00000000-0000-0000-0000-0000000000b1');
select ok((select number like 'П-%-000001' from public.purchases), 'номер закупки П-ГГГГ-000001');

-- --------------------------------------------------- ограничения заказа
select throws_like($$insert into public.orders (price_type) values ('wholesale')$$, '%orders_wholesale_needs_client%', 'оптовый заказ без клиента запрещён');
select throws_like($$update public.orders set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000000e1'$$, '%orders_cancel_reason_required%', 'отмена без причины запрещена');

-- ------------------------------------------------- дробные количества
select throws_like($$insert into public.order_items (order_id, product_id, qty, unit_price, price_source, line_total)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 1.5, 100, 'retail', 150)$$, '%должно быть целым%', 'шт: 1,5 запрещено');
insert into public.order_items (order_id, product_id, qty, unit_price, price_source, line_total)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f2', 1.5, 50, 'retail', 75);
select ok(true, 'кг: 1,5 — ок');
select throws_like($$insert into public.order_items (order_id, product_id, qty, unit_price, price_source, line_total)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f2', 1, 50, 'promo', 50)$$, '%violates check%', 'price_source: только допустимые значения');

-- ------------------------------------------------ неизменяемые журналы
insert into public.stock_movements (product_id, type, qty, balance_after)
values ('00000000-0000-0000-0000-0000000000f1', 'adjustment', 5, 5);
select throws_like($$update public.stock_movements set qty = 6$$, '%неизменяемы%', 'stock_movements: UPDATE запрещён');
select throws_like($$delete from public.stock_movements$$, '%неизменяемы%', 'stock_movements: DELETE запрещён');

insert into public.audit_log (table_name, record_id, action) values ('products', 'x', 'UPDATE');
select throws_like($$delete from public.audit_log$$, '%неизменяемы%', 'audit_log: DELETE запрещён');

-- --------------------------------------------------------------- платежи
select throws_like($$insert into public.payments (direction, amount, method, cash_account_id)
    select 'in', 100, 'cash', id from public.cash_accounts limit 1$$, '%payments_in_from_client%', 'входящий платёж без клиента/заказа запрещён');

-- ------------------------------------------------------------------ RLS
select ok(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  'RLS включён на всех таблицах public');

select * from finish();
rollback;
