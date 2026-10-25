-- =====================================================================
-- NurLife CRM · Тесты бизнес-логики: цены, скидки, заказы, склад,
-- оплаты, быстрая продажа, закупки, инвентаризация, касса.
-- Запуск: npx supabase test db. Всё откатывается.
-- =====================================================================
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated;

select plan(79);

-- Вспомогательное хранилище id между шагами.
create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids (name text primary key, id uuid not null);
grant select, insert on tests.ids to authenticated;
create function tests.id(p_name text) returns uuid language sql stable as
  $$ select id from tests.ids where name = p_name $$;
grant execute on function tests.id(text) to authenticated;

-- ------------------------------------------------------------ данные
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 's1@test.local');
update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a0';

insert into products (id, sku, name, unit_id, retail_price, wholesale_price)
select '00000000-0000-0000-0000-0000000000f1', 'P1', 'Товар штучный', id, 100, 80 from units where code = 'шт';
insert into products (id, sku, name, unit_id, retail_price, wholesale_price)
select '00000000-0000-0000-0000-0000000000f2', 'P2', 'Товар весовой', id, 50, 45 from units where code = 'кг';
insert into product_price_tiers (product_id, min_qty, price) values ('00000000-0000-0000-0000-0000000000f1', 10, 70);

insert into clients (id, type, name, payment_terms_days) values
  ('00000000-0000-0000-0000-0000000000c1', 'wholesale', 'Опт клиент', 14);
insert into clients (id, type, name, discount_percent) values
  ('00000000-0000-0000-0000-0000000000c2', 'wholesale', 'Клиент со скидкой', 5);
insert into client_prices (client_id, product_id, price)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f2', 40);

insert into suppliers (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Поставщик');

-- =====================================================================
-- Владелец: закупка и приход (частичный + остаток), скользящая средняя
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';

insert into tests.ids select 'pur1', save_purchase(null, jsonb_build_object(
  'supplier_id', '00000000-0000-0000-0000-0000000000b1', 'supplier_invoice', 'СЧ-1',
  'items', jsonb_build_array(
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f1', 'qty', 10, 'unit_cost', 60),
    jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f2', 'qty', 10, 'unit_cost', 30))));
select is((select total from purchases where id = tests.id('pur1')), 900.00::numeric(12,2), 'закупка: сумма 900');
select lives_ok($$select set_purchase_status(tests.id('pur1'), 'ordered')$$, 'закупка: оформлена');

select lives_ok($$select post_receipt(tests.id('pur1'), jsonb_build_array(jsonb_build_object(
  'item_id', (select id from purchase_items where purchase_id = tests.id('pur1') and product_id = '00000000-0000-0000-0000-0000000000f1'),
  'qty', 4)))$$, 'приход: частичная приёмка 4 шт');
select is((select status::text from purchases where id = tests.id('pur1')), 'ordered', 'приход: после частичной — статус ordered');
select throws_like($$select post_receipt(tests.id('pur1'), jsonb_build_array(jsonb_build_object(
  'item_id', (select id from purchase_items where purchase_id = tests.id('pur1') and product_id = '00000000-0000-0000-0000-0000000000f1'),
  'qty', 7)))$$, '%больше оставшегося%', 'приход: больше оставшегося запрещено');
select lives_ok($$select post_receipt(tests.id('pur1'))$$, 'приход: остаток принят');
select is((select status::text from purchases where id = tests.id('pur1')), 'received', 'приход: статус received');

insert into tests.ids select 'pur2', save_purchase(null, jsonb_build_object(
  'supplier_id', '00000000-0000-0000-0000-0000000000b1',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f1', 'qty', 10, 'unit_cost', 70))));
select post_receipt(tests.id('pur2'));

select results_eq($$select qty_on_hand, avg_cost from stock where product_id = '00000000-0000-0000-0000-0000000000f1'$$,
  $$values (20.000::numeric(12,3), 65.00::numeric(12,2))$$, 'склад: 20 шт, себестоимость 65 (скользящая средняя)');
select is((select purchase_price from products where id = '00000000-0000-0000-0000-0000000000f1'), 70.00::numeric(12,2),
  'товар: закупочная цена = последняя приёмка');
select is((select count(*)::int from stock_movements where type = 'receipt'), 4, 'журнал: 4 движения прихода');
select throws_like($$select set_purchase_status(tests.id('pur1'), 'cancelled')$$, '%Нельзя перевести%',
  'закупку с принятым товаром отменить нельзя');

reset role;

-- =====================================================================
-- Продавец: автоцена
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';

select results_eq($$select unit_price, price_source from calc_price('00000000-0000-0000-0000-0000000000f1', 1, 'retail')$$,
  $$values (100.00::numeric, 'retail'::text)$$, 'цена: розница');
select results_eq($$select unit_price, price_source from calc_price('00000000-0000-0000-0000-0000000000f1', 5, 'wholesale')$$,
  $$values (80.00::numeric, 'wholesale'::text)$$, 'цена: опт');
select results_eq($$select unit_price, price_source from calc_price('00000000-0000-0000-0000-0000000000f1', 10, 'wholesale')$$,
  $$values (70.00::numeric, 'tier'::text)$$, 'цена: оптовая ступень от 10 шт');
select results_eq($$select unit_price, price_source, discount_percent from calc_price('00000000-0000-0000-0000-0000000000f2', 1, 'wholesale', '00000000-0000-0000-0000-0000000000c1')$$,
  $$values (40.00::numeric, 'client_price'::text, 0::numeric)$$, 'цена: индивидуальная цена клиента');
select results_eq($$select unit_price, discount_percent from calc_price('00000000-0000-0000-0000-0000000000f1', 1, 'wholesale', '00000000-0000-0000-0000-0000000000c2')$$,
  $$values (80.00::numeric, 5.00::numeric)$$, 'цена: скидка клиента 5%');

-- =====================================================================
-- Лимит скидки продавца (10% по умолчанию)
-- =====================================================================
select throws_like($$select save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1,"discount_percent":11}]}')$$,
  '%превышает лимит продавца%', 'скидка: seller 11% — отказ');
select lives_ok($$select save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1,"discount_percent":10}]}')$$,
  'скидка: seller 10% — ок');
