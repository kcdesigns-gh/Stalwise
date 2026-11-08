-- Three-way profit/loss for the dashboard and horse profile, from Karel's
-- 6 Nov 2026 brainstorm: the lifetime view on its own makes an unsold horse
-- look like a straight loss (no revenue yet). Three views instead:
--   1) this month    - invoiced revenue minus costs logged this month
--   2) lifetime       - the existing horse_profitability view, unchanged
--   3) projected      - current valuation minus total cost to date (which
--                        already includes the purchase price, stored as a
--                        cost entry) - only meaningful for Kimco's own stock
-- "Own stock" = the horse's current owner is the business's own (is_self)
-- owner row, as opposed to a client owner.

-- ---------------------------------------------------------------------------
-- Bounded version of private.horse_feed: same flat-rate daily feed logic,
-- but only counting days within [start_date, end_date] (inclusive), for the
-- "this month" figure. The lifetime figure keeps using horse_feed as-is.
-- ---------------------------------------------------------------------------
create or replace function private.horse_feed_between(hid uuid, start_date date, end_date date)
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
      least(end_date, (now() at time zone b.timezone)::date) as range_end
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
      greatest(s.arrived_on, start_date),
      least(coalesce(s.departed_on, biz.range_end), biz.range_end),
      interval '1 day'
    ) as d
    where biz.range_end >= start_date
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

grant execute on function private.horse_feed_between(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Lifetime view gains: whose stock it is, and the projected (unrealised)
-- profit if sold today at the latest valuation. New columns go at the end.
-- ---------------------------------------------------------------------------
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
  coalesce(fd.feed_days, 0) as feed_days,
  coalesce(ow.is_self, h.current_owner_id is null) as is_own_stock,
  case when v.amount is not null then
    v.amount - coalesce(ce.direct_costs, 0) - coalesce(fd.feed_cost, 0) - coalesce(sa.shared_costs, 0)
  end as projected_profit
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
left join public.owners ow on ow.id = h.current_owner_id and ow.business_id = h.business_id
where (select private.is_manager(h.business_id));

-- ---------------------------------------------------------------------------
-- This-month view: same shape of calc as the lifetime one, bounded to the
-- current calendar month in the business's own timezone. Revenue counts in
-- the month an invoice is issued (not when it's paid), to match how the
-- invoice itself is dated for VAT purposes.
-- ---------------------------------------------------------------------------
create or replace view public.horse_profitability_month
with (security_invoker = true)
as
select
  h.id as horse_id,
  h.business_id,
  coalesce(ce.direct_costs, 0) + coalesce(fd.feed_cost, 0) + coalesce(sa.shared_costs, 0) as total_cost,
  coalesce(inc.invoiced_income, 0) + coalesce(sl.sale_income, 0) as total_income,
  coalesce(inc.invoiced_income, 0) + coalesce(sl.sale_income, 0)
    - coalesce(ce.direct_costs, 0) - coalesce(fd.feed_cost, 0) - coalesce(sa.shared_costs, 0) as profit
from public.horses h
join public.businesses b on b.id = h.business_id
cross join lateral (
  select
    date_trunc('month', (now() at time zone b.timezone))::date as month_start,
    (date_trunc('month', (now() at time zone b.timezone)) + interval '1 month - 1 day')::date as month_end
) m
left join lateral (
  select sum(c.amount) as direct_costs
  from public.cost_entries c
  where c.horse_id = h.id
    and c.source <> 'feed_rate'
    and c.cost_on between m.month_start and m.month_end
) ce on true
left join lateral (
  select f.feed_days, f.feed_cost from private.horse_feed_between(h.id, m.month_start, m.month_end) f
) fd on true
left join lateral (
  select sum(a.amount) as shared_costs
  from public.shared_cost_allocations a
  where a.horse_id = h.id
    and a.month = m.month_start
) sa on true
left join lateral (
  select sum(round(il.quantity * il.unit_price, 2)) as invoiced_income
  from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where il.horse_id = h.id
    and i.status in ('sent', 'part_paid', 'paid')
    and il.line_kind not in ('sale', 'commission', 'deposit')
    and i.issued_on between m.month_start and m.month_end
) inc on true
left join lateral (
  select sum(case when s.on_behalf_of_client
                  then round(s.sale_price * s.commission_percent / 100, 2)
                  else s.sale_price end) as sale_income
  from public.horse_sales s
  where s.horse_id = h.id
    and s.sold_on between m.month_start and m.month_end
) sl on true
where (select private.is_manager(h.business_id));
