-- Venue onboarding: review status, logo and cover photo, owner and staff invites.
--
-- Venues are invite-only for now. A verzus admin creates an invite link; the owner signs in and
-- redeems it, which creates a draft venue they own. They fill it in and submit it; only an admin
-- can make it live. Players only ever see live venues.

create type public.venue_status as enum ('draft', 'submitted', 'live', 'suspended');

-- ---------------------------------------------------------------------------
-- Status replaces is_published. is_published stays as a generated column so
-- existing readers (court_busy_ranges, the API) keep working unchanged.
-- ---------------------------------------------------------------------------

drop policy "published venues are public; members see their own" on public.venues;

alter table public.venues add column status public.venue_status not null default 'draft';
update public.venues set status = 'live' where is_published;
alter table public.venues drop column is_published;
alter table public.venues add column is_published boolean generated always as (status = 'live') stored;

create index venues_status_idx on public.venues (status);

-- A new draft has only a name; the rest is required before it can be submitted.
alter table public.venues
  alter column address drop not null,
  alter column city drop not null,
  alter column location drop not null;

alter table public.venues
  add column logo_path text,
  add column cover_path text,
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  -- Shown to the owner, e.g. "the cover photo is too dark".
  add column review_note text,
  -- Logo and cover live in the venue's own folder of the venue-photos bucket.
  add constraint venues_logo_in_own_folder check (logo_path is null or logo_path like id::text || '/%'),
  add constraint venues_cover_in_own_folder check (cover_path is null or cover_path like id::text || '/%'),
  add constraint venues_complete_unless_draft
    check (status = 'draft' or (address is not null and city is not null and location is not null));

-- Owners may only move draft <-> submitted, and never touch review fields. Submitting needs at
-- least one active court and opening hours. Runs as the caller (SECURITY INVOKER) so current_user
-- is 'authenticated' for app requests; the API and migrations (postgres) and admins pass through.
create function public.guard_venue_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  privileged boolean := current_user not in ('authenticated', 'anon') or public.is_admin();
begin
  if not privileged then
    if new.review_note is distinct from old.review_note
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.submitted_at is distinct from old.submitted_at
       or new.created_by is distinct from old.created_by then
      raise exception 'only verzus can change review fields' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and not ((old.status = 'draft' and new.status = 'submitted')
             or (old.status = 'submitted' and new.status = 'draft')) then
      raise exception 'only verzus can change a venue from % to %', old.status, new.status using errcode = '42501';
    end if;
  end if;

  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    if not exists (select 1 from public.courts c where c.venue_id = new.id and c.is_active) then
      raise exception 'add at least one court before submitting' using errcode = '23514';
    end if;
    if not exists (select 1 from public.opening_hours h where h.venue_id = new.id) then
      raise exception 'add opening hours before submitting' using errcode = '23514';
    end if;
    new.submitted_at := now();
  end if;

  if new.status in ('live', 'suspended') and new.status is distinct from old.status then
    new.reviewed_at := now();
    new.reviewed_by := (select auth.uid());
  end if;

  return new;
end;
$$;

create trigger venues_guard before update on public.venues
  for each row execute function public.guard_venue_update();

-- Policies ------------------------------------------------------------------

create policy "live venues are public; members and admins see theirs"
  on public.venues for select to anon, authenticated
  using (status = 'live' or public.is_venue_member(id) or public.is_admin());

-- Venues are created by redeeming an invite, not inserted directly.
drop policy "signed-in users can create a venue they own" on public.venues;

create policy "admins manage venues"
  on public.venues for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Owner invites (created by admins, redeemed by the venue owner)
-- ---------------------------------------------------------------------------

create table public.venue_invites (
  -- The token is the secret in the invite link (122 random bits).
  token uuid primary key default gen_random_uuid(),
  -- Who it's for, so admins can tell invites apart, e.g. "Smash Hall BGC, Mark (owner)".
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz,
  venue_id uuid references public.venues (id) on delete set null
);

alter table public.venue_invites enable row level security;

create policy "admins manage venue invites"
  on public.venue_invites for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Redeems an owner invite: creates a draft venue owned by the caller. Returns the venue id.
create function public.redeem_venue_invite(p_token uuid, p_venue_name text)
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

revoke execute on function public.redeem_venue_invite(uuid, text) from public, anon;
grant execute on function public.redeem_venue_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff invites (created by owners, redeemed by staff)
-- ---------------------------------------------------------------------------

create table public.venue_staff_invites (
  token uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  note text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz
);

create index venue_staff_invites_venue_idx on public.venue_staff_invites (venue_id);

alter table public.venue_staff_invites enable row level security;

create policy "owners manage their venue's staff invites"
  on public.venue_staff_invites for all to authenticated
  using (public.is_venue_member(venue_id, true) or public.is_admin())
  with check (public.is_venue_member(venue_id, true) or public.is_admin());

-- Redeems a staff invite: the caller joins the venue as staff. Returns the venue id.
create function public.redeem_staff_invite(p_token uuid)
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

revoke execute on function public.redeem_staff_invite(uuid) from public, anon;
grant execute on function public.redeem_staff_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Photos (logo, cover, gallery) are the owner's job; staff run the calendar.
-- ---------------------------------------------------------------------------

create function public.is_owner_of_venue_folder(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(p_name))[1];
begin
  if folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  return public.is_venue_member(folder::uuid, true);
end;
$$;

drop policy "venue staff upload venue photos" on storage.objects;
drop policy "venue staff replace venue photos" on storage.objects;
drop policy "venue staff delete venue photos" on storage.objects;
drop function public.is_member_of_venue_folder(text);

create policy "venue owners upload venue photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-photos' and public.is_owner_of_venue_folder(name));

create policy "venue owners replace venue photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'venue-photos' and public.is_owner_of_venue_folder(name));

create policy "venue owners delete venue photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and public.is_owner_of_venue_folder(name));
