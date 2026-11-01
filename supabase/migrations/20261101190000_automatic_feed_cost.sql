-- Automatic daily feed cost.
-- Every horse is charged the business's daily feed rate for every day it is on
-- the yard (stay arrival to departure, or to today while still here). The cost is
-- worked out live whenever profit is read, so there is nothing to log or run, and
-- it stays correct when a rate changes, a stay is edited or a horse leaves.
--   * Days before the first rate's start date are not charged.
--   * A rate with a purpose applies to horses of that purpose; a rate with no
--     purpose applies to all horses. A purpose rate wins over the general one.
--   * "Today" follows the business's own time zone.

create or replace function private.horse_feed(hid uuid)
returns table (feed_days integer, feed_cost numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with biz as (
    select
      h.id,
      h.business_id,
      h.current_purpose,
      (now() at time zone b.timezone)::date as today
    from public.horses h
    join public.businesses b on b.id = h.business_id
    where h.id = hid
  ),
  days as (
    select
      d::date as day,
      biz.business_id,
      coalesce(
        (select ph.purpose
         from public.horse_purpose_history ph
         where ph.horse_id = biz.id
           and ph.started_on <= d::date
           and (ph.ended_on is null or ph.ended_on > d::date)
         order by ph.started_on desc
         limit 1),
        biz.current_purpose
      ) as purpose
    from biz
    join public.horse_stays s on s.horse_id = biz.id
    cross join lateral generate_series(
      s.arrived_on,
      least(coalesce(s.departed_on, biz.today), biz.today),
      interval '1 day'
    ) as d
  )
  select
    count(r.daily_rate)::integer,
    coalesce(sum(r.daily_rate), 0)::numeric
  from days
  left join lateral (
    select fr.daily_rate
    from public.feed_rates fr
    where fr.business_id = days.business_id
      and fr.effective_from <= days.day
      and (fr.purpose = days.purpose or fr.purpose is null)
    order by (fr.purpose is null), fr.effective_from desc
    limit 1
  ) r on true;
$$;

grant execute on function private.horse_feed(uuid) to authenticated;

-- Profit now includes the automatic feed cost. New columns go at the end.
create or replace view public.horse_profitability
with (security_invoker = true)
as
select
  h.id as horse_id,
  h.business_id,
  coalesce(ce.direct_costs, 0) as direct_costs,
  coalesce(sa.shared_costs, 0) as shared_costs,
  coalesce(ce.direct_costs, 0) + coalesce(fd.feed_cost, 0) + coalesce(sa.shared_costs, 0) as total_cost,
  coalesce(inc.invoiced_income, 0) as invoiced_income,
  coalesce(sl.sale_income, 0) as sale_income,
  coalesce(inc.invoiced_income, 0) + coalesce(sl.sale_income, 0) as total_income,
  coalesce(inc.invoiced_income, 0) + coalesce(sl.sale_income, 0)
    - coalesce(ce.direct_costs, 0) - coalesce(fd.feed_cost, 0) - coalesce(sa.shared_costs, 0) as profit,
  v.amount as latest_valuation,
  v.valued_on as latest_valuation_on,
  coalesce(fd.feed_cost, 0) as feed_costs,
  coalesce(fd.feed_days, 0) as feed_days
from public.horses h
left join lateral (
  select sum(c.amount) as direct_costs
  from public.cost_entries c
  where c.horse_id = h.id
    and c.source <> 'feed_rate'
) ce on true
left join lateral (
  select f.feed_days, f.feed_cost from private.horse_feed(h.id) f
) fd on true
left join lateral (
  select sum(a.amount) as shared_costs from public.shared_cost_allocations a where a.horse_id = h.id
) sa on true
left join lateral (
  select sum(round(il.quantity * il.unit_price, 2)) as invoiced_income
  from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where il.horse_id = h.id
    and i.status in ('sent', 'part_paid', 'paid')
    and il.line_kind not in ('sale', 'commission', 'deposit')
) inc on true
left join lateral (
  select sum(case when s.on_behalf_of_client
                  then round(s.sale_price * s.commission_percent / 100, 2)
                  else s.sale_price end) as sale_income
  from public.horse_sales s
  where s.horse_id = h.id
) sl on true
left join lateral (
  select hv.amount, hv.valued_on
  from public.horse_valuations hv
  where hv.horse_id = h.id
  order by hv.valued_on desc, hv.created_at desc
  limit 1
) v on true
where (select private.is_manager(h.business_id));

-- The monthly run now only splits shared costs (feed is automatic).
create or replace function public.run_month_allocation(bid uuid, for_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_start date := date_trunc('month', for_month)::date;
  m_end date := (date_trunc('month', for_month) + interval '1 month - 1 day')::date;
  pool record;
  total_days integer;
  pools_done integer := 0;
begin
  if not private.is_manager(bid) then
    raise exception 'Only a Manager can run the monthly split' using errcode = '42501';
  end if;

  drop table if exists pg_temp.horse_days;
  create temporary table horse_days on commit drop as
  select
    s.horse_id,
    d::date as day
  from public.horse_stays s
  cross join lateral generate_series(
    greatest(s.arrived_on, m_start),
    least(coalesce(s.departed_on, m_end), m_end),
    interval '1 day'
  ) as d
  where s.business_id = bid
    and s.arrived_on <= m_end
    and (s.departed_on is null or s.departed_on >= m_start);

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

  return jsonb_build_object('month', m_start, 'horse_days', total_days, 'pools_split', pools_done);
end;
$$;

-- Sets the business-wide daily feed rate from a given date. Manager only.
-- Changing it later adds a new rate from the new date, so earlier days keep the
-- rate they had. Calling it again for the same date replaces that day's rate.
create or replace function public.set_daily_feed_rate(bid uuid, rate numeric, from_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_manager(bid) then
    raise exception 'Only a Manager can set the feed rate' using errcode = '42501';
  end if;
  if rate is null or rate < 0 then
    raise exception 'The daily feed rate cannot be negative' using errcode = '23514';
  end if;
  if from_date is null then
    raise exception 'Choose the date the rate starts' using errcode = '22004';
  end if;

  delete from public.feed_rates
  where business_id = bid and purpose is null and effective_from = from_date;

  insert into public.feed_rates (business_id, purpose, daily_rate, effective_from)
  values (bid, null, round(rate, 2), from_date);
end;
$$;

revoke execute on function public.set_daily_feed_rate(uuid, numeric, date) from public, anon;
grant execute on function public.set_daily_feed_rate(uuid, numeric, date) to authenticated;
