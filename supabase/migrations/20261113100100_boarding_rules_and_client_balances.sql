-- 1. Client horses may be on Training or Boarding (own horses keep their own
--    purposes). Everything else in horse_rules stays as it was.
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

    if owner_is_self is false and new.current_purpose not in ('training', 'boarding') then
      raise exception 'Client horses must have purpose Training or Boarding'
        using errcode = '23514';
    end if;
    if owner_is_self is true and new.current_purpose = 'boarding' then
      raise exception 'Boarding is for client horses only'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- 2. What each client owes. Drafts and cancelled invoices do not count.
--    Dates use the business's own time zone.
create view public.client_balances
with (security_invoker = true)
as
select
  o.id as owner_id,
  o.business_id,
  coalesce(sum(t.total)   filter (where i.status in ('sent', 'part_paid', 'paid')), 0) as invoiced,
  coalesce(sum(t.paid)    filter (where i.status in ('sent', 'part_paid', 'paid')), 0) as paid,
  coalesce(sum(t.credited) filter (where i.status in ('sent', 'part_paid', 'paid')), 0) as credited,
  coalesce(sum(t.balance) filter (where i.status in ('sent', 'part_paid')), 0) as balance,
  count(*) filter (
    where i.status in ('sent', 'part_paid')
      and t.balance > 0
      and i.due_on is not null
      and i.due_on < (now() at time zone b.timezone)::date
  ) as overdue_invoices
from public.owners o
join public.businesses b on b.id = o.business_id
left join public.invoices i on i.owner_id = o.id
left join public.invoice_totals t on t.invoice_id = i.id
group by o.id, o.business_id, b.timezone;
