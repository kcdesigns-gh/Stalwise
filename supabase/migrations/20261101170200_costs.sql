-- Stalwise costs: categories, products with prices, cost entries, feed logs,
-- flat feed rates, shared cost pools and their per-horse-per-day split, sales.
-- Money tables are Manager-only. Grooms log feed given without ever seeing prices.

create table public.cost_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null check (code ~ '^[a-z_]+$'),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, code)
);

call private.tenant_table('cost_categories', '{manager,trainer,groom,casual}', '{manager}', '{}');

create or replace function private.seed_cost_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cost_categories (business_id, code, name, sort_order)
  values
    (new.id, 'feed', 'Feed', 10),
    (new.id, 'medicine', 'Medicine', 20),
    (new.id, 'supplements', 'Supplements', 30),
    (new.id, 'vet', 'Vet', 40),
    (new.id, 'farrier', 'Farrier', 50),
    (new.id, 'transport', 'Transport', 60),
    (new.id, 'training', 'Training', 70),
    (new.id, 'other', 'Other', 90);
  return new;
end;
$$;

create trigger businesses_seed_cost_categories
  after insert on public.businesses
  for each row execute function private.seed_cost_categories();

-- ---------------------------------------------------------------------------
-- Products and prices (prices kept separately so Grooms can pick products
-- without seeing what they cost; price history keeps old costs correct)
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  category_id uuid not null,
  unit text not null default 'unit',
  doses_per_unit numeric(10,3) not null default 1 check (doses_per_unit > 0),
  dose_label text not null default 'dose',
  included_in_feed_rate boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (category_id, business_id) references public.cost_categories (id, business_id)
);

call private.tenant_table('products', '{manager,trainer,groom,casual}', '{manager}', '{}');

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  effective_from date not null default current_date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, effective_from),
  foreign key (product_id, business_id) references public.products (id, business_id) on delete cascade
);

call private.tenant_table('product_prices', '{manager}', '{manager}', '{manager}');

-- Cost of one dose of a product on a given date: unit price / doses per unit.
create or replace function private.product_dose_cost(pid uuid, on_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select pp.unit_price / p.doses_per_unit
  from public.products p
  join public.product_prices pp on pp.product_id = p.id
  where p.id = pid
    and pp.effective_from <= on_date
  order by pp.effective_from desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Cost entries (every cost against a horse)
-- ---------------------------------------------------------------------------

create table public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  category_id uuid not null,
  product_id uuid,
  care_event_id uuid,
  cost_on date not null default current_date,
  description text,
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  unit_cost numeric(12,4),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  billable boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'feed_log', 'feed_rate')),
  source_id uuid,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (category_id, business_id) references public.cost_categories (id, business_id),
  foreign key (product_id, business_id) references public.products (id, business_id),
  foreign key (care_event_id, business_id) references public.care_events (id, business_id) on delete set null (care_event_id)
);

create index cost_entries_horse_idx on public.cost_entries (horse_id, cost_on);
create unique index cost_entries_feed_log_once on public.cost_entries (source_id) where source = 'feed_log';
create unique index cost_entries_feed_rate_once on public.cost_entries (horse_id, cost_on) where source = 'feed_rate';

call private.tenant_table('cost_entries', '{manager}', '{manager}', '{manager}');

-- A product cost without an amount is priced from the product list.
create or replace function private.cost_entry_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.product_id is not null and (new.unit_cost is null or new.amount = 0) then
    new.unit_cost := coalesce(new.unit_cost, private.product_dose_cost(new.product_id, new.cost_on), 0);
    new.amount := round(new.quantity * new.unit_cost, 2);
  elsif new.unit_cost is not null and new.amount = 0 then
    new.amount := round(new.quantity * new.unit_cost, 2);
  end if;
  return new;
end;
$$;

create trigger cost_entries_price
  before insert or update of product_id, quantity, unit_cost, amount, cost_on on public.cost_entries
  for each row execute function private.cost_entry_price();

