/**
 * Cities the location step can centre the map on. Coordinates are rough city centres: they only
 * position the map; the owner places the pin. "Elsewhere" lets them type any city.
 */
export const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'Caloocan', lat: 14.6507, lng: 120.9668 },
  { name: 'Las Piñas', lat: 14.4445, lng: 120.9939 },
  { name: 'Makati', lat: 14.5547, lng: 121.0244 },
  { name: 'Malabon', lat: 14.6625, lng: 120.9567 },
  { name: 'Mandaluyong', lat: 14.5794, lng: 121.0359 },
  { name: 'Manila', lat: 14.5995, lng: 120.9842 },
  { name: 'Marikina', lat: 14.6507, lng: 121.1029 },
  { name: 'Muntinlupa', lat: 14.4081, lng: 121.0415 },
  { name: 'Navotas', lat: 14.6667, lng: 120.9417 },
  { name: 'Parañaque', lat: 14.4793, lng: 121.0198 },
  { name: 'Pasay', lat: 14.5378, lng: 121.0014 },
  { name: 'Pasig', lat: 14.5764, lng: 121.0851 },
  { name: 'Pateros', lat: 14.5446, lng: 121.0687 },
  { name: 'Quezon City', lat: 14.676, lng: 121.0437 },
  { name: 'San Juan', lat: 14.6019, lng: 121.0355 },
  { name: 'Taguig', lat: 14.5176, lng: 121.0509 },
  { name: 'Valenzuela', lat: 14.7011, lng: 120.983 },
];

export const METRO_MANILA = { lat: 14.5995, lng: 121.0244 };
