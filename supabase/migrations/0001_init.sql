-- MAANG schema. All access is server-side with the service role.
-- RLS is enabled on every table with NO policies, so anon/authenticated roles read nothing.

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_key text not null,
  name text not null,
  tags text[] not null default '{}',
  price int not null,
  stock_available int not null check (stock_available >= 0),
  synthetic bool not null default true
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  token text not null,
  source_text text not null,
  input_mode text not null check (input_mode in ('voice','typed')),
  extraction jsonb not null,
  extraction_mode text not null check (extraction_mode in ('ai','rules_fallback','manual')),
  item_label text,
  item_key text,
  hard_constraints text[] not null default '{}',
  max_budget int,
  quantity int,
  needed_by date,
  urgent bool not null default false,
  cluster_key text,
  phone text,
  consent bool not null default false,
  status text not null default 'open' check (status in ('open','notified','reserved','picked_up','closed')),
  close_reason text check (close_reason in ('cannot_meet_deadline','no_longer_needed','not_stockable','duplicate')),
  matched_product_id text references public.products(id),
  synthetic bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phone_only_with_consent check (phone is null or consent)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique not null references public.requests(id) on delete cascade,
  product_id text not null references public.products(id),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.events (
  id bigserial primary key,
  shop_id uuid references public.shops(id) on delete cascade,
  request_id uuid references public.requests(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists requests_shop_status_idx on public.requests(shop_id, status);
create index if not exists requests_shop_cluster_idx on public.requests(shop_id, cluster_key);
create index if not exists events_shop_type_idx on public.events(shop_id, type);

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.requests enable row level security;
alter table public.reservations enable row level security;
alter table public.events enable row level security;

-- ---------- reserve_unit ----------
create or replace function public.reserve_unit(p_request uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.requests%rowtype;
  v_stock int;
begin
  select * into r from public.requests where id = p_request for update;
  if not found then return 'not_found'; end if;
  if r.status = 'reserved' then return 'already'; end if;
  if r.status <> 'notified' or r.matched_product_id is null then return 'not_notified'; end if;

  update public.products
     set stock_available = stock_available - 1
   where id = r.matched_product_id and stock_available > 0
  returning stock_available into v_stock;
  if not found then
    insert into public.events(shop_id, request_id, type, payload)
    values (r.shop_id, r.id, 'reserve_out_of_stock', jsonb_build_object('product_id', r.matched_product_id));
    return 'out_of_stock';
  end if;

  insert into public.reservations(request_id, product_id, released_at)
  values (r.id, r.matched_product_id, null)
  on conflict (request_id) do update set product_id = excluded.product_id, created_at = now(), released_at = null;

  update public.requests set status = 'reserved', updated_at = now() where id = r.id;
  insert into public.events(shop_id, request_id, type, payload)
  values (r.shop_id, r.id, 'reserved', jsonb_build_object('product_id', r.matched_product_id, 'stock_after', v_stock));
  return 'ok';
end $$;

-- ---------- release_unit (close; restock if reserved) ----------
create or replace function public.release_unit(p_request uuid, p_reason text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.requests%rowtype;
begin
  if p_reason not in ('cannot_meet_deadline','no_longer_needed','not_stockable','duplicate') then
    raise exception 'invalid close reason';
  end if;
  select * into r from public.requests where id = p_request for update;
  if not found then return 'not_found'; end if;
  if r.status = 'closed' then return 'already'; end if;
  if r.status = 'picked_up' then return 'not_allowed'; end if;

  if r.status = 'reserved' then
    update public.products set stock_available = stock_available + 1
     where id = (select product_id from public.reservations where request_id = r.id and released_at is null);
    update public.reservations set released_at = now() where request_id = r.id and released_at is null;
    insert into public.events(shop_id, request_id, type, payload)
    values (r.shop_id, r.id, 'released', jsonb_build_object('reason', p_reason));
  end if;

  update public.requests set status = 'closed', close_reason = p_reason, updated_at = now() where id = r.id;
  insert into public.events(shop_id, request_id, type, payload)
  values (r.shop_id, r.id, 'closed', jsonb_build_object('reason', p_reason, 'from', r.status));
  return 'ok';
end $$;

-- ---------- mark_pickup ----------
create or replace function public.mark_pickup(p_request uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.requests%rowtype;
begin
  select * into r from public.requests where id = p_request for update;
  if not found then return 'not_found'; end if;
  if r.status = 'picked_up' then return 'already'; end if;
  if r.status <> 'reserved' then return 'not_reserved'; end if;
  update public.requests set status = 'picked_up', updated_at = now() where id = r.id;
  insert into public.events(shop_id, request_id, type, payload)
  values (r.shop_id, r.id, 'picked_up', jsonb_build_object('product_id', r.matched_product_id));
  return 'ok';
end $$;

-- ---------- add_stock (atomic increment) ----------
create or replace function public.add_stock(p_shop uuid, p_product text, p_qty int)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_stock int;
begin
  if p_qty is null or p_qty < 1 or p_qty > 50 then raise exception 'quantity must be 1..50'; end if;
  update public.products set stock_available = stock_available + p_qty
   where id = p_product and shop_id = p_shop
  returning stock_available into v_stock;
  if not found then raise exception 'product not in shop'; end if;
  insert into public.events(shop_id, request_id, type, payload)
  values (p_shop, null, 'stock_added', jsonb_build_object('product_id', p_product, 'qty', p_qty, 'stock_after', v_stock));
  return v_stock;
end $$;

-- ---------- notify_requests (open + consent only) ----------
create or replace function public.notify_requests(p_ids uuid[], p_product text)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id, shop_id from public.requests
     where id = any(p_ids) and status = 'open' and consent
     order by created_at
     for update
  loop
    update public.requests
       set status = 'notified', matched_product_id = p_product, updated_at = now()
     where id = r.id;
    insert into public.events(shop_id, request_id, type, payload)
    values (r.shop_id, r.id, 'notified', jsonb_build_object('product_id', p_product));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------- reset_demo: single source of seed data ----------
create or replace function public.reset_demo()
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shop uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_weekend date;
begin
  -- coming Sunday (today if Sunday), in IST
  v_weekend := v_today + ((7 - extract(isodow from v_today)::int) % 7);

  insert into public.shops(slug, name) values ('neighbourhood-toys', 'Neighbourhood Toys (demo)')
  on conflict (slug) do update set name = excluded.name
  returning id into v_shop;

  delete from public.events where shop_id = v_shop;
  delete from public.reservations where request_id in (select id from public.requests where shop_id = v_shop);
  delete from public.requests where shop_id = v_shop;
  delete from public.products where shop_id = v_shop;

  insert into public.products(id, shop_id, item_key, name, tags, price, stock_available, synthetic) values
    ('RC-01', v_shop, 'rc_car', 'Rechargeable RC car (USB charging)', '{rechargeable}', 899, 0, true),
    ('RC-02', v_shop, 'rc_car', 'RC car (AA batteries)', '{disposable_batteries}', 799, 3, true),
    ('GH-01', v_shop, 'gift_hamper', 'Diwali gift hamper, small', '{}', 449, 0, true),
    ('PZ-01', v_shop, 'jigsaw_puzzle', 'Jigsaw puzzle, 500 pieces', '{pieces:500}', 599, 2, true);

  insert into public.requests(id, shop_id, token, source_text, input_mode, extraction, extraction_mode,
      item_label, item_key, hard_constraints, max_budget, quantity, needed_by, urgent, cluster_key,
      phone, consent, status, synthetic, created_at, updated_at) values
    ('00000000-0000-4000-8000-000000000001', v_shop, md5('seed-1' || random()::text), 'Remote wali gaadi chahiye, rechargeable, 1000 ke andar, kal tak',
      'typed', jsonb_build_object('item','rechargeable remote control car','item_key','rc_car','hard_constraints',jsonb_build_array('rechargeable'),'soft_preferences','[]'::jsonb,'max_budget',1000,'quantity',null,'needed_by',(v_today+1)::text,'needed_by_label','kal tak','urgent',false,'language','hi-IN','missing','[]'::jsonb,'clarifying_question',null,'source_text','Remote wali gaadi chahiye, rechargeable, 1000 ke andar, kal tak','mode','rules_fallback'),
      'rules_fallback', 'rechargeable remote control car', 'rc_car', '{rechargeable}', 1000, null, v_today + 1, false, 'rc_car|rechargeable|1000',
      '9000000101', true, 'open', true, now() - interval '50 minutes', now() - interval '50 minutes'),
    ('00000000-0000-4000-8000-000000000002', v_shop, md5('seed-2' || random()::text), 'Rechargeable RC car, budget 1000, kal chahiye',
      'typed', jsonb_build_object('item','rechargeable remote control car','item_key','rc_car','hard_constraints',jsonb_build_array('rechargeable'),'soft_preferences','[]'::jsonb,'max_budget',1000,'quantity',null,'needed_by',(v_today+1)::text,'needed_by_label','kal','urgent',false,'language','hi-IN','missing','[]'::jsonb,'clarifying_question',null,'source_text','Rechargeable RC car, budget 1000, kal chahiye','mode','rules_fallback'),
      'rules_fallback', 'rechargeable remote control car', 'rc_car', '{rechargeable}', 1000, null, v_today + 1, false, 'rc_car|rechargeable|1000',
      null, false, 'open', true, now() - interval '40 minutes', now() - interval '40 minutes'),
    ('00000000-0000-4000-8000-000000000003', v_shop, md5('seed-3' || random()::text), 'Gift hamper chahiye 500 ke andar, Sunday tak',
      'typed', jsonb_build_object('item','gift hamper','item_key','gift_hamper','hard_constraints','[]'::jsonb,'soft_preferences','[]'::jsonb,'max_budget',500,'quantity',null,'needed_by',v_weekend::text,'needed_by_label','Sunday tak','urgent',false,'language','hi-IN','missing','[]'::jsonb,'clarifying_question',null,'source_text','Gift hamper chahiye 500 ke andar, Sunday tak','mode','rules_fallback'),
      'rules_fallback', 'gift hamper', 'gift_hamper', '{}', 500, null, v_weekend, false, 'gift_hamper||500',
      '9000000102', true, 'open', true, now() - interval '35 minutes', now() - interval '35 minutes'),
    ('00000000-0000-4000-8000-000000000004', v_shop, md5('seed-4' || random()::text), 'Diwali hamper under 500 by Sunday',
      'typed', jsonb_build_object('item','gift hamper','item_key','gift_hamper','hard_constraints','[]'::jsonb,'soft_preferences','[]'::jsonb,'max_budget',500,'quantity',null,'needed_by',v_weekend::text,'needed_by_label','by Sunday','urgent',false,'language','en-IN','missing','[]'::jsonb,'clarifying_question',null,'source_text','Diwali hamper under 500 by Sunday','mode','rules_fallback'),
      'rules_fallback', 'gift hamper', 'gift_hamper', '{}', 500, null, v_weekend, false, 'gift_hamper||500',
      '9000000103', true, 'open', true, now() - interval '30 minutes', now() - interval '30 minutes'),
    ('00000000-0000-4000-8000-000000000005', v_shop, md5('seed-5' || random()::text), '1000 pieces wala jigsaw puzzle, 800 rupaye tak',
      'typed', jsonb_build_object('item','jigsaw puzzle','item_key','jigsaw_puzzle','hard_constraints',jsonb_build_array('pieces:1000'),'soft_preferences','[]'::jsonb,'max_budget',800,'quantity',null,'needed_by',null,'needed_by_label',null,'urgent',false,'language','hi-IN','missing',jsonb_build_array('needed_by'),'clarifying_question','Kab tak chahiye?','source_text','1000 pieces wala jigsaw puzzle, 800 rupaye tak','mode','rules_fallback'),
      'rules_fallback', 'jigsaw puzzle', 'jigsaw_puzzle', '{pieces:1000}', 800, null, null, false, 'jigsaw_puzzle|pieces:1000|1000',
      '9000000104', true, 'open', true, now() - interval '25 minutes', now() - interval '25 minutes'),
    ('00000000-0000-4000-8000-000000000006', v_shop, md5('seed-6' || random()::text), 'RC car chahiye tha kal ke liye, rechargeable, 1000 ke andar',
      'typed', jsonb_build_object('item','rechargeable remote control car','item_key','rc_car','hard_constraints',jsonb_build_array('rechargeable'),'soft_preferences','[]'::jsonb,'max_budget',1000,'quantity',null,'needed_by',(v_today-1)::text,'needed_by_label','kal','urgent',false,'language','hi-IN','missing','[]'::jsonb,'clarifying_question',null,'source_text','RC car chahiye tha kal ke liye, rechargeable, 1000 ke andar','mode','rules_fallback'),
      'rules_fallback', 'rechargeable remote control car', 'rc_car', '{rechargeable}', 1000, null, v_today - 1, false, 'rc_car|rechargeable|1000',
      null, false, 'open', true, now() - interval '2 days', now() - interval '2 days');

  insert into public.events(shop_id, request_id, type, payload, created_at)
  select shop_id, id, 'captured', jsonb_build_object('seed', true), created_at
    from public.requests where shop_id = v_shop;

  return json_build_object(
    'products', (select count(*) from public.products where shop_id = v_shop),
    'requests', (select count(*) from public.requests where shop_id = v_shop),
    'reservations', (select count(*) from public.reservations r join public.requests q on q.id = r.request_id where q.shop_id = v_shop),
    'events', (select count(*) from public.events where shop_id = v_shop)
  );
end $$;

-- Only the service role may execute these functions (PostgREST would otherwise expose them to anon).
revoke execute on function public.reserve_unit(uuid) from public, anon, authenticated;
revoke execute on function public.release_unit(uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_pickup(uuid) from public, anon, authenticated;
revoke execute on function public.add_stock(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.notify_requests(uuid[], text) from public, anon, authenticated;
revoke execute on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.reserve_unit(uuid) to service_role;
grant execute on function public.release_unit(uuid, text) to service_role;
grant execute on function public.mark_pickup(uuid) to service_role;
grant execute on function public.add_stock(uuid, text, int) to service_role;
grant execute on function public.notify_requests(uuid[], text) to service_role;
grant execute on function public.reset_demo() to service_role;