select throws_like($$select save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1,"unit_price":89}]}')$$,
  '%превышает лимит продавца%', 'скидка: ручная цена на 11% ниже автоцены — отказ');
select lives_ok($$select save_order(null, '{"client_id":"00000000-0000-0000-0000-0000000000c2","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1,"discount_percent":14.5}]}')$$,
  'скидка: клиентская скидка 5% не входит в лимит продавца');

-- триггер на order_items срабатывает и без rpc
reset role;
insert into tests.ids select 'draft', id from orders where client_id is null limit 1;
select throws_like($$insert into order_items (order_id, product_id, qty, unit_price, price_source, discount_percent, line_total)
  values (tests.id('draft'), '00000000-0000-0000-0000-0000000000f1', 1, 100, 'retail', 11, 89)$$,
  '%превышает лимит продавца%', 'скидка: триггер order_items отклоняет 11% от продавца');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select lives_ok($$select save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1,"discount_percent":25}]}')$$,
  'скидка: owner 25% — ок');
update settings set seller_max_discount = 15;

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select lives_ok($$select save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1,"discount_percent":15}]}')$$,
  'скидка: после смены лимита на 15% seller 15% — ок');

-- =====================================================================
-- Заказ: подтверждение → отгрузка → частичная и полная оплата
-- =====================================================================
insert into tests.ids select 'o1', save_order(null, '{"client_id":"00000000-0000-0000-0000-0000000000c1","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":5}]}');
select results_eq($$select price_type::text, total, number like 'З-%-0000%' from orders where id = tests.id('o1')$$,
  $$values ('wholesale'::text, 400.00::numeric(12,2), true)$$, 'заказ: опт по типу клиента, 5 × 80 = 400, номер присвоен');

