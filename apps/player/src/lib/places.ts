import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

/**
 * Philippine provinces, cities / municipalities and barangays (the PSA's PSGC), the same lists the
 * venue app uses, served as static files from public/psgc (scripts/psgc.mjs writes both copies).
 * The web app loads its own copy; the native apps load the deployed web app's.
 */

export interface City {
  code: string;
  name: string;
}
export interface Province {
  code: string;
  name: string;
  cities: City[];
}
/** City code -> its barangays, A to Z. */
export type BarangayLists = Record<string, string[]>;

const BASE = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_WEB_URL ?? '');

async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/psgc/${path}`);
  if (!res.ok) throw new Error(`Couldn't load the list of places (${res.status}).`);
  return res.json() as Promise<T>;
}

// The lists never change while the app runs: load each once and keep it.
const forever = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY };

export function useProvinces() {
  return useQuery({ queryKey: ['psgc', 'places'], queryFn: () => load<Province[]>('places.json'), ...forever });
}

/** The barangays of one province's cities, loaded once a province is chosen. */
export function useBarangays(provinceCode: string | null) {
  return useQuery({
    queryKey: ['psgc', 'barangays', provinceCode],
    queryFn: () => load<BarangayLists>(`barangays/${provinceCode}.json`),
    enabled: Boolean(provinceCode),
    ...forever,
  });
}

/** Lower case without accents, so "las pinas" finds "Las Piñas City". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The names that contain the search, best first: names that start with it, then names with a word
 * that starts with it ("cem" finds "South Cembo"), then the rest. Same order as the venue app.
 */
export function filterNames<T>(items: T[], name: (t: T) => string, query: string): T[] {
  const q = fold(query.trim());
  if (!q) return items;
  const rank = (label: string) => {
    const l = fold(label);
    if (l.startsWith(q)) return 0;
    if (l.split(/[\s\-(/]+/).some((w) => w.startsWith(q))) return 1;
    return l.includes(q) ? 2 : -1;
  };
  return items
    .map((t) => ({ t, r: rank(name(t)) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.t);
}
