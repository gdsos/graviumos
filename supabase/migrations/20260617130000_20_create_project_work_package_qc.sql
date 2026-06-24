create table if not exists public.project_work_package_qc (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  timeline_id uuid null references public.project_timelines(id) on delete cascade,
  work_package_id text not null,
  work_package_title text not null,
  vendor_id text null references public.vendors(id) on delete set null,
  vendor_name text null,
  status text not null default 'pending'
    check (status in ('pending', 'needs_rework', 'passed', 'accepted_exception')),
  remarks text null,
  rework_notes text null,
  accepted_exception_reason text null,
  inspected_by uuid null references auth.users(id) on delete set null,
  inspected_at timestamptz null,
  passed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, work_package_id)
);

create index if not exists idx_project_work_package_qc_project_id
  on public.project_work_package_qc(project_id);

create index if not exists idx_project_work_package_qc_timeline_id
  on public.project_work_package_qc(timeline_id);

create index if not exists idx_project_work_package_qc_work_package_id
  on public.project_work_package_qc(work_package_id);

create index if not exists idx_project_work_package_qc_status
  on public.project_work_package_qc(status);

create or replace function public.set_project_work_package_qc_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_project_work_package_qc_updated_at
  on public.project_work_package_qc;

create trigger trg_project_work_package_qc_updated_at
before update on public.project_work_package_qc
for each row
execute function public.set_project_work_package_qc_updated_at();

alter table public.project_work_package_qc enable row level security;

drop policy if exists "Authenticated users can read project work package QC"
  on public.project_work_package_qc;

create policy "Authenticated users can read project work package QC"
on public.project_work_package_qc
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert project work package QC"
  on public.project_work_package_qc;

create policy "Authenticated users can insert project work package QC"
on public.project_work_package_qc
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update project work package QC"
  on public.project_work_package_qc;

create policy "Authenticated users can update project work package QC"
on public.project_work_package_qc
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete project work package QC"
  on public.project_work_package_qc;

create policy "Authenticated users can delete project work package QC"
on public.project_work_package_qc
for delete
to authenticated
using (true);
