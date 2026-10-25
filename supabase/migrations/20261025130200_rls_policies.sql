-- =====================================================================
-- NurLife CRM · 14 · Политики RLS
--
-- Обозначения: «активный» — is_active_user(), «owner» — is_owner().
-- Деактивированный пользователь не проходит ни одну политику.
-- Вызовы обёрнуты в (select …), чтобы Postgres считал их один раз
-- на запрос, а не на каждую строку.
--
-- Записи заказов, склада и платежей идут только через rpc-функции
-- (security definer, шаги 7, 9, 11), поэтому политик на запись там нет.
-- =====================================================================

-- ------------------------------------------------------------ profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select public.is_active_user()));

create policy profiles_update_owner on public.profiles
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ------------------------------------------------------------ settings
create policy settings_select on public.settings
  for select to authenticated
  using ((select public.is_active_user()));

create policy settings_update_owner on public.settings
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ------------------------------------- справочники каталога: читают все,
-- ------------------------------------- меняет только owner
create policy units_select on public.units
  for select to authenticated using ((select public.is_active_user()));
create policy units_owner_all on public.units
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy categories_select on public.categories
  for select to authenticated using ((select public.is_active_user()));
create policy categories_owner_all on public.categories
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy product_price_tiers_select on public.product_price_tiers
  for select to authenticated using ((select public.is_active_user()));
create policy product_price_tiers_owner_all on public.product_price_tiers
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy product_images_select on public.product_images
  for select to authenticated using ((select public.is_active_user()));
create policy product_images_owner_all on public.product_images
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- products: только owner. Seller читает products_public.
create policy products_owner_all on public.products
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ------------------------------------------------------------- клиенты
-- Seller видит и редактирует всех клиентов, кроме полей скидки/лимита/
-- отсрочки (триггер clients_guard_owner_fields). Удаляет только owner.
create policy clients_select on public.clients
  for select to authenticated using ((select public.is_active_user()));
create policy clients_insert on public.clients
  for insert to authenticated with check ((select public.is_active_user()));
create policy clients_update on public.clients
  for update to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));
create policy clients_delete_owner on public.clients
  for delete to authenticated using ((select public.is_owner()));

create policy client_contacts_all on public.client_contacts
  for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

create policy client_prices_select on public.client_prices
  for select to authenticated using ((select public.is_active_user()));
create policy client_prices_owner_all on public.client_prices
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- --------------------------------------------------------------- заказы
create policy orders_select on public.orders
  for select to authenticated using ((select public.is_active_user()));

create policy order_items_select_owner on public.order_items
  for select to authenticated using ((select public.is_owner()));

create policy order_status_history_select on public.order_status_history
  for select to authenticated using ((select public.is_active_user()));

-- ---------------------------------------------------------------- склад
create policy stock_select_owner on public.stock
  for select to authenticated using ((select public.is_owner()));

create policy stock_movements_select_owner on public.stock_movements
  for select to authenticated using ((select public.is_owner()));

-- Черновики корректировок/инвентаризаций owner правит напрямую;
-- проведение (status → posted) — только rpc post_adjustment/post_inventory.
create policy stock_adjustments_select_owner on public.stock_adjustments
  for select to authenticated using ((select public.is_owner()));
create policy stock_adjustments_insert_owner on public.stock_adjustments
  for insert to authenticated
  with check ((select public.is_owner()) and status = 'draft');
create policy stock_adjustments_update_owner on public.stock_adjustments
  for update to authenticated
  using ((select public.is_owner()) and status = 'draft')
  with check ((select public.is_owner()) and status = 'draft');
create policy stock_adjustments_delete_owner on public.stock_adjustments
  for delete to authenticated
  using ((select public.is_owner()) and status = 'draft');

create policy stock_adjustment_items_select_owner on public.stock_adjustment_items
  for select to authenticated using ((select public.is_owner()));
create policy stock_adjustment_items_write_owner on public.stock_adjustment_items
  for all to authenticated
  using (
    (select public.is_owner())
    and exists (select 1 from public.stock_adjustments a
                 where a.id = adjustment_id and a.status = 'draft')
  )
  with check (
    (select public.is_owner())
    and exists (select 1 from public.stock_adjustments a
                 where a.id = adjustment_id and a.status = 'draft')
  );

-- ------------------------------------------------ поставщики и закупки
create policy suppliers_owner_all on public.suppliers
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Приёмка (status → received, qty_received) — только rpc post_receipt.
create policy purchases_select_owner on public.purchases
  for select to authenticated using ((select public.is_owner()));
create policy purchases_insert_owner on public.purchases
  for insert to authenticated
  with check ((select public.is_owner()) and status in ('draft', 'ordered'));
create policy purchases_update_owner on public.purchases
  for update to authenticated
  using ((select public.is_owner()) and status in ('draft', 'ordered'))
  with check ((select public.is_owner()) and status in ('draft', 'ordered', 'cancelled'));
create policy purchases_delete_owner on public.purchases
  for delete to authenticated
  using ((select public.is_owner()) and status = 'draft');

create policy purchase_items_select_owner on public.purchase_items
  for select to authenticated using ((select public.is_owner()));
create policy purchase_items_write_owner on public.purchase_items
  for all to authenticated
  using (
    (select public.is_owner())
    and exists (select 1 from public.purchases p
                 where p.id = purchase_id and p.status = 'draft')
  )
  with check (
    (select public.is_owner())
    and qty_received = 0
    and exists (select 1 from public.purchases p
                 where p.id = purchase_id and p.status = 'draft')
  );

-- ------------------------------------------------------ кассы и платежи
-- Seller видит список касс (выбор при приёме оплаты), но не балансы:
-- балансы считает rpc с проверкой owner (шаг 11).
create policy cash_accounts_select on public.cash_accounts
  for select to authenticated using ((select public.is_active_user()));
create policy cash_accounts_owner_all on public.cash_accounts
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Seller видит только входящие платежи клиентов; запись — через rpc.
create policy payments_select on public.payments
  for select to authenticated
  using ((select public.is_owner()) or ((select public.is_active_user()) and direction = 'in'));

create policy payment_allocations_select on public.payment_allocations
  for select to authenticated using ((select public.is_active_user()));

create policy cash_operations_owner_all on public.cash_operations
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ---------------------------------------------------------- уведомления
-- Свои (user_id) или адресованные роли пользователя. Менять можно
-- только is_read (ограничено правами на колонки в следующей миграции).
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    (select public.is_active_user())
    and (user_id = (select auth.uid())
         or (user_id is null and role = (select public.current_user_role())))
  );
create policy notifications_update on public.notifications
  for update to authenticated
  using (
    (select public.is_active_user())
    and (user_id = (select auth.uid())
         or (user_id is null and role = (select public.current_user_role())))
  )
  with check (
    (select public.is_active_user())
    and (user_id = (select auth.uid())
         or (user_id is null and role = (select public.current_user_role())))
  );

-- ----------------------------------------------------------------- аудит
create policy audit_log_select_owner on public.audit_log
  for select to authenticated using ((select public.is_owner()));

-- document_counters: политик нет — только функции security definer.
