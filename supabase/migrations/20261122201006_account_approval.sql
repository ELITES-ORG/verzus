-- Every account is reviewed by verzus before it can be used.
--
-- After confirming their email, a new player or venue owner waits for an admin to approve them.
-- Until then (and if rejected) they can sign in and see where they stand, but can't book, join
-- matches, add allies, create a venue or join one. The review lives in account_reviews, which
-- only the person and admins can read (a rejection reason is nobody else's business). Accounts
-- that exist before this migration are approved.
--
-- Venue owners now register with their name and mobile number too (owner_details), so an admin
-- has something to review. A rejected person fixes their details and resubmits.

create type public.account_kind as enum ('player', 'venue_owner');
create type public.account_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table public.account_reviews (
  id uuid primary key references public.profiles (id) on delete cascade,
  -- What they registered as; null for accounts made another way (staff signing in with a code).
  kind public.account_kind,
  status public.account_status not null default 'pending',
  -- Why it was rejected; kept after a resubmission so the next reviewer sees it.
  note text check (note is null or char_length(btrim(note)) between 1 and 500),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null
);

create index account_reviews_status_idx on public.account_reviews (status, submitted_at);

alter table public.account_reviews enable row level security;

create policy "people read their own review; verzus reads all"
  on public.account_reviews for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- No write policies: the sign-up trigger, review_account and resubmit_account write it.

-- Everyone already registered is approved, with their kind where it can be told.
insert into public.account_reviews (id, kind, status, reviewed_at)
select p.id,
       case
         when exists (select 1 from public.player_details d where d.id = p.id) then 'player'::public.account_kind
         when exists (select 1 from public.venue_members m where m.user_id = p.id and m.role = 'owner') then 'venue_owner'
       end,
       'approved',
       now()
from public.profiles p;

-- ---------------------------------------------------------------------------
-- Owner details (private, like player_details)
-- ---------------------------------------------------------------------------

create table public.owner_details (
  id uuid primary key references public.profiles (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 60),
  middle_name text check (middle_name is null or char_length(btrim(middle_name)) between 1 and 60),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 60),
  suffix text check (suffix in ('Jr.', 'Sr.', 'II', 'III', 'IV', 'V')),
  phone text not null check (phone ~ '^\+639[0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger owner_details_updated_at before update on public.owner_details
  for each row execute function public.set_updated_at();

alter table public.owner_details enable row level security;

create policy "owners read their own details; verzus reads all"
  on public.owner_details for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "owners update their own details"
  on public.owner_details for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Sign-up: as before, plus owner details and a pending review for everyone
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_sports public.sport[];
  v_kind public.account_kind;
begin
  if m ->> 'kind' = 'player' then
    v_kind := 'player';
    -- Each sport once, in the enum's order.
    v_sports := array(
      select distinct s::public.sport from jsonb_array_elements_text(coalesce(m -> 'sports', '[]'::jsonb)) as s order by 1
    );
    if cardinality(v_sports) = 0 then
      raise exception 'pick at least one sport' using errcode = '23514';
    end if;

    insert into public.profiles (id, display_name, username, sports, home_city)
    values (new.id, left(btrim(m ->> 'first_name'), 40), lower(btrim(m ->> 'username')), v_sports, btrim(m ->> 'city'));

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
  elsif m ->> 'kind' = 'venue_owner' then
    v_kind := 'venue_owner';
    insert into public.profiles (id, display_name) values (new.id, left(btrim(m ->> 'first_name'), 40));
    insert into public.owner_details (id, first_name, middle_name, last_name, suffix, phone)
    values (
      new.id,
      btrim(m ->> 'first_name'),
      nullif(btrim(m ->> 'middle_name'), ''),
      btrim(m ->> 'last_name'),
      nullif(m ->> 'suffix', ''),
      m ->> 'phone'
    );
  else
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(nullif(m ->> 'name', ''), 'Player'));
  end if;

  insert into public.account_reviews (id, kind) values (new.id, v_kind);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approval checks
-- ---------------------------------------------------------------------------

-- True for an approved account. (Admins are let through separately, where it applies.)
create function public.is_approved(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.account_reviews r where r.id = p_user and r.status = 'approved')
$$;

revoke execute on function public.is_approved(uuid) from public, anon;
grant execute on function public.is_approved(uuid) to authenticated, service_role;

-- The signed-in caller must be approved (or a verzus admin).
create function public.require_approved()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_approved((select auth.uid()))) then
    raise exception 'your account is waiting for approval' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.require_approved() from public, anon;
