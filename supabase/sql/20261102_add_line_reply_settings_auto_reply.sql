-- Auto-reply the bot sends after a customer taps the "order via chat" button
-- on a LINE product card. Requires 20261102_add_line_reply_settings.sql.
alter table if exists public.line_reply_settings
add column if not exists reply_enabled boolean not null default true;

alter table if exists public.line_reply_settings
add column if not exists reply_template text not null
  default E'ได้รับข้อความเรื่อง {title} ขนาด {size} แล้วค่ะ\nแอดมินจะตอบกลับโดยเร็วที่สุด';

alter table if exists public.line_reply_settings
drop constraint if exists line_reply_settings_reply_template_check;

alter table if exists public.line_reply_settings
add constraint line_reply_settings_reply_template_check
check (char_length(reply_template) between 1 and 1000);
