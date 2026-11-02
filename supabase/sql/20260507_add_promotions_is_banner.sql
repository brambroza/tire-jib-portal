alter table public.promotions
add column if not exists is_banner boolean not null default false;

create index if not exists promotions_is_banner_idx
  on public.promotions (is_banner, active, priority);
