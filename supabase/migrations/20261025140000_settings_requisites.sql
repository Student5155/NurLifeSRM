-- =====================================================================
-- NurLife CRM · 16 · Реквизиты для печатных форм
-- Для счёта на оплату нужны банковские реквизиты и подписант.
-- =====================================================================

alter table public.settings
  add column kpp           text check (kpp is null or kpp ~ '^\d{9}$'),
  add column ogrn          text check (ogrn is null or ogrn ~ '^\d{13}(\d{2})?$'),
  add column legal_name    text,
  add column bank_name     text,
  add column bik           text check (bik is null or bik ~ '^\d{9}$'),
  add column bank_account  text check (bank_account is null or bank_account ~ '^\d{20}$'),
  add column corr_account  text check (corr_account is null or corr_account ~ '^\d{20}$'),
  add column director_name text;

comment on column public.settings.legal_name    is 'Полное наименование (ИП Иванов И. И. / ООО «…») для печатных форм';
comment on column public.settings.director_name is 'Руководитель / ИП — подпись в счёте и накладной';
