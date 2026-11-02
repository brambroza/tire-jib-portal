-- Add insurance / compulsory act / tax expiry reminders captured from field install.

alter table if exists public.install_inspection_forms
  add column if not exists insurance_type text,
  add column if not exists insurance_expiry_date date,
  add column if not exists act_expiry_date date,
  add column if not exists tax_expiry_date date;

alter table if exists public.vehicle_renewals
  add column if not exists insurance_class text;

alter table if exists public.vehicle_renewals
  drop constraint if exists vehicle_renewals_renewal_type_check;

alter table if exists public.vehicle_renewals
  add constraint vehicle_renewals_renewal_type_check
  check (renewal_type in ('insurance', 'act', 'tax'));

create unique index if not exists vehicle_renewals_vehicle_type_uidx
  on public.vehicle_renewals (vehicle_id, renewal_type);

alter table if exists public.customer_notifications
  drop constraint if exists customer_notifications_source_type_check;

alter table if exists public.customer_notifications
  add constraint customer_notifications_source_type_check
  check (source_type in ('renewal', 'service', 'install_item'));
