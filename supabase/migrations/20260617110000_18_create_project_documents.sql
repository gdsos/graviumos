create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  document_url text not null default '',
  category text not null default 'Project Document',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_documents_project_id_idx
  on public.project_documents(project_id);

alter table public.project_documents enable row level security;

drop policy if exists project_documents_select_authenticated
  on public.project_documents;

create policy project_documents_select_authenticated
  on public.project_documents
  for select
  to authenticated
  using (true);

drop policy if exists project_documents_insert_admin
  on public.project_documents;

create policy project_documents_insert_admin
  on public.project_documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  );

drop policy if exists project_documents_update_admin
  on public.project_documents;

create policy project_documents_update_admin
  on public.project_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  );

drop policy if exists project_documents_delete_admin
  on public.project_documents;

create policy project_documents_delete_admin
  on public.project_documents
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  );

insert into public.project_documents (
  project_id,
  name,
  document_url,
  category,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  project_checkpoints.project_id,
  coalesce(
    nullif(document_item.value ->> 'title', ''),
    nullif(document_item.value ->> 'name', ''),
    'Imported checkpoint document'
  ) as name,
  coalesce(
    document_item.value ->> 'url',
    document_item.value ->> 'link',
    document_item.value ->> 'href',
    ''
  ) as document_url,
  coalesce(
    nullif(document_item.value ->> 'category', ''),
    project_checkpoints.title || ' Document'
  ) as category,
  coalesce(
    document_item.value ->> 'notes',
    document_item.value ->> 'description',
    ''
  ) as notes,
  project_checkpoints.created_by,
  now(),
  now()
from public.project_checkpoints
cross join lateral jsonb_array_elements(
  coalesce(project_checkpoints.attachments, '[]'::jsonb)
) as document_item(value)
where jsonb_typeof(document_item.value) = 'object'
  and (
    coalesce(document_item.value ->> 'title', document_item.value ->> 'name', '') <> ''
    or coalesce(document_item.value ->> 'url', document_item.value ->> 'link', document_item.value ->> 'href', '') <> ''
    or coalesce(document_item.value ->> 'notes', document_item.value ->> 'description', '') <> ''
  );
