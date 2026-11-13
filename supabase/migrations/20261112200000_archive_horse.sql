-- Archiving a horse that has left (not sold): ends its stay so the daily feed
-- rate and the monthly shared-cost split stop counting it, frees its stall and
-- archives it. Before this, the app only set archived_at, the stay stayed open
-- and the horse kept gathering costs every day.
-- Manager only; one step so a failure leaves nothing half-done.

create or replace function public.archive_horse(horse uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  today date;
begin
  select x.id, x.business_id, x.archived_at into h from public.horses x where x.id = horse;
  if h.id is null then
    raise exception 'Horse not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(h.business_id) then
    raise exception 'Only a Manager can archive a horse' using errcode = '42501';
  end if;

  select (now() at time zone b.timezone)::date into today
  from public.businesses b where b.id = h.business_id;

  update public.horse_stays s
    set departed_on = greatest(s.arrived_on, today)
    where s.horse_id = horse and s.departed_on is null;

  update public.stall_assignments a
    set ended_on = greatest(a.started_on, today)
    where a.horse_id = horse and a.ended_on is null;

  if h.archived_at is null then
    update public.horses set archived_at = now() where id = horse;
  end if;
end;
$$;

revoke execute on function public.archive_horse(uuid) from public, anon;
grant execute on function public.archive_horse(uuid) to authenticated;

-- Safety net for horses archived the old way: close any stay still open.
update public.horse_stays s
  set departed_on = greatest(s.arrived_on, (h.archived_at at time zone b.timezone)::date)
  from public.horses h
  join public.businesses b on b.id = h.business_id
  where s.horse_id = h.id
    and s.departed_on is null
    and h.archived_at is not null;
