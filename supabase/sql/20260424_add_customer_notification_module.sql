-- Customer notification module

create table if not exists public.customer_vehicles (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.customes (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  plate_no text not null,
  brand text,
  model text,
  year integer,
  current_mileage integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, plate_no)
);

create index if not exists customer_vehicles_customer_idx
  on public.customer_vehicles (customer_id, active, updated_at desc);
create index if not exists customer_vehicles_site_idx
  on public.customer_vehicles (site_id, active, updated_at desc);

create table if not exists public.vehicle_renewals (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.customer_vehicles (id) on delete cascade,
  renewal_type text not null check (renewal_type in ('insurance', 'act')),
  provider text,
  policy_no text,
  start_date date,
  expiry_date date not null,
  remind_before_days integer not null default 30 check (remind_before_days between 1 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_renewals_vehicle_idx
  on public.vehicle_renewals (vehicle_id, active, expiry_date);
create index if not exists vehicle_renewals_type_idx
  on public.vehicle_renewals (renewal_type, active, expiry_date);

create table if not exists public.vehicle_service_records (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.customer_vehicles (id) on delete cascade,
  service_type text not null check (service_type in ('battery', 'tire', 'inspection')),
  service_date date,
  mileage_at_service integer,
  next_due_date date,
  next_due_mileage integer,
  remind_before_days integer not null default 30 check (remind_before_days between 1 and 365),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (next_due_date is not null or next_due_mileage is not null)
);

create index if not exists vehicle_service_records_vehicle_idx
  on public.vehicle_service_records (vehicle_id, active, next_due_date);
create index if not exists vehicle_service_records_type_idx
  on public.vehicle_service_records (service_type, active, next_due_date);

create table if not exists public.customer_notifications (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete restrict,
  customer_id uuid not null references public.customes (id) on delete cascade,
  vehicle_id uuid references public.customer_vehicles (id) on delete set null,
  source_type text not null check (source_type in ('renewal', 'service')),
  source_id uuid not null,
  remind_days integer not null check (remind_days in (7, 15, 30)),
  due_date date,
  title text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  channel text not null default 'line',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, remind_days)
);

create index if not exists customer_notifications_site_idx
  on public.customer_notifications (site_id, status, due_date, created_at desc);
create index if not exists customer_notifications_customer_idx
  on public.customer_notifications (customer_id, due_date, created_at desc);
