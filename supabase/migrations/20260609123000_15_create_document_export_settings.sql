create table if not exists public.document_export_settings (
  id text primary key default 'default',

  organization_name text not null default 'GRAVIUM DESIGN STUDIO LLP',
  address_lines jsonb not null default '[]'::jsonb,
  email text not null default '',
  phone text not null default '',

  logo_path text not null default '/brand/Organization-Logo.png',
  fallback_logo_path text not null default '/Organization-Logo.png',
  signature_path text not null default '/brand/Authorized-Signature.png',
  invert_logo_on_dark boolean not null default true,

  cost_estimate_terms jsonb not null default '[]'::jsonb,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint document_export_settings_singleton check (id = 'default')
);

create trigger set_document_export_settings_updated_at
  before update on public.document_export_settings
  for each row
  execute function public.set_updated_at();

alter table public.document_export_settings enable row level security;

drop policy if exists "Authenticated users can read document export settings"
  on public.document_export_settings;

create policy "Authenticated users can read document export settings"
  on public.document_export_settings
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can insert document export settings"
  on public.document_export_settings;

create policy "Admins can insert document export settings"
  on public.document_export_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
    )
  );

drop policy if exists "Admins can update document export settings"
  on public.document_export_settings;

create policy "Admins can update document export settings"
  on public.document_export_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
    )
  );

insert into public.document_export_settings (id)
values ('default')
on conflict (id) do nothing;
