alter table if exists public.products
add column if not exists is_hot boolean default false,
add column if not exists is_new boolean default false,
add column if not exists is_promotion boolean default false,
add column if not exists total_sold integer default 0;

alter table if exists public.prices
add column if not exists old_price numeric;

