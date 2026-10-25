-- =====================================================================
-- NurLife CRM · 15 · Представления *_public и права доступа
--
-- Представления без закупочных цен и себестоимости для seller.
-- Они выполняются с правами владельца (не security_invoker), иначе
-- seller не смог бы читать закрытые для него таблицы. Поэтому:
--   • доступ фильтруется внутри: where is_active_user();
--   • security_barrier — фильтр нельзя обойти «протекающими» функциями;
--   • authenticated получает только SELECT (простые представления
--     автообновляемые — без отзыва INSERT/UPDATE seller смог бы менять
--     товары в обход RLS).
-- Supabase Advisor пометит их как security definer view — это намеренно.
-- =====================================================================

create view public.products_public
with (security_barrier = true)
as
select p.id,
       p.sku,
       p.barcode,
       p.name,
       p.description,
       p.category_id,
       p.unit_id,
       p.retail_price,
       p.wholesale_price,
       p.min_stock,
       p.is_active,
       p.created_at,
       p.updated_at
  from public.products p
 where public.is_active_user();

comment on view public.products_public is 'Товары без закупочной цены — для всех активных пользователей';

create view public.stock_public
with (security_barrier = true)
as
select s.product_id,
       s.qty_on_hand,
       s.qty_reserved,
       s.qty_available,
       s.updated_at
  from public.stock s
 where public.is_active_user();

comment on view public.stock_public is 'Остатки без себестоимости — для всех активных пользователей';

create view public.order_items_public
with (security_barrier = true)
as
select i.id,
       i.order_id,
       i.product_id,
       i.qty,
       i.unit_price,
       i.price_source,
       i.discount_percent,
       i.line_total
  from public.order_items i
 where public.is_active_user();

comment on view public.order_items_public is 'Позиции заказов без себестоимости — для всех активных пользователей';

-- =====================================================================
-- Права
-- =====================================================================

-- anon (не вошедший) не работает с данными вообще: вход — через Supabase Auth.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Лишние права authenticated на таблицах.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Представления: только чтение.
revoke all on public.products_public, public.stock_public, public.order_items_public
  from anon, authenticated;
grant select on public.products_public, public.stock_public, public.order_items_public
  to authenticated;

-- Уведомления: пользователь может менять только отметку «прочитано».
revoke insert, update, delete on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Журналы: никаких изменений через API даже теоретически.
revoke insert, update, delete on public.stock_movements, public.audit_log, public.document_counters
  from authenticated;

-- Функции: по умолчанию никто, кроме явно разрешённых.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user()   to authenticated;
grant execute on function public.is_owner()         to authenticated;
grant execute on function public.app_timezone()     to authenticated;

-- То же для объектов, которые создадут следующие миграции:
-- новые rpc нужно явно открывать через grant execute … to authenticated.
alter default privileges in schema public revoke all     on tables    from anon;
alter default privileges in schema public revoke all     on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
-- EXECUTE для PUBLIC — глобальная настройка, отзывается без «in schema».
alter default privileges revoke execute on functions from public;
