-- TEST DATABASE ONLY. Never apply to prod.
-- /api/health reports db_role=test only when MAANG_DB_ROLE=test AND this row exists.
create table if not exists public.maang_env (role text primary key);
alter table public.maang_env enable row level security;
insert into public.maang_env (role) values ('test') on conflict do nothing;

-- Newer Supabase images do not grant public tables to service_role by default; the app needs them.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
