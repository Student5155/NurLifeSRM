-- =====================================================================
-- NurLife CRM · Шаг 2 · Тесты доступа (RLS, представления, права)
-- Запуск: npx supabase test db
-- Всё в транзакции с откатом: данные в базе не остаются.
-- =====================================================================
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Миграции отзывают EXECUTE у PUBLIC для новых функций: даём pgTAP
-- тестовой роли на время транзакции.
grant execute on all functions in schema extensions to authenticated, anon;

select plan(56);

-- ---------------------------------------------------------------------
-- Вспомогательное: число строк, затронутых запросом (от имени текущей роли)
-- ---------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated, anon;
create function tests.affected(p_sql text) returns integer
language plpgsql as $$
declare v integer;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end $$;
grant execute on function tests.affected(text) to authenticated, anon;

-- ---------------------------------------------------------------------
-- Данные (от имени postgres)
-- owner …a0, продавцы …a1 и …a2, деактивированный продавец …a3
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 's1@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 's2@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 's3@test.local');
update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a0';
update profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a3';

insert into products (id, sku, name, unit_id, retail_price, wholesale_price, purchase_price)
select '00000000-0000-0000-0000-0000000000f1', 'SKU-1', 'Товар', id, 100, 80, 70
  from units where code = 'шт';
insert into product_price_tiers (product_id, min_qty, price)
values ('00000000-0000-0000-0000-0000000000f1', 10, 75);
update stock set qty_on_hand = 10, avg_cost = 70
 where product_id = '00000000-0000-0000-0000-0000000000f1';
insert into stock_movements (product_id, type, qty, unit_cost, balance_after)
values ('00000000-0000-0000-0000-0000000000f1', 'receipt', 10, 70, 10);

insert into clients (id, type, name, manager_id)
values ('00000000-0000-0000-0000-0000000000c1', 'wholesale', 'Клиент продавца 2',
        '00000000-0000-0000-0000-0000000000a2');

insert into orders (id, client_id, price_type, subtotal, total, manager_id)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
        'wholesale', 800, 800, '00000000-0000-0000-0000-0000000000a2');
insert into order_items (order_id, product_id, qty, unit_price, price_source, line_total, cost_price)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
        10, 80, 'wholesale', 800, 70);

insert into suppliers (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Поставщик');
insert into purchases (supplier_id) values ('00000000-0000-0000-0000-0000000000b1');

insert into payments (direction, amount, method, cash_account_id, client_id)
select 'in', 500, 'cash', id, '00000000-0000-0000-0000-0000000000c1'
  from cash_accounts where name = 'Наличные';
insert into payments (direction, amount, method, cash_account_id, supplier_id)
select 'out', 300, 'bank_transfer', id, '00000000-0000-0000-0000-0000000000b1'
  from cash_accounts where name = 'Расчётный счёт';
insert into cash_operations (cash_account_id, direction, amount, category)
select id, 'out', 1000, 'Аренда' from cash_accounts where name = 'Наличные';

insert into notifications (user_id, role, type, title) values
  ('00000000-0000-0000-0000-0000000000a1', null,     'status_change', 'Для продавца 1'),
  ('00000000-0000-0000-0000-0000000000a2', null,     'status_change', 'Для продавца 2'),
  (null,                                    'seller', 'new_order',     'Всем продавцам'),
  (null,                                    'owner',  'low_stock',     'Владельцу');

insert into audit_log (table_name, record_id, action) values ('products', 'x', 'UPDATE');

-- =====================================================================
-- Схема
-- =====================================================================
select is_empty($$
  select table_name || '.' || column_name
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('products_public', 'stock_public', 'order_items_public')
     and column_name in ('purchase_price', 'avg_cost', 'cost_price', 'unit_cost')
$$, 'представления *_public не содержат закупочных цен и себестоимости');

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
$$, 'RLS включён на всех таблицах');

-- =====================================================================
-- Продавец 1 (активный)
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is(current_user_role(), 'seller'::user_role, 'seller: current_user_role() = seller');

-- закрытые таблицы
select is_empty('select * from products',        'seller: products закрыта');
select is_empty('select * from stock',           'seller: stock закрыта');
select is_empty('select * from order_items',     'seller: order_items закрыта');
select is_empty('select * from stock_movements', 'seller: stock_movements закрыта');
select is_empty('select * from suppliers',       'seller: поставщики закрыты');
select is_empty('select * from purchases',       'seller: закупки закрыты');
select is_empty('select * from cash_operations', 'seller: расходы касс закрыты');
select is_empty('select * from audit_log',       'seller: аудит закрыт');

-- что видно
select results_eq('select retail_price, wholesale_price from products_public',
  $$values (100.00::numeric(12,2), 80.00::numeric(12,2))$$, 'seller: розничная и оптовая цена видны');
select results_eq('select price from product_price_tiers', $$values (75.00::numeric(12,2))$$,
  'seller: оптовые ступени видны');
select results_eq('select qty_available from stock_public', $$values (10.000::numeric(12,3))$$,
  'seller: остатки видны');
select results_eq('select count(*)::int from orders', $$values (1)$$,
  'seller: видит заказ другого продавца');
select results_eq('select count(*)::int from order_items_public', $$values (1)$$,
  'seller: видит позиции заказа без себестоимости');
select results_eq('select count(*)::int from clients', $$values (1)$$,
  'seller: видит клиента другого продавца');
