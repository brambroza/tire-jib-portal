-- Add per-site payment account data + QR code storage bucket (websitebank)

create table if not exists public.site_payment_accounts (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null unique references public.sites (id) on delete cascade,
  account_name text,
  account_number text,
  bank_name text,
  qr_code_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'websitebank',
  'websitebank',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'websitebank_public_read'
  ) then
    create policy websitebank_public_read
      on storage.objects
      for select
      using (bucket_id = 'websitebank');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'websitebank_authenticated_upload'
  ) then
    create policy websitebank_authenticated_upload
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'websitebank');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'websitebank_authenticated_update'
  ) then
    create policy websitebank_authenticated_update
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'websitebank')
      with check (bucket_id = 'websitebank');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'websitebank_authenticated_delete'
  ) then
    create policy websitebank_authenticated_delete
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'websitebank');
  end if;
end
$$;
