alter table if exists public.install_execution_reports
add column if not exists form_data jsonb;