-- ---------------------------------------------------------------------------
-- Feed logs (Grooms record feed given; extras outside the flat rate become costs)
-- ---------------------------------------------------------------------------

create table public.feed_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  product_id uuid not null,
  fed_on date not null default current_date,
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (product_id, business_id) references public.products (id, business_id)
);

create index feed_logs_horse_idx on public.feed_logs (horse_id, fed_on);

call private.tenant_table('feed_logs', '{manager,groom}', '{manager,groom}', '{manager}');

create or replace function private.feed_log_cost_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prod record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.cost_entries where source = 'feed_log' and source_id = old.id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select p.category_id, p.included_in_feed_rate, p.name into prod
    from public.products p
    where p.id = new.product_id;

    if not prod.included_in_feed_rate then
      insert into public.cost_entries (
        business_id, horse_id, category_id, product_id, cost_on, description,
        quantity, source, source_id, created_by
      )
      values (
        new.business_id, new.horse_id, prod.category_id, new.product_id, new.fed_on, prod.name,
        new.quantity, 'feed_log', new.id, new.created_by
      );
    end if;
    return new;
  end if;

  return old;
end;
$$;

create trigger feed_logs_cost_sync
  after insert or update or delete on public.feed_logs
  for each row execute function private.feed_log_cost_sync();

-- ---------------------------------------------------------------------------
-- Flat feed rates per day (by purpose, or for all horses when purpose is empty)
-- ---------------------------------------------------------------------------

create table public.feed_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  purpose public.horse_purpose,
  daily_rate numeric(12,2) not null check (daily_rate >= 0),
  effective_from date not null default current_date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index feed_rates_once_by_purpose on public.feed_rates (business_id, purpose, effective_from)
  where purpose is not null;
create unique index feed_rates_once_all on public.feed_rates (business_id, effective_from)
  where purpose is null;

call private.tenant_table('feed_rates', '{manager}', '{manager}', '{manager}');

-- ---------------------------------------------------------------------------
-- Shared cost pools and their split
-- ---------------------------------------------------------------------------

create table public.shared_cost_pools (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  month date not null check (extract(day from month) = 1),
  amount numeric(12,2) not null check (amount >= 0),
  locked boolean not null default false,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create index shared_cost_pools_month_idx on public.shared_cost_pools (business_id, month);

call private.tenant_table('shared_cost_pools', '{manager}', '{manager}', '{manager}');

create table public.shared_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  pool_id uuid not null,
  horse_id uuid not null,
  month date not null,
  days_present integer not null check (days_present > 0),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, horse_id),
  foreign key (pool_id, business_id) references public.shared_cost_pools (id, business_id) on delete cascade,
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

create index shared_cost_allocations_horse_idx on public.shared_cost_allocations (horse_id, month);

-- Written only by run_month_allocation.
call private.tenant_table('shared_cost_allocations', '{manager}', '{}', '{}');

-- ---------------------------------------------------------------------------
-- Horse sales (own horses, and sales on behalf of a client for commission)
-- ---------------------------------------------------------------------------

create table public.horse_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  sold_on date not null default current_date,
  buyer_owner_id uuid,
  buyer_name text,
  sale_price numeric(12,2) not null check (sale_price >= 0),
  on_behalf_of_client boolean not null default false,
  commission_percent numeric(5,2) check (commission_percent >= 0 and commission_percent <= 100),
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  check (not on_behalf_of_client or commission_percent is not null),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (buyer_owner_id, business_id) references public.owners (id, business_id)
);

call private.tenant_table('horse_sales', '{manager}', '{manager}', '{manager}');

-- ---------------------------------------------------------------------------
-- Monthly run: flat feed cost per horse and the equal per-horse-per-day split
-- of every unlocked shared cost pool. Safe to re-run; locked pools are kept.
-- ---------------------------------------------------------------------------

