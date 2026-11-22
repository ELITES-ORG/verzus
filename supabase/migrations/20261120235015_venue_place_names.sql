-- Province and barangay next to the venue's city (the municipality), so players and verzus can
-- read where a venue is at every Philippine admin level. The venue app fills them from the map
-- pin (reverse geocoding); either can stay empty when the map data has no name for the spot.
-- Metro Manila has no province, so its venues store the region ("Metro Manila") instead.

alter table public.venues
  add column province text check (province is null or char_length(province) between 1 and 100),
  add column barangay text check (barangay is null or char_length(barangay) between 1 and 100);
