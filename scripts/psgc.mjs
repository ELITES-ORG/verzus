#!/usr/bin/env node
// Builds the Philippine place lists the venue app's location step picks from:
//   apps/venue/public/psgc/places.json            provinces and their cities / municipalities
//   apps/venue/public/psgc/barangays/<code>.json  one file per province: city code -> barangays
//
// Source: the PSA's Philippine Standard Geographic Code (PSGC), via the PSGC Cloud API
// (https://psgc.cloud), which follows the PSA's quarterly releases. (psa.gov.ph itself blocks
// scripted downloads.) Run again to refresh: `node scripts/psgc.mjs`. Nothing is written unless
// every download succeeds and the checks at the end pass.
//
// Shaping:
// - PSGC codes are 10 digits: region (2), province (3), city / municipality (2), barangay (3). A
//   city belongs to the province its code starts with; a barangay to the city its code starts with.
// - Highly urbanized and independent cities have province-level codes of their own. They are
//   listed under the province they are in (the API's `province` field), except where noted below.
// - Metro Manila has no provinces, so its cities sit under a "Metro Manila" entry. That is also
//   the name the map's reverse geocoder gives for the region.
// - Manila's barangays are coded under its districts (Tondo, Sampaloc, ...); they are listed under
//   Manila City, which is what owners pick.
// - BARMM's Special Geographic Area has a province-level code of its own and is its own entry.
// - "City of Makati" is shown the way people say it: "Makati City".

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://psgc.cloud/api/v2';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'venue', 'public', 'psgc');
const NCR_REGION = '1300000000';
const METRO_MANILA = { code: NCR_REGION, name: 'Metro Manila' };
const SGA = { code: '1999900000', name: 'Special Geographic Area (BARMM)' };
/** Cities the API files under the wrong province -> the province they are in. */
const PROVINCE_FIX = new Map([['0990100000', 'Basilan']]); // City of Isabela (API says Zamboanga Sibugay)

// Corrections for changes the API has not caught up with (checked November 2026). Each one is
// checked below: if the API changes so a correction no longer applies, the run stops so it can be
// reviewed and removed.

/**
 * The Special Geographic Area's eight municipalities, created by Bangsamoro law and ratified in
 * the April 2024 plebiscites. The API still names their codes after the interim "clusters".
 * Code -> name per Wikidata (P988, PSGC code) and Wikipedia's "Special Geographic Area".
 */
const CITY_NAMES = new Map([
  ['1999901000', 'Kapalawan'], // was Carmen Cluster
  ['1999902000', 'Old Kaabakan'], // Kabacan Cluster
  ['1999903000', 'Kadayangan'], // Midsayap Cluster I
  ['1999904000', 'Nabalawag'], // Midsayap Cluster II
  ['1999905000', 'Pahamuddin'], // Pigcawayan Cluster
  ['1999906000', 'Malidegao'], // Pikit Cluster I
  ['1999907000', 'Ligawasan'], // Pikit Cluster II
  ['1999908000', 'Tugunan'], // Pikit Cluster III
]);

/**
 * The ten "EMBO" barangays are Taguig's: the Supreme Court ruled for Taguig (final in 2023), the
 * DILG ordered the transfer in October 2023, and Comelec has counted them in Taguig since. The API
 * still lists them under Makati.
 */
const BARANGAY_MOVES = [
  {
    from: '1380300000', // Makati City
    to: '1381500000', // Taguig City
    names: [
      'Cembo',
      'Comembo',
      'East Rembo',
      'Pembo',
      'Pitogo',
      'Post Proper Northside',
      'Post Proper Southside',
      'Rizal',
      'South Cembo',
      'West Rembo',
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with retries: the API is free and sometimes slow to answer. */
async function get(path, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`${API}/${path}`, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data ?? body;
    } catch (e) {
      if (i >= tries) throw new Error(`${path}: ${e.message}`);
      await sleep(2000 * i);
    }
  }
}

/** Trims, and repairs UTF-8 text that was decoded as Latin-1 on the way ("Las PiÃ±as"). */
function clean(s) {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!/[ÃÂ]/.test(t)) return t;
  const fixed = Buffer.from(t, 'latin1').toString('utf8');
  return fixed.includes('�') ? t : fixed;
}

const displayName = (name) => clean(name).replace(/^City of (.+)$/, '$1 City');
const byName = (a, b) => a.name.localeCompare(b.name, 'en');
const prefix = (code, digits) => code.slice(0, digits);

const regions = await get('regions');
const provinces = (await get('provinces')).map((p) => ({ code: p.code, name: clean(p.name) }));
const allCities = await get('cities-municipalities');
const barangays = [];
for (const r of regions) {
  const rows = await get(`regions/${r.code}/barangays`);
  console.log(`${clean(r.name)}: ${rows.length} barangays`);
  barangays.push(...rows);
}

