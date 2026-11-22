-- Player registration (profile and private details from sign-up metadata), usernames, and
-- self-serve venues.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.act_as(p_user uuid, p_admin boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'app_metadata', json_build_object('verzus_admin', p_admin))::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

create function pg_temp.player(p_username text, p_sports jsonb default '["badminton","tennis"]') returns jsonb
language sql as $$
  select jsonb_build_object(
    'kind', 'player', 'username', p_username, 'first_name', 'Maria', 'middle_name', '', 'last_name', 'Santos',
    'suffix', 'Jr.', 'phone', '+639171234567', 'province', 'Cebu', 'city', 'Cebu City', 'barangay', 'Lahug',
    'sports', p_sports)
$$;

-- Registration ------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11000000-0000-4000-8000-000000000001', 'maria@test.local', pg_temp.player('Maria.S')),
  ('22000000-0000-4000-8000-000000000002', 'owner2@test.local', '{}'),
  ('33000000-0000-4000-8000-000000000003', 'other@test.local', pg_temp.player('other_one', '["futsal"]'));
-- New accounts wait for approval (account_approval.test.sql); these are approved.
update public.account_reviews set status = 'approved';

select is((select username from public.profiles where id = '11000000-0000-4000-8000-000000000001'), 'maria.s',
  'a registering player gets their username, lowercased');
select is((select sports::text from public.profiles where id = '11000000-0000-4000-8000-000000000001'), '{badminton,tennis}',
  'and their sports');
select is((select display_name from public.profiles where id = '11000000-0000-4000-8000-000000000001'), 'Maria',
  'and their first name as display name');
select is(
  (select row(first_name, middle_name, last_name, suffix, phone, barangay)::text from public.player_details
    where id = '11000000-0000-4000-8000-000000000001'),
  '(Maria,,Santos,Jr.,+639171234567,Lahug)', 'their private details are stored, an empty middle name as none');
select is((select username from public.profiles where id = '22000000-0000-4000-8000-000000000002'), null,
  'an account without a player registration (an owner) gets a plain profile');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
      ('44000000-0000-4000-8000-000000000004', 'dup@test.local', pg_temp.player('MARIA.s'))$$,
  '23505', null, 'usernames are unique, ignoring case');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
      ('44000000-0000-4000-8000-000000000004', 'nosport@test.local', pg_temp.player('nosport', '[]'))$$,
  '23514', null, 'a player needs at least one sport');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
      ('44000000-0000-4000-8000-000000000004', 'bad@test.local', pg_temp.player('bad name!'))$$,
  '23514', null, 'a username is 3 to 20 letters, digits, dots or underscores');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
      ('44000000-0000-4000-8000-000000000004', 'phone@test.local', pg_temp.player('phoney') || '{"phone":"09171234567"}')$$,
  '23514', null, 'the phone number must be a +63 mobile number');

-- Privacy -----------------------------------------------------------------------
select pg_temp.act_as('33000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.player_details), 1, 'a player reads only their own details');
select is((select username from public.profiles where id = '11000000-0000-4000-8000-000000000001'), 'maria.s',
  'but everyone signed in can see usernames');
select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a', true);
select is((select count(*)::int from public.player_details where id in ('11000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000003')), 2, 'verzus reads every player''s details');

-- Usernames ---------------------------------------------------------------------
select pg_temp.act_as_anon();
select is(public.username_available('maria.s'), false, 'a taken username is not available');
select is(public.username_available('Fresh_Name'), true, 'a free one is');
select is(public.username_available('no'), false, 'nor is one too short');
select throws_ok($$select public.login_email('maria.s')$$, '42501', null, 'visitors cannot turn a username into an email');
reset role;
set local role service_role;
select is(public.login_email('Maria.S'), 'maria@test.local', 'the sign-in function can');
reset role;

-- Self-serve venues -------------------------------------------------------------
select pg_temp.act_as('22000000-0000-4000-8000-000000000002');
select set_config('t.venue', public.create_my_venue('Self Serve Courts')::text, true);
reset role;
select is((select role::text from public.venue_members
           where venue_id = current_setting('t.venue')::uuid and user_id = '22000000-0000-4000-8000-000000000002'),
  'owner', 'an owner can start their own venue, as its owner');

select pg_temp.act_as('22000000-0000-4000-8000-000000000002');
select public.create_my_venue('Second Courts');
select public.create_my_venue('Third Courts');
select throws_ok($$select public.create_my_venue('Fourth Courts')$$, '23514', null, 'but no more than three');
reset role;

select * from finish();
rollback;
