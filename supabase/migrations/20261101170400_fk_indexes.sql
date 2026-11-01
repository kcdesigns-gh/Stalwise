-- Index every foreign key between Stalwise tables (not the created_by-style
-- links to auth.users) so lookups such as "all costs for this horse" and
-- deletes that cascade stay fast as data grows.

do $$
declare
  fk record;
  idx_name text;
begin
  for fk in
    select
      c.conrelid::regclass as tbl,
      c.conname,
      c.conkey,
      (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
       from unnest(c.conkey) with ordinality as k(attnum, ord)
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as col_list
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and c.confrelid <> 'auth.users'::regclass
  loop
    -- Skip when an existing index already starts with the same columns.
    if not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.tbl
        and (i.indkey::int2[])[0:array_length(fk.conkey, 1) - 1] = fk.conkey
    ) then
      idx_name := left(fk.conname, 59) || '_idx';
      execute format('create index %I on %s (%s)', idx_name, fk.tbl, fk.col_list);
    end if;
  end loop;
end;
$$;
