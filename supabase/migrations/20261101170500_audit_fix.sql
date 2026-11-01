-- Fix: when a whole business is deleted, its rows are removed by cascade and the
-- audit trigger tried to record them against a business that no longer exists.
-- Skip auditing in that case (the business and all its records are gone).

create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bid uuid := coalesce(new.business_id, old.business_id);
begin
  if not exists (select 1 from public.businesses b where b.id = bid) then
    return null;
  end if;

  insert into public.audit_log (business_id, table_name, record_id, action, changed_by, old_data, new_data)
  values (
    bid,
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
