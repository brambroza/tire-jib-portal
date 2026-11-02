-- Admin-configurable footer button(s) on LINE product cards sent by the webhook.
-- Single-row table (id = 'default'); webhook reads it with the service role.
create table if not exists public.line_reply_settings (
  id text primary key default 'default' check (id = 'default'),
  button_mode text not null default 'message' check (button_mode in ('link', 'message', 'both')),
  link_label text not null default 'ดูหน้าสินค้า' check (char_length(link_label) between 1 and 20),
  message_label text not null default 'สั่งซื้อสินค้า' check (char_length(message_label) between 1 and 20),
  message_template text not null default 'ต้องการสั่งซื้อ {title} ขนาด {size} ราคา {price}'
    check (char_length(message_template) between 1 and 300),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.line_reply_settings (id) values ('default')
on conflict (id) do nothing;

alter table public.line_reply_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'line_reply_settings'
      and policyname = 'line_reply_settings_staff_select'
  ) then
    create policy line_reply_settings_staff_select
      on public.line_reply_settings
      for select
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and coalesce(p.is_active, true)
            and (p.role = 'admin' or coalesce(to_jsonb(p.menu_permissions) ? 'line-reply-settings', false))
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'line_reply_settings'
      and policyname = 'line_reply_settings_staff_update'
  ) then
    create policy line_reply_settings_staff_update
      on public.line_reply_settings
      for update
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and coalesce(p.is_active, true)
            and (p.role = 'admin' or coalesce(to_jsonb(p.menu_permissions) ? 'line-reply-settings', false))
        )
      )
      with check (id = 'default');
  end if;
end $$;
