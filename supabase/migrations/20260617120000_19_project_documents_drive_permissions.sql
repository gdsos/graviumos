-- 19. Project document Drive-ready metadata and page-access permissions
-- Keeps existing external-link documents working while preparing Google Drive upload/delete.

alter table public.project_documents
  add column if not exists storage_provider text not null default 'external_link',
  add column if not exists drive_file_id text,
  add column if not exists drive_folder_id text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists uploaded_at timestamptz;

update public.project_documents
set storage_provider = 'external_link'
where storage_provider is null or storage_provider = '';

create index if not exists project_documents_drive_file_id_idx
  on public.project_documents(drive_file_id);

create or replace function public.can_manage_page(page_key text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and (
        profiles.role = 'super_admin'
        or coalesce(profiles.page_permissions, '{}'::jsonb) ->> page_key = 'manage'
      )
  );
$$;

grant execute on function public.can_manage_page(text) to authenticated;

drop policy if exists project_documents_insert_admin
  on public.project_documents;

drop policy if exists project_documents_update_admin
  on public.project_documents;

drop policy if exists project_documents_delete_admin
  on public.project_documents;

drop policy if exists project_documents_insert_projects_manage
  on public.project_documents;

create policy project_documents_insert_projects_manage
  on public.project_documents
  for insert
  to authenticated
  with check (
    public.can_manage_page('portal.projects')
  );

drop policy if exists project_documents_update_projects_manage
  on public.project_documents;

create policy project_documents_update_projects_manage
  on public.project_documents
  for update
  to authenticated
  using (
    public.can_manage_page('portal.projects')
  )
  with check (
    public.can_manage_page('portal.projects')
  );

drop policy if exists project_documents_delete_projects_manage
  on public.project_documents;

create policy project_documents_delete_projects_manage
  on public.project_documents
  for delete
  to authenticated
  using (
    public.can_manage_page('portal.projects')
  );
