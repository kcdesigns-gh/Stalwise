-- Stalwise core: businesses, people, roles, owners, tenant security helpers.
-- Every tenant table carries business_id; row-level security limits each user
-- to the businesses they are an active member of.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.member_role as enum ('manager', 'trainer', 'groom', 'casual');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Businesses (tenants)
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  logo_path text,
  country_code text not null default 'ZA' check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null default 'ZAR' check (currency_code ~ '^[A-Z]{3}$'),
  locale text not null default 'en-ZA',
  timezone text not null default 'Africa/Johannesburg',
  tax_name text not null default 'VAT',
  default_tax_rate numeric(5,2) not null default 15.00
    check (default_tax_rate >= 0 and default_tax_rate < 100),
  tax_number text,
  registration_number text,
  address text,
  phone text,
  email text,
  bank_details text,
  invoice_prefix text not null default 'INV-',
  credit_note_prefix text not null default 'CN-',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0),
  next_credit_note_number integer not null default 1 check (next_credit_note_number > 0),
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 365),
  setup_completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles (one per login)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Memberships (person <-> business, with role)
-- ---------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers used by every policy (security definer avoids RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function private.my_role(bid uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.business_id = bid
    and m.user_id = auth.uid()
    and m.active
  limit 1;
$$;

create or replace function private.is_member(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.my_role(bid) is not null;
$$;

create or replace function private.has_role(bid uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_role(bid) = any (roles), false);
$$;

create or replace function private.is_manager(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(bid, array['manager']::public.member_role[]);
$$;

-- Standard setup for a tenant table: RLS on, updated_at trigger, business index,
-- and select / insert / update / delete policies for the given roles.
create or replace procedure private.tenant_table(
  tbl text,
  read_roles text,
  write_roles text,
  delete_roles text
)
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format(
    'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
    tbl || '_updated_at', tbl);
  execute format('create index %I on public.%I (business_id)', tbl || '_business_idx', tbl);

  execute format(
    'create policy %I on public.%I for select to authenticated using ((select private.has_role(business_id, %L::public.member_role[])))',
    tbl || '_select', tbl, read_roles);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check ((select private.has_role(business_id, %L::public.member_role[])))',
    tbl || '_insert', tbl, write_roles);
  execute format(
    'create policy %I on public.%I for update to authenticated using ((select private.has_role(business_id, %L::public.member_role[]))) with check ((select private.has_role(business_id, %L::public.member_role[])))',
    tbl || '_update', tbl, write_roles, write_roles);
  execute format(
    'create policy %I on public.%I for delete to authenticated using ((select private.has_role(business_id, %L::public.member_role[])))',
    tbl || '_delete', tbl, delete_roles);
end;
$$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Feature switches
-- ---------------------------------------------------------------------------

create table public.business_features (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  feature text not null check (feature in (
    'breeding', 'training', 'trading', 'health_reminders', 'task_board', 'owner_updates'
  )),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, feature)
);

call private.tenant_table('business_features', '{manager,trainer,groom,casual}', '{manager}', '{}');

-- ---------------------------------------------------------------------------
-- Owners / clients (the business itself is an owner, for its own horses)
-- ---------------------------------------------------------------------------

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  is_self boolean not null default false,
  email text,
  phone text,
  address text,
  tax_number text,
  notes text,
  updates_consent boolean not null default false,
  updates_consent_at timestamptz,
  updates_channel text check (updates_channel in ('whatsapp', 'email')),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create unique index owners_one_self_per_business on public.owners (business_id) where is_self;

-- Owner contact details are personal information (POPIA): managers only.
call private.tenant_table('owners', '{manager}', '{manager}', '{}');

-- ---------------------------------------------------------------------------
-- Row-level security for businesses, profiles, memberships
-- ---------------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create policy businesses_select on public.businesses
  for select to authenticated
  using ((select private.is_member(id)));

create policy businesses_update on public.businesses
  for update to authenticated
  using ((select private.is_manager(id)))
  with check ((select private.is_manager(id)));

-- True when the caller and the other person are active in at least one shared business.
create or replace function private.shares_business(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.business_id = mine.business_id
    where mine.user_id = auth.uid() and mine.active
      and theirs.user_id = other and theirs.active
  );
$$;

grant execute on function private.shares_business(uuid) to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_business(id)));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_manager(business_id)));

-- Managers manage other people's memberships, never their own row
-- (stops a manager locking themselves out by accident).
create policy memberships_insert on public.memberships
  for insert to authenticated
  with check ((select private.is_manager(business_id)) and user_id <> (select auth.uid()));

create policy memberships_update on public.memberships
  for update to authenticated
  using ((select private.is_manager(business_id)) and user_id <> (select auth.uid()))
  with check ((select private.is_manager(business_id)) and user_id <> (select auth.uid()));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using ((select private.is_manager(business_id)) and user_id <> (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Business setup: creates the business, makes the caller its manager,
-- and seeds feature switches and the "self" owner record.
-- ---------------------------------------------------------------------------

create or replace function public.create_business(
  business_name text,
  country_code text default 'ZA',
  currency_code text default 'ZAR',
  tax_name text default 'VAT',
  default_tax_rate numeric default 15.00
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  insert into public.businesses (name, country_code, currency_code, tax_name, default_tax_rate, created_by)
  values (business_name, country_code, currency_code, tax_name, default_tax_rate, uid)
  returning id into new_id;

  insert into public.memberships (business_id, user_id, role)
  values (new_id, uid, 'manager');

  insert into public.business_features (business_id, feature, enabled)
  values
    (new_id, 'breeding', true),
    (new_id, 'training', true),
    (new_id, 'trading', true),
    (new_id, 'health_reminders', true),
    (new_id, 'task_board', true),
    (new_id, 'owner_updates', false);

  insert into public.owners (business_id, name, is_self, created_by)
  values (new_id, business_name, true, uid);

  return new_id;
end;
$$;

revoke execute on function public.create_business(text, text, text, text, numeric) from public, anon;
grant execute on function public.create_business(text, text, text, text, numeric) to authenticated;
