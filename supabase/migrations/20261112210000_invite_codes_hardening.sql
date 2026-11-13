-- Staff invite codes, hardened.
-- 1. Codes were built with (random() * 32)::int + 1. ::int rounds, so the index
--    could be 33 (nothing there): about 9% of codes came out shorter than six
--    characters, and the first letter was half as likely as the rest. Codes are
--    now 8 characters drawn from cryptographic random bytes.
-- 2. Guessing is limited: five wrong codes in 15 minutes locks that person out
--    for the rest of the 15 minutes.
-- 3. A Manager can no longer demote themself by entering one of their own
--    codes, and a person who already works in a business cannot join a second.

create or replace function private.random_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 8 characters from an unambiguous alphabet (no 0/O/1/I). 256 is a multiple
  -- of 32, so every character is equally likely.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(r.b, i) % 32) + 1, 1), '')
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i;
$$;

create table if not exists private.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists invite_attempts_user_idx on private.invite_attempts (user_id, attempted_at);
alter table private.invite_attempts enable row level security;
revoke all on private.invite_attempts from public, anon, authenticated;

-- Returns { ok: true, business_id } or { ok: false, error }. A wrong code is
-- returned, not raised, so the failed attempt stays recorded.
create or replace function public.join_with_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  found public.staff_invites;
  recent integer;
  problem text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select count(*) into recent
  from private.invite_attempts a
  where a.user_id = uid and a.attempted_at > now() - interval '15 minutes';
  if recent >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many wrong codes. Wait 15 minutes, check the code with your Manager and try again.');
  end if;

  select * into found
  from public.staff_invites
  where upper(code) = upper(btrim(invite_code))
  for update;

  if found.id is null then
    problem := 'That invite code was not found. Check it and try again.';
  elsif found.used_at is not null then
    problem := 'That invite has already been used. Ask your Manager for a new one.';
  elsif found.expires_at < now() then
    problem := 'That invite has expired. Ask your Manager for a new one.';
  end if;

  if problem is not null then
    insert into private.invite_attempts (user_id) values (uid);
    return jsonb_build_object('ok', false, 'error', problem);
  end if;

  if exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.active and m.business_id = found.business_id and m.role = 'manager'
  ) then
    return jsonb_build_object('ok', false, 'error', 'You are already the Manager of this business. Share this code with the person you are inviting.');
  end if;

  if exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.active and m.business_id <> found.business_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'You already belong to a business on Stalwise. One account works in one business.');
  end if;

  insert into public.memberships (business_id, user_id, role)
  values (found.business_id, uid, found.role)
  on conflict (business_id, user_id) do update set role = excluded.role, active = true;

  update public.staff_invites set used_at = now(), used_by = uid where id = found.id;
  delete from private.invite_attempts where user_id = uid;

  return jsonb_build_object('ok', true, 'business_id', found.business_id);
end;
$$;

revoke execute on function public.join_with_invite(text) from public, anon;
grant execute on function public.join_with_invite(text) to authenticated;

-- The old function stays for a short while so the version of the app that is
-- live today keeps working. It now runs the same checks. It raises its errors,
-- which undoes the attempt record, so it is NOT rate limited: drop it once the
-- app that calls join_with_invite is live.
create or replace function public.accept_staff_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.join_with_invite(invite_code);
  if not (result ->> 'ok')::boolean then
    raise exception '%', result ->> 'error';
  end if;
  return (result ->> 'business_id')::uuid;
end;
$$;
