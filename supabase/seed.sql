-- Local development data. Never used in production: `supabase db push` does not run this file.
-- Runs on `supabase db reset` / first `supabase start`, and can be re-run any time with
-- `pnpm db:seed` (every insert skips rows that already exist).
--
-- Dev accounts (all use the password `verzus-dev`; the /dev-login pages sign in with them):
--   admin@verzus.local    verzus admin (review queue, owner invites)
--   owner@verzus.local    NEW venue owner: no venue yet, plus an unused owner invite, so the first
--                         dev login goes through onboarding (invite, name the venue, setup wizard)
--   venues@verzus.local   ESTABLISHED owner of the sample venues: Makati Hoops Center and BGC
--                         Smash Hall (live) and Kapitolyo Courts (waiting for review)
--   staff@verzus.local    staff at BGC Smash Hall
--   player1@verzus.local  player, badminton Silver II
--   player2@verzus.local  player, badminton Silver I

-- Users ------------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('verzus-dev', extensions.gen_salt('bf')), now(),
       jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')) || u.app_meta,
       jsonb_build_object('name', u.name), now(), now(), '', '', '', ''
from (values
  ('eeeeeeee-0000-4000-8000-000000000001'::uuid, 'admin@verzus.local', 'Ada (admin)', '{"verzus_admin": true}'::jsonb),
  ('eeeeeeee-0000-4000-8000-000000000002'::uuid, 'owner@verzus.local', 'Oscar (new owner)', '{}'::jsonb),
  ('eeeeeeee-0000-4000-8000-000000000006'::uuid, 'venues@verzus.local', 'Vera (venue owner)', '{}'::jsonb),
  ('eeeeeeee-0000-4000-8000-000000000003'::uuid, 'staff@verzus.local', 'Sam (staff)', '{}'::jsonb),
  ('eeeeeeee-0000-4000-8000-000000000004'::uuid, 'player1@verzus.local', 'Pia (player)', '{}'::jsonb),
  ('eeeeeeee-0000-4000-8000-000000000005'::uuid, 'player2@verzus.local', 'Paolo (player)', '{}'::jsonb)
) as u (id, email, name, app_meta)
on conflict (id) do nothing;

-- Password sign-in also needs an email identity per user.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id::text like 'eeeeeeee-0000-4000-8000-%'
on conflict (provider_id, provider) do nothing;

-- Venues -------------------------------------------------------------------------------
insert into public.venues (id, name, description, address, city, location, status, phone)
values
  ('00000000-0000-4000-8000-000000000001', 'Makati Hoops Center', 'Two indoor full courts.',
   'Ayala Ave, Makati', 'Makati',
   extensions.st_setsrid(extensions.st_makepoint(121.0244, 14.5547), 4326)::extensions.geography, 'live', '0917 555 0001'),
  ('00000000-0000-4000-8000-000000000002', 'BGC Smash Hall', 'Six badminton courts, air-conditioned.',
   '28th St, Bonifacio Global City', 'Taguig',
   extensions.st_setsrid(extensions.st_makepoint(121.0509, 14.5509), 4326)::extensions.geography, 'live', '0917 555 0002'),
  ('00000000-0000-4000-8000-000000000003', 'Kapitolyo Courts', 'Two outdoor courts under a roof. Parking on the street.',
   'East Capitol Dr, Kapitolyo', 'Pasig',
   extensions.st_setsrid(extensions.st_makepoint(121.0612, 14.5712), 4326)::extensions.geography, 'live', null)
on conflict (id) do nothing;

insert into public.venue_members (venue_id, user_id, role)
values
  ('00000000-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000006', 'owner'),
  ('00000000-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000006', 'owner'),
  ('00000000-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-000000000006', 'owner'),
  ('00000000-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-000000000003', 'staff')
on conflict (venue_id, user_id) do nothing;

-- The new owner's invite. The venue portal's dev login sends owner@verzus.local here the first
-- time; once redeemed it stays used (run `pnpm db:reset` to go through onboarding again).
insert into public.venue_invites (token, note, expires_at)
values ('dddddddd-0000-4000-8000-000000000001', 'Dev: owner@verzus.local (seed)', '2099-01-01T00:00:00Z')
on conflict (token) do nothing;

-- Each court gets one photo path (venues need a photo of every open court to be submitted). The
-- files aren't in local storage, so these show as missing images; upload real ones in the app.
insert into public.courts (venue_id, name, sport, hourly_rate_cents, photo_paths)
select x.venue_id, x.name, x.sport::public.sport, x.rate,
       array[x.venue_id::text || '/court-' || lower(replace(x.name, ' ', '-')) || '.webp']
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Court 1', 'basketball', 120000),
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Court 2', 'basketball', 120000),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Court A', 'badminton', 30000),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Court B', 'badminton', 30000),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Court 1', 'pickleball', 40000),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Court 2', 'pickleball', 40000)
) as x (venue_id, name, sport, rate)
where not exists (select 1 from public.courts c where c.venue_id = x.venue_id and c.name = x.name);

insert into public.opening_hours (venue_id, weekday, opens, closes)
select v.id, d, '07:00', '23:00'
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid),
  ('00000000-0000-4000-8000-000000000002'::uuid),
  ('00000000-0000-4000-8000-000000000003'::uuid)
) as v (id)
cross join generate_series(0, 6) as d
on conflict (venue_id, weekday) do nothing;

-- Kapitolyo Courts waits in the admin review queue. It was inserted as live (complete in one
-- step); now that it has courts and hours it can move to submitted, like a real submission.
update public.venues
   set status = 'submitted', submitted_at = coalesce(submitted_at, now())
 where id = '00000000-0000-4000-8000-000000000003' and status = 'live' and reviewed_at is null;

-- Players -------------------------------------------------------------------------------
insert into public.ratings (user_id, sport, mode, mu, sigma, self_assessment, games_played, last_played_at)
values
  ('eeeeeeee-0000-4000-8000-000000000004', 'badminton', 'ranked', 15.0, 2.1, 'intermediate', 12, now() - interval '2 days'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'badminton', 'ranked', 17.2, 1.9, 'advanced', 30, now() - interval '1 day')
on conflict (user_id, sport, mode) do nothing;

insert into public.seasons (name, starts_at)
select 'Season 1', '2026-12-01T00:00:00+08:00'
where not exists (select 1 from public.seasons where name = 'Season 1');