grant execute on function public.require_approved() to authenticated;

-- Players act only once approved: booking (the player on an app booking), joining a match, and
-- asking someone to be an ally. Bookings made at the desk have no player and aren't affected.
-- The trigger's argument names the column that holds the player.
create function public.guard_player_approved()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if v_user is not null and not public.is_approved(v_user) then
    raise exception 'this account is waiting for approval' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger bookings_player_approved before insert on public.bookings
  for each row execute function public.guard_player_approved('booked_by');
create trigger match_participants_approved before insert on public.match_participants
  for each row execute function public.guard_player_approved('user_id');
create trigger allies_requester_approved before insert on public.allies
  for each row execute function public.guard_player_approved('requester_id');

-- Creating or joining a venue needs an approved account. Same functions as before, with the check.
create or replace function public.create_my_venue(p_venue_name text)
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
  perform public.require_approved();
  if (select count(*) from public.venues where created_by = v_user) >= 3 then
    raise exception 'you can set up at most 3 venues; ask verzus for more' using errcode = '23514';
  end if;
  insert into public.venues (name, created_by) values (btrim(p_venue_name), v_user) returning id into v_venue;
  return v_venue;
end;
$$;

create or replace function public.redeem_venue_invite(p_token uuid, p_venue_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.venue_invites;
  v_venue uuid;
begin
  if v_user is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  perform public.require_approved();
  select * into v_invite from public.venue_invites where token = p_token for update;
  if not found or v_invite.redeemed_at is not null or v_invite.expires_at < now() then
    raise exception 'this invite link has expired or was already used' using errcode = 'P0002';
  end if;

  -- created_by makes the caller the owner (handle_new_venue trigger).
  insert into public.venues (name, created_by) values (p_venue_name, v_user) returning id into v_venue;
  update public.venue_invites
     set redeemed_by = v_user, redeemed_at = now(), venue_id = v_venue
   where token = p_token;
  return v_venue;
end;
$$;

create or replace function public.redeem_staff_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.venue_staff_invites;
begin
  if v_user is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  perform public.require_approved();
  select * into v_invite from public.venue_staff_invites where token = p_token for update;
  if not found or v_invite.redeemed_at is not null or v_invite.expires_at < now() then
    raise exception 'this invite link has expired or was already used' using errcode = 'P0002';
  end if;

  -- An existing member (e.g. the owner opening their own link) keeps their role.
  insert into public.venue_members (venue_id, user_id, role)
  values (v_invite.venue_id, v_user, 'staff')
  on conflict (venue_id, user_id) do nothing;
  update public.venue_staff_invites set redeemed_by = v_user, redeemed_at = now() where token = p_token;
  return v_invite.venue_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviewing and resubmitting
-- ---------------------------------------------------------------------------

-- An admin approves an account, or rejects it with a reason the person will see.
create function public.review_account(p_user uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only verzus can review accounts' using errcode = '42501';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'say why the account is rejected' using errcode = '23514';
  end if;
  update public.account_reviews
     set status = case when p_approve then 'approved'::public.account_status else 'rejected' end,
         note = case when p_approve then null else btrim(p_note) end,
         reviewed_at = now(),
         reviewed_by = (select auth.uid())
   where id = p_user;
  if not found then
    raise exception 'no such account' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.review_account(uuid, boolean, text) from public, anon;
grant execute on function public.review_account(uuid, boolean, text) to authenticated;

-- A rejected person, having fixed their details, sends their account back for review.
create function public.resubmit_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_reviews
     set status = 'pending', submitted_at = now()
   where id = (select auth.uid()) and status = 'rejected';
  if not found then
    raise exception 'only a rejected account can be resubmitted' using errcode = '23514';
  end if;
end;
$$;

revoke execute on function public.resubmit_account() from public, anon;
grant execute on function public.resubmit_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin views
-- ---------------------------------------------------------------------------

-- Accounts with their details, for the admin queue. Only people who have confirmed their email
-- are listed, and verzus admins themselves are left out.
create function public.admin_accounts(p_status public.account_status default 'pending')
returns table (
  id uuid,
  kind public.account_kind,
  status public.account_status,
  note text,
  email text,
  email_confirmed_at timestamptz,
  registered_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  username text,
  sports public.sport[],
  first_name text,
  middle_name text,
  last_name text,
  suffix text,
  phone text,
  province text,
  city text,
  barangay text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only verzus can list accounts' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind, r.status, r.note, u.email::text, u.email_confirmed_at, u.created_at, r.submitted_at,
           r.reviewed_at, p.username, p.sports,
           coalesce(pd.first_name, od.first_name), coalesce(pd.middle_name, od.middle_name),
           coalesce(pd.last_name, od.last_name), coalesce(pd.suffix, od.suffix), coalesce(pd.phone, od.phone),
           pd.province, pd.city, pd.barangay
      from public.account_reviews r
      join auth.users u on u.id = r.id
      join public.profiles p on p.id = r.id
      left join public.player_details pd on pd.id = r.id
      left join public.owner_details od on od.id = r.id
     where r.status = p_status
       and u.email_confirmed_at is not null
       and coalesce((u.raw_app_meta_data ->> 'verzus_admin')::boolean, false) = false
     order by case when p_status = 'pending' then r.submitted_at end asc,
              r.reviewed_at desc nulls last;
end;
$$;

revoke execute on function public.admin_accounts(public.account_status) from public, anon;
grant execute on function public.admin_accounts(public.account_status) to authenticated;

-- The numbers on the admin overview, in one row.
create function public.admin_stats()
returns table (
  players_unconfirmed integer,
  players_pending integer,
  players_approved integer,
  players_rejected integer,
  owners_unconfirmed integer,
  owners_pending integer,
  owners_approved integer,
  owners_rejected integer,
  venues_live integer,
  venues_waiting integer,
  bookings_total integer,
  bookings_week integer,
  bookings_upcoming integer,
  bookings_app integer,
  bookings_desk integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only verzus can see platform numbers' using errcode = '42501';
  end if;
  return query
    with a as (
      select r.kind, r.status, u.email_confirmed_at is not null as confirmed
        from public.account_reviews r
        join auth.users u on u.id = r.id
       where coalesce((u.raw_app_meta_data ->> 'verzus_admin')::boolean, false) = false
    ),
    -- Bookings that are on: confirmed, not time the desk blocked off.
    b as (
      select source, during, created_at from public.bookings where status = 'confirmed' and source <> 'block'
    )
    select
      (select count(*) from a where kind = 'player' and not confirmed)::int,
      (select count(*) from a where kind = 'player' and confirmed and status = 'pending')::int,
      (select count(*) from a where kind = 'player' and status = 'approved')::int,
      (select count(*) from a where kind = 'player' and status = 'rejected')::int,
      (select count(*) from a where kind = 'venue_owner' and not confirmed)::int,
      (select count(*) from a where kind = 'venue_owner' and confirmed and status = 'pending')::int,
      (select count(*) from a where kind = 'venue_owner' and status = 'approved')::int,
      (select count(*) from a where kind = 'venue_owner' and status = 'rejected')::int,
      (select count(*) from public.venues where status = 'live')::int,
      (select count(*) from public.venues where status = 'submitted')::int,
      (select count(*) from b)::int,
      (select count(*) from b where created_at >= now() - interval '7 days')::int,
      (select count(*) from b where lower(during) > now())::int,
      (select count(*) from b where source = 'app')::int,
      (select count(*) from b where source in ('walk_in', 'phone'))::int;
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
