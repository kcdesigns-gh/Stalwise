-- A horse can be sold once. Before this, a double tap or a retry could record
-- two sales and count the income twice.

create unique index if not exists horse_sales_one_per_horse on public.horse_sales (horse_id);

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
  select x.id, x.business_id, x.archived_at into h from public.horses x where x.id = horse for update;
  if h.id is null then
    raise exception 'Horse not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(h.business_id) then
    raise exception 'Only a Manager can record a sale' using errcode = '42501';
  end if;
  if exists (select 1 from public.horse_sales s where s.horse_id = horse) then
    raise exception 'This horse has already been sold' using errcode = '23505';
  end if;
  if h.archived_at is not null then
    raise exception 'This horse has been archived and cannot be sold' using errcode = '23514';
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
