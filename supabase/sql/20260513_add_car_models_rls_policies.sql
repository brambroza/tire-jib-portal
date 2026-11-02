alter table if exists public.car_models enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'car_models'
      and policyname = 'car_models_authenticated_select'
  ) then
    create policy car_models_authenticated_select
      on public.car_models
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'car_models'
      and policyname = 'car_models_authenticated_insert'
  ) then
    create policy car_models_authenticated_insert
      on public.car_models
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'car_models'
      and policyname = 'car_models_authenticated_update'
  ) then
    create policy car_models_authenticated_update
      on public.car_models
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

