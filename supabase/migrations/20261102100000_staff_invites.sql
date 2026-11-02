-- Staff invites: a Manager generates a short code for a role; anyone signed in
-- without a business yet (or wanting a second one later) can join with it.

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  role public.member_role not null,
  code text not null unique,
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only a Manager sees or manages invites for their own business.
call private.tenant_table('staff_invites', '{manager}', '{manager}', '{manager}');

create or replace function private.random_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 6 characters from an unambiguous alphabet (no 0/O/1/I).
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random() * 32)::int + 1, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public.create_staff_invite(bid uuid, role public.member_role)
returns public.staff_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_row public.staff_invites;
  new_code text;
  tries int := 0;
begin
  if not private.is_manager(bid) then
    raise exception 'Only a Manager can invite staff' using errcode = '42501';
  end if;

  loop
    new_code := private.random_invite_code();
    tries := tries + 1;
    begin
      insert into public.staff_invites (business_id, role, code)
      values (bid, role, new_code)
      returning * into new_row;
      exit;
    exception when unique_violation then
      if tries > 10 then
        raise exception 'Could not generate a unique invite code, please try again';
      end if;
    end;
  end loop;

  return new_row;
end;
$$;

revoke execute on function public.create_staff_invite(uuid, public.member_role) from public, anon;
grant execute on function public.create_staff_invite(uuid, public.member_role) to authenticated;

-- Joins the caller to the invite's business with the invited role.
-- Runs for any signed-in user, including one with no business yet.
create or replace function public.accept_staff_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  found public.staff_invites;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into found
  from public.staff_invites
  where upper(code) = upper(btrim(invite_code))
  for update;

  if found.id is null then
    raise exception 'That invite code was not found. Check it and try again.';
  end if;
  if found.used_at is not null then
    raise exception 'That invite has already been used. Ask your Manager for a new one.';
  end if;
  if found.expires_at < now() then
    raise exception 'That invite has expired. Ask your Manager for a new one.';
  end if;

  insert into public.memberships (business_id, user_id, role)
  values (found.business_id, uid, found.role)
  on conflict (business_id, user_id) do update set role = excluded.role, active = true;

  update public.staff_invites set used_at = now(), used_by = uid where id = found.id;

  return found.business_id;
end;
$$;

revoke execute on function public.accept_staff_invite(text) from public, anon;
grant execute on function public.accept_staff_invite(text) to authenticated;
