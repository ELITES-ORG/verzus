-- Bookings (one calendar for app, walk-in, phone and blocked slots) and matches.

create type public.booking_status as enum ('held', 'confirmed', 'cancelled', 'expired');
create type public.booking_source as enum ('app', 'walk_in', 'phone', 'block');
create type public.match_status as enum (
  'open_allies', 'open_public', 'full', 'played', 'awaiting_confirmation',
  'rated', 'disputed', 'resolved', 'cancelled'
);
create type public.participant_status as enum ('held', 'paid', 'left', 'expired', 'refunded');

-- ---------------------------------------------------------------------------
-- Bookings. The exclusion constraint makes double booking impossible: two
-- active rows for the same court can never have overlapping time ranges,
-- whatever their source.
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete restrict,
  during tstzrange not null,
  status public.booking_status not null,
  source public.booking_source not null,
  booked_by uuid references public.profiles (id) on delete set null,
  -- App bookings are 'held' until payment confirms; unpaid holds expire.
  hold_expires_at timestamptz,
  price_cents integer check (price_cents >= 0),
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_range_valid check (not isempty(during) and lower_inc(during) and not upper_inc(during)),
  constraint bookings_hold_has_expiry check (status <> 'held' or hold_expires_at is not null),
  constraint bookings_app_has_player check (source <> 'app' or booked_by is not null),
  constraint bookings_no_overlap exclude using gist (court_id with =, during with &&)
    where (status in ('held', 'confirmed'))
);

create index bookings_booked_by_idx on public.bookings (booked_by);
create index bookings_hold_expiry_idx on public.bookings (hold_expires_at) where status = 'held';
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create function public.court_venue(p_court_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select venue_id from public.courts where id = p_court_id;
$$;

alter table public.bookings enable row level security;

create policy "players see their bookings; staff see their venue's"
  on public.bookings for select to authenticated
  using (
    booked_by = (select auth.uid())
    or public.is_venue_member(public.court_venue(court_id))
    or public.is_admin()
  );

-- Venue staff record walk-ins and phone bookings and block slots by hand.
-- App bookings are created only by the API, after payment.
create policy "staff add manual entries"
  on public.bookings for insert to authenticated
  with check (
    source in ('walk_in', 'phone', 'block')
    and status = 'confirmed'
    and booked_by is null
    and public.is_venue_member(public.court_venue(court_id))
  );

create policy "staff edit manual entries"
  on public.bookings for update to authenticated
  using (source in ('walk_in', 'phone', 'block') and public.is_venue_member(public.court_venue(court_id)))
  with check (
    source in ('walk_in', 'phone', 'block')
    and status in ('confirmed', 'cancelled')
    and booked_by is null
    and public.is_venue_member(public.court_venue(court_id))
  );

create policy "staff delete manual entries"
  on public.bookings for delete to authenticated
  using (source in ('walk_in', 'phone', 'block') and public.is_venue_member(public.court_venue(court_id)));

-- Players see when a court is busy, never who booked it.
create function public.court_busy_ranges(p_court_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select lower(b.during), upper(b.during)
  from public.bookings b
  join public.courts c on c.id = b.court_id
  join public.venues v on v.id = c.venue_id
  where b.court_id = p_court_id
    and b.status in ('held', 'confirmed')
    and b.during && tstzrange(p_from, p_to, '[)')
    and (v.is_published or public.is_venue_member(v.id))
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Matches. Created and changed only by the API; apps read them and get live
-- updates through Realtime.
-- ---------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  -- Copied from the booking so lists can filter without reading bookings.
  venue_id uuid not null references public.venues (id),
  court_id uuid not null references public.courts (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sport public.sport not null,
  mode public.match_mode not null,
  team_size smallint not null check (team_size between 1 and 5),
  status public.match_status not null default 'open_allies',
  created_by uuid not null references public.profiles (id),
  opened_public_at timestamptz,
  winning_team smallint check (winning_team in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index matches_open_idx on public.matches (sport, starts_at) where status = 'open_public';
create index matches_venue_idx on public.matches (venue_id, starts_at);
create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

create table public.match_participants (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  team smallint not null check (team in (1, 2)),
  status public.participant_status not null,
  share_cents integer not null check (share_cents >= 0),
  hold_expires_at timestamptz,
  -- Null until attendance is recorded after the match.
  attended boolean,
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id),
  check (status <> 'held' or hold_expires_at is not null)
);

create index match_participants_user_idx on public.match_participants (user_id);

create table public.match_invites (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.result_confirmations (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  winning_team smallint not null check (winning_team in (1, 2)),
  confirmed_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches (id) on delete cascade,
  raised_by uuid not null references public.profiles (id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Visibility helpers -------------------------------------------------------

create function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_participants p
    where p.match_id = p_match_id and p.user_id = (select auth.uid())
      and p.status in ('held', 'paid')
  );
$$;

-- A match is visible when it is open to the public, or you created it, were
-- invited to it, or are playing in it.
create function public.can_see_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (
        m.status = 'open_public'
        or m.created_by = (select auth.uid())
        or exists (select 1 from public.match_invites i where i.match_id = m.id and i.user_id = (select auth.uid()))
        or public.is_match_participant(m.id)
        or public.is_admin()
      )
  );
$$;

alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_invites enable row level security;
alter table public.result_confirmations enable row level security;
alter table public.disputes enable row level security;

create policy "visible matches"
  on public.matches for select to authenticated
  using (public.can_see_match(id));

create policy "lobby of visible matches"
  on public.match_participants for select to authenticated
  using (public.can_see_match(match_id));

create policy "your invites, or invites to your match"
  on public.match_invites for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.matches m where m.id = match_id and m.created_by = (select auth.uid()))
  );

create policy "players see confirmations for their match"
  on public.result_confirmations for select to authenticated
  using (public.is_match_participant(match_id) or public.is_admin());

create policy "players and admins see disputes"
  on public.disputes for select to authenticated
  using (public.is_match_participant(match_id) or public.is_admin());

-- Reliability: share of past matches a player actually attended.
create function public.player_reliability(p_user_ids uuid[])
returns table (user_id uuid, matches_recorded bigint, matches_attended bigint, reliability_pct numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id,
         count(*) as matches_recorded,
         count(*) filter (where p.attended) as matches_attended,
         round(100.0 * count(*) filter (where p.attended) / nullif(count(*), 0), 0) as reliability_pct
  from public.match_participants p
  where p.user_id = any (p_user_ids) and p.attended is not null
  group by p.user_id;
$$;
