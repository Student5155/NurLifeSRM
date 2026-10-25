-- =====================================================================
-- NurLife CRM · Тесты rpc для интерфейса: главное фото, контекст цен.
-- =====================================================================
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated;

select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 's1@test.local');
update profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a0';

insert into products (id, sku, name, unit_id, retail_price, wholesale_price)
select '00000000-0000-0000-0000-0000000000f1', 'P1', 'Товар', id, 100, 80 from units where code = 'шт';
insert into product_price_tiers (product_id, min_qty, price) values ('00000000-0000-0000-0000-0000000000f1', 10, 70);
insert into product_images (id, product_id, storage_path, sort_order) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000f1', 'a.webp', 0),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000f1', 'b.webp', 1),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-0000000000f1', 'c.webp', 2);
insert into clients (id, type, name, discount_percent) values ('00000000-0000-0000-0000-0000000000c1', 'wholesale', 'Клиент', 3);
insert into client_prices (client_id, product_id, price) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 65);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1"}';

select throws_ok($$select set_main_product_image('00000000-0000-0000-0000-00000000d003')$$, '42501', null,
  'seller: главное фото менять нельзя');
select results_eq($$select (pricing_context(null) -> 'settings' ->> 'seller_max_discount')::numeric$$, $$values (10::numeric)$$,
  'контекст цен: лимит скидки продавца');
select results_eq($$select jsonb_array_length(pricing_context(null) -> 'tiers' -> '00000000-0000-0000-0000-0000000000f1')$$, $$values (1)$$,
  'контекст цен: ступени товара');
select results_eq($$select (c -> 'client' -> 'prices' ->> '00000000-0000-0000-0000-0000000000f1')::numeric,
                           (c -> 'client' ->> 'discount_percent')::numeric
                      from pricing_context('00000000-0000-0000-0000-0000000000c1') c$$,
  $$values (65::numeric, 3::numeric)$$, 'контекст цен: индивидуальные цены и скидка клиента');
select ok(pricing_context(null) -> 'client' = 'null'::jsonb, 'контекст цен без клиента');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a0"}';
select lives_ok($$select set_main_product_image('00000000-0000-0000-0000-00000000d003')$$, 'owner: главное фото');
select results_eq($$select storage_path from product_images order by sort_order$$,
  $$values ('c.webp'::text), ('a.webp'::text), ('b.webp'::text)$$, 'порядок: выбранное первым, остальные сохранили порядок');

reset role;
select * from finish();
rollback;
