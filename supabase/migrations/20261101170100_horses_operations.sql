-- Stalwise operations: horses and their history, stalls and waiting list,
-- training, health and daily tasks, breeding.
-- Child rows use composite foreign keys (id, business_id) so a record can never
-- point at another business's horse, owner or stall.

create type public.horse_sex as enum ('mare', 'stallion', 'gelding', 'colt', 'filly', 'rig');
create type public.horse_purpose as enum ('broodstock', 'trading', 'training');

-- ---------------------------------------------------------------------------
-- Horses
-- ---------------------------------------------------------------------------

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  stock_number text,
  breed text,
  colour text,
  sex public.horse_sex,
  date_of_birth date,
  passport_number text,
  microchipped boolean not null default false,
  microchip_number text,
  previous_owner text,
  entry_date date not null default current_date,
  current_purpose public.horse_purpose not null default 'training',
  current_owner_id uuid,
  sire_id uuid,
  dam_id uuid,
  sire_name text,
  dam_name text,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, stock_number),
  foreign key (current_owner_id, business_id) references public.owners (id, business_id),
  foreign key (sire_id, business_id) references public.horses (id, business_id),
  foreign key (dam_id, business_id) references public.horses (id, business_id)
);

call private.tenant_table('horses', '{manager,trainer,groom,casual}', '{manager}', '{}');

create table public.horse_purpose_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  purpose public.horse_purpose not null,
  started_on date not null default current_date,
  ended_on date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

call private.tenant_table('horse_purpose_history', '{manager,trainer,groom,casual}', '{manager}', '{manager}');

create table public.horse_ownership (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  owner_id uuid not null,
  started_on date not null default current_date,
  ended_on date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (owner_id, business_id) references public.owners (id, business_id)
);

call private.tenant_table('horse_ownership', '{manager}', '{manager}', '{manager}');

create table public.horse_stays (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  arrived_on date not null,
  departed_on date,
  note text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departed_on is null or departed_on >= arrived_on),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

create unique index horse_stays_one_open on public.horse_stays (horse_id) where departed_on is null;

call private.tenant_table('horse_stays', '{manager,trainer,groom,casual}', '{manager}', '{manager}');

create table public.horse_valuations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  amount numeric(12,2) not null check (amount >= 0),
  valued_on date not null default current_date,
  note text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

call private.tenant_table('horse_valuations', '{manager}', '{manager}', '{manager}');

create table public.horse_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  storage_path text not null,
  caption text,
  taken_on date not null default current_date,
  is_main boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

create unique index horse_photos_one_main on public.horse_photos (horse_id) where is_main;

-- Manager and Trainer add photos; only the Manager edits, deletes or sets the main photo.
call private.tenant_table('horse_photos', '{manager,trainer,groom,casual}', '{manager,trainer}', '{manager}');
drop policy horse_photos_update on public.horse_photos;
create policy horse_photos_update on public.horse_photos
  for update to authenticated
  using ((select private.is_manager(business_id)))
  with check ((select private.is_manager(business_id)));

create or replace function private.horse_photo_main_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_main and not private.is_manager(new.business_id) then
    new.is_main := false;
  end if;
  return new;
end;
$$;

create trigger horse_photos_main_guard
  before insert on public.horse_photos
  for each row execute function private.horse_photo_main_guard();

-- ---------------------------------------------------------------------------
-- Horse rules and automatic history
-- ---------------------------------------------------------------------------

-- Client horses are always Training; only the business's own horses can be
-- Broodstock or Trading.
create or replace function private.horse_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_is_self boolean;
begin
  if new.current_owner_id is not null then
    select o.is_self into owner_is_self
    from public.owners o
    where o.id = new.current_owner_id;

    if owner_is_self is false and new.current_purpose <> 'training' then
      raise exception 'Client horses must have purpose Training'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger horses_rules
  before insert or update of current_owner_id, current_purpose on public.horses
  for each row execute function private.horse_rules();

