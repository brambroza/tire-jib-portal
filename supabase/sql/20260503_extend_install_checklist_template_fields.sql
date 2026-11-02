alter table if exists public.install_checklist_items
  add column if not exists section_name text,
  add column if not exists response_mode text not null default 'pass_fail',
  add column if not exists response_options jsonb not null default '[]'::jsonb,
  add column if not exists unit_label text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'install_checklist_items_response_mode_check'
  ) then
    alter table public.install_checklist_items
      add constraint install_checklist_items_response_mode_check
      check (response_mode in ('pass_fail', 'low_normal_high', 'normal_leak_damaged', 'custom', 'text_only'));
  end if;
end $$;

create index if not exists install_checklist_items_section_idx
  on public.install_checklist_items (section_name, sort_order, created_at);
