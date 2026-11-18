-- Ratings: one OpenSkill rating per user, sport and mode. Written only by the API.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  check (ends_at is null or ends_at > starts_at)
);

create table public.ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport public.sport not null,
  mode public.match_mode not null,
  mu double precision not null,
  sigma double precision not null check (sigma > 0),
  -- Ranked rank uses mu − 3·sigma; stored so leaderboards can sort by an index.
  conservative_score double precision generated always as (mu - 3 * sigma) stored,
  self_assessment public.self_assessment not null,
  games_played integer not null default 0,
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, sport, mode)
);

create index ratings_leaderboard_idx on public.ratings (sport, mode, conservative_score desc);

create table public.rating_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport public.sport not null,
  mode public.match_mode not null,
  match_id uuid references public.matches (id),
  -- 'match' | 'inactivity' | 'season' | 'manual'
  reason text not null check (reason in ('match', 'inactivity', 'season', 'manual')),
  mu_before double precision not null,
  sigma_before double precision not null,
  mu_after double precision not null,
  sigma_after double precision not null,
  created_at timestamptz not null default now()
);

create index rating_history_user_idx on public.rating_history (user_id, sport, created_at desc);

create trigger rating_history_append_only before update or delete on public.rating_history
  for each row execute function public.forbid_change();

alter table public.seasons enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_history enable row level security;

create policy "seasons are public"
  on public.seasons for select to anon, authenticated
  using (true);

-- Ranked ratings feed public leaderboards. Casual ratings stay hidden: they
-- are used only by the API to suggest fair casual games.
create policy "ranked ratings are readable; casual only by their owner"
  on public.ratings for select to authenticated
  using (mode = 'ranked' or user_id = (select auth.uid()));

create policy "players see their own rating history"
  on public.rating_history for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