select lives_ok($$select change_order_status(tests.id('o1'), 'confirmed')$$, 'заказ: подтверждён');
select results_eq($$select qty_reserved, qty_available from stock_public where product_id = '00000000-0000-0000-0000-0000000000f1'$$,
  $$values (5.000::numeric(12,3), 15.000::numeric(12,3))$$, 'заказ: резерв 5, доступно 15');

select lives_ok($$select change_order_status(tests.id('o1'), 'assembled')$$, 'заказ: собран');
select lives_ok($$select change_order_status(tests.id('o1'), 'shipped')$$, 'заказ: отгружен');
select results_eq($$select qty_on_hand, qty_reserved from stock_public where product_id = '00000000-0000-0000-0000-0000000000f1'$$,
  $$values (15.000::numeric(12,3), 0.000::numeric(12,3))$$, 'отгрузка: списано 5, резерв снят');
select is((select due_date from orders where id = tests.id('o1')),
  (now() at time zone app_timezone())::date + 14, 'отгрузка: срок оплаты = сегодня + отсрочка 14 дней');
select is(client_debt('00000000-0000-0000-0000-0000000000c1'), 400.00::numeric, 'долг клиента 400');

select lives_ok($$select register_payment('00000000-0000-0000-0000-0000000000c1', tests.id('o1'), 150, 'cash',
  (select id from cash_accounts where name = 'Наличные'))$$, 'оплата: частичная 150');
select results_eq($$select status::text, payment_status::text, paid_amount from orders where id = tests.id('o1')$$,
  $$values ('shipped'::text, 'partial'::text, 150.00::numeric(12,2))$$, 'оплата: статус partial');
insert into tests.ids select 'pay250', register_payment('00000000-0000-0000-0000-0000000000c1', tests.id('o1'), 250, 'cash',
  (select id from cash_accounts where name = 'Наличные'));
select results_eq($$select status::text, payment_status::text from orders where id = tests.id('o1')$$,
  $$values ('paid'::text, 'paid'::text)$$, 'оплата: полная → статус «Оплачен» автоматически');
select is(client_debt('00000000-0000-0000-0000-0000000000c1'), 0.00::numeric, 'долг клиента погашен');
select throws_like($$select change_order_status(tests.id('o1'), 'cancelled', null, 'тест')$$, '%невозможен%',
  'оплаченный заказ отменить нельзя');

-- =====================================================================
-- Ограничения продавца по статусам
-- =====================================================================
insert into tests.ids select 'o2', save_order(null, '{"client_id":"00000000-0000-0000-0000-0000000000c1","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":3}]}');
select change_order_status(tests.id('o2'), 'confirmed');
select throws_ok($$select change_order_status(tests.id('o2'), 'new')$$, '42501', null, 'seller: откат статуса запрещён');
select throws_like($$select change_order_status(tests.id('o2'), 'cancelled')$$, '%причину отмены%', 'отмена без причины запрещена');
select lives_ok($$select change_order_status(tests.id('o2'), 'cancelled', null, 'Клиент передумал')$$, 'seller: отмена подтверждённого');
select is((select qty_reserved from stock_public where product_id = '00000000-0000-0000-0000-0000000000f1'), 0.000::numeric(12,3),
  'отмена: резерв снят');
select throws_like($$select save_order(tests.id('o2'), '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1}]}')$$,
  '%только заказ в статусе «Новый»%', 'отменённый заказ не редактируется');

insert into tests.ids select 'o3', save_order(null, '{"client_id":"00000000-0000-0000-0000-0000000000c1","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1}]}');
select change_order_status(tests.id('o3'), 'confirmed');
select change_order_status(tests.id('o3'), 'shipped');
select throws_ok($$select change_order_status(tests.id('o3'), 'cancelled', null, 'Возврат')$$, '42501', null,
  'seller: отмена отгруженного запрещена');

