create table if not exists public.car_models (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.car_models
  add column if not exists model text;

alter table if exists public.car_models
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.car_models
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists car_models_model_unique_idx
  on public.car_models (model);

