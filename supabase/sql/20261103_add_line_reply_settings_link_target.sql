-- Link button target on LINE product cards:
--   'cart'    -> storefront /line/order (adds to cart, LINE login if needed, opens /cart)
--   'product' -> storefront product page (previous behaviour)
-- Requires 20261102_add_line_reply_settings.sql.
alter table if exists public.line_reply_settings
add column if not exists link_target text not null default 'cart';

alter table if exists public.line_reply_settings
add column if not exists cart_quantity integer not null default 1;

alter table if exists public.line_reply_settings
drop constraint if exists line_reply_settings_link_target_check;

alter table if exists public.line_reply_settings
add constraint line_reply_settings_link_target_check
check (link_target in ('cart', 'product'));

alter table if exists public.line_reply_settings
drop constraint if exists line_reply_settings_cart_quantity_check;

alter table if exists public.line_reply_settings
add constraint line_reply_settings_cart_quantity_check
check (cart_quantity between 1 and 8);
