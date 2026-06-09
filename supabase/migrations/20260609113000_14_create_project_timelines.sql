create table if not exists public.project_timelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  source_estimate_id text,
  source_estimate_version integer not null default 0,
  source_estimate_updated_at timestamptz,
  source_estimate_project_name text not null default '',
  source_estimate_client_name text not null default '',
  source_estimate_grand_total numeric(14, 2) not null default 0,

  has_timeline boolean not null default false,
  timeline_confirmed_at timestamptz,

  payment_gates jsonb not null default '[]'::jsonb,
  work_packages jsonb not null default '[]'::jsonb,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_timelines_project_unique unique (project_id)
);

create index if not exists project_timelines_project_id_idx
  on public.project_timelines(project_id);

create index if not exists project_timelines_source_estimate_id_idx
  on public.project_timelines(source_estimate_id);

create trigger set_project_timelines_updated_at
  before update on public.project_timelines
  for each row
  execute function public.set_updated_at();

alter table public.project_timelines enable row level security;

drop policy if exists "Authenticated users can read project timelines"
  on public.project_timelines;

create policy "Authenticated users can read project timelines"
  on public.project_timelines
  for select
  to authenticated
  using (true);

drop policy if exists "Timeline operators can insert project timelines"
  on public.project_timelines;

create policy "Timeline operators can insert project timelines"
  on public.project_timelines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('super_admin', 'admin')
          or exists (
            select 1
            from public.departments d
            where d.id = any(coalesce(p.department_ids, '{}'::uuid[]))
              and (
                d.code in ('DE', 'OQ', 'PL')
                or d.name in (
                  'Designing & Execution',
                  'Ops. & Quality Control',
                  'Procurement & Logistics'
                )
              )
          )
        )
    )
  );

drop policy if exists "Timeline operators can update project timelines"
  on public.project_timelines;

create policy "Timeline operators can update project timelines"
  on public.project_timelines
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('super_admin', 'admin')
          or exists (
            select 1
            from public.departments d
            where d.id = any(coalesce(p.department_ids, '{}'::uuid[]))
              and (
                d.code in ('DE', 'OQ', 'PL')
                or d.name in (
                  'Designing & Execution',
                  'Ops. & Quality Control',
                  'Procurement & Logistics'
                )
              )
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('super_admin', 'admin')
          or exists (
            select 1
            from public.departments d
            where d.id = any(coalesce(p.department_ids, '{}'::uuid[]))
              and (
                d.code in ('DE', 'OQ', 'PL')
                or d.name in (
                  'Designing & Execution',
                  'Ops. & Quality Control',
                  'Procurement & Logistics'
                )
              )
          )
        )
    )
  );

drop policy if exists "Timeline operators can delete project timelines"
  on public.project_timelines;

create policy "Timeline operators can delete project timelines"
  on public.project_timelines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('super_admin', 'admin')
          or exists (
            select 1
            from public.departments d
            where d.id = any(coalesce(p.department_ids, '{}'::uuid[]))
              and (
                d.code in ('DE', 'OQ', 'PL')
                or d.name in (
                  'Designing & Execution',
                  'Ops. & Quality Control',
                  'Procurement & Logistics'
                )
              )
          )
        )
    )
  );
