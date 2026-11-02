-- Admin-editable text message sent after the LINE product carousel
-- (previously hardcoded "ดูทั้งหมด/สั่งซื้อ: ... กลับหน้าเว็บ: ...").
-- Requires 20261102_add_line_reply_settings.sql.
alter table if exists public.line_reply_settings
add column if not exists result_footer_enabled boolean not null default true;

alter table if exists public.line_reply_settings
add column if not exists result_footer_template text not null
  default E'ดูทั้งหมด/สั่งซื้อ: {search_url}\nกลับหน้าเว็บ: {home_url}';

alter table if exists public.line_reply_settings
drop constraint if exists line_reply_settings_result_footer_template_check;

alter table if exists public.line_reply_settings
add constraint line_reply_settings_result_footer_template_check
check (char_length(result_footer_template) between 1 and 1000);
