-- Stalwise invoicing, payments, credit notes, recurring charges, owner message log,
-- audit log, photo and logo storage, and the profitability and invoice-total views.
-- All of it is Manager-only.

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_id uuid not null,
  invoice_number text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'part_paid', 'paid', 'cancelled')),
  issued_on date,
  due_on date,
  currency_code text not null default 'ZAR',
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, invoice_number),
  foreign key (owner_id, business_id) references public.owners (id, business_id)
);

create index invoices_owner_idx on public.invoices (owner_id);
create index invoices_status_idx on public.invoices (business_id, status);

call private.tenant_table('invoices', '{manager}', '{manager}', '{manager}');

-- Drafts can be made offline without a number; the server gives the next
-- number, issue date and due date the moment an invoice leaves draft.
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
    select b.invoice_prefix, b.next_invoice_number, b.payment_terms_days into biz
    from public.businesses b
    where b.id = new.business_id
    for update;

    new.invoice_number := biz.invoice_prefix || lpad(biz.next_invoice_number::text, 4, '0');
    new.issued_on := coalesce(new.issued_on, current_date);
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

create trigger invoices_numbering
  before insert or update on public.invoices
  for each row execute function private.invoice_numbering();

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null,
  sort_order integer not null default 0,
  line_kind text not null default 'other'
    check (line_kind in ('training_fee', 'livery', 'sale', 'commission', 'transport', 'extra', 'deposit', 'other')),
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null,
  tax_applies boolean not null default true,
  tax_rate numeric(5,2),
  horse_id uuid,
  cost_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade,
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete set null (horse_id),
  foreign key (cost_entry_id, business_id) references public.cost_entries (id, business_id) on delete set null (cost_entry_id)
);

create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index invoice_lines_horse_idx on public.invoice_lines (horse_id);
create unique index invoice_lines_cost_once on public.invoice_lines (cost_entry_id) where cost_entry_id is not null;

call private.tenant_table('invoice_lines', '{manager}', '{manager}', '{manager}');

create or replace function private.invoice_line_tax_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tax_rate is null then
    select b.default_tax_rate into new.tax_rate from public.businesses b where b.id = new.business_id;
  end if;
  return new;
end;
$$;

create trigger invoice_lines_tax_default
  before insert or update on public.invoice_lines
  for each row execute function private.invoice_line_tax_default();

-- ---------------------------------------------------------------------------
-- Payments and credit notes
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null,
  paid_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'eft' check (method in ('eft', 'cash', 'card', 'other')),
  is_deposit boolean not null default false,
  reference text,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade
);

create index payments_invoice_idx on public.payments (invoice_id);

call private.tenant_table('payments', '{manager}', '{manager}', '{manager}');

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null,
  credit_number text,
  issued_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, credit_number),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade
);

create index credit_notes_invoice_idx on public.credit_notes (invoice_id);

call private.tenant_table('credit_notes', '{manager}', '{manager}', '{manager}');

create or replace function private.credit_note_numbering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  biz record;
begin
  if new.credit_number is null then
    select b.credit_note_prefix, b.next_credit_note_number into biz
    from public.businesses b
    where b.id = new.business_id
    for update;

    new.credit_number := biz.credit_note_prefix || lpad(biz.next_credit_note_number::text, 4, '0');

    update public.businesses
      set next_credit_note_number = next_credit_note_number + 1
      where id = new.business_id;
  end if;
  return new;
end;
$$;

create trigger credit_notes_numbering
  before insert on public.credit_notes
  for each row execute function private.credit_note_numbering();

-- ---------------------------------------------------------------------------
-- Invoice totals (amounts incl. tax; credit notes are entered incl. tax)
-- ---------------------------------------------------------------------------

create view public.invoice_totals
with (security_invoker = true)
as
select
  i.id as invoice_id,
  i.business_id,
  coalesce(l.subtotal, 0) as subtotal,
  coalesce(l.tax, 0) as tax,
  coalesce(l.subtotal, 0) + coalesce(l.tax, 0) as total,
  coalesce(p.paid, 0) as paid,
  coalesce(c.credited, 0) as credited,
  coalesce(l.subtotal, 0) + coalesce(l.tax, 0) - coalesce(p.paid, 0) - coalesce(c.credited, 0) as balance
