-- 1. "Today" follows the business's own time zone. Invoice dates and the
--    purpose/owner history used the server's date (UTC), so a US barn issuing an
--    invoice in the evening got tomorrow's date, sometimes in the next month.
-- 2. Correcting a horse's entry date now moves the start of its stay, its first
--    purpose and owner record and its purchase cost with it. Before, feed days
--    kept counting from the old date.

create or replace function private.invoice_numbering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz record;
begin
  if tg_op = 'INSERT' then
    select b.currency_code into new.currency_code from public.businesses b where b.id = new.business_id;
  end if;

  if new.status <> 'draft' and new.invoice_number is null then
    select b.invoice_prefix, b.next_invoice_number, b.payment_terms_days,
           (now() at time zone b.timezone)::date as today
      into biz
    from public.businesses b
    where b.id = new.business_id
    for update;

    new.invoice_number := biz.invoice_prefix || lpad(biz.next_invoice_number::text, 4, '0');
    new.issued_on := coalesce(new.issued_on, biz.today);
    new.due_on := coalesce(new.due_on, new.issued_on + biz.payment_terms_days);

    update public.businesses
      set next_invoice_number = next_invoice_number + 1
      where id = new.business_id;
  end if;

  if tg_op = 'UPDATE' and old.invoice_number is not null
     and new.invoice_number is distinct from old.invoice_number then
    raise exception 'An invoice number cannot be changed once issued' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.horse_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date;
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

  select (now() at time zone b.timezone)::date into today
  from public.businesses b where b.id = new.business_id;
  today := coalesce(today, current_date);

  -- A corrected entry date moves the records that started on the old one.
  if new.entry_date is distinct from old.entry_date then
    if exists (
      select 1 from public.horse_stays s
      where s.horse_id = new.id and s.arrived_on = old.entry_date
        and s.departed_on is not null and s.departed_on < new.entry_date
    ) then
      raise exception 'The entry date cannot be after the date the horse left' using errcode = '23514';
    end if;

    update public.horse_stays s
      set arrived_on = new.entry_date
      where s.horse_id = new.id and s.arrived_on = old.entry_date;

    update public.horse_purpose_history p
      set started_on = new.entry_date
      where p.horse_id = new.id and p.started_on = old.entry_date
        and (p.ended_on is null or p.ended_on >= new.entry_date);

    update public.horse_ownership o
      set started_on = new.entry_date
      where o.horse_id = new.id and o.started_on = old.entry_date
        and (o.ended_on is null or o.ended_on >= new.entry_date);

    update public.cost_entries c
      set cost_on = new.entry_date
      where c.source = 'purchase' and c.source_id = new.id and c.cost_on = old.entry_date;
  end if;

  if new.current_purpose is distinct from old.current_purpose then
    update public.horse_purpose_history
      set ended_on = greatest(started_on, today)
      where horse_id = new.id and ended_on is null;
    insert into public.horse_purpose_history (business_id, horse_id, purpose, started_on)
    values (new.business_id, new.id, new.current_purpose, today);
  end if;

  if new.current_owner_id is distinct from old.current_owner_id then
    update public.horse_ownership
      set ended_on = greatest(started_on, today)
      where horse_id = new.id and ended_on is null;
    if new.current_owner_id is not null then
      insert into public.horse_ownership (business_id, horse_id, owner_id, started_on)
      values (new.business_id, new.id, new.current_owner_id, today);
    end if;
  end if;

  return new;
end;
$$;

-- The history trigger only fired when the purpose or owner changed. It must
-- also fire when the entry date is corrected.
create or replace trigger horses_history
  after insert or update of current_purpose, current_owner_id, entry_date on public.horses
  for each row execute function private.horse_history();
