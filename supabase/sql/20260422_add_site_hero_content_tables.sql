-- Add hero section + hero ads for each site

create table if not exists public.site_hero_sections (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  eyebrow text,
  title_line_1 text,
  title_line_2 text,
  title_line_3 text,
  subtitle text,
  subtitle_highlight text,
  left_bg_image_url text,
  right_bg_image_url text,
  badges jsonb not null default '[]'::jsonb,
  ctas jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id)
);

create table if not exists public.site_hero_ads (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null,
  message text,
  tag text,
  image_url text,
  cta_label text,
  cta_href text,
  sort_order int not null default 100,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_hero_ads_site_sort_idx
  on public.site_hero_ads (site_id, active, sort_order, updated_at desc);

-- Allow homepage to read active content via anon key
alter table public.site_hero_sections enable row level security;
alter table public.site_hero_ads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_sections'
      and policyname = 'site_hero_sections_public_read'
  ) then
    create policy site_hero_sections_public_read
      on public.site_hero_sections
      for select
      using (active = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_sections'
      and policyname = 'site_hero_sections_authenticated_manage'
  ) then
    create policy site_hero_sections_authenticated_manage
      on public.site_hero_sections
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_ads'
      and policyname = 'site_hero_ads_public_read'
  ) then
    create policy site_hero_ads_public_read
      on public.site_hero_ads
      for select
      using (
        active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_ads'
      and policyname = 'site_hero_ads_authenticated_manage'
  ) then
    create policy site_hero_ads_authenticated_manage
      on public.site_hero_ads
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