create or replace function public.run_month_allocation(bid uuid, for_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_start date := date_trunc('month', for_month)::date;
  m_end date := (date_trunc('month', for_month) + interval '1 month - 1 day')::date;
  feed_cat uuid;
  pool record;
  total_days integer;
  pools_done integer := 0;
  feed_rows integer := 0;
begin
  if not private.is_manager(bid) then
    raise exception 'Only a Manager can run the monthly split' using errcode = '42501';
  end if;

  select c.id into feed_cat
  from public.cost_categories c
  where c.business_id = bid and c.code = 'feed';

  drop table if exists pg_temp.horse_days;
  create temporary table horse_days on commit drop as
  select
    s.horse_id,
    d::date as day,
    coalesce(
      (select ph.purpose
       from public.horse_purpose_history ph
       where ph.horse_id = s.horse_id
         and ph.started_on <= d::date
         and (ph.ended_on is null or ph.ended_on > d::date)
       order by ph.started_on desc
       limit 1),
      h.current_purpose
    ) as purpose
  from public.horse_stays s
  join public.horses h on h.id = s.horse_id
  cross join lateral generate_series(
    greatest(s.arrived_on, m_start),
    least(coalesce(s.departed_on, m_end), m_end),
    interval '1 day'
  ) as d
  where s.business_id = bid
    and s.arrived_on <= m_end
    and (s.departed_on is null or s.departed_on >= m_start);

  -- Flat feed cost per horse for the month.
  delete from public.cost_entries
  where business_id = bid and source = 'feed_rate' and cost_on = m_start;

  if feed_cat is not null then
    insert into public.cost_entries (
      business_id, horse_id, category_id, cost_on, description, quantity, unit_cost, amount, source
    )
    select
      bid,
      hd.horse_id,
      feed_cat,
      m_start,
      'Flat feed rate ' || to_char(m_start, 'Mon YYYY'),
      count(*),
      round(sum(r.daily_rate) / count(*), 4),
      round(sum(r.daily_rate), 2),
      'feed_rate'
    from pg_temp.horse_days hd
    cross join lateral (
      select fr.daily_rate
      from public.feed_rates fr
      where fr.business_id = bid
        and fr.effective_from <= hd.day
        and (fr.purpose = hd.purpose or fr.purpose is null)
      order by (fr.purpose is null), fr.effective_from desc
      limit 1
    ) r
    group by hd.horse_id
    having sum(r.daily_rate) > 0;
    get diagnostics feed_rows = row_count;
  end if;

  -- Equal split of each unlocked pool over horse-days present.
  select count(*) into total_days from pg_temp.horse_days;

  for pool in
    select p.id, p.amount
    from public.shared_cost_pools p
    where p.business_id = bid and p.month = m_start and not p.locked
  loop
    delete from public.shared_cost_allocations where pool_id = pool.id;

    if total_days > 0 then
      insert into public.shared_cost_allocations (business_id, pool_id, horse_id, month, days_present, amount)
      select bid, pool.id, hd.horse_id, m_start, count(*),
             round(pool.amount * count(*) / total_days, 2)
      from pg_temp.horse_days hd
      group by hd.horse_id;

      -- Put any rounding cent difference on the horse with the most days.
      update public.shared_cost_allocations a
        set amount = a.amount + (pool.amount - (select sum(x.amount) from public.shared_cost_allocations x where x.pool_id = pool.id))
        where a.id = (
          select y.id from public.shared_cost_allocations y
          where y.pool_id = pool.id
          order by y.days_present desc, y.horse_id
          limit 1
        );
    end if;

    pools_done := pools_done + 1;
  end loop;

  return jsonb_build_object(
    'month', m_start,
    'horse_days', total_days,
    'pools_split', pools_done,
    'horses_with_feed_cost', feed_rows
  );
end;
$$;

revoke execute on function public.run_month_allocation(uuid, date) from public, anon;
grant execute on function public.run_month_allocation(uuid, date) to authenticated;
grant execute on function private.product_dose_cost(uuid, date) to authenticated;
