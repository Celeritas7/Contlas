-- Contlas · Supabase schema. Paste into SQL Editor → Run. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  job text, company text,
  city text, lat double precision, lon double precision,
  tz_name text, tz_offset smallint,
  home_city text, home_lat double precision, home_lon double precision,
  birthday text,
  languages text[] not null default '{}',
  met_story text, notes text, gift_ideas text,
  tags text[] not null default '{}',
  circle uuid[] not null default '{}',
  placed_by_hand boolean not null default false,
  source text not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_user_idx on public.contacts(user_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null default 'call',
  note text,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists conversations_contact_idx on public.conversations(contact_id);

create table if not exists public.contact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  kind text not null,
  headline text not null,
  detail text,
  proposed_patch jsonb,
  status text not null default 'pending',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists contact_events_contact_idx on public.contact_events(contact_id);

create table if not exists public.snoozes (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  until timestamptz not null
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();

alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.contact_events enable row level security;
alter table public.snoozes enable row level security;

drop policy if exists "own rows" on public.contacts;
create policy "own rows" on public.contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.conversations;
create policy "own rows" on public.conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.contact_events;
create policy "own rows" on public.contact_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.snoozes;
create policy "own rows" on public.snoozes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Social + "last seen" (last seen wins on the map and for trips)
alter table public.contacts add column if not exists instagram text;
alter table public.contacts add column if not exists linkedin text;
alter table public.contacts add column if not exists facebook text;
alter table public.contacts add column if not exists last_seen_city text;
alter table public.contacts add column if not exists last_seen_lat double precision;
alter table public.contacts add column if not exists last_seen_lon double precision;
alter table public.contacts add column if not exists last_seen_at date;

-- Trips: who's within 200 km, birthdays in the window, reminder a week before
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  city text not null, lat double precision, lon double precision,
  start_date date not null, end_date date not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists trips_user_idx on public.trips(user_id);
alter table public.trips enable row level security;
drop policy if exists "own rows" on public.trips;
create policy "own rows" on public.trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Calendar feed: one secret token per user. The birthdays-ics edge function looks it up with the service role.
create table if not exists public.feed_tokens (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.feed_tokens enable row level security;
drop policy if exists "own rows" on public.feed_tokens;
create policy "own rows" on public.feed_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
