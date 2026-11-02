-- TireHub multi-site ecommerce schema for Supabase (Postgres)
-- Run in Supabase SQL Editor

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Enums
create type public.site_code as enum ('car_retail', 'truck_dealer', 'moto_dealer');
create type public.customer_group_code as enum ('general', 'member', 'dealer_small', 'dealer_mid', 'dealer_big');
create type public.user_role as enum ('admin', 'staff', 'customer');
create type public.order_status as enum ('pending', 'processing', 'shipping', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type public.install_status as enum ('waiting', 'in_progress', 'done', 'missed', 'cancelled');

-- Sites
create table if not exists public.sites (
  id uuid primary key default uuid_generate_v4(),
  code public.site_code not null unique,
  name text not null,
  domain text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Site-level company profile / content management
create table if not exists public.site_company_profiles (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null unique references public.sites (id) on delete cascade,
  company_name text,
  tax_id text,
  phone text,
  email text,
  line_id text,
  address text,
  about text,
  logo_url text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_payment_accounts (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null unique references public.sites (id) on delete cascade,
  account_name text,
  account_number text,
  bank_name text,
  qr_code_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_shipping_provinces (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  province text not null,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, province)
);

create index if not exists site_shipping_provinces_site_idx
  on public.site_shipping_provinces (site_id, province, updated_at desc);

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

create table if not exists public.site_services (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null,
  summary text,
  detail text,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_services_site_idx
  on public.site_services (site_id, sort_order, created_at);

create table if not exists public.site_showcase_products (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null,
  subtitle text,
  description text,
  image_url text,
  price_from numeric(12,2),
  cta_label text,
  cta_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_showcase_products_site_idx
  on public.site_showcase_products (site_id, sort_order, created_at);

create table if not exists public.site_hero_sections (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  eyebrow text,
  title_line_1 text,
  title_line_2 text,
  title_line_3 text,
  subtitle text,
  subtitle_highlight text,
  left_bg_image_url text,
  right_bg_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id)
);

create table if not exists public.site_hero_ads (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null,
  message text,
  tag text,
  image_url text,
  cta_label text,
  cta_href text,
  sort_order int not null default 100,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_hero_ads_site_sort_idx
  on public.site_hero_ads (site_id, active, sort_order, updated_at desc);

alter table public.site_hero_sections enable row level security;
alter table public.site_hero_ads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_sections'
      and policyname = 'site_hero_sections_public_read'
  ) then
    create policy site_hero_sections_public_read
      on public.site_hero_sections
      for select
      using (active = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_sections'
      and policyname = 'site_hero_sections_authenticated_manage'
  ) then
    create policy site_hero_sections_authenticated_manage
      on public.site_hero_sections
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_ads'
      and policyname = 'site_hero_ads_public_read'
  ) then
    create policy site_hero_ads_public_read
      on public.site_hero_ads
      for select
      using (
        active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_hero_ads'
      and policyname = 'site_hero_ads_authenticated_manage'
  ) then
    create policy site_hero_ads_authenticated_manage
      on public.site_hero_ads
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Customer groups
create table if not exists public.customer_groups (
  id uuid primary key default uuid_generate_v4(),
  code public.customer_group_code not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- User profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role public.user_role not null default 'customer',
  group_id uuid references public.customer_groups (id),
  site_id uuid references public.sites (id),
  dealer_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Products
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites (id),
  brand text not null,
  name text not null,
  description text,
  remark text,
  car_make text,
  car_model text,
  car_year_from integer,
  car_year_to integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tire brand / model catalog
create table if not exists public.tire_brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.tire_models (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references public.tire_brands (id) on delete cascade,
  name text not null,
  segment text,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists tire_models_brand_idx on public.tire_models (brand_id);

-- Car make / model / year catalog
create table if not exists public.car_brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.car_models (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references public.car_brands (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table if not exists public.car_years (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid not null references public.car_models (id) on delete cascade,
  year_from integer not null,
  year_to integer not null,
  created_at timestamptz not null default now(),
  unique (model_id, year_from, year_to)
);

create index if not exists car_models_brand_idx on public.car_models (brand_id);
create index if not exists car_years_model_idx on public.car_years (model_id);

-- Tire fitment to car models (many-to-many)
create table if not exists public.product_car_models (
  product_id uuid not null references public.products (id) on delete cascade,
  car_model_id uuid not null references public.car_models (id) on delete cascade,
  car_brand_id uuid not null references public.car_brands (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, car_model_id)
);

create index if not exists product_car_models_model_idx on public.product_car_models (car_model_id);

-- SKUs
create table if not exists public.skus (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku_code text not null unique,
  size_label text,
  width_mm integer,
  aspect_ratio integer,
  rim_inch integer,
  load_index text,
  speed_rating text,
  cost_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- SKU image index for visual search
create table if not exists public.sku_image_embeddings (
  id bigserial primary key,
  sku_id uuid not null references public.skus (id) on delete cascade,
  image_url text,
  source text not null default 'manual',
  embedding vector not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sku_id, image_url)
);

create index if not exists sku_image_embeddings_sku_idx
  on public.sku_image_embeddings (sku_id);
create index if not exists sku_image_embeddings_vector_idx
  on public.sku_image_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Inventory
create table if not exists public.inventory (
  sku_id uuid primary key references public.skus (id) on delete cascade,
  qty_on_hand integer not null default 0,
  qty_reserved integer not null default 0,
  min_stock integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Pricing per customer group
create table if not exists public.prices (
  id uuid primary key default uuid_generate_v4(),
  sku_id uuid not null references public.skus (id) on delete cascade,
  group_id uuid not null references public.customer_groups (id),
  price numeric(12,2) not null,
  currency text not null default 'THB',
  updated_at timestamptz not null default now(),
  unique (sku_id, group_id)
);

-- Orders
create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_no text not null unique,
  site_id uuid not null references public.sites (id),
  customer_id uuid not null references public.profiles (id),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists orders_site_status_idx on public.orders (site_id, status);
create index if not exists orders_customer_idx on public.orders (customer_id);

-- Order items
create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  quantity integer not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- Free issue / bonus items attached to orders (optional per install appointment)
create table if not exists public.order_bonus_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders (id) on delete cascade,
  appointment_id uuid,
  sku_id uuid not null references public.skus (id),
  quantity integer not null check (quantity > 0),
  source text not null check (source in ('promotion', 'manual', 'field_install')),
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_bonus_items_order_idx
  on public.order_bonus_items (order_id, created_at desc);
create index if not exists order_bonus_items_appointment_idx
  on public.order_bonus_items (appointment_id, created_at desc);
create index if not exists order_bonus_items_sku_idx
  on public.order_bonus_items (sku_id);

-- Inventory movement log for auditing stock adjustments and free issues
create table if not exists public.inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  sku_id uuid not null references public.skus (id) on delete restrict,
  movement_type text not null check (
    movement_type in ('sale', 'bonus', 'free_issue', 'restock', 'adjust')
  ),
  qty_change integer not null,
  ref_type text check (ref_type in ('order', 'install_appointment', 'manual')),
  ref_id uuid,
  note text,
  order_bonus_item_id uuid references public.order_bonus_items (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_sku_idx
  on public.inventory_movements (sku_id, created_at desc);
create index if not exists inventory_movements_type_idx
  on public.inventory_movements (movement_type, created_at desc);
create index if not exists inventory_movements_ref_idx
  on public.inventory_movements (ref_type, ref_id, created_at desc);

-- Payments (for Site 1 admin confirmation)
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method text not null,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null,
  paid_at timestamptz,
  slip_url text,
  created_at timestamptz not null default now()
);

-- Installation appointments (Site 1)
create table if not exists public.install_appointments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  scheduled_at timestamptz not null,
  job_duration_minutes integer not null default 120 check (job_duration_minutes between 30 and 480),
  status public.install_status not null default 'waiting',
  vehicle_plate text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.install_appointments
  add column if not exists job_duration_minutes integer not null default 120;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_bonus_items_appointment_id_fkey'
  ) then
    alter table public.order_bonus_items
      add constraint order_bonus_items_appointment_id_fkey
      foreign key (appointment_id) references public.install_appointments (id) on delete set null;
  end if;
end
$$;

-- Installation checklist templates (extra checks beyond order items)
create table if not exists public.install_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists install_checklist_items_active_idx
  on public.install_checklist_items (active, sort_order, created_at);

-- Installation execution report (1 report per appointment)
create table if not exists public.install_execution_reports (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid not null unique references public.install_appointments (id) on delete cascade,
  notes text,
  executed_at timestamptz,
  executed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists install_execution_reports_appointment_idx
  on public.install_execution_reports (appointment_id);

-- Checklist results captured in each execution report
create table if not exists public.install_execution_report_items (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references public.install_execution_reports (id) on delete cascade,
  source_type text not null check (source_type in ('order_item', 'extra')),
  source_id uuid,
  label text not null,
  is_checked boolean not null default false,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists install_execution_report_items_report_idx
  on public.install_execution_report_items (report_id, sort_order, created_at);

-- Photos attached to each installation execution report
create table if not exists public.install_execution_report_photos (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references public.install_execution_reports (id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists install_execution_report_photos_report_idx
  on public.install_execution_report_photos (report_id, created_at);

-- Simple audit for bulk price updates
create table if not exists public.price_bulk_logs (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.customer_groups (id),
  percent_change numeric(6,2),
  fixed_change numeric(12,2),
  applied_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Promotions (ticker / banner)
create table if not exists public.promotions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  message text not null,
  site_id uuid references public.sites (id),
  start_at timestamptz,
  end_at timestamptz,
  active boolean not null default true,
  is_banner boolean not null default false,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotions_active_idx on public.promotions (active, start_at, end_at, priority);
create index if not exists promotions_is_banner_idx on public.promotions (is_banner, active, priority);

create table if not exists public.promotion_images (
  id uuid primary key default uuid_generate_v4(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists promotion_images_promotion_idx
  on public.promotion_images (promotion_id, sort_order, created_at);

-- Technicians / installation teams
create table if not exists public.technicians (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  role text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Customer reminder master data
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
  renewal_type text not null check (renewal_type in ('insurance', 'act', 'tax')),
  insurance_class text,
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
create unique index if not exists vehicle_renewals_vehicle_type_uidx
  on public.vehicle_renewals (vehicle_id, renewal_type);

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
  source_type text not null check (source_type in ('renewal', 'service', 'install_item')),
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

-- Team relation: one technician team can have many users (profiles)
alter table public.profiles
  add column if not exists technician_id uuid references public.technicians (id) on delete set null;
create index if not exists profiles_technician_idx on public.profiles (technician_id);

-- Seed sites and groups
insert into public.sites (code, name) values
  ('car_retail', 'ยางรถยนต์ (ปลีก)'),
  ('truck_dealer', 'ยางรถบรรทุก'),
  ('moto_dealer', 'ยางมอเตอร์ไซค์')
  on conflict (code) do nothing;

insert into public.customer_groups (code, name) values
  ('general', 'ทั่วไป'),
  ('member', 'สมาชิก'),
  ('dealer_small', 'ดีลเลอร์เล็ก'),
  ('dealer_mid', 'ดีลเลอร์กลาง'),
  ('dealer_big', 'ดีลเลอร์ใหญ่')
  on conflict (code) do nothing;

-- LINE messages storage
create table if not exists public.line_messages (
  id uuid primary key default uuid_generate_v4(),
  direction text not null check (direction in ('in','out')),
  line_user_id text,
  line_group_id text,
  line_room_id text,
  message_type text not null default 'text',
  message text,
  status text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists line_messages_user_idx on public.line_messages (line_user_id, created_at);
create index if not exists line_messages_group_idx on public.line_messages (line_group_id, created_at);

-- Notification read-state per user (for checkout waitingconfirm alerts)
create table if not exists public.cart_notification_reads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cart_id uuid not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, cart_id)
);

create index if not exists cart_notification_reads_user_idx
  on public.cart_notification_reads (user_id, read_at desc);
create index if not exists cart_notification_reads_cart_idx
  on public.cart_notification_reads (cart_id);

alter table public.cart_notification_reads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cart_notification_reads'
      and policyname = 'users_select_own_cart_notification_reads'
  ) then
    create policy users_select_own_cart_notification_reads
      on public.cart_notification_reads
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cart_notification_reads'
      and policyname = 'users_insert_own_cart_notification_reads'
  ) then
    create policy users_insert_own_cart_notification_reads
      on public.cart_notification_reads
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cart_notification_reads'
      and policyname = 'users_update_own_cart_notification_reads'
  ) then
    create policy users_update_own_cart_notification_reads
      on public.cart_notification_reads
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
