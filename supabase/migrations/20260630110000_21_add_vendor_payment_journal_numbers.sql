alter table if exists public.project_vendor_payments
  add column if not exists journal_number text,
  add column if not exists journal_vendor_initials text,
  add column if not exists journal_fiscal_year text,
  add column if not exists journal_sequence integer;

create unique index if not exists project_vendor_payments_journal_number_key
  on public.project_vendor_payments(journal_number)
  where journal_number is not null;

create index if not exists project_vendor_payments_vendor_fy_sequence_idx
  on public.project_vendor_payments(vendor_account_id, journal_fiscal_year, journal_sequence);