from public.invoices i
left join lateral (
  select
    sum(round(il.quantity * il.unit_price, 2)) as subtotal,
    sum(case when il.tax_applies
             then round(il.quantity * il.unit_price * coalesce(il.tax_rate, 0) / 100, 2)
             else 0 end) as tax
  from public.invoice_lines il
  where il.invoice_id = i.id
) l on true
left join lateral (
  select sum(pm.amount) as paid from public.payments pm where pm.invoice_id = i.id
) p on true
left join lateral (
  select sum(cn.amount) as credited from public.credit_notes cn where cn.invoice_id = i.id
) c on true;

-- Keeps status in step with payments and credits once an invoice is issued.
create or replace function private.refresh_invoice_status(inv uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  cur text;
begin
  select i.status into cur from public.invoices i where i.id = inv;
  if cur is null or cur in ('draft', 'cancelled') then
    return;
  end if;

  select x.total, x.paid, x.credited, x.balance into t
  from public.invoice_totals x
  where x.invoice_id = inv;

  update public.invoices
    set status = case
      when t.balance <= 0 then 'paid'
      when t.paid + t.credited > 0 then 'part_paid'
      else 'sent'
    end
    where id = inv
      and status is distinct from case
        when t.balance <= 0 then 'paid'
        when t.paid + t.credited > 0 then 'part_paid'
        else 'sent'
      end;
end;
$$;

create or replace function private.money_change_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_invoice_status(new.invoice_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_invoice_status(old.invoice_id);
  end if;
  return null;
end;
$$;

create trigger payments_refresh_status
  after insert or update or delete on public.payments
  for each row execute function private.money_change_refresh();

create trigger credit_notes_refresh_status
  after insert or update or delete on public.credit_notes
  for each row execute function private.money_change_refresh();

create trigger invoice_lines_refresh_status
  after insert or update or delete on public.invoice_lines
  for each row execute function private.money_change_refresh();

-- ---------------------------------------------------------------------------
-- Recurring monthly charges (livery, training fees) -> draft invoices
-- ---------------------------------------------------------------------------

create table public.recurring_charges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_id uuid not null,
  horse_id uuid,
  line_kind text not null default 'livery'
    check (line_kind in ('training_fee', 'livery', 'extra', 'other')),
  description text not null check (length(btrim(description)) > 0),
  amount numeric(12,2) not null check (amount >= 0),
  tax_applies boolean not null default true,
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  last_billed_month date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, business_id) references public.owners (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete set null (horse_id)
);

call private.tenant_table('recurring_charges', '{manager}', '{manager}', '{manager}');

-- One draft invoice per owner for the month, holding all their due charges.
-- Safe to re-run: a charge is billed at most once per month.
create or replace function public.generate_recurring_invoices(bid uuid, for_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_start date := date_trunc('month', for_month)::date;
  m_end date := (date_trunc('month', for_month) + interval '1 month - 1 day')::date;
  own record;
  inv_id uuid;
  made integer := 0;
begin
  if not private.is_manager(bid) then
    raise exception 'Only a Manager can create invoices' using errcode = '42501';
  end if;

  for own in
    select distinct rc.owner_id
    from public.recurring_charges rc
    where rc.business_id = bid
      and rc.active
      and rc.starts_on <= m_end
      and (rc.ends_on is null or rc.ends_on >= m_start)
      and (rc.last_billed_month is null or rc.last_billed_month < m_start)
  loop
    insert into public.invoices (business_id, owner_id, status, notes)
    values (bid, own.owner_id, 'draft', 'Monthly charges ' || to_char(m_start, 'Mon YYYY'))
    returning id into inv_id;

    insert into public.invoice_lines (business_id, invoice_id, sort_order, line_kind, description, unit_price, tax_applies, horse_id)
    select bid, inv_id, row_number() over (order by rc.created_at), rc.line_kind,
           rc.description || ' · ' || to_char(m_start, 'Mon YYYY'), rc.amount, rc.tax_applies, rc.horse_id
    from public.recurring_charges rc
    where rc.business_id = bid
      and rc.owner_id = own.owner_id
      and rc.active
      and rc.starts_on <= m_end
      and (rc.ends_on is null or rc.ends_on >= m_start)
      and (rc.last_billed_month is null or rc.last_billed_month < m_start);

    update public.recurring_charges rc
      set last_billed_month = m_start
      where rc.business_id = bid
        and rc.owner_id = own.owner_id
        and rc.active
        and rc.starts_on <= m_end
        and (rc.ends_on is null or rc.ends_on >= m_start)
        and (rc.last_billed_month is null or rc.last_billed_month < m_start);

    made := made + 1;
  end loop;

  return made;
end;
$$;

revoke execute on function public.generate_recurring_invoices(uuid, date) from public, anon;
grant execute on function public.generate_recurring_invoices(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner message log
-- ---------------------------------------------------------------------------

create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_id uuid not null,
  horse_id uuid,
  invoice_id uuid,
  channel text not null check (channel in ('whatsapp', 'email')),
  kind text not null check (kind in ('invoice', 'progress_update', 'other')),
  summary text,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, business_id) references public.owners (id, business_id),
  foreign key (horse_id, business_id) references public.horses (id, business_id) on delete set null (horse_id),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete set null (invoice_id)
);

call private.tenant_table('message_log', '{manager}', '{manager}', '{}');

-- ---------------------------------------------------------------------------
-- Audit log (written by triggers only)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_log_record_idx on public.audit_log (record_id, changed_at desc);

call private.tenant_table('audit_log', '{manager}', '{}', '{}');

create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (business_id, table_name, record_id, action, changed_by, old_data, new_data)
  values (
    coalesce(new.business_id, old.business_id),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'memberships', 'horses', 'horse_valuations', 'horse_sales', 'cost_entries',
    'product_prices', 'shared_cost_pools', 'invoices', 'invoice_lines', 'payments', 'credit_notes'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit()',
      t || '_audit', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profitability per horse (Manager-only through the underlying tables' RLS).
-- Income: invoiced fees for the horse (ex tax, issued invoices only) plus the
-- sale price for own horses or the commission for sales on behalf of a client.
-- Unsold own horses carry no income; the latest valuation is shown for reference.
-- ---------------------------------------------------------------------------

create view public.horse_profitability
with (security_invoker = true)
as
select
  h.id as horse_id,
  h.business_id,
  coalesce(ce.direct_costs, 0) as direct_costs,
  coalesce(sa.shared_costs, 0) as shared_costs,
  coalesce(ce.direct_costs, 0) + coalesce(sa.shared_costs, 0) as total_cost,
  coalesce(inc.invoiced_income, 0) as invoiced_income,
  coalesce(sl.sale_income, 0) as sale_income,
  coalesce(inc.invoiced_income, 0) + coalesce(sl.sale_income, 0) as total_income,
  coalesce(inc.invoiced_income, 0) + coalesce(sl.sale_income, 0)
    - coalesce(ce.direct_costs, 0) - coalesce(sa.shared_costs, 0) as profit,
  v.amount as latest_valuation,
  v.valued_on as latest_valuation_on
from public.horses h
left join lateral (
  select sum(c.amount) as direct_costs from public.cost_entries c where c.horse_id = h.id
) ce on true
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

-- ---------------------------------------------------------------------------
-- Storage: private buckets; the first folder of every path is the business id.
--   horse-photos/<business_id>/<horse_id>/<file>.jpg
--   business-assets/<business_id>/logo.png
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('horse-photos', 'horse-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('business-assets', 'business-assets', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.path_business(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

grant execute on function private.path_business(text) to authenticated;

create policy horse_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'horse-photos' and (select private.is_member(private.path_business(name))));

create policy horse_photos_add on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'horse-photos'
    and (select private.has_role(private.path_business(name), array['manager', 'trainer']::public.member_role[]))
  );

create policy horse_photos_change on storage.objects
  for update to authenticated
  using (bucket_id = 'horse-photos' and (select private.is_manager(private.path_business(name))))
  with check (bucket_id = 'horse-photos' and (select private.is_manager(private.path_business(name))));

create policy horse_photos_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'horse-photos' and (select private.is_manager(private.path_business(name))));

create policy business_assets_read on storage.objects
  for select to authenticated
  using (bucket_id = 'business-assets' and (select private.is_member(private.path_business(name))));

create policy business_assets_add on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-assets' and (select private.is_manager(private.path_business(name))));

create policy business_assets_change on storage.objects
  for update to authenticated
  using (bucket_id = 'business-assets' and (select private.is_manager(private.path_business(name))))
  with check (bucket_id = 'business-assets' and (select private.is_manager(private.path_business(name))));

create policy business_assets_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-assets' and (select private.is_manager(private.path_business(name))));
