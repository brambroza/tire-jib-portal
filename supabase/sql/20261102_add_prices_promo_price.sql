-- Promotion price per SKU per customer group (nullable = no promotion)
alter table if exists public.prices
add column if not exists promo_price numeric(12,2);

alter table if exists public.prices
drop constraint if exists prices_promo_price_check;

alter table if exists public.prices
add constraint prices_promo_price_check
check (promo_price is null or (promo_price >= 0 and promo_price < price));
