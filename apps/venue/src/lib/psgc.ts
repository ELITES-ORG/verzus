import { useQuery } from '@tanstack/react-query';

/**
 * Philippine provinces, cities / municipalities and barangays (the PSA's PSGC), served as static
 * files from public/psgc. Built by scripts/psgc.mjs; see that script for how the data is shaped.
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

async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}psgc/${path}`);
  if (!res.ok) throw new Error(`Couldn't load the list of places (${res.status}).`);
  return res.json() as Promise<T>;
}

// The lists never change while the app runs: load each once and keep it.
const forever = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY };

/** All provinces with their cities (about 70 KB). For useQuery or queryClient.fetchQuery. */
export const provincesQuery = {
  queryKey: ['psgc', 'places'],
  queryFn: () => load<Province[]>('places.json'),
  ...forever,
};

/** The barangays of one province's cities (25 KB at most), loaded once a province is chosen. */
export const barangaysQuery = (provinceCode: string) => ({
  queryKey: ['psgc', 'barangays', provinceCode],
  queryFn: () => load<BarangayLists>(`barangays/${provinceCode}.json`),
  ...forever,
});

export function useProvinces() {
  return useQuery(provincesQuery);
}

export function useBarangays(provinceCode: string | null) {
  return useQuery({ ...barangaysQuery(provinceCode ?? ''), enabled: Boolean(provinceCode) });
}

const ROMAN: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
};

/**
 * A name reduced for comparing spellings from different sources: the map says "Makati" and
 * "Poblacion 2", the PSGC says "Makati City" and "Poblacion II (Pob.)". Ignores case, accents,
 * "City of" / "City", "(Pob.)", punctuation and Roman numerals.
 */
export function placeKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(pob\.?\)/g, '')
    .replace(/^city of\s+/, '')
    .replace(/\s+city$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => ROMAN[w] ?? w)
    .join(' ');
}

const same = (a: string, b: string) => placeKey(a) === placeKey(b);

/**
 * Finds the province and city a place is in, by name. If the province's name doesn't match (map
 * data can be newer or older than the PSGC, e.g. a split province), a city name found in exactly
 * one province is used instead.
 */
export function matchCity(
  provinces: Province[],
  province: string | null | undefined,
  city: string | null | undefined,
): { province: Province; city: City | null } | null {
  const p = province ? provinces.find((x) => same(x.name, province)) : undefined;
  const c = city ? p?.cities.find((x) => same(x.name, city)) : undefined;
  if (p && c) return { province: p, city: c };
  if (city) {
    const hits = provinces.flatMap((x) => x.cities.filter((y) => same(y.name, city)).map((y) => ({ province: x, city: y })));
    if (hits.length === 1 && hits[0]) return hits[0];
  }
  return p ? { province: p, city: null } : null;
}

/** The barangay in `list` with the same name, spelled the list's way. */
export function matchBarangay(list: string[] | undefined, name: string | null | undefined): string | null {
  if (!list || !name) return null;
  return list.find((b) => same(b, name)) ?? null;
}
