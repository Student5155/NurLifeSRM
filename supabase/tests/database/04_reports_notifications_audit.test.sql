-- =====================================================================
-- NurLife CRM · Тесты отчётов, уведомлений, аудита, пользователей,
-- импорта и массового изменения цен. Всё откатывается.
-- =====================================================================
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated;

select plan(33);

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids (name text primary key, id uuid not null);
grant select, insert on tests.ids to authenticated;
create function tests.id(p_name text) returns uuid language sql stable as
  $$ select id from tests.ids where name = p_name $$;
grant execute on function tests.id(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@test.local', '{"full_name":"Владелец"}'),
  ('00000000-0000-0000-0000-0000000000a1', 's1@test.local',    '{"full_name":"Продавец 1"}'),
  ('00000000-0000-0000-0000-0000000000a2', 's2@test.local',    '{"full_name":"Продавец 2"}');
update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a0';

insert into products (id, sku, name, unit_id, retail_price, wholesale_price, min_stock)
select '00000000-0000-0000-0000-0000000000f1', 'P1', 'Товар', id, 100, 80, 50 from units where code = 'шт';
insert into suppliers (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Поставщик');
insert into clients (id, type, name, phone, manager_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'wholesale', 'Опт клиент', '+7 (912) 345-67-89', '00000000-0000-0000-0000-0000000000a2');

-- ---------------------------------------------------------- операции
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
insert into tests.ids select 'pur', save_purchase(null, jsonb_build_object('supplier_id', '00000000-0000-0000-0000-0000000000b1',
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f1', 'qty', 20, 'unit_cost', 60))));
select lives_ok($$select post_receipt(tests.id('pur'))$$, 'приход 20 × 60');
select lives_ok($$select register_supplier_payment(null, tests.id('pur'), 1000, 'bank_transfer',
  (select id from cash_accounts where name = 'Расчётный счёт'))$$, 'оплата поставщику 1000');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
insert into tests.ids select 'qs', quick_sale(jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000f1', 'qty', 2)),
  'payment', jsonb_build_object('method', 'cash', 'cash_account_id', (select id from cash_accounts where name = 'Наличные'))));

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2"}';
insert into tests.ids select 'o2', save_order(null,
  '{"client_id":"00000000-0000-0000-0000-0000000000c1","items":[{"product_id":"00000000-0000-0000-0000-0000000000f1","qty":1}]}');

reset role;
select is((select count(*)::int from notifications where type = 'new_order'
            and user_id = '00000000-0000-0000-0000-0000000000a0'), 2,
  'уведомления: владелец получил 2 «Новый заказ»');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select change_order_status(tests.id('o2'), 'confirmed');
select change_order_status(tests.id('o2'), 'shipped');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2"}';
select results_eq($$select count(*)::int from notifications where type = 'status_change'$$, $$values (2)$$,
  'уведомления: продавец узнал о смене статуса своего заказа владельцем');
select lives_ok('select mark_all_notifications_read()', 'уведомления: прочитать все');
select is((select count(*)::int from notifications where not is_read), 0, 'уведомления: непрочитанных нет');

-- ------------------------------------------------------------ отчёты
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select results_eq($$select (s->>'revenue')::numeric, s->'gross_profit' from dashboard_stats(current_date - 1, current_date + 1) s$$,
  $$values (200::numeric, 'null'::jsonb)$$, 'дашборд seller: только свои продажи, без прибыли');
select throws_ok($$select * from report_margin(current_date - 1, current_date + 1)$$, '42501', null,
  'seller: отчёт по марже недоступен');
select throws_ok($$select * from report_stock_value()$$, '42501', null, 'seller: стоимость склада недоступна');
select results_eq($$select sum(total)::numeric from report_sales(current_date - 1, current_date + 1, 'day')$$,
  $$values (200::numeric)$$, 'seller: продажи только свои');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select results_eq($$select (s->>'revenue')::numeric, (s->>'gross_profit')::numeric, (s->>'margin_percent')::numeric
                     from dashboard_stats(current_date - 1, current_date + 1) s$$,
  $$values (280::numeric, 100::numeric, 35.71::numeric)$$, 'дашборд owner: выручка 280, прибыль 100, маржа 35,71%');
select results_eq($$select revenue, cost, profit from report_margin(current_date - 1, current_date + 1, 'product')$$,
  $$values (280::numeric, 180::numeric, 100::numeric)$$, 'маржа по товару');
select results_eq($$select retail, wholesale from report_sales(current_date - 1, current_date + 1, 'month')$$,
  $$values (200::numeric, 80::numeric)$$, 'продажи: розница и опт');
select results_eq($$select qty, revenue from report_top_products(current_date - 1, current_date + 1)$$,
  $$values (3::numeric, 280::numeric)$$, 'топ товаров');
select results_eq($$select count(*)::int from report_sales_by_manager(current_date - 1, current_date + 1)$$,
  $$values (2)$$, 'продажи по продавцам: два продавца');
select results_eq($$select abc from report_abc(current_date - 1, current_date + 1)$$, $$values ('A'::text)$$, 'ABC: класс A');
select results_eq($$select qty, value from report_stock_value()$$, $$values (17::numeric, 1020::numeric)$$,
  'стоимость склада: 17 × 60');
select results_eq($$select debt from supplier_balances()$$, $$values (200::numeric)$$, 'долг поставщику 1200 − 1000');
select results_eq($$select need from low_stock_products()$$, $$values (33::numeric)$$, 'нужно заказать: 50 − 17');
select results_eq($$select debt from clients_overview() where client_id = '00000000-0000-0000-0000-0000000000c1'$$,
  $$values (80::numeric)$$, 'долг клиента в списке');
select results_eq($$select (s->>'closing')::numeric, jsonb_array_length(s->'rows')
                     from client_statement('00000000-0000-0000-0000-0000000000c1', current_date - 30, current_date) s$$,
  $$values (80::numeric, 1)$$, 'акт сверки: сальдо 80, одна отгрузка');
select results_eq($$select name from find_client_duplicates('8 912 345 67 89', null)$$,
  $$values ('Опт клиент'::text)$$, 'дубли: телефон в другом формате найден');

-- -------------------------------------------- просрочка и ежедневные задачи
reset role;
update orders set due_date = current_date - 10 where id = tests.id('o2');
select is(notify_overdue_debts(), 1, 'просроченный долг найден');
select is((select count(*)::int from notifications where type = 'overdue_debt'), 2,
  'просрочка: уведомлены владелец и менеджер клиента');
select is(notify_low_stock(), 1, 'низкий остаток: уведомление владельцу');
select results_eq($$select d31_60 + d1_30 from report_receivables_aging()$$, $$values (80::numeric)$$,
  'возраст дебиторки: 80 в корзине 1–30 дней');

-- ------------------------------------------------------------------ аудит
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
update products set retail_price = 120 where id = '00000000-0000-0000-0000-0000000000f1';
select results_eq($$select (old_data->>'retail_price')::numeric, (new_data->>'retail_price')::numeric, changed_by
                     from audit_log where table_name = 'products' and action = 'UPDATE'
                     order by id desc limit 1$$,
  $$values (100::numeric, 120::numeric, '00000000-0000-0000-0000-0000000000a0'::uuid)$$, 'аудит: изменение цены с автором');

-- ------------------------------------------------- каталог: цены и импорт
select is(bulk_update_prices(array['00000000-0000-0000-0000-0000000000f1'::uuid], 'retail_price', 'percent', 10, 1), 1,
  'массовое изменение цен');
select is((select retail_price from products where id = '00000000-0000-0000-0000-0000000000f1'), 132.00::numeric(12,2),
  'цена +10% с округлением до рубля');

select is(jsonb_array_length(import_products('[{"sku":"N1","name":"Новый","unit":"шт","retail_price":"abc"},
                                               {"sku":"","name":"Без артикула","unit":"кг"}]', false) -> 'errors'), 2,
  'импорт: ошибки найдены, ничего не записано');
select results_eq($$select (r->>'created')::int, (r->>'updated')::int from import_products(
  '[{"sku":"N1","name":"Новый","unit":"шт","retail_price":"10,5","category":"Новая категория"},
    {"sku":"P1","name":"Товар (обновлён)","unit":"шт","retail_price":"150"}]', false) r$$,
  $$values (1, 1)$$, 'импорт: 1 создан, 1 обновлён');

-- --------------------------------------------------------- пользователи
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';
select throws_ok($$select deactivate_user('00000000-0000-0000-0000-0000000000a2', null)$$, '42501', null,
  'seller: деактивация недоступна');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select is(deactivate_user('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1'), 1,
  'деактивация: 1 клиент переназначен');

reset role;
select * from finish();
rollback;
