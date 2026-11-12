-- An issued invoice is fixed. The app already hides line editing after issue;
-- this makes the database refuse it too, so a correction always goes through a
-- credit note. Deleting a whole business (account deletion) still works: by the
-- time the cascade reaches these rows the business or invoice is already gone.

create or replace function private.invoice_line_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked boolean;
begin
  select exists (
    select 1 from public.invoices i
    where i.status <> 'draft'
      and i.id in (
        case when tg_op <> 'INSERT' then old.invoice_id end,
        case when tg_op <> 'DELETE' then new.invoice_id end
      )
  ) into locked;

  if locked then
    raise exception 'This invoice has been issued and can no longer be changed. Use a credit note to correct it.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace trigger invoice_lines_lock
  before insert or update or delete on public.invoice_lines
  for each row execute function private.invoice_line_lock();

create or replace function private.invoice_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' and new.status = 'draft' then
      raise exception 'An issued invoice cannot go back to a draft. Use a credit note to correct it.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  -- DELETE: allowed for drafts, and when the whole business is being deleted.
  if old.status <> 'draft' and exists (select 1 from public.businesses b where b.id = old.business_id) then
    raise exception 'An issued invoice cannot be deleted. Use a credit note to correct it.'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create or replace trigger invoices_lock
  before update or delete on public.invoices
  for each row execute function private.invoice_lock();
