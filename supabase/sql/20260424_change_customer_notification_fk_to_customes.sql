-- Switch customer foreign keys from profiles to customes for customer notification module

alter table if exists public.customer_vehicles
  drop constraint if exists customer_vehicles_customer_id_fkey;

alter table if exists public.customer_vehicles
  add constraint customer_vehicles_customer_id_fkey
  foreign key (customer_id)
  references public.customes (id)
  on delete cascade;

alter table if exists public.customer_notifications
  drop constraint if exists customer_notifications_customer_id_fkey;

alter table if exists public.customer_notifications
  add constraint customer_notifications_customer_id_fkey
  foreign key (customer_id)
  references public.customes (id)
  on delete cascade;
