-- ════════════════════════════════════════════════════════════════════════════
-- Comly — grant table-level privileges to anon/authenticated
--
-- Found during the first real-account smoke test: every table in the public
-- schema had zero SELECT/INSERT/UPDATE/DELETE grants for `anon` or
-- `authenticated` — only REFERENCES/TRIGGER/TRUNCATE existed. A brand-new
-- Supabase project normally provisions these automatically; on this project
-- they were never applied, so every real authenticated request failed with
-- "permission denied for table X" (Postgres code 42501) before RLS was ever
-- evaluated. RLS policies were correct the entire time — they simply never
-- ran, because the table-level grant is a harder gate that sits in front of
-- them. This affected every table, every operation, since migration 0001.
--
-- Row Level Security remains the actual authorization boundary: granting
-- table-level privileges only lets a role attempt an operation, and existing
-- RLS policies (0002/0003/0004/0005) still decide which rows are visible or
-- writable. Matches Supabase's own default new-project grant.
-- ════════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;

-- Cover any table/sequence/function created by a future migration too, so
-- this gap can't reopen silently the next time someone adds a table.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