const provinceByPrefix = new Map(provinces.map((p) => [prefix(p.code, 5), p]));
const provinceByName = new Map(provinces.map((p) => [p.name, p]));

function provinceOf(c) {
  if (c.code.startsWith('13')) return METRO_MANILA;
  if (c.type === 'SGU') return SGA;
  const fix = PROVINCE_FIX.get(prefix(c.code, 5).padEnd(10, '0'));
  const p = provinceByName.get(fix ?? '') ?? provinceByPrefix.get(prefix(c.code, 5)) ?? provinceByName.get(clean(c.province));
  if (!p) throw new Error(`No province for ${c.name} (${c.code})`);
  return p;
}

// Manila's districts are not picked; their barangays go to the city they are part of.
const cities = allCities.filter((c) => c.type !== 'SubMun');
const parentOf = new Map(allCities.filter((c) => c.type === 'SubMun').map((c) => [c.code, `${prefix(c.code, 5)}00000`]));
const cityCodes = new Set(cities.map((c) => c.code));
const cityProvince = new Map(cities.map((c) => [c.code, provinceOf(c).code]));

const entries = [METRO_MANILA, ...provinces, SGA].map((p) => ({
  code: p.code,
  name: p.name,
  cities: cities
    .filter((c) => cityProvince.get(c.code) === p.code)
    .map((c) => ({ code: c.code, name: CITY_NAMES.get(c.code) ?? displayName(c.name) }))
    .sort(byName),
}));
// Metro Manila first (most venues so far), then the rest A to Z.
const places = [entries[0], ...entries.slice(1).sort(byName)];

const perProvince = new Map();
const unplaced = [];
for (const b of barangays) {
  const own = `${prefix(b.code, 7)}000`;
  const city = parentOf.get(own) ?? own;
  const province = cityProvince.get(city);
  if (!cityCodes.has(city) || !province) {
    unplaced.push(`${b.name} (${b.code})`);
    continue;
  }
  const lists = perProvince.get(province) ?? {};
  const list = lists[city] ?? [];
  list.push(clean(b.name));
  lists[city] = list;
  perProvince.set(province, lists);
}

// Checks: stop before writing anything if the data looks wrong.
const problems = [];

for (const [code, name] of CITY_NAMES) {
  const c = cities.find((x) => x.code === code);
  if (!c) problems.push(`CITY_NAMES: no city ${code} (${name}) any more`);
  else if (!/Cluster/.test(c.name))
    problems.push(`CITY_NAMES: ${code} is now "${clean(c.name)}"; check and remove the correction`);
}

for (const move of BARANGAY_MOVES) {
  const lists = perProvince.get(cityProvince.get(move.from));
  const target = perProvince.get(cityProvince.get(move.to));
  if (!lists?.[move.from] || !target?.[move.to]) {
    problems.push(`BARANGAY_MOVES: city ${move.from} or ${move.to} is gone`);
    continue;
  }
  for (const name of move.names) {
    if (target[move.to].includes(name)) problems.push(`BARANGAY_MOVES: ${name} is already in ${move.to}; remove the correction`);
    else if (!lists[move.from].includes(name)) problems.push(`BARANGAY_MOVES: ${name} is not in ${move.from}`);
  }
  if (problems.length) continue;
  lists[move.from] = lists[move.from].filter((n) => !move.names.includes(n));
  target[move.to].push(...move.names);
}

if (unplaced.length) problems.push(`${unplaced.length} barangays with no city, e.g. ${unplaced.slice(0, 3).join(', ')}`);
for (const p of places) {
  if (!p.cities.length) problems.push(`${p.name} has no cities`);
  for (const c of p.cities)
    if (!perProvince.get(p.code)?.[c.code]?.length) problems.push(`${c.name}, ${p.name} has no barangays`);
}
const garbled = [
  ...places.flatMap((p) => [p.name, ...p.cities.map((c) => c.name)]),
  ...barangays.map((b) => clean(b.name)),
].filter((n) => /[ÃÂ�]/.test(n));
if (garbled.length) problems.push(`garbled names, e.g. ${garbled.slice(0, 3).join(', ')}`);
if (problems.length) throw new Error(`Not writing the place lists:\n- ${problems.join('\n- ')}`);

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'barangays'), { recursive: true });
await writeFile(join(OUT, 'places.json'), `${JSON.stringify(places)}\n`);
for (const [province, lists] of perProvince) {
  for (const names of Object.values(lists)) names.sort((a, b) => a.localeCompare(b, 'en'));
  await writeFile(join(OUT, 'barangays', `${province}.json`), `${JSON.stringify(lists)}\n`);
}
console.log(`${places.length} provinces, ${cities.length} cities / municipalities, ${barangays.length} barangays -> ${OUT}`);
