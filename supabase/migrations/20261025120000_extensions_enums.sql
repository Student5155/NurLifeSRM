-- =====================================================================
-- NurLife CRM · 01 · Расширения и перечисления
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

create type public.user_role      as enum ('owner', 'seller');
create type public.client_type    as enum ('wholesale', 'retail');
create type public.order_status   as enum ('new', 'confirmed', 'assembled', 'shipped', 'paid', 'cancelled');
create type public.payment_status as enum ('unpaid', 'partial', 'paid');
create type public.purchase_status as enum ('draft', 'ordered', 'received', 'cancelled');
create type public.movement_type  as enum ('receipt', 'reserve', 'unreserve', 'write_off_sale', 'adjustment', 'inventory', 'return');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'online');

comment on type public.order_status is
  'new → confirmed (резерв) → assembled → shipped (списание) → paid (авто); cancelled — до paid';
