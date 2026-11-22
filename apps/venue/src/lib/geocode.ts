import type { LatLng } from '../components/VenueMap';
import { placeKey } from './psgc';

/**
 * Geocoder. Defaults to OpenStreetMap's public Nominatim (free, no key; fair use is about one
 * request a second, which a debounced pin and one search per picked place stay under). Any
 * Nominatim-compatible server works: set its base URL (the part before /reverse and /search).
 */
const BASE_URL = (import.meta.env.VITE_GEOCODE_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');

/** The three Philippine admin levels a player would recognise. Any of them can be missing. */
export type PlaceNames = { province: string | null; municipality: string | null; barangay: string | null };

type NominatimAddress = Partial<
  Record<
    | 'state'
    | 'province'
    | 'region'
    | 'city'
    | 'town'
    | 'municipality'
    | 'village'
    | 'quarter'
    | 'suburb'
    | 'neighbourhood'
    | 'hamlet',
    string
  >
>;

export async function reverseGeocode(p: LatLng, signal?: AbortSignal): Promise<PlaceNames> {
  const url = new URL(`${BASE_URL}/reverse`);
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(p.lat),
    lon: String(p.lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'en',
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  const body = (await res.json()) as { address?: NominatimAddress };
  return placeNames(body.address ?? {});
}

/** A place's centre and the box around its whole area. */
export interface FoundPlace {
  center: LatLng;
  bounds: Bounds;
  /**
   * True when the map has the place's real outline. Many places (most rural barangays) are
   * mapped as a single point, and the box around those is a guess, too rough to tell whether a
   * pin is inside the place.
   */
  outlined: boolean;
}
export type Bounds = { south: number; north: number; west: number; east: number };

export const inBounds = (p: LatLng, b: Bounds) => p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;

/**
 * Where a named place is, searched in the Philippines only, e.g. find("Kawayan", "Kawayan,
 * Biliran"). Only a result actually called `name` counts: the search also returns schools, shops
 * and similarly named places ("Barangay 252" for "Barangay 659"), and showing those would mislead.
 * Null if there is no such result.
 */
export async function findPlace(name: string, query: string, signal?: AbortSignal): Promise<FoundPlace | null> {
  const url = new URL(`${BASE_URL}/search`);
  url.search = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    countrycodes: 'ph',
    limit: '5',
    'accept-language': 'en',
  }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  // boundingbox is [south, north, west, east], as strings.
  const hits = (await res.json()) as {
    name: string;
    lat: string;
    lon: string;
    osm_type: 'node' | 'way' | 'relation';
    boundingbox: [string, string, string, string];
  }[];
  const key = placeKey(name);
  const exact = hits.find((h) => placeKey(h.name) === key);
  // Many barangays aren't mapped at all, but their school or hall is, named after them
  // ("Masagaosao Primary School"). That stands in for the barangay, as a point: its outline is
  // the building's, not the barangay's. ("Barangay 658" doesn't pass for "Barangay 659".)
  const landmark = exact ? undefined : hits.find((h) => placeKey(h.name).startsWith(`${key} `));
  const hit = exact ?? landmark;
  if (!hit) return null;
  const [south, north, west, east] = hit.boundingbox.map(Number) as [number, number, number, number];
  return {
    center: { lat: Number(hit.lat), lng: Number(hit.lon) },
    bounds: { south, north, west, east },
    outlined: Boolean(exact) && hit.osm_type !== 'node',
  };
}

/**
 * Maps OSM's address keys to PH admin levels. Provinces are OSM admin level 4 ("state"); Metro
 * Manila has no province, so it falls back to the region. Barangays usually come back as a village
 * or quarter. The City of Manila's barangays are numbered and come back as a bare-number
 * neighbourhood, while its "suburb" is the district (Ermita, Sampaloc), so a number wins first.
 */
export function placeNames(a: NominatimAddress): PlaceNames {
  const numbered = a.neighbourhood && /^\d+$/.test(a.neighbourhood) ? `Barangay ${a.neighbourhood}` : undefined;
  return {
    province: a.province ?? a.state ?? a.region ?? null,
    municipality: a.city ?? a.town ?? a.municipality ?? null,
    barangay: a.village ?? a.quarter ?? numbered ?? a.suburb ?? a.neighbourhood ?? a.hamlet ?? null,
  };
}