select results_eq('select direction from payments', $$values ('in'::text)$$,
  'seller: видит только входящие платежи');
select results_eq('select seller_max_discount from settings', $$values (10.00::numeric(5,2))$$,
  'seller: читает настройки (лимит скидки, реквизиты)');

-- запись в обход правил
select throws_ok($$update products_public set retail_price = 1$$, '42501', null,
  'seller: products_public только для чтения (UPDATE)');
select throws_ok($$insert into products_public (sku, name) values ('X', 'X')$$, '42501', null,
  'seller: products_public только для чтения (INSERT)');
select throws_ok($$insert into products (sku, name, unit_id) select 'X', 'X', id from units limit 1$$, '42501', null,
  'seller: не может создать товар');
select is(tests.affected('update products set retail_price = 1'), 0, 'seller: не может менять цены товаров');
select is(tests.affected('update product_price_tiers set price = 1'), 0, 'seller: не может менять ступени цен');
select is(tests.affected('update settings set seller_max_discount = 50'), 0, 'seller: не может менять лимит скидки');
select is(tests.affected($$update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a1'$$), 0,
  'seller: не может менять свою роль');
select is(tests.affected($$update profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a2'$$), 0,
  'seller: не может деактивировать коллегу');

-- клиенты
select lives_ok($$insert into clients (type, name, phone) values ('retail', 'Новый клиент', '+79001112233')$$,
  'seller: создаёт клиента');
select results_eq($$select manager_id from clients where name = 'Новый клиент'$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid)$$, 'seller: новый клиент закреплён за создавшим');
select throws_ok($$insert into clients (type, name, discount_percent) values ('retail', 'Со скидкой', 5)$$,
  '42501', null, 'seller: не может задать скидку клиента при создании');
select throws_ok($$update clients set credit_limit = 100000 where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'seller: не может менять кредитный лимит');
select throws_ok($$update clients set payment_terms_days = 30 where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'seller: не может менять отсрочку');
select is(tests.affected($$update clients set phone = '+79990000000' where id = '00000000-0000-0000-0000-0000000000c1'$$), 1,
  'seller: редактирует контактные данные клиента');
select throws_ok($$insert into client_prices (client_id, product_id, price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 1)$$,
  '42501', null, 'seller: не может задать индивидуальную цену');
select is(tests.affected($$delete from clients where id = '00000000-0000-0000-0000-0000000000c1'$$), 0,
  'seller: не может удалить клиента');

-- заказы, склад, деньги — только через rpc
select throws_ok($$insert into orders (price_type) values ('retail')$$, '42501', null,
  'seller: заказ напрямую не создаётся (только rpc)');
select is(tests.affected($$update orders set status = 'paid'$$), 0, 'seller: статус заказа напрямую не меняется');
select throws_ok($$insert into payments (direction, amount, method, cash_account_id, client_id)
  select 'in', 1, 'cash', id, '00000000-0000-0000-0000-0000000000c1' from cash_accounts limit 1$$,
  '42501', null, 'seller: платёж напрямую не создаётся (только rpc)');
select throws_ok($$insert into stock_movements (product_id, type, qty, balance_after)
  values ('00000000-0000-0000-0000-0000000000f1', 'adjustment', 1, 11)$$,
  '42501', null, 'seller: движения склада напрямую запрещены');
select throws_ok($$select next_document_number('З')$$, '42501', null,
  'seller: служебная функция нумерации недоступна');

-- уведомления
select results_eq('select title from notifications order by title',
  $$values ('Всем продавцам'::text), ('Для продавца 1'::text)$$, 'seller: видит свои и ролевые уведомления');
select is(tests.affected('update notifications set is_read = true'), 2, 'seller: отмечает уведомления прочитанными');
select throws_ok($$update notifications set title = 'x'$$, '42501', null,
  'seller: менять можно только is_read');

reset role;

-- =====================================================================
-- Деактивированный продавец
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select is(current_user_role(), null, 'неактивный: роль не определяется');
select is_empty('select * from clients',         'неактивный: клиенты не видны');
select is_empty('select * from products_public', 'неактивный: товары не видны');
select is_empty('select * from settings',        'неактивный: настройки не видны');
select throws_ok($$insert into clients (type, name) values ('retail', 'X')$$, '42501', null,
  'неактивный: не может создать клиента');

reset role;

-- =====================================================================
-- Аноним
-- =====================================================================
set local role anon;
select throws_ok('select * from products_public', '42501', null, 'anon: представления недоступны');
select throws_ok('select * from clients',         '42501', null, 'anon: таблицы недоступны');
reset role;

-- =====================================================================
-- Владелец
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0","role":"authenticated"}';

select results_eq('select purchase_price from products', $$values (70.00::numeric(12,2))$$,
  'owner: видит закупочную цену');
select results_eq('select avg_cost from stock', $$values (70.00::numeric(12,2))$$,
  'owner: видит себестоимость');
select results_eq('select count(*)::int from payments', $$values (2)$$,
  'owner: видит входящие и исходящие платежи');
select is(tests.affected('update settings set seller_max_discount = 15'), 1, 'owner: меняет лимит скидки');
select lives_ok($$insert into clients (type, name, discount_percent, credit_limit) values ('wholesale', 'VIP', 25, 50000)$$,
  'owner: задаёт скидку и лимит клиента');
select throws_ok($$update profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a0'$$,
  '42501', null, 'owner: не может деактивировать сам себя');

reset role;

select * from finish();
rollback;
