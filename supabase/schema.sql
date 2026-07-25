-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent (drop-if-exists / create-if-not-exists).

create extension if not exists pgcrypto;

-- 1. The table that holds one row per surprise a creator has built.
create table if not exists surprises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  her_name text not null default '',
  her_nickname text not null default '',
  her_country text not null default '',
  him_name text not null default '',
  him_nickname text not null default '',
  him_country text not null default '',
  letter text not null default '',
  gift jsonb not null default '{}'::jsonb,
  song jsonb,
  her_photos text[] not null default '{}',
  him_photos text[] not null default '{}',
  memories text[] not null default '{}',
  places_photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adds the columns when this script is re-run against a table created before
-- they existed. No-op on a fresh install (the create table above already has them).
alter table surprises add column if not exists memories text[] not null default '{}';
alter table surprises add column if not exists him_nickname text not null default '';
alter table surprises add column if not exists places_photos text[] not null default '{}';

alter table surprises enable row level security;

-- 1b. One row per successful Paystack charge for a surprise. Deliberately a
-- separate table from `surprises` (not a `tier` column on it) so that the
-- owner's normal "manage my own row" RLS policy below can never be used to
-- grant themselves a paid tier by just UPDATE-ing it from devtools -- only
-- the verify-surprise-payment edge function (service-role key, after Paystack
-- itself confirms the charge) is able to write here. See "3b" below for how
-- get_surprise() uses this to decide what she actually sees.
create table if not exists surprise_payments (
  id uuid primary key default gen_random_uuid(),
  surprise_id uuid not null references surprises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('basic', 'super', 'premium')),
  amount integer not null,
  paystack_reference text not null unique,
  created_at timestamptz not null default now()
);

alter table surprise_payments enable row level security;

-- Owners can see their own payment history (e.g. to know a surprise is
-- still unpaid and needs the "complete payment" flow re-opened). No insert/
-- update/delete policy exists for anon/authenticated -- see comment above.
drop policy if exists "owners read their own surprise payments" on surprise_payments;
create policy "owners read their own surprise payments"
  on surprise_payments
  for select
  using (auth.uid() = user_id);

-- One-time backfill: any surprise created before payments existed (e.g. the
-- one you already tested and shared a link for) gets grandfathered in at
-- 'premium' for free, so get_surprise() below doesn't suddenly start
-- rejecting a link that already worked. Safe to re-run -- only inserts for
-- surprises that still have zero payment rows.
insert into surprise_payments (surprise_id, user_id, tier, amount, paystack_reference)
select id, user_id, 'premium', 0, 'GRANDFATHERED_' || id::text
from surprises s
where not exists (
  select 1 from surprise_payments sp where sp.surprise_id = s.id
);

-- 2. Only the creator (the signed-in "him") can read/write their own rows directly.
-- This is intentionally NOT public — her link never talks to this table directly,
-- it goes through the get_surprise() function below instead.
drop policy if exists "owners manage their surprises" on surprises;
create policy "owners manage their surprises"
  on surprises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Public, unauthenticated read of exactly one surprise by its id (the share link).
-- SECURITY DEFINER lets this bypass the owner-only RLS policy above, but only ever
-- returns the single row matching the exact uuid you pass in -- there's no way to
-- list or enumerate other people's surprises through it.
--
-- The join against surprise_payments means this returns NOTHING until a real
-- Paystack charge has been verified for this surprise -- an unpaid link
-- simply doesn't work yet, even if someone already has the URL. If a
-- surprise somehow has more than one payment row, the highest tier wins
-- (there's no "downgrade" path, so this only matters if a retry double-paid).
-- Postgres won't let CREATE OR REPLACE change a function's return columns (e.g.
-- adding "memories" below), so drop it first -- safe to re-run either way.
--
-- The parameter is named p_surprise_id (not surprise_id) on purpose:
-- surprise_payments has its own column literally called surprise_id, and in
-- a plain SQL function a same-named column silently wins over a same-named
-- parameter reference -- "where s.id = surprise_id" would resolve to
-- sp.surprise_id (already pinned equal to s.id by the join), turning the
-- filter into a no-op that returned an arbitrary row for ANY id, including
-- ones that don't exist. Caught this by testing with a made-up uuid and
-- getting back a real surprise's data back -- do not rename this parameter
-- back to surprise_id.
drop function if exists get_surprise(uuid);
create or replace function get_surprise(p_surprise_id uuid)
returns table (
  her_name text,
  her_nickname text,
  him_name text,
  him_nickname text,
  letter text,
  gift jsonb,
  song jsonb,
  her_photos text[],
  him_photos text[],
  memories text[],
  places_photos text[],
  tier text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.her_name, s.her_nickname, s.him_name, s.him_nickname, s.letter, s.gift, s.song,
         s.her_photos, s.him_photos, s.memories, s.places_photos, sp.tier
  from surprises s
  join surprise_payments sp on sp.surprise_id = s.id
  where s.id = p_surprise_id
  order by case sp.tier when 'premium' then 3 when 'super' then 2 else 1 end desc
  limit 1;
$$;

grant execute on function get_surprise(uuid) to anon, authenticated;

-- 4. Keep updated_at current on every edit.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists surprises_set_updated_at on surprises;
create trigger surprises_set_updated_at
  before update on surprises
  for each row
  execute function set_updated_at();

-- 5. Storage bucket for gallery / gift / song-upload files.
-- Public bucket: simplest option since her link needs to load images with no auth.
-- Files are namespaced by owner id (<user_id>/...), so uploads can't collide or be
-- overwritten by someone else's session.
insert into storage.buckets (id, name, public)
values ('surprise-photos', 'surprise-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read surprise photos" on storage.objects;
create policy "public read surprise photos"
  on storage.objects for select
  using (bucket_id = 'surprise-photos');

drop policy if exists "owners upload their own surprise photos" on storage.objects;
create policy "owners upload their own surprise photos"
  on storage.objects for insert
  with check (
    bucket_id = 'surprise-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners update their own surprise photos" on storage.objects;
create policy "owners update their own surprise photos"
  on storage.objects for update
  using (
    bucket_id = 'surprise-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "owners delete their own surprise photos" on storage.objects;
create policy "owners delete their own surprise photos"
  on storage.objects for delete
  using (
    bucket_id = 'surprise-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
