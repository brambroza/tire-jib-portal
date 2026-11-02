create table if not exists public.install_inspection_forms (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.install_appointments(id) on delete cascade,
  receive_time text null,
  finish_time text null,
  plate_no text null,
  car_model text null,
  mileage_km text null,
  battery_voltage text null,
  tire_fl text null,
  tire_fr text null,
  tire_rl text null,
  tire_rr text null,
  tire_checked_before boolean not null default false,
  tire_checked_after boolean not null default false,
  tire_target_psi text null,
  technician_note text null,
  customer_sign text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists install_inspection_forms_appointment_id_uidx
  on public.install_inspection_forms(appointment_id);

create index if not exists install_inspection_forms_car_model_idx
  on public.install_inspection_forms(car_model);

