-- Foundation: extensions, enums, helper functions, profiles.
--
-- Trust boundary: apps (anon/authenticated roles) may only write low-risk rows
-- that RLS allows. Bookings, match participants, results, ratings and money are
-- written only by the API, which connects with a privileged role.

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Enum values must match @verzus/schemas.
create type public.sport as enum ('basketball', 'badminton', 'futsal', 'tennis', 'volleyball', 'pickleball');
create type public.match_mode as enum ('ranked', 'casual');
create type public.self_assessment as enum ('beginner', 'intermediate', 'advanced');
create type public.venue_role as enum ('owner', 'staff');

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so RLS policies can call them without recursion.
-- ---------------------------------------------------------------------------

-- Admins are flagged in auth app_metadata, which only the service role can set.
create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'verzus_admin')::boolean, false);
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Blocks UPDATE and DELETE on append-only tables (ledger, rating history).
create function public.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 40),
  avatar_path text,
  home_city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Player'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Allies (friends list). One row per request; status 'accepted' means mutual.
-- ---------------------------------------------------------------------------

create table public.allies (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index allies_addressee_idx on public.allies (addressee_id);

alter table public.allies enable row level security;

create policy "see allies rows you are part of"
  on public.allies for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "send an ally request"
  on public.allies for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

create policy "accept a request sent to you"
  on public.allies for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');

create policy "remove an ally or request"
  on public.allies for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
