-- Add technician work slots + holidays

create table if not exists public.technician_work_slots (
  id uuid primary key default uuid_generate_v4(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (technician_id, start_time, end_time)
);

create index if not exists technician_work_slots_technician_idx
  on public.technician_work_slots (technician_id, active, sort_order, start_time);

create table if not exists public.technician_holidays (
  id uuid primary key default uuid_generate_v4(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  holiday_date date not null,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (technician_id, holiday_date)
);

create index if not exists technician_holidays_technician_idx
  on public.technician_holidays (technician_id, holiday_date desc, active);