insert into tests.ids select 'o4', save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":100}]}');
select throws_like($$select change_order_status(tests.id('o4'), 'confirmed')$$, '%Недостаточно товара%',
  'подтверждение без остатка отклонено');
select throws_like($$select save_order(null, '{"items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1.5}]}')$$,
  '%должно быть целым%', 'дробное количество штучного товара отклонено');

reset role;

-- =====================================================================
-- Владелец: возврат отгруженного, кредитный лимит
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';

select lives_ok($$select change_order_status(tests.id('o3'), 'cancelled', null, 'Возврат брака')$$, 'owner: возврат отгруженного');
select is((select qty_on_hand from stock where product_id = '00000000-0000-0000-0000-0000000000f1'), 15.000::numeric(12,3),
  'возврат: товар вернулся на склад');
select is((select count(*)::int from stock_movements where type = 'return'), 1, 'возврат: движение return в журнале');

update clients set credit_limit = 100 where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
insert into tests.ids select 'o5', save_order(null, '{"client_id":"00000000-0000-0000-0000-0000000000c1","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":5}]}');
select throws_like($$select change_order_status(tests.id('o5'), 'confirmed')$$, '%кредитный лимит%',
  'кредитный лимит: seller не может подтвердить сверх лимита');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select lives_ok($$select change_order_status(tests.id('o5'), 'confirmed')$$, 'кредитный лимит: owner подтверждает');
select lives_ok($$select change_order_status(tests.id('o5'), 'new')$$, 'owner: откат подтверждённого в «Новый»');
select is((select qty_reserved from stock where product_id = '00000000-0000-0000-0000-0000000000f1'), 0.000::numeric(12,3),
  'откат: резерв снят');

-- =====================================================================
-- Аванс и распределение FIFO, сторно
-- =====================================================================
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select lives_ok($$select register_payment('00000000-0000-0000-0000-0000000000c2', null, 1000, 'card',
  (select id from cash_accounts where name = 'Эквайринг'))$$, 'аванс клиента 1000');
select is(client_debt('00000000-0000-0000-0000-0000000000c2'), -1000.00::numeric, 'аванс: долг −1000');

insert into tests.ids select 'o6', save_order(null, '{"client_id":"00000000-0000-0000-0000-0000000000c2","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":2}]}');
select is((select total from orders where id = tests.id('o6')), 152.00::numeric(12,2), 'заказ: 2 × 80 − 5% = 152');
select change_order_status(tests.id('o6'), 'confirmed');
select results_eq($$select status::text, payment_status::text, paid_amount from orders where id = tests.id('o6')$$,
  $$values ('confirmed'::text, 'paid'::text, 152.00::numeric(12,2))$$, 'FIFO: аванс зачтён при подтверждении');
select change_order_status(tests.id('o6'), 'shipped');
select is((select status::text from orders where id = tests.id('o6')), 'paid', 'FIFO: предоплаченный заказ после отгрузки — «Оплачен»');

select throws_ok($$select void_payment(tests.id('pay250'), 'ошибка')$$, '42501', null, 'seller: сторно запрещено');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select lives_ok($$select void_payment(tests.id('pay250'), 'Ошибочный ввод')$$, 'owner: сторно платежа');
select results_eq($$select status::text, payment_status::text, paid_amount from orders where id = tests.id('o1')$$,
  $$values ('shipped'::text, 'partial'::text, 150.00::numeric(12,2))$$, 'сторно: заказ снова «Отгружен», частично оплачен');
reset role;
select throws_like($$update payments set amount = 1 where id = tests.id('pay250')$$, '%изменить нельзя%',
  'платёж нельзя отредактировать даже напрямую');
select throws_like($$delete from payments where id = tests.id('pay250')$$, '%неизменяемы%',
  'платёж нельзя удалить');
set local role authenticated;

-- =====================================================================
-- Быстрая продажа
-- =====================================================================
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
insert into tests.ids select 'qs', quick_sale(jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f1', 'qty', 2)),
  'payment', jsonb_build_object('method', 'cash', 'cash_account_id', (select id from cash_accounts where name = 'Наличные'))));
