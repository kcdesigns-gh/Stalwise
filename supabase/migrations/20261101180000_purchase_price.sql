-- Cost (purchase) price of a horse.
-- Stored as a normal cost entry (category "Purchase price"), not as a column on
-- horses: the horses table is readable by every role, and money figures must stay
-- Manager-only. Because it is a cost entry, it flows straight into full-cost
-- profitability (a trading horse's profit = sale price - purchase price - running costs).

alter table public.cost_entries drop constraint cost_entries_source_check;
alter table public.cost_entries add constraint cost_entries_source_check
  check (source in ('manual', 'feed_log', 'feed_rate', 'purchase'));

create unique index cost_entries_purchase_once on public.cost_entries (source_id) where source = 'purchase';

-- New businesses get the category automatically.
create or replace function private.seed_cost_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cost_categories (business_id, code, name, sort_order)
  values
    (new.id, 'purchase', 'Purchase price', 5),
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

-- Businesses that already exist get it too.
insert into public.cost_categories (business_id, code, name, sort_order)
select b.id, 'purchase', 'Purchase price', 5
from public.businesses b
on conflict (business_id, code) do nothing;

-- Sets (or changes, or clears) a horse's cost price. Manager only.
-- Safe to call again: it replaces the previous purchase entry. A price of 0 or
-- null removes it (for example a horse bred on the yard).
create or replace function public.set_horse_purchase_price(horse uuid, price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h record;
  cat uuid;
begin
  select x.id, x.business_id, x.entry_date into h
  from public.horses x
  where x.id = horse;

  if h.id is null then
    raise exception 'Horse not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(h.business_id) then
    raise exception 'Only a Manager can set the cost price' using errcode = '42501';
  end if;
  if price is not null and price < 0 then
    raise exception 'The cost price cannot be negative' using errcode = '23514';
  end if;

  delete from public.cost_entries where source = 'purchase' and source_id = horse;

  if price is not null and price > 0 then
    insert into public.cost_categories (business_id, code, name, sort_order)
    values (h.business_id, 'purchase', 'Purchase price', 5)
    on conflict (business_id, code) do nothing;

    select c.id into cat
    from public.cost_categories c
    where c.business_id = h.business_id and c.code = 'purchase';

    insert into public.cost_entries (
      business_id, horse_id, category_id, cost_on, description,
      quantity, unit_cost, amount, source, source_id, created_by
    )
    values (
      h.business_id, h.id, cat, h.entry_date, 'Purchase price',
      1, round(price, 2), round(price, 2), 'purchase', h.id, auth.uid()
    );
  end if;
end;
$$;

revoke execute on function public.set_horse_purchase_price(uuid, numeric) from public, anon;
grant execute on function public.set_horse_purchase_price(uuid, numeric) to authenticated;
