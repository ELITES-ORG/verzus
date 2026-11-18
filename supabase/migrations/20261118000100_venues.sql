-- Venues, staff, courts, opening hours, and the "venues near me" search.

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  address text not null,
  city text not null,
  location extensions.geography(point, 4326) not null,
  phone text,
  photo_paths text[] not null default '{}',
  is_published boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index venues_location_idx on public.venues using gist (location);
create trigger venues_updated_at before update on public.venues
  for each row execute function public.set_updated_at();

create table public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.venue_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create index venue_members_user_idx on public.venue_members (user_id);

create function public.is_venue_member(p_venue_id uuid, p_owner_only boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.venue_members m
    where m.venue_id = p_venue_id
      and m.user_id = (select auth.uid())
      and (not p_owner_only or m.role = 'owner')
  );
$$;

-- Whoever creates a venue becomes its owner.
create function public.handle_new_venue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.venue_members (venue_id, user_id, role) values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

create trigger on_venue_created
  after insert on public.venues
  for each row execute function public.handle_new_venue();

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sport public.sport not null,
  hourly_rate_cents integer not null check (hourly_rate_cents > 0),
  currency char(3) not null default 'PHP',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index courts_venue_idx on public.courts (venue_id);

create table public.opening_hours (
  venue_id uuid not null references public.venues (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  opens time not null,
  closes time not null,
  primary key (venue_id, weekday),
  check (closes > opens)
);

-- RLS ---------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.courts enable row level security;
alter table public.opening_hours enable row level security;

create policy "published venues are public; members see their own"
  on public.venues for select to anon, authenticated
  using (is_published or public.is_venue_member(id) or public.is_admin());

create policy "signed-in users can create a venue they own"
  on public.venues for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "owners edit their venue"
  on public.venues for update to authenticated
  using (public.is_venue_member(id, true))
  with check (public.is_venue_member(id, true));

create policy "members see their venue's staff"
  on public.venue_members for select to authenticated
  using (public.is_venue_member(venue_id) or public.is_admin());

create policy "owners add staff"
  on public.venue_members for insert to authenticated
  with check (public.is_venue_member(venue_id, true));

create policy "owners remove staff"
  on public.venue_members for delete to authenticated
  using (public.is_venue_member(venue_id, true) and user_id <> (select auth.uid()));

create policy "courts of visible venues are visible"
  on public.courts for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id));

create policy "owners manage courts"
  on public.courts for all to authenticated
  using (public.is_venue_member(venue_id, true))
  with check (public.is_venue_member(venue_id, true));

create policy "hours of visible venues are visible"
  on public.opening_hours for select to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id));

create policy "owners manage hours"
  on public.opening_hours for all to authenticated
  using (public.is_venue_member(venue_id, true))
  with check (public.is_venue_member(venue_id, true));

-- Search ------------------------------------------------------------------

-- Venues within p_radius_m metres, nearest first, optionally only those with a
-- court for p_sport. SECURITY INVOKER: RLS above still decides what is visible.
create function public.venues_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 10000,
  p_sport public.sport default null
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  photo_paths text[],
  distance_m double precision,
  min_hourly_rate_cents integer
)
language sql
stable
set search_path = ''
as $$
  with here as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select v.id, v.name, v.address, v.city, v.photo_paths,
         extensions.st_distance(v.location, here.g) as distance_m,
         r.min_rate as min_hourly_rate_cents
  from public.venues v
  cross join here
  -- Only venues with at least one active court for the sport.
  join lateral (
    select min(c.hourly_rate_cents) as min_rate
    from public.courts c
    where c.venue_id = v.id and c.is_active and (p_sport is null or c.sport = p_sport)
  ) r on r.min_rate is not null
  where extensions.st_dwithin(v.location, here.g, p_radius_m)
  order by distance_m
  limit 100;
$$;
