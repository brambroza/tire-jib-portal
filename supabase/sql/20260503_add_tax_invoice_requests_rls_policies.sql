-- Enable RLS + policies for tax invoice requests (admin panel usage)
-- Run this in Supabase SQL editor (or your migration pipeline).

alter table if exists public.tax_invoice_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_invoice_requests'
      and policyname = 'tax_invoice_requests_authenticated_select'
  ) then
    create policy tax_invoice_requests_authenticated_select
      on public.tax_invoice_requests
      for select
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_invoice_requests'
      and policyname = 'tax_invoice_requests_authenticated_insert'
  ) then
    create policy tax_invoice_requests_authenticated_insert
      on public.tax_invoice_requests
      for insert
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_invoice_requests'
      and policyname = 'tax_invoice_requests_authenticated_update'
  ) then
    create policy tax_invoice_requests_authenticated_update
      on public.tax_invoice_requests
      for update
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_invoice_requests'
      and policyname = 'tax_invoice_requests_authenticated_delete'
  ) then
    create policy tax_invoice_requests_authenticated_delete
      on public.tax_invoice_requests
      for delete
      using (auth.role() = 'authenticated');
  end if;
end
$$;