create or replace function private.horse_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.horse_purpose_history (business_id, horse_id, purpose, started_on)
    values (new.business_id, new.id, new.current_purpose, new.entry_date);

    if new.current_owner_id is not null then
      insert into public.horse_ownership (business_id, horse_id, owner_id, started_on)
      values (new.business_id, new.id, new.current_owner_id, new.entry_date);
    end if;

    insert into public.horse_stays (business_id, horse_id, arrived_on)
    values (new.business_id, new.id, new.entry_date);
    return new;
  end if;

  if new.current_purpose is distinct from old.current_purpose then
    update public.horse_purpose_history
      set ended_on = greatest(started_on, current_date)
      where horse_id = new.id and ended_on is null;
    insert into public.horse_purpose_history (business_id, horse_id, purpose, started_on)
    values (new.business_id, new.id, new.current_purpose, current_date);
  end if;

  if new.current_owner_id is distinct from old.current_owner_id then
    update public.horse_ownership
      set ended_on = greatest(started_on, current_date)
      where horse_id = new.id and ended_on is null;
    if new.current_owner_id is not null then
      insert into public.horse_ownership (business_id, horse_id, owner_id, started_on)
      values (new.business_id, new.id, new.current_owner_id, current_date);
    end if;
  end if;

  return new;
end;
$$;

create trigger horses_history
  after insert or update of current_purpose, current_owner_id on public.horses
  for each row execute function private.horse_history();

-- ---------------------------------------------------------------------------
-- Stalls and waiting list
-- ---------------------------------------------------------------------------

create table public.stalls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'training_stall' check (kind in ('training_stall', 'camp')),
  capacity integer not null default 1 check (capacity > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

call private.tenant_table('stalls', '{manager,trainer}', '{manager}', '{manager}');

create table public.stall_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  stall_id uuid not null,
  horse_id uuid not null,
  started_on date not null default current_date,
  ended_on date,
  expected_end_on date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on),
  foreign key (stall_id, business_id) references public.stalls (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

create unique index stall_assignments_one_open_per_horse
  on public.stall_assignments (horse_id) where ended_on is null;

call private.tenant_table('stall_assignments', '{manager,trainer}', '{manager}', '{manager}');

create or replace function private.stall_capacity_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap integer;
  in_use integer;
begin
  if new.ended_on is not null then
    return new;
  end if;

  select s.capacity into cap from public.stalls s where s.id = new.stall_id for update;

  select count(*) into in_use
  from public.stall_assignments a
  where a.stall_id = new.stall_id
    and a.ended_on is null
    and a.id <> new.id;

  if in_use >= cap then
    raise exception 'Stall is full' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger stall_assignments_capacity
  before insert or update of stall_id, ended_on on public.stall_assignments
  for each row execute function private.stall_capacity_guard();

create table public.waiting_list (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_id uuid,
  contact_name text not null check (length(btrim(contact_name)) > 0),
  horse_description text,
  horse_count integer not null default 1 check (horse_count > 0),
  requested_on date not null default current_date,
  priority integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'placed', 'withdrawn')),
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, business_id) references public.owners (id, business_id)
);

call private.tenant_table('waiting_list', '{manager,trainer}', '{manager}', '{manager}');

-- ---------------------------------------------------------------------------
-- Training
-- ---------------------------------------------------------------------------

create table public.training_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  trainer_id uuid references auth.users (id) on delete set null default auth.uid(),
  planned_on date not null,
  session_type text not null,
  duration_minutes integer check (duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

call private.tenant_table('training_schedules', '{manager,trainer}', '{manager,trainer}', '{manager,trainer}');

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  schedule_id uuid,
  trainer_id uuid references auth.users (id) on delete set null default auth.uid(),
  session_on date not null default current_date,
  session_type text not null,
  duration_minutes integer check (duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (schedule_id, business_id) references public.training_schedules (id, business_id) on delete set null (schedule_id)
);

call private.tenant_table('training_sessions', '{manager,trainer}', '{manager,trainer}', '{manager,trainer}');

create table public.progress_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  week_starting date not null,
  note text not null,
  milestone text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

call private.tenant_table('progress_notes', '{manager,trainer}', '{manager,trainer}', '{manager,trainer}');

create table public.show_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  show_name text not null,
  show_on date not null,
  class_name text,
  rider text,
  finish_position integer check (finish_position > 0),
  result text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

call private.tenant_table('show_entries', '{manager,trainer}', '{manager,trainer}', '{manager,trainer}');

-- ---------------------------------------------------------------------------
-- Health reminders, care done, daily tasks
-- ---------------------------------------------------------------------------

create table public.care_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  care_type text not null check (care_type in ('deworming', 'farrier', 'dentist', 'vaccination', 'other')),
  description text,
  interval_days integer not null check (interval_days > 0),
  next_due_on date not null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

create index care_schedules_due_idx on public.care_schedules (business_id, next_due_on) where active;

call private.tenant_table('care_schedules', '{manager,trainer,groom,casual}', '{manager}', '{manager}');

create table public.care_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid not null,
  care_schedule_id uuid,
  care_type text not null check (care_type in ('deworming', 'farrier', 'dentist', 'vaccination', 'other')),
  done_on date not null default current_date,
  done_by uuid references auth.users (id) on delete set null default auth.uid(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (care_schedule_id, business_id) references public.care_schedules (id, business_id) on delete set null (care_schedule_id)
);

call private.tenant_table('care_events', '{manager,trainer,groom,casual}', '{manager,trainer}', '{manager}');

-- Logging care against a schedule moves its next due date forward.
create or replace function private.care_event_advance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.care_schedule_id is not null then
    update public.care_schedules s
      set next_due_on = greatest(s.next_due_on, new.done_on + s.interval_days)
      where s.id = new.care_schedule_id;
  end if;
  return new;
end;
$$;

create trigger care_events_advance
  after insert on public.care_events
  for each row execute function private.care_event_advance();

create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  horse_id uuid,
  task_on date not null default current_date,
  task_type text not null default 'other' check (task_type in ('feeding', 'turnout', 'treatment', 'other')),
  title text not null check (length(btrim(title)) > 0),
  assigned_to uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete cascade
);

