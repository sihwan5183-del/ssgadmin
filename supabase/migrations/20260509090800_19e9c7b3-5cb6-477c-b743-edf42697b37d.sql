
-- bucket
insert into storage.buckets (id, name, public)
values ('secure-files', 'secure-files', false)
on conflict (id) do nothing;

-- file_vault
create table public.file_vault (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  description text,
  uploaded_by uuid not null,
  status text not null default 'pending', -- pending | approved | rejected
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index file_vault_uploaded_by_idx on public.file_vault(uploaded_by);
create index file_vault_status_idx on public.file_vault(status);

alter table public.file_vault enable row level security;

create policy "Users insert own file_vault"
on public.file_vault for insert to authenticated
with check (auth.uid() = uploaded_by);

create policy "View own or admin file_vault"
on public.file_vault for select to authenticated
using (auth.uid() = uploaded_by or is_admin(auth.uid()) or is_ceo(auth.uid()));

create policy "Update by admin or owner-pending file_vault"
on public.file_vault for update to authenticated
using (
  is_admin(auth.uid()) or is_ceo(auth.uid())
  or (auth.uid() = uploaded_by and status = 'pending')
);

create policy "Delete by admin or owner-pending file_vault"
on public.file_vault for delete to authenticated
using (
  is_admin(auth.uid()) or is_ceo(auth.uid())
  or (auth.uid() = uploaded_by and status = 'pending')
);

create trigger trg_file_vault_updated
before update on public.file_vault
for each row execute function public.update_updated_at_column();

-- download log
create table public.file_vault_downloads (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.file_vault(id) on delete cascade,
  downloaded_by uuid not null,
  downloaded_at timestamptz not null default now(),
  user_agent text,
  ip text
);

create index file_vault_downloads_file_idx on public.file_vault_downloads(file_id);
create index file_vault_downloads_user_idx on public.file_vault_downloads(downloaded_by);

alter table public.file_vault_downloads enable row level security;

create policy "Insert own download record"
on public.file_vault_downloads for insert to authenticated
with check (auth.uid() = downloaded_by);

create policy "View own or admin download record"
on public.file_vault_downloads for select to authenticated
using (auth.uid() = downloaded_by or is_admin(auth.uid()) or is_ceo(auth.uid()));

create policy "Admins delete download record"
on public.file_vault_downloads for delete to authenticated
using (is_admin(auth.uid()) or is_ceo(auth.uid()));

-- storage policies for secure-files
create policy "secure-files: uploader insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'secure-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "secure-files: uploader read own"
on storage.objects for select to authenticated
using (
  bucket_id = 'secure-files'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or is_admin(auth.uid())
    or is_ceo(auth.uid())
  )
);

create policy "secure-files: admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'secure-files'
  and (
    is_admin(auth.uid())
    or is_ceo(auth.uid())
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);
