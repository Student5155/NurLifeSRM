-- =====================================================================
-- NurLife CRM · 19 · Платежи и касса
-- rpc: register_payment, allocate_payment, register_supplier_payment,
--      void_payment, cash_balances
-- =====================================================================

-- Входящий платёж: по заказу (остаток — аванс) или аванс клиента.
create or replace function public.register_payment(
  p_client_id       uuid,
  p_order_id        uuid,
  p_amount          numeric,
  p_method          public.payment_method,
  p_cash_account_id uuid,
  p_paid_at         timestamptz default null,
  p_comment         text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_active();
  return public._register_incoming(p_client_id, p_order_id, p_amount, p_method,
                                   p_cash_account_id, p_paid_at, p_comment);
end;
$$;

-- Распределить свободные суммы (авансы) клиента по заказам FIFO.
create or replace function public.allocate_payment(p_client_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_active();
  return public._allocate_client(p_client_id);
end;
$$;

-- Оплата поставщику (owner).
create or replace function public.register_supplier_payment(
  p_supplier_id     uuid,
  p_purchase_id     uuid,
  p_amount          numeric,
  p_method          public.payment_method,
  p_cash_account_id uuid,
  p_paid_at         timestamptz default null,
  p_comment         text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid := p_supplier_id;
  v_id       uuid;
begin
  perform public._require_owner();

  if p_amount is null or p_amount <= 0 then
    raise exception 'Сумма платежа должна быть больше нуля' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cash_accounts a where a.id = p_cash_account_id and a.is_active) then
    raise exception 'Касса не найдена или неактивна' using errcode = 'P0001';
  end if;

  if p_purchase_id is not null then
    select p.supplier_id into v_supplier from public.purchases p where p.id = p_purchase_id for update;
    if not found then
      raise exception 'Закупка не найдена' using errcode = 'P0002';
    end if;
    if p_supplier_id is not null and p_supplier_id <> v_supplier then
      raise exception 'Закупка другого поставщика' using errcode = 'P0001';
    end if;
  end if;
  if v_supplier is null then
    raise exception 'Укажите поставщика' using errcode = 'P0001';
  end if;

  insert into public.payments (direction, amount, method, cash_account_id, supplier_id, purchase_id, paid_at, comment)
  values ('out', round(p_amount, 2), p_method, p_cash_account_id, v_supplier, p_purchase_id,
          coalesce(p_paid_at, now()), nullif(trim(p_comment), ''))
  returning id into v_id;

  if p_purchase_id is not null then
    perform public._recalc_purchase(p_purchase_id);
  end if;
  return v_id;
end;
$$;

-- Сторно (owner): платёж остаётся в журнале с is_void = true.
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  perform public._require_owner();

  if nullif(trim(p_reason), '') is null then
    raise exception 'Укажите причину сторно' using errcode = 'P0001';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Платёж не найден' using errcode = 'P0002';
  end if;
  if v_payment.is_void then
    raise exception 'Платёж уже сторнирован' using errcode = 'P0001';
  end if;

  update public.payments
     set is_void = true,
         comment = concat_ws(' · ', comment, 'Сторно: ' || trim(p_reason))
   where id = p_payment_id;

  delete from public.payment_allocations where payment_id = p_payment_id;

  if v_payment.purchase_id is not null then
    perform public._recalc_purchase(v_payment.purchase_id);
  end if;
  perform public._allocate_client(v_payment.client_id);
end;
$$;

-- Сторнированный платёж нельзя «вернуть» и нельзя менять сумму/кассу.
create or replace function public.guard_payment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_void and not new.is_void then
    raise exception 'Сторно отменить нельзя — внесите платёж заново' using errcode = 'P0001';
  end if;
  if (new.amount, new.direction, new.cash_account_id, new.client_id, new.supplier_id, new.order_id, new.purchase_id)
     is distinct from
     (old.amount, old.direction, old.cash_account_id, old.client_id, old.supplier_id, old.order_id, old.purchase_id) then
    raise exception 'Проведённый платёж изменить нельзя — сторнируйте и внесите заново' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payments_guard_update
  before update on public.payments
  for each row execute function public.guard_payment_update();

create trigger payments_no_delete
  before delete on public.payments
  for each row execute function public.prevent_modification();

-- Балансы касс (owner).
create or replace function public.cash_balances()
returns table (cash_account_id uuid, name text, type text, is_active boolean, balance numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public._require_owner();
  return query
  select a.id, a.name, a.type, a.is_active,
         coalesce((select sum(case p.direction when 'in' then p.amount else -p.amount end)
                     from public.payments p where p.cash_account_id = a.id and not p.is_void), 0)
       + coalesce((select sum(case o.direction when 'in' then o.amount else -o.amount end)
                     from public.cash_operations o where o.cash_account_id = a.id), 0)
    from public.cash_accounts a
   order by a.name;
end;
$$;

grant execute on function public.register_payment(uuid, uuid, numeric, public.payment_method, uuid, timestamptz, text) to authenticated;
grant execute on function public.allocate_payment(uuid) to authenticated;
grant execute on function public.register_supplier_payment(uuid, uuid, numeric, public.payment_method, uuid, timestamptz, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.cash_balances() to authenticated;
