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
-- Postgres won't let CREATE OR REPLACE change a function's return columns (e.g.
-- adding "memories" below), so drop it first -- safe to re-run either way.
drop function if exists get_surprise(uuid);
create or replace function get_surprise(surprise_id uuid)
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
  places_photos text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select her_name, her_nickname, him_name, him_nickname, letter, gift, song, her_photos, him_photos, memories, places_photos
  from surprises
  where id = surprise_id
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
