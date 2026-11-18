-- Database guarantees the rest of verzus relies on. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'owner@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'player@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'other@test.local');

select ok(exists (select 1 from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'a profile is created for every new auth user');

-- Owner creates a venue and becomes its owner.
insert into public.venues (id, name, address, city, location, status, created_by)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Test Courts', '1 Test St', 'Makati',
        extensions.st_setsrid(extensions.st_makepoint(121.02, 14.55), 4326)::extensions.geography,
        'live', '11111111-1111-4111-8111-111111111111');

select is((select role::text from public.venue_members
           where venue_id = 'aaaaaaaa-0000-4000-8000-000000000001'
             and user_id = '11111111-1111-4111-8111-111111111111'),
  'owner', 'the venue creator becomes its owner');

insert into public.courts (id, venue_id, name, sport, hourly_rate_cents)
values ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Court 1', 'badminton', 30000);

-- Double booking -------------------------------------------------------------
insert into public.bookings (court_id, during, status, source)
values ('cccccccc-0000-4000-8000-000000000001', '[2026-12-01 18:00+08, 2026-12-01 19:00+08)', 'confirmed', 'walk_in');

select throws_ok(
  $$insert into public.bookings (court_id, during, status, source, booked_by, hold_expires_at)
    values ('cccccccc-0000-4000-8000-000000000001', '[2026-12-01 18:30+08, 2026-12-01 19:30+08)',
            'held', 'app', '22222222-2222-4222-8222-222222222222', now() + interval '10 minutes')$$,
  '23P01', null, 'an app hold cannot overlap a walk-in on the same court');

select lives_ok(
  $$insert into public.bookings (court_id, during, status, source, booked_by, hold_expires_at)
    values ('cccccccc-0000-4000-8000-000000000001', '[2026-12-01 19:00+08, 2026-12-01 20:00+08)',
            'held', 'app', '22222222-2222-4222-8222-222222222222', now() + interval '10 minutes')$$,
  'back-to-back slots are allowed');

select lives_ok(
  $$insert into public.bookings (court_id, during, status, source)
    values ('cccccccc-0000-4000-8000-000000000001', '[2026-12-01 18:00+08, 2026-12-01 19:00+08)', 'cancelled', 'phone')$$,
  'cancelled rows do not block a slot');

select throws_ok(
  $$insert into public.bookings (court_id, during, status, source, hold_expires_at)
    values ('cccccccc-0000-4000-8000-000000000001', '[2026-12-02 10:00+08, 2026-12-02 11:00+08)', 'held', 'app', now())$$,
  '23514', null, 'an app booking must name the player');

-- Expired holds are released -------------------------------------------------
update public.bookings set hold_expires_at = now() - interval '1 minute' where status = 'held';
select public.expire_holds();
select is((select count(*)::int from public.bookings where status = 'held'), 0, 'expire_holds releases unpaid holds');

-- Ledger -------------------------------------------------------------------------
select throws_ok(
  $$insert into public.ledger_entries (txn_id, account, account_id, amount_cents, currency, kind)
    values ('dddddddd-0000-4000-8000-000000000001', 'player', '22222222-2222-4222-8222-222222222222', 15000, 'PHP', 'share_credit');
    set constraints public.ledger_balanced immediate$$,
  'P0001', null, 'an unbalanced ledger transaction is rejected');

select lives_ok(
  $$insert into public.ledger_entries (txn_id, account, account_id, amount_cents, currency, kind) values
      ('dddddddd-0000-4000-8000-000000000002', 'provider_clearing', null, -15000, 'PHP', 'share_charge'),
      ('dddddddd-0000-4000-8000-000000000002', 'player', '22222222-2222-4222-8222-222222222222', 15000, 'PHP', 'share_credit');
    set constraints public.ledger_balanced immediate$$,
  'a balanced ledger transaction is accepted');

select throws_ok(
  $$update public.ledger_entries set amount_cents = 1 where txn_id = 'dddddddd-0000-4000-8000-000000000002'$$,
  'P0001', null, 'ledger entries cannot be edited');

-- Venue search -------------------------------------------------------------------
-- Checks membership, not rank: other venues (e.g. left by the API integration test) may sit at the same spot.
select ok(exists (select 1 from public.venues_near(14.55, 121.02, 2000, 'badminton') where name = 'Test Courts'),
  'venues_near finds a nearby venue with a court for the sport');

-- RLS: apps cannot write ratings or bookings for app sources ---------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.ratings (user_id, sport, mode, mu, sigma, self_assessment)
    values ('22222222-2222-4222-8222-222222222222', 'badminton', 'ranked', 99, 1, 'advanced')$$,
  '42501', null, 'a player cannot write their own rating');

select throws_ok(
  $$insert into public.bookings (court_id, during, status, source)
    values ('cccccccc-0000-4000-8000-000000000001', '[2026-12-03 10:00+08, 2026-12-03 11:00+08)', 'confirmed', 'walk_in')$$,
  '42501', null, 'a non-member cannot add entries to a venue calendar');

select * from finish();
rollback;
