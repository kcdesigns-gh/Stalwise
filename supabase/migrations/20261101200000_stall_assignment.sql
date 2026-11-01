-- Putting horses in stalls, moving them and taking them out. Manager only.
-- Both functions do their whole job in one step, so a failed move (for example
-- a full stall) never leaves a horse without a stall.
-- "Today" follows the business's own time zone.

create or replace function public.assign_horse_to_stall(horse uuid, stall uuid, expected_end date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  s record;
  today date;
begin
  select x.id, x.business_id into h from public.horses x where x.id = horse;
  if h.id is null then
    raise exception 'Horse not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(h.business_id) then
    raise exception 'Only a Manager can assign stalls' using errcode = '42501';
  end if;

  select st.id, st.business_id, st.active into s from public.stalls st where st.id = stall;
  if s.id is null or s.business_id <> h.business_id then
    raise exception 'Stall not found' using errcode = 'P0002';
  end if;
  if not s.active then
    raise exception 'That stall is not in use' using errcode = '23514';
  end if;

  select (now() at time zone b.timezone)::date into today
  from public.businesses b where b.id = h.business_id;

  if expected_end is not null and expected_end < today then
    raise exception 'The leaving date cannot be in the past' using errcode = '23514';
  end if;

  -- Already in this stall: only the leaving date changes.
  if exists (
    select 1 from public.stall_assignments a
    where a.horse_id = horse and a.stall_id = stall and a.ended_on is null
  ) then
    update public.stall_assignments a
      set expected_end_on = expected_end
      where a.horse_id = horse and a.stall_id = stall and a.ended_on is null;
    return;
  end if;

  -- Leave the old stall (if any), then join the new one. A full stall raises
  -- "Stall is full" and the whole move is undone.
  update public.stall_assignments a
    set ended_on = greatest(a.started_on, today)
    where a.horse_id = horse and a.ended_on is null;

  insert into public.stall_assignments (business_id, stall_id, horse_id, started_on, expected_end_on)
  values (h.business_id, stall, horse, today, expected_end);
end;
$$;

create or replace function public.remove_horse_from_stall(horse uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  today date;
begin
  select x.id, x.business_id into h from public.horses x where x.id = horse;
  if h.id is null then
    raise exception 'Horse not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(h.business_id) then
    raise exception 'Only a Manager can take a horse out of a stall' using errcode = '42501';
  end if;

  select (now() at time zone b.timezone)::date into today
  from public.businesses b where b.id = h.business_id;

  update public.stall_assignments a
    set ended_on = greatest(a.started_on, today)
    where a.horse_id = horse and a.ended_on is null;
end;
$$;

revoke execute on function public.assign_horse_to_stall(uuid, uuid, date) from public, anon;
revoke execute on function public.remove_horse_from_stall(uuid) from public, anon;
grant execute on function public.assign_horse_to_stall(uuid, uuid, date) to authenticated;
grant execute on function public.remove_horse_from_stall(uuid) to authenticated;
