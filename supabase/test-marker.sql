-- TEST DATABASE ONLY. Never apply to prod.
-- /api/health reports db_role=test only when MAANG_DB_ROLE=test AND this row exists.
create table if not exists public.maang_env (role text primary key);
alter table public.maang_env enable row level security;
insert into public.maang_env (role) values ('test') on conflict do nothing;
