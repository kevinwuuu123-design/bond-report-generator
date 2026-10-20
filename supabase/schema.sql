-- Run once in Supabase SQL Editor. Completed records are immutable snapshots.
create table if not exists public.bond_records (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  primary key (user_id,id),
  constraint payload_matches_id check (payload->>'id' = id::text),
  constraint payload_structure check (
    jsonb_typeof(payload) = 'object' and
    payload ?& array['id','fields','report','raw','meta','calendar','createdAt'] and
    jsonb_typeof(payload->'id') = 'string' and
    jsonb_typeof(payload->'fields') = 'object' and
    jsonb_typeof(payload->'report') = 'string' and
    jsonb_typeof(payload->'raw') = 'string' and
    jsonb_typeof(payload->'meta') = 'object' and
    jsonb_typeof(payload->'calendar') = 'object' and
    jsonb_typeof(payload->'createdAt') = 'string'
  ),
  constraint payload_size check (octet_length(payload::text) <= 2000000)
);
create index if not exists bond_records_user_id_idx on public.bond_records(user_id,id);
alter table public.bond_records enable row level security;
revoke all on public.bond_records from anon, authenticated;
grant select, insert on public.bond_records to authenticated;
drop policy if exists "Read own bond archives" on public.bond_records;
create policy "Read own bond archives" on public.bond_records for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Insert own bond archives" on public.bond_records;
create policy "Insert own bond archives" on public.bond_records for insert to authenticated
with check ((select auth.uid()) = user_id);
-- No UPDATE / DELETE permissions: history cannot be silently overwritten by another device.
