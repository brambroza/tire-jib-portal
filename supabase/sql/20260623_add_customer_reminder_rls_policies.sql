-- Allow authenticated admin/staff UI users to manage customer reminder data.
-- Required for FieldInstallPage and CustomerNotificationsPage when RLS is enabled.

alter table if exists public.customer_vehicles enable row level security;
alter table if exists public.vehicle_renewals enable row level security;
alter table if exists public.vehicle_service_records enable row level security;
alter table if exists public.customer_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_vehicles'
      and policyname = 'customer_vehicles_authenticated_select'
  ) then
    create policy customer_vehicles_authenticated_select
      on public.customer_vehicles
      for select
      to authenticated
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_vehicles'
      and policyname = 'customer_vehicles_authenticated_insert'
  ) then
    create policy customer_vehicles_authenticated_insert
      on public.customer_vehicles
      for insert
      to authenticated
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_vehicles'
      and policyname = 'customer_vehicles_authenticated_update'
  ) then
    create policy customer_vehicles_authenticated_update
      on public.customer_vehicles
      for update
      to authenticated
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_vehicles'
      and policyname = 'customer_vehicles_authenticated_delete'
  ) then
    create policy customer_vehicles_authenticated_delete
      on public.customer_vehicles
      for delete
      to authenticated
      using (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_renewals'
      and policyname = 'vehicle_renewals_authenticated_select'
  ) then
    create policy vehicle_renewals_authenticated_select
      on public.vehicle_renewals
      for select
      to authenticated
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_renewals'
      and policyname = 'vehicle_renewals_authenticated_insert'
  ) then
    create policy vehicle_renewals_authenticated_insert
      on public.vehicle_renewals
      for insert
      to authenticated
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_renewals'
      and policyname = 'vehicle_renewals_authenticated_update'
  ) then
    create policy vehicle_renewals_authenticated_update
      on public.vehicle_renewals
      for update
      to authenticated
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_renewals'
      and policyname = 'vehicle_renewals_authenticated_delete'
  ) then
    create policy vehicle_renewals_authenticated_delete
      on public.vehicle_renewals
      for delete
      to authenticated
      using (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_service_records'
      and policyname = 'vehicle_service_records_authenticated_manage'
  ) then
    create policy vehicle_service_records_authenticated_manage
      on public.vehicle_service_records
      for all
      to authenticated
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_notifications'
      and policyname = 'customer_notifications_authenticated_manage'
  ) then
    create policy customer_notifications_authenticated_manage
      on public.customer_notifications
      for all
      to authenticated
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;
