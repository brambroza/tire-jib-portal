-- Add hero image storage bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hero',
  'hero',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
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
      and policyname = 'hero_public_read'
  ) then
    create policy hero_public_read
      on storage.objects
      for select
      using (bucket_id = 'hero');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'hero_authenticated_upload'
  ) then
    create policy hero_authenticated_upload
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'hero');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'hero_authenticated_update'
  ) then
    create policy hero_authenticated_update
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'hero')
      with check (bucket_id = 'hero');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'hero_authenticated_delete'
  ) then
    create policy hero_authenticated_delete
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'hero');
  end if;
end
$$;
