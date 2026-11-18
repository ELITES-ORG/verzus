-- Venue onboarding rules: invites, review status, logo/cover paths, staff, photo uploads.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'admin@test.local'),
  ('10000000-0000-4000-8000-000000000001', 'owner@test.local'),
  ('20000000-0000-4000-8000-000000000002', 'outsider@test.local'),
  ('30000000-0000-4000-8000-000000000003', 'staff@test.local');

-- Act as a signed-in user (optionally a verzus admin) for the rest of the transaction.
create function pg_temp.act_as(p_user uuid, p_admin boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'app_metadata', json_build_object('verzus_admin', p_admin))::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Act as a signed-out visitor (no claims left over from a previous user).
create function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

-- Invites ----------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a', true);
select lives_ok(
  $$insert into public.venue_invites (token, note) values
      ('d0000000-0000-4000-8000-000000000001', 'Test owner'),
      ('d0000000-0000-4000-8000-000000000002', 'Expired')$$,
  'an admin can create owner invites');
reset role;
update public.venue_invites set expires_at = now() - interval '1 day' where token = 'd0000000-0000-4000-8000-000000000002';

select pg_temp.act_as('20000000-0000-4000-8000-000000000002');
select throws_ok(
  $$insert into public.venue_invites (note) values ('sneaky')$$,
  '42501', null, 'a non-admin cannot create invites');
select is((select count(*)::int from public.venue_invites), 0, 'a non-admin cannot read invites');

select throws_ok(
  $$insert into public.venues (name, created_by) values ('Self-made Courts', '20000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'nobody can create a venue without an invite');

select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
select set_config('t.venue', public.redeem_venue_invite('d0000000-0000-4000-8000-000000000001', 'Draft Courts')::text, true);
reset role;

select is((select role::text from public.venue_members
           where venue_id = current_setting('t.venue')::uuid and user_id = '10000000-0000-4000-8000-000000000001'),
  'owner', 'redeeming an invite makes the caller the owner');
select is((select status::text from public.venues where id = current_setting('t.venue')::uuid), 'draft',
  'the new venue starts as a draft');

select pg_temp.act_as('20000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.redeem_venue_invite('d0000000-0000-4000-8000-000000000001', 'Again')$$,
  'P0002', null, 'an invite works once');
select throws_ok(
  $$select public.redeem_venue_invite('d0000000-0000-4000-8000-000000000002', 'Late')$$,
  'P0002', null, 'an expired invite does not work');

-- Owner fills in the venue ----------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');

select throws_ok(
  format($$update public.venues set status = 'live' where id = %L$$, current_setting('t.venue')),
  '42501', null, 'an owner cannot publish their own venue');

select lives_ok(
  format($$update public.venues set address = '1 Test St', city = 'Makati',
             location = extensions.st_setsrid(extensions.st_makepoint(121.02, 14.55), 4326)::extensions.geography
           where id = %L$$, current_setting('t.venue')),
  'an owner can fill in their draft');

select throws_ok(
  format($$update public.venues set status = 'submitted' where id = %L$$, current_setting('t.venue')),
  '23514', 'add at least one court before submitting', 'a venue without courts cannot be submitted');

select lives_ok(
  format($$insert into public.courts (venue_id, name, sport, hourly_rate_cents) values (%L, 'Court 1', 'badminton', 30000);
           insert into public.opening_hours (venue_id, weekday, opens, closes) values (%L, 1, '08:00', '22:00')$$,
         current_setting('t.venue'), current_setting('t.venue')),
  'an owner can add courts and hours');

select throws_ok(
  format($$update public.venues set logo_path = 'someone-else/logo.png' where id = %L$$, current_setting('t.venue')),
  '23514', null, 'the logo must be in the venue''s own folder');

select lives_ok(
  format($$update public.venues set logo_path = %L, cover_path = %L where id = %L$$,
         current_setting('t.venue') || '/logo.png', current_setting('t.venue') || '/cover.jpg', current_setting('t.venue')),
  'an owner can set a logo and cover photo from their folder');

select lives_ok(
  format($$update public.venues set status = 'submitted' where id = %L$$, current_setting('t.venue')),
  'a complete venue can be submitted');

select throws_ok(
  format($$update public.venues set review_note = 'looks great' where id = %L$$, current_setting('t.venue')),
  '42501', null, 'an owner cannot write review notes');

-- Review ----------------------------------------------------------------------------
reset role;
select pg_temp.act_as_anon();
select is((select count(*)::int from public.venues where id = current_setting('t.venue')::uuid), 0,
  'players cannot see a venue under review');
reset role;

select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a', true);
select lives_ok(
  format($$update public.venues set status = 'live' where id = %L$$, current_setting('t.venue')),
  'an admin can publish a submitted venue');
reset role;

select pg_temp.act_as_anon();
select is((select count(*)::int from public.venues where id = current_setting('t.venue')::uuid and is_published), 1,
  'players see the venue once it is live');
reset role;

-- Staff -------------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
insert into public.venue_staff_invites (token, venue_id, note)
values ('e0000000-0000-4000-8000-000000000001', current_setting('t.venue')::uuid, 'Front desk');

select pg_temp.act_as('30000000-0000-4000-8000-000000000003');
select public.redeem_staff_invite('e0000000-0000-4000-8000-000000000001');
update public.venues set name = 'Renamed by staff' where id = current_setting('t.venue')::uuid;
reset role;

select is((select role::text from public.venue_members
           where venue_id = current_setting('t.venue')::uuid and user_id = '30000000-0000-4000-8000-000000000003'),
  'staff', 'a staff invite adds the caller as staff');
select is((select name from public.venues where id = current_setting('t.venue')::uuid), 'Draft Courts',
  'staff cannot edit the venue profile');

-- Photos: owners upload to their venue's folder; staff cannot.
select pg_temp.act_as('30000000-0000-4000-8000-000000000003');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('venue-photos', %L)$$, current_setting('t.venue') || '/staff.png'),
  '42501', null, 'staff cannot upload venue photos');
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('venue-photos', %L)$$, current_setting('t.venue') || '/cover.jpg'),
  'an owner can upload to their venue''s folder');
reset role;

-- People list: owners and admins see emails; staff and outsiders see nothing.
select pg_temp.act_as('10000000-0000-4000-8000-000000000001');
select is((select string_agg(role::text || ':' || email, ',' order by role) from public.venue_people(current_setting('t.venue')::uuid)),
  'owner:owner@test.local,staff:staff@test.local', 'an owner sees their venue''s people with emails');
select pg_temp.act_as('30000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.venue_people(current_setting('t.venue')::uuid)), 0, 'staff cannot list emails');
select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a', true);
select is((select count(*)::int from public.venue_people(current_setting('t.venue')::uuid)), 2, 'an admin sees the people list');
reset role;

select * from finish();
rollback;
