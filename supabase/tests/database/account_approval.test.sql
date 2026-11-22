-- Account approval: new accounts wait for an admin; pending and rejected accounts can't act;
-- reviews are private; admins approve, reject with a reason, and see the queue and numbers.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create function pg_temp.act_as(p_user uuid, p_admin boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'app_metadata', json_build_object('verzus_admin', p_admin))::text, true);
  execute 'set local role authenticated';
end;
$$;

-- A confirmed player, a confirmed owner, an owner who hasn't confirmed, an approved player, an admin.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data) values
  ('a1000000-0000-4000-8000-000000000001', 'pia@test.local', now(), jsonb_build_object(
     'kind', 'player', 'username', 'pia_p', 'first_name', 'Pia', 'last_name', 'Cruz', 'phone', '+639171112222',
     'province', 'Cebu', 'city', 'Cebu City', 'barangay', 'Lahug', 'sports', jsonb_build_array('badminton')), '{}'),
  ('a2000000-0000-4000-8000-000000000002', 'olga@test.local', now(), jsonb_build_object(
     'kind', 'venue_owner', 'first_name', 'Olga', 'last_name', 'Reyes', 'suffix', 'Jr.', 'phone', '+639173334444'), '{}'),
  ('a3000000-0000-4000-8000-000000000003', 'nobody-yet@test.local', null, jsonb_build_object(
     'kind', 'venue_owner', 'first_name', 'Nil', 'last_name', 'Yet', 'phone', '+639175556666'), '{}'),
  ('a4000000-0000-4000-8000-000000000004', 'old@test.local', now(), '{}', '{}'),
  ('a5000000-0000-4000-8000-000000000005', 'admin@test.local', now(), '{}', '{"verzus_admin": true}');
update public.account_reviews set status = 'approved' where id = 'a4000000-0000-4000-8000-000000000004';

select is((select row(kind, status)::text from public.account_reviews where id = 'a1000000-0000-4000-8000-000000000001'),
  '(player,pending)', 'a new player waits for approval');
select is((select row(kind, status)::text from public.account_reviews where id = 'a2000000-0000-4000-8000-000000000002'),
  '(venue_owner,pending)', 'so does a new venue owner');
select is((select row(first_name, last_name, suffix, phone)::text from public.owner_details
            where id = 'a2000000-0000-4000-8000-000000000002'),
  '(Olga,Reyes,Jr.,+639173334444)', 'an owner''s name and mobile are stored');

-- Pending accounts can't act ---------------------------------------------------------------
select pg_temp.act_as('a2000000-0000-4000-8000-000000000002');
select throws_ok($$select public.create_my_venue('Too Early Courts')$$, '42501', null,
  'a pending owner cannot create a venue');
select pg_temp.act_as('a1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$insert into public.allies (requester_id, addressee_id) values
      ('a1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'a pending player cannot add allies');
reset role;
select throws_ok(
  $$insert into public.match_participants (match_id, user_id, team, status, share_cents)
      values (gen_random_uuid(), 'a1000000-0000-4000-8000-000000000001', 1, 'paid', 0)$$,
  '42501', null, 'nor join a match (checked even for trusted writes)');

-- Privacy ------------------------------------------------------------------------------------
select pg_temp.act_as('a4000000-0000-4000-8000-000000000004');
select is((select count(*)::int from public.account_reviews), 1, 'people read only their own review');
select is((select count(*)::int from public.owner_details), 0, 'and not other people''s owner details');
select throws_ok($$select * from public.admin_accounts()$$, '42501', null, 'only admins list accounts');
select throws_ok($$select * from public.admin_stats()$$, '42501', null, 'only admins see the numbers');
select throws_ok($$select public.review_account('a1000000-0000-4000-8000-000000000001', true)$$, '42501', null,
  'only admins review accounts');
update public.account_reviews set status = 'rejected', note = 'self-inflicted';
select is((select status::text from public.account_reviews), 'approved', 'nobody changes their own review');

-- The admin queue ---------------------------------------------------------------------------
select pg_temp.act_as('a5000000-0000-4000-8000-000000000005', true);
select is(
  (select array_agg(email order by email) from public.admin_accounts('pending')),
  array['olga@test.local', 'pia@test.local'],
  'the queue lists pending accounts that confirmed their email, and no admins');
select is((select row(first_name, city, sports)::text from public.admin_accounts('pending') where email = 'pia@test.local'),
  '(Pia,"Cebu City",{badminton})', 'with their details');
select is(
  (select row(players_pending, owners_pending, owners_unconfirmed)::text from public.admin_stats()),
  '(1,1,1)', 'the numbers count confirmed and unconfirmed sign-ups apart');

select throws_ok($$select public.review_account('a2000000-0000-4000-8000-000000000002', false, '')$$, '23514', null,
  'a rejection needs a reason');
select lives_ok($$select public.review_account('a2000000-0000-4000-8000-000000000002', false, 'Use your real name')$$,
  'an admin rejects with a reason');
select lives_ok($$select public.review_account('a1000000-0000-4000-8000-000000000001', true)$$, 'and approves');

-- After review --------------------------------------------------------------------------------
select pg_temp.act_as('a2000000-0000-4000-8000-000000000002');
select is((select row(status, note)::text from public.account_reviews), '(rejected,"Use your real name")',
  'the rejected owner sees why');
select throws_ok($$select public.create_my_venue('Still No Courts')$$, '42501', null, 'and still cannot create a venue');
select lives_ok($$update public.owner_details set first_name = 'Olga Maria'$$, 'they can fix their details');
select lives_ok($$select public.resubmit_account()$$, 'and resubmit');
select is((select status::text from public.account_reviews), 'pending', 'which puts them back in the queue');

select pg_temp.act_as('a1000000-0000-4000-8000-000000000001');
select lives_ok(
  $$insert into public.allies (requester_id, addressee_id) values
      ('a1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000004')$$,
  'an approved player can act');
reset role;

select * from finish();
rollback;
