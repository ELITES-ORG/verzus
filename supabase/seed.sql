-- Local development data. Runs on `supabase db reset`. Never used in production.

insert into public.venues (id, name, description, address, city, location, status, created_by)
values
  ('00000000-0000-4000-8000-000000000001', 'Makati Hoops Center', 'Two indoor full courts.',
   'Ayala Ave, Makati', 'Makati',
   extensions.st_setsrid(extensions.st_makepoint(121.0244, 14.5547), 4326)::extensions.geography, 'live', null),
  ('00000000-0000-4000-8000-000000000002', 'BGC Smash Hall', 'Six badminton courts, air-conditioned.',
   '28th St, Bonifacio Global City', 'Taguig',
   extensions.st_setsrid(extensions.st_makepoint(121.0509, 14.5509), 4326)::extensions.geography, 'live', null);

insert into public.courts (venue_id, name, sport, hourly_rate_cents)
values
  ('00000000-0000-4000-8000-000000000001', 'Court 1', 'basketball', 120000),
  ('00000000-0000-4000-8000-000000000001', 'Court 2', 'basketball', 120000),
  ('00000000-0000-4000-8000-000000000002', 'Court A', 'badminton', 30000),
  ('00000000-0000-4000-8000-000000000002', 'Court B', 'badminton', 30000);

insert into public.opening_hours (venue_id, weekday, opens, closes)
select v.id, d, '07:00', '23:00'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (id)
cross join generate_series(0, 6) as d;

insert into public.seasons (name, starts_at) values ('Season 1', '2026-12-01T00:00:00+08:00');
