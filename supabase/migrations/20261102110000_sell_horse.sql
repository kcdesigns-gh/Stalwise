-- Selling a horse: records the sale (with commission if sold for a client),
-- ends its stay and stall assignment on the sale date, and archives it.
-- Manager only; the whole thing happens in one step so a failure leaves nothing half-done.

create or replace function public.sell_horse(
  horse uuid,
  sold_on date,
  sale_price numeric,
  buyer_owner_id uuid default null,
  buyer_name text default null,
  on_behalf_of_client boolean default false,
  commission_percent numeric default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  new_id uuid;
begin
  select x.id, x.business_id into h from public.horses x where x.id = horse;
  if h.id is null then
    raise exception 'Horse not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(h.business_id) then
    raise exception 'Only a Manager can record a sale' using errcode = '42501';
  end if;
  if sale_price < 0 then
    raise exception 'The sale price cannot be negative' using errcode = '23514';
  end if;
  if on_behalf_of_client and commission_percent is null then
    raise exception 'Enter the commission percentage for a sale on a client''s behalf' using errcode = '23514';
  end if;

  insert into public.horse_sales (
    business_id, horse_id, sold_on, buyer_owner_id, buyer_name, sale_price,
    on_behalf_of_client, commission_percent, notes
  )
  values (h.business_id, horse, sold_on, buyer_owner_id, nullif(btrim(buyer_name), ''), sale_price,
          on_behalf_of_client, commission_percent, nullif(btrim(notes), ''))
  returning id into new_id;

  update public.horse_stays s
    set departed_on = greatest(s.arrived_on, sold_on)
    where s.horse_id = horse and s.departed_on is null;

  update public.stall_assignments a
    set ended_on = greatest(a.started_on, sold_on)
    where a.horse_id = horse and a.ended_on is null;

  update public.horses set archived_at = now() where id = horse;

  return new_id;
end;
$$;

revoke execute on function public.sell_horse(uuid, date, numeric, uuid, text, boolean, numeric, text) from public, anon;
grant execute on function public.sell_horse(uuid, date, numeric, uuid, text, boolean, numeric, text) to authenticated;
