-- Court photos: one to five per court, so players see the court they are booking.
--
-- Every court open for booking needs at least one photo before its venue can be submitted for
-- review (the same check that already requires a court and opening hours). Courts switched off
-- aren't shown to players, so they don't need one. Venues already submitted or live are not
-- affected until they are submitted again.

-- True when every path is inside the venue's own folder of the venue-photos bucket, like the
-- venue's logo and cover (venues_logo_in_own_folder). A function, because a check constraint
-- can't loop over an array itself.
create function public.paths_in_venue_folder(p_paths text[], p_venue_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p like p_venue_id::text || '/%'), true) from unnest(p_paths) as p
$$;

alter table public.courts
  add column photo_paths text[] not null default '{}',
  add constraint courts_photo_count check (cardinality(photo_paths) <= 5),
  add constraint courts_photos_in_own_folder check (public.paths_in_venue_folder(photo_paths, venue_id));

-- As before, plus the court-photo check on submitting.
create or replace function public.guard_venue_update()
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
    if exists (select 1 from public.courts c where c.venue_id = new.id and c.is_active and cardinality(c.photo_paths) = 0) then
      raise exception 'add a photo of every court open for booking before submitting' using errcode = '23514';
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
