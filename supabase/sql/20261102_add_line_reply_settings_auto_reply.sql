-- Auto-reply the bot sends after a customer taps the "order via chat" button
-- on a LINE product card. Requires 20261102_add_line_reply_settings.sql.
alter table if exists public.line_reply_settings
add column if not exists reply_enabled boolean not null default true;

alter table if exists public.line_reply_settings
add column if not exists reply_template text not null
  default E'รับคำสั่งซื้อ {title} ขนาด {size} ราคา {price} แล้วค่ะ\nแอดมินจะติดต่อกลับเพื่อยืนยันสต๊อกและนัดติดตั้งโดยเร็วที่สุด\nดูรายละเอียดสินค้า: {url}';

alter table if exists public.line_reply_settings
drop constraint if exists line_reply_settings_reply_template_check;

alter table if exists public.line_reply_settings
add constraint line_reply_settings_reply_template_check
check (char_length(reply_template) between 1 and 1000);
