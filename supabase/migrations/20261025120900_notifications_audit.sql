-- =====================================================================
-- NurLife CRM · 10 · Уведомления и журнал аудита
-- Функция audit_trigger() и подключение к таблицам — шаг 13.
-- =====================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  role       public.user_role,
  type       text not null check (type in ('low_stock', 'new_order', 'overdue_debt', 'status_change')),
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now(),
  check (user_id is not null or role is not null)
);

comment on column public.notifications.user_id is 'Адресат; NULL — для всех пользователей роли role';

create index notifications_user_unread_idx on public.notifications (user_id, is_read, created_at desc);
create index notifications_role_idx        on public.notifications (role, created_at desc) where user_id is null;

-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  text not null,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.audit_log.record_id is 'Текстовый id записи (uuid или true для settings)';

create index audit_log_record_idx     on public.audit_log (table_name, record_id, created_at desc);
create index audit_log_changed_by_idx on public.audit_log (changed_by);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_modification();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.prevent_modification();