select results_eq($$select status::text, payment_status::text, total, price_type::text from orders where id = tests.id('qs')$$,
  $$values ('paid'::text, 'paid'::text, 200.00::numeric(12,2), 'retail'::text)$$, 'быстрая продажа: оплачена, розница 200');

select throws_like($$select quick_sale(jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f1', 'qty', 1000)),
  'payment', jsonb_build_object('method', 'cash', 'cash_account_id', (select id from cash_accounts where name = 'Наличные'))))$$,
  '%Недостаточно товара%', 'быстрая продажа: нет остатка — отказ');
select is((select count(*)::int from order_items_public where qty = 1000), 0,
  'быстрая продажа: при ошибке ничего не сохранено');

-- склад после всех операций: 20 − 5 (o1) − 1 (o3) + 1 (возврат) − 2 (o6) − 2 (быстрая) = 11
select is((select qty_on_hand from stock_public where product_id = '00000000-0000-0000-0000-0000000000f1'), 11.000::numeric(12,3),
  'склад: остаток 11 после всех операций');

-- =====================================================================
-- Инвентаризация и корректировка (owner)
-- =====================================================================
select throws_ok($$select save_stock_document(null, '{"type":"inventory","items":[]}')$$, '42501', null,
  'seller: склад недоступен');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
insert into tests.ids select 'inv', save_stock_document(null,
  '{"type":"inventory","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty_actual":10}]}');
select alike((select number from stock_adjustments where id = tests.id('inv')), 'И-%', 'инвентаризация: номер И-…');
select lives_ok($$select post_inventory(tests.id('inv'))$$, 'инвентаризация проведена');
select results_eq($$select qty, balance_after from stock_movements where type = 'inventory'$$,
  $$values (-1.000::numeric(12,3), 10.000::numeric(12,3))$$, 'инвентаризация: недостача 1, остаток 10');
select throws_like($$select post_inventory(tests.id('inv'))$$, '%уже проведён%', 'повторное проведение запрещено');

insert into tests.ids select 'adj', save_stock_document(null,
  '{"type":"adjustment","items":[{"product_id":"00000000-0000-0000-0000-0000000000f2","qty_actual":9}]}');
select throws_like($$select post_adjustment(tests.id('adj'))$$, '%причину%', 'корректировка без причины запрещена');
select lives_ok($$select save_stock_document(tests.id('adj'),
  '{"reason":"Усушка","items":[{"product_id":"00000000-0000-0000-0000-0000000000f2","qty_actual":9.5}]}')$$,
  'черновик корректировки изменён');
select lives_ok($$select post_adjustment(tests.id('adj'))$$, 'корректировка с причиной проведена');
select is((select qty_on_hand from stock where product_id = '00000000-0000-0000-0000-0000000000f2'), 9.500::numeric(12,3),
  'корректировка: весовой товар 9,5 кг');

reset role;
select throws_like($$update stock_adjustments set reason = 'x' where id = tests.id('adj')$$, '%Проведённый%',
  'проведённый документ неизменяем');

-- =====================================================================
-- Поставщик и касса
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select lives_ok($$select register_supplier_payment(null, tests.id('pur1'), 500, 'bank_transfer',
  (select id from cash_accounts where name = 'Расчётный счёт'))$$, 'оплата поставщику');
select is((select paid_amount from purchases where id = tests.id('pur1')), 500.00::numeric(12,2), 'закупка: оплачено 500');

-- Наличные: 150 + 250 (сторно, не учитывается) + 200 (быстрая продажа) = 350
select results_eq($$select name, balance from cash_balances() order by name$$,
  $$values ('Наличные'::text, 350.00::numeric), ('Расчётный счёт'::text, -500.00::numeric), ('Эквайринг'::text, 1000.00::numeric)$$,
  'балансы касс');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select throws_ok('select * from cash_balances()', '42501', null, 'seller: балансы касс недоступны');

reset role;
select * from finish();
rollback;
