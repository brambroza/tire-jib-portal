-- Add per-site extra fee config for unmet free conditions

create table if not exists public.site_extra_fee_configs (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  condition_type text not null check (condition_type in ('min_item_qty', 'min_subtotal')),
  threshold_value numeric(12,2) not null default 0 check (threshold_value >= 0),
  extra_fee numeric(12,2) not null default 0 check (extra_fee >= 0),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, condition_type)
);

create index if not exists site_extra_fee_configs_site_idx
  on public.site_extra_fee_configs (site_id, condition_type, updated_at desc);
