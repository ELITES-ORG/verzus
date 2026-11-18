-- Plain latitude/longitude next to the PostGIS location, for apps that place a map pin.
-- (Through the REST API a geography comes back as hex EWKB, which browsers can't read directly.)
-- Apps write `location` as text, e.g. 'SRID=4326;POINT(121.05 14.55)' (longitude first).

alter table public.venues
  add column lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored;
