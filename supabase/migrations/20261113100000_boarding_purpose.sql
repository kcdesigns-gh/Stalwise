-- Boarding: a client's horse that is kept on the yard but not trained.
-- (A separate file from the rules below: a new enum value cannot be used in
-- the same transaction that adds it.)
alter type public.horse_purpose add value if not exists 'boarding';
