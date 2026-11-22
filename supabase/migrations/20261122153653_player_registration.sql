-- Player registration and self-serve venue owners.
--
-- Players register with a username, their name, email, phone, home area (province, city,
-- barangay), the sports they play and a password. The username and sports are public (they are
-- how players find each other); everything else is personal and lives in player_details, which
-- only the player and verzus can read. The whole registration arrives as sign-up metadata and is
-- written by the sign-up trigger, in the same transaction as the account: there is never an
-- account without its profile, even when the email still has to be confirmed.
--
-- Players sign in with their username or email. Supabase signs in by email only, so a username is
-- turned into its email on the server (login_email, for the sign-in Edge Function only); emails
-- are never handed to browsers.
--
-- Venue owners no longer need an invite: create_my_venue makes a draft they own. Every venue is
-- still reviewed by verzus before it goes live (guard_venue_update). Invites keep working.

-- ---------------------------------------------------------------------------
-- Public profile: username and sports
-- ---------------------------------------------------------------------------

-- Lowercase only, so the unique index treats "Migs" and "migs" as the same name.
alter table public.profiles
  add column username text check (username ~ '^[a-z0-9_.]{3,20}$'),
  add column sports public.sport[] not null default '{}';

create unique index profiles_username_key on public.profiles (username);

-- ---------------------------------------------------------------------------
-- Private player details
-- ---------------------------------------------------------------------------

create table public.player_details (
  id uuid primary key references public.profiles (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  middle_name text check (middle_name is null or char_length(btrim(middle_name)) between 1 and 60),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
  suffix text check (suffix in ('Jr.', 'Sr.', 'II', 'III', 'IV', 'V')),
  -- A Philippine mobile number, stored as +639XXXXXXXXX (see @verzus/schemas/phone).
  phone text not null check (phone ~ '^\+639[0-9]{9}$'),
  province text not null check (char_length(btrim(province)) between 1 and 100),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  barangay text not null check (char_length(btrim(barangay)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger player_details_updated_at before update on public.player_details
  for each row execute function public.set_updated_at();

alter table public.player_details enable row level security;

create policy "players read their own details; verzus reads all"
  on public.player_details for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "players update their own details"
  on public.player_details for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policies: the sign-up trigger creates the row, and it goes with the account.

-- ---------------------------------------------------------------------------
-- Sign-up: profiles from registration metadata
-- ---------------------------------------------------------------------------

-- A player registration carries {"kind": "player", "username", "first_name", "middle_name",
-- "last_name", "suffix", "phone", "province", "city", "barangay", "sports": [...]}. Anything else
-- (venue owners, staff, Google) gets a plain profile as before. A bad or missing player field
-- fails the sign-up, so a half-registered player can't exist; the app checks every field first.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_sports public.sport[];
begin
  if m ->> 'kind' = 'player' then
    -- Each sport once, in the enum's order.
    v_sports := array(
      select distinct s::public.sport from jsonb_array_elements_text(coalesce(m -> 'sports', '[]'::jsonb)) as s order by 1
    );
    if cardinality(v_sports) = 0 then
      raise exception 'pick at least one sport' using errcode = '23514';
    end if;

    insert into public.profiles (id, display_name, username, sports, home_city)
    values (
      new.id,
      left(btrim(m ->> 'first_name'), 40),
      lower(btrim(m ->> 'username')),
      v_sports,
      btrim(m ->> 'city')
    );

    insert into public.player_details (id, first_name, middle_name, last_name, suffix, phone, province, city, barangay)
    values (
      new.id,
      btrim(m ->> 'first_name'),
      nullif(btrim(m ->> 'middle_name'), ''),
      btrim(m ->> 'last_name'),
      nullif(m ->> 'suffix', ''),
      m ->> 'phone',
      btrim(m ->> 'province'),
      btrim(m ->> 'city'),
      btrim(m ->> 'barangay')
    );
  else
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(nullif(m ->> 'name', ''), 'Player'));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usernames: availability and sign-in
-- ---------------------------------------------------------------------------

-- For the registration form, before anyone is signed in. Usernames are public anyway.
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(p_username)) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(btrim(p_username)))
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- The email behind a username, for the sign-in Edge Function (service role) only: handing it to
-- browsers would let anyone collect players' emails from their usernames.
create function public.login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.username = lower(btrim(p_username))
$$;

revoke execute on function public.login_email(text) from public, anon, authenticated;
grant execute on function public.login_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Self-serve venues
-- ---------------------------------------------------------------------------

-- A signed-in owner starts a draft venue (created_by makes them its owner: handle_new_venue).
-- At most three per person, so an account can't flood the review queue.
create function public.create_my_venue(p_venue_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_venue uuid;
begin
  if v_user is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if (select count(*) from public.venues where created_by = v_user) >= 3 then
    raise exception 'you can set up at most 3 venues; ask verzus for more' using errcode = '23514';
  end if;
  insert into public.venues (name, created_by) values (btrim(p_venue_name), v_user) returning id into v_venue;
  return v_venue;
end;
$$;

revoke execute on function public.create_my_venue(text) from public, anon;
grant execute on function public.create_my_venue(text) to authenticated;
