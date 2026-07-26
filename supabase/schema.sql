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
  -- Compressed sibling of each *_photos array (same order/length) plus a
  -- compressed copy of the gift photo -- Basic tier shows these instead of
  -- the full-quality originals; Super/Premium always use the originals.
  -- Empty/shorter-than-original on rows saved before this existed, which
  -- get_surprise() falls back on the original for.
  her_photos_compressed text[] not null default '{}',
  him_photos_compressed text[] not null default '{}',
  places_photos_compressed text[] not null default '{}',
  unlock_at timestamptz,
  view_count integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adds the columns when this script is re-run against a table created before
-- they existed. No-op on a fresh install (the create table above already has them).
alter table surprises add column if not exists memories text[] not null default '{}';
alter table surprises add column if not exists him_nickname text not null default '';
alter table surprises add column if not exists places_photos text[] not null default '{}';
alter table surprises add column if not exists her_photos_compressed text[] not null default '{}';
alter table surprises add column if not exists him_photos_compressed text[] not null default '{}';
alter table surprises add column if not exists places_photos_compressed text[] not null default '{}';
-- questions: replaces the fixed "Do you believe in love?" gate question (see
-- LoveQuiz.tsx) with his own -- Super gets exactly one, Premium gets as many
-- as he writes (SharedSurprise.tsx enforces the Super cap at display time).
-- Empty array (the default) means "use the built-in question".
alter table surprises drop column if exists question;
alter table surprises add column if not exists questions text[] not null default '{}';
-- unlock_at: leave a surprise's link "not yet unlocked" until this moment, even
-- though the link itself already works (Paystack verified, get_surprise() finds
-- the row) -- see get_surprise() below for how it blanks out the actual content
-- until then. Null means "unlocked immediately", same as every surprise before
-- this feature existed.
alter table surprises add column if not exists unlock_at timestamptz;
-- view tracking: lets the creator see whether she's actually opened it yet.
alter table surprises add column if not exists view_count integer not null default 0;
alter table surprises add column if not exists first_viewed_at timestamptz;
alter table surprises add column if not exists last_viewed_at timestamptz;

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
-- unlock_at adds a "locked" state: her_name/her_nickname/him_name/him_nickname
-- (who this is for/from) and tier/unlock_at/locked itself always come through so
-- the page can show a "so-and-so has something for you, unlocks in..." screen,
-- but every actual spoiler field (letter/gift/song/photos/memories) comes back
-- blank until now() >= unlock_at. A null unlock_at behaves exactly like every
-- surprise made before this feature existed -- unlocked the moment the link works.
drop function if exists get_surprise(uuid);
create or replace function get_surprise(p_surprise_id uuid)
returns table (
  her_name text,
  her_nickname text,
  him_name text,
  him_nickname text,
  letter text,
  questions text[],
  gift jsonb,
  song jsonb,
  her_photos text[],
  him_photos text[],
  memories text[],
  places_photos text[],
  her_photos_compressed text[],
  him_photos_compressed text[],
  places_photos_compressed text[],
  tier text,
  unlock_at timestamptz,
  locked boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.her_name,
    s.her_nickname,
    s.him_name,
    s.him_nickname,
    case when s.unlock_at is not null and now() < s.unlock_at then '' else s.letter end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.questions end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::jsonb else s.gift end,
    case when s.unlock_at is not null and now() < s.unlock_at then null else s.song end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.her_photos end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.him_photos end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.memories end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.places_photos end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.her_photos_compressed end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.him_photos_compressed end,
    case when s.unlock_at is not null and now() < s.unlock_at then '{}'::text[] else s.places_photos_compressed end,
    sp.tier,
    s.unlock_at,
    (s.unlock_at is not null and now() < s.unlock_at) as locked
  from surprises s
  join surprise_payments sp on sp.surprise_id = s.id
  where s.id = p_surprise_id
  order by case sp.tier when 'premium' then 3 when 'super' then 2 else 1 end desc
  limit 1;
$$;

grant execute on function get_surprise(uuid) to anon, authenticated;

-- Records that her link was actually opened (called once she clicks past the
-- love-quiz intro, not on the bare page load, so a link preview/crawler bot
-- doesn't count as "she saw it"). SECURITY DEFINER + narrow grant, same
-- reasoning as get_surprise() -- anon can't UPDATE surprises directly (RLS
-- above is owner-only), so this is the one deliberate, narrow hole in that:
-- it can only ever bump counters on a row it's given the exact id for, never
-- read or change anything else.
--
-- Now called from the record-surprise-view edge function (not directly from
-- the client) so it can also email him the first time she opens it. Returns
-- is_first_view straight out of the same UPDATE...RETURNING -- comparing
-- against a fresh now() here is safe because every now() call within one
-- statement returns the same transaction timestamp, so this can't race
-- against a second near-simultaneous call the way a separate
-- select-then-update would.
-- Postgres won't let CREATE OR REPLACE change a function's return columns, so
-- drop it first -- safe to re-run either way.
drop function if exists record_surprise_view(uuid);
create or replace function record_surprise_view(p_surprise_id uuid)
returns table (
  user_id uuid,
  her_name text,
  her_nickname text,
  view_count integer,
  is_first_view boolean
)
language sql
security definer
set search_path = public
volatile
as $$
  update surprises
  set view_count = view_count + 1,
      first_viewed_at = coalesce(first_viewed_at, now()),
      last_viewed_at = now()
  where id = p_surprise_id
  returning surprises.user_id, surprises.her_name, surprises.her_nickname,
    surprises.view_count, (surprises.first_viewed_at = now()) as is_first_view;
$$;

grant execute on function record_surprise_view(uuid) to anon, authenticated;

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