create index daily_tasks_day_idx on public.daily_tasks (business_id, task_on);

call private.tenant_table('daily_tasks', '{manager,trainer,groom,casual}', '{manager,trainer}', '{manager,trainer}');

-- Everyone may tick tasks off; Grooms and Casuals may change nothing else.
drop policy daily_tasks_update on public.daily_tasks;
create policy daily_tasks_update on public.daily_tasks
  for update to authenticated
  using ((select private.is_member(business_id)))
  with check ((select private.is_member(business_id)));

create or replace function private.daily_task_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.has_role(new.business_id, array['groom', 'casual']::public.member_role[]) then
    if (new.business_id, new.horse_id, new.task_on, new.task_type, new.title, new.assigned_to, new.created_by)
       is distinct from
       (old.business_id, old.horse_id, old.task_on, old.task_type, old.title, old.assigned_to, old.created_by) then
      raise exception 'Only ticking off a task is allowed' using errcode = '42501';
    end if;
  end if;

  if new.done_at is not null and old.done_at is null then
    new.done_by := coalesce(new.done_by, auth.uid());
  elsif new.done_at is null then
    new.done_by := null;
  end if;
  return new;
end;
$$;

create trigger daily_tasks_guard
  before update on public.daily_tasks
  for each row execute function private.daily_task_guard();

-- ---------------------------------------------------------------------------
-- Breeding
-- ---------------------------------------------------------------------------

create table public.breeding_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  mare_id uuid not null,
  stallion_id uuid,
  stallion_name text,
  method text not null check (method in ('natural', 'ai_fresh', 'ai_chilled', 'ai_frozen', 'embryo_transfer')),
  bred_on date not null,
  semen_details text,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  check (stallion_id is not null or stallion_name is not null),
  foreign key (mare_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (stallion_id, business_id) references public.horses (id, business_id)
);

call private.tenant_table('breeding_events', '{manager,trainer}', '{manager}', '{manager}');

create table public.pregnancy_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  breeding_event_id uuid not null,
  checked_on date not null,
  result text not null check (result in ('in_foal', 'not_in_foal', 'twins', 'lost', 'unsure')),
  expected_foaling_on date,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (breeding_event_id, business_id) references public.breeding_events (id, business_id) on delete cascade
);

call private.tenant_table('pregnancy_checks', '{manager,trainer}', '{manager}', '{manager}');

create table public.foalings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  breeding_event_id uuid,
  mare_id uuid not null,
  foal_id uuid,
  foaled_on date not null,
  outcome text not null default 'live' check (outcome in ('live', 'stillborn', 'died')),
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (breeding_event_id, business_id) references public.breeding_events (id, business_id) on delete set null (breeding_event_id),
  foreign key (mare_id, business_id) references public.horses (id, business_id) on delete cascade,
  foreign key (foal_id, business_id) references public.horses (id, business_id) on delete set null (foal_id)
);

call private.tenant_table('foalings', '{manager,trainer}', '{manager}', '{manager}');
