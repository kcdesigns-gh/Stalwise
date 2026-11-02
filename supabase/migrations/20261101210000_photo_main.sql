-- Horse photos: the first photo added to a horse becomes its main photo
-- automatically (whoever adds it), later photos are not main, and only the
-- Manager can switch the main photo. Switching happens in one step so a horse
-- never ends up with two main photos.

create or replace function private.horse_photo_main_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.horse_photos p where p.horse_id = new.horse_id and p.is_main
  ) then
    new.is_main := true;
  elsif new.is_main and not private.is_manager(new.business_id) then
    new.is_main := false;
  end if;
  return new;
end;
$$;

create or replace function public.set_main_horse_photo(photo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  select x.id, x.horse_id, x.business_id into p from public.horse_photos x where x.id = photo;
  if p.id is null then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
  if not private.is_manager(p.business_id) then
    raise exception 'Only a Manager can change the main photo' using errcode = '42501';
  end if;

  update public.horse_photos set is_main = false where horse_id = p.horse_id and is_main and id <> photo;
  update public.horse_photos set is_main = true where id = photo;
end;
$$;

revoke execute on function public.set_main_horse_photo(uuid) from public, anon;
grant execute on function public.set_main_horse_photo(uuid) to authenticated;
