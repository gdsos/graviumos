-- 13. Cost estimate records
-- Stores estimate records, drafts, approved estimates, revisions, and snapshots.
-- Projects are still being finalized, so project_id is stored as text for now
-- instead of adding a strict foreign key in this migration.

create table if not exists public.cost_estimates (
  id text primary key,
  project_id text,
  project_name text not null,
  client_name text,
  status text not null check (status in ('draft', 'approved', 'revision')),
  version integer not null default 1 check (version > 0),
  grand_total numeric not null default 0,
  areas jsonb not null default '[]'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  service_charge_percent numeric not null default 0,
  misc_charge_percent numeric not null default 0,
  target_project_revenue numeric not null default 0,
  approved_snapshot jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cost_estimates_project_id_idx
  on public.cost_estimates(project_id);

create index if not exists cost_estimates_status_idx
  on public.cost_estimates(status);

create index if not exists cost_estimates_updated_at_idx
  on public.cost_estimates(updated_at desc);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cost_estimates_updated_at on public.cost_estimates;

create trigger set_cost_estimates_updated_at
before update on public.cost_estimates
for each row
execute function public.set_updated_at_timestamp();

alter table public.cost_estimates enable row level security;

drop policy if exists cost_estimates_select_authenticated on public.cost_estimates;
drop policy if exists cost_estimates_insert_admin_or_pl_head on public.cost_estimates;
drop policy if exists cost_estimates_update_admin_or_pl_head on public.cost_estimates;
drop policy if exists cost_estimates_delete_admin_or_pl_head on public.cost_estimates;

create policy cost_estimates_select_authenticated
on public.cost_estimates
for select
to authenticated
using (true);

create policy cost_estimates_insert_admin_or_pl_head
on public.cost_estimates
for insert
to authenticated
with check (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    )
    or exists (
      select 1
      from public.profiles p
      join public.departments d on d.id = any(p.department_ids)
      where p.id = auth.uid()
        and p.role = 'department_head'
        and d.code = 'PL'
    )
  )
);

create policy cost_estimates_update_admin_or_pl_head
on public.cost_estimates
for update
to authenticated
using (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    )
    or exists (
      select 1
      from public.profiles p
      join public.departments d on d.id = any(p.department_ids)
      where p.id = auth.uid()
        and p.role = 'department_head'
        and d.code = 'PL'
    )
  )
)
with check (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    )
    or exists (
      select 1
      from public.profiles p
      join public.departments d on d.id = any(p.department_ids)
      where p.id = auth.uid()
        and p.role = 'department_head'
        and d.code = 'PL'
    )
  )
);

create policy cost_estimates_delete_admin_or_pl_head
on public.cost_estimates
for delete
to authenticated
using (
  (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    )
    or exists (
      select 1
      from public.profiles p
      join public.departments d on d.id = any(p.department_ids)
      where p.id = auth.uid()
        and p.role = 'department_head'
        and d.code = 'PL'
    )
  )
);
