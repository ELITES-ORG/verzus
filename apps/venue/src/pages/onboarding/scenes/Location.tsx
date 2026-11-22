import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng, VenueMapHandle } from '../../../components/VenueMap';
import { type Bounds, findPlace, inBounds, type PlaceNames, reverseGeocode } from '../../../lib/geocode';
import {
  barangaysQuery,
  matchBarangay,
  matchCity,
  placeKey,
  provincesQuery,
  useBarangays,
  useProvinces,
} from '../../../lib/psgc';
import { supabase } from '../../../lib/supabase';
import { saveLabel, useAutosave } from '../autosave';
import { LocationIcon } from '../icons';
import { SearchSelect } from '../SearchSelect';
import { Block, Scene, SceneFooter, type SceneProps, StageButton, StageInput } from '../stage';

const VenueMap = lazy(() => import('../../../components/VenueMap').then((m) => ({ default: m.VenueMap })));
const METRO_MANILA: LatLng = { lat: 14.5995, lng: 121.0244 };

/** `b`, grown around `center` to at least `span` degrees each way. */
function widen(b: Bounds, center: LatLng, span: number): Bounds {
  const half = span / 2;
  return {
    south: Math.min(b.south, center.lat - half),
    north: Math.max(b.north, center.lat + half),
    west: Math.min(b.west, center.lng - half),
    east: Math.max(b.east, center.lng + half),
  };
}

/**
 * Where the venue is: a pin on the map, plus its province, city / municipality and barangay from
 * the official PSGC lists. The pin fills the three in; owners can also pick them by hand, each
 * list narrowed by the one above it. Before there is a pin, picking a place moves the map there.
 */
export function LocationScene({ setup, refresh, next, back }: SceneProps) {
  const v = setup.venue;
  const qc = useQueryClient();
  const provinces = useProvinces();
  const [provinceCode, setProvinceCode] = useState<string | null>(null);
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [barangay, setBarangay] = useState<string | null>(null);
  const barangays = useBarangays(provinceCode);
  const [address, setAddress] = useState(v.address ?? '');
  const [pin, setPin] = useState<LatLng | null>(v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null);
  const [locating, setLocating] = useState(false);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const map = useRef<VenueMapHandle>(null);
  // True once the owner moves the pin in this visit. Until then a venue with a saved province keeps
  // its saved place names; after that, the pin decides them.
  const moved = useRef(false);
  // The pin as of the latest render, for searches that finish later.
  const pinNow = useRef(pin);
  pinNow.current = pin;
  // What the pin's own spot is called, as far as we know: from the map's lookup of the spot, the
  // address that moved it there, or (for a saved pin) the saved address. Null while unknown.
  const pinNames = useRef<PlaceNames | null>(
    v.province ? { province: v.province, municipality: v.city, barangay: v.barangay } : null,
  );
  // Set when an address pick moves the pin, so the pin's new spot isn't looked up and renamed.
  const skipLookup = useRef(false);
  // The place search still on its way, if any; a newer pick cancels it.
  const placeSearch = useRef<AbortController | null>(null);
  // Shown after an address pick moved the pin.
  const [pinNote, setPinNote] = useState<string | null>(null);

  const province = provinces.data?.find((p) => p.code === provinceCode) ?? null;
  const city = province?.cities.find((c) => c.code === cityCode) ?? null;
  const barangayList = cityCode ? barangays.data?.[cityCode] : undefined;

  // Which line's search is open, if any.
  const [picking, setPicking] = useState<'province' | 'city' | 'barangay' | null>(null);
  const closePicker = useCallback(() => setPicking(null), []);
  const provinceOptions = useMemo(() => (provinces.data ?? []).map((p) => ({ value: p.code, label: p.name })), [provinces.data]);
  const cityOptions = useMemo(() => (province?.cities ?? []).map((c) => ({ value: c.code, label: c.name })), [province]);
  const barangayOptions = useMemo(() => (barangayList ?? []).map((b) => ({ value: b, label: b })), [barangayList]);

  /** Selects the listed places that match these names (from the map or from what was saved). */
  async function applyNames(names: PlaceNames, signal?: AbortSignal) {
    const all = await qc.fetchQuery(provincesQuery);
    const hit = matchCity(all, names.province, names.municipality);
    const lists = hit?.city ? await qc.fetchQuery(barangaysQuery(hit.province.code)) : undefined;
    if (signal?.aborted) return;
    setProvinceCode(hit?.province.code ?? null);
    setCityCode(hit?.city?.code ?? null);
    setBarangay(hit?.city ? matchBarangay(lists?.[hit.city.code], names.barangay) : null);
  }

  // Show what was saved.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on opening the step.
  useEffect(() => {
    if (v.city || v.province) {
      applyNames({ province: v.province, municipality: v.city, barangay: v.barangay }).catch(() => setLookup('failed'));
    }
  }, []);

  // Name the pinned spot. Waits for the pin to settle (drags, repeated taps) before asking, and
  // drops answers for spots the pin has already left. A saved venue keeps its saved names until
  // its pin moves.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the pin moves; applyNames only sets state.
  useEffect(() => {
    if (!pin || (!moved.current && v.province)) return;
    if (skipLookup.current) {
      // Moved by an address pick, not by the owner: the picked names stand. (A lookup for the
      // pin's previous spot was cancelled by the cleanup below, so clear its "looking up" state.)
      skipLookup.current = false;
      setLookup('idle');
      return;
    }
    const ctrl = new AbortController();
    setLookup('loading');
    const t = setTimeout(() => {
      reverseGeocode(pin, ctrl.signal)
        .then((names) => {
          if (!ctrl.signal.aborted) pinNames.current = names;
          return applyNames(names, ctrl.signal);
        })
        .then(() => {
          if (!ctrl.signal.aborted) setLookup('idle');
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setLookup('failed');
        });
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pin]);

  /** The owner put the pin here (tap, drag or their location): name the spot from the map. */
  function movePin(p: LatLng) {
    moved.current = true;
    skipLookup.current = false;
    pinNames.current = null; // Unknown until the lookup for the new spot answers.
    setPinNote(null);
    setPin(p);
  }

  /**
   * The map follows the address: each pick zooms to the picked place. If the pin isn't in the
   * picked place it can't be right, so it moves to the place's middle for the owner to drag onto
   * their entrance. That move doesn't rename the place from the map: the owner's pick stands.
   *
   * Is the pin in the place? With the place's real outline, check the pin against it. Most rural
   * barangays are only a point on the map, though, and the box around a point is a guess (it once
   * put a pin in Kawayan's town centre "inside" Masagaosao, 2 km away). For those, the pin counts
   * as inside only if the map named the pin's own spot the same; otherwise it moves.
   *
   * `level`: which name the place is (province, municipality or barangay).
   * `picked`: the address as picked, which becomes the pin's names if it moves.
   * `span`: the smallest area (in degrees) to show, so a point place isn't shown at street level.
   */
  function showPlace(name: string, level: keyof PlaceNames, picked: PlaceNames, queries: string[], span: number) {
    placeSearch.current?.abort(); // A newer pick wins over a search still on its way.
    const ctrl = new AbortController();
    placeSearch.current = ctrl;
    const plain = (s: string) => s.replace(/\s*\([^)]*\)/g, ''); // "Special Geographic Area (BARMM)"
    (async () => {
      for (const q of queries) {
        const hit = await findPlace(plain(name), plain(q), ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (!hit) continue; // Try the broader name next.
        map.current?.fitBounds(widen(hit.bounds, hit.center, span));
        const current = pinNow.current;
        if (!current) return;
        const known = pinNames.current?.[level];
        const inside = hit.outlined ? inBounds(current, hit.bounds) : Boolean(known) && placeKey(known ?? '') === placeKey(name);
        if (!inside) {
          skipLookup.current = true;
          pinNames.current = picked;
          setPin(hit.center);
          setPinNote(`Pin moved to ${name}. Drag it onto your entrance.`);
        }
        return;
      }
      // Not on the map at all. If the pin isn't known to be there, say so rather than leave it
      // silently somewhere else.
      const known = pinNames.current?.[level];
      if (pinNow.current && !(known && placeKey(known) === placeKey(name))) {
        setPinNote(`${name} isn't on the map yet. Check the pin is in ${name}, and drag it onto your entrance.`);
      }
    })().catch(() => {}); // Offline: the map stays where it is.
  }

  // Each pick opens the next list, so the whole address is three quick searches. Picking the same
  // place again keeps the lines below it.
  function pickProvince(code: string) {
    if (code === provinceCode) return setPicking(null);
    setProvinceCode(code);
    setCityCode(null);
    setBarangay(null);
    setPicking('city');
    const p = provinces.data?.find((x) => x.code === code);
    if (p) {
      const picked = { province: p.name, municipality: null, barangay: null };
      showPlace(p.name, 'province', picked, [`${p.name}, Philippines`], 0.6);
    }
  }

  function pickCity(code: string) {
    if (code === cityCode) return setPicking(null);
    setCityCode(code);
    setBarangay(null);
    setPicking('barangay');
    const c = province?.cities.find((x) => x.code === code);
    if (c && province) {
      const picked = { province: province.name, municipality: c.name, barangay: null };
      showPlace(c.name, 'municipality', picked, [`${c.name}, ${province.name}`, `${c.name}, Philippines`], 0.08);
    }
  }

  function pickBarangay(name: string) {
    setPicking(null);
    if (name === barangay) return;
    setBarangay(name);
    if (city && province) {
      const picked = { province: province.name, municipality: city.name, barangay: name };
      showPlace(name, 'barangay', picked, [`${name}, ${city.name}, ${province.name}`, `${name}, ${city.name}`], 0.015);
    }
  }

  /**
   * Phones often report a rough position first (from Wi-Fi or cell towers) and a precise GPS fix
   * seconds later. Watch for up to 8 seconds, keep the most accurate reading, and stop early once
   * one is within 15 m. Then say how close it is, so the owner knows how much to fine-tune.
   */
  function locateMe() {
    if (!navigator.geolocation) return setError("This browser can't share its location. Tap the map instead.");
    setLocating(true);
    setError(null);
    let best: GeolocationPosition | null = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      setLocating(false);
      if (!best) return setError("Couldn't get your location. Tap the map where your venue is instead.");
      const p = { lat: best.coords.latitude, lng: best.coords.longitude };
      movePin(p);
      map.current?.flyTo(p, 18);
      const metres = Math.round(best.coords.accuracy);
      setPinNote(
        metres <= 20
          ? `Found you, to within about ${metres} m. Drag the pin onto your entrance if it's off.`
          : `Found you, but only to within about ${metres} m. Drag the pin onto your entrance.`,
      );
    };
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= 15) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    const timer = setTimeout(finish, 8_000);
  }

  const missing = !province ? 'province' : !city ? 'city or municipality' : !barangay ? 'barangay' : null;

  // Saved as they go, once the pin and the whole address are in (and the map isn't still naming
  // the spot). `saved` is what the database holds, so filling the lists in on opening isn't a change.
  const ready = Boolean(pin) && !missing && Boolean(address.trim()) && lookup !== 'loading';
  const auto = useAutosave(
    { pin, province: province?.name ?? null, city: city?.name ?? null, barangay, address: address.trim() },
    ready,
    async (d) => {
      if (!d.pin) return;
      const { error } = await supabase
        .from('venues')
        .update({
          province: d.province,
          city: d.city,
          barangay: d.barangay,
          address: d.address,
          location: `SRID=4326;POINT(${d.pin.lng} ${d.pin.lat})`,
        })
        .eq('id', v.id);
      if (error) throw error;
      await refresh();
    },
    {
      saved: {
        pin: v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null,
        province: v.province,
        city: v.city,
        barangay: v.barangay,
        address: v.address?.trim() ?? '',
      },
    },
  );

  async function save() {
    setBusy(true);
    setError(null);
    const ok = await auto.flush();
    setBusy(false);
    if (!ok) return setError("Couldn't save. Check your connection and try again.");
    next();
  }
  /** One line under the address card: what is happening, or what to do next. */
  function statusLine(): string | null {
    if (lookup === 'loading') return 'Looking up this spot…';
    if (provinces.isError) return "Couldn't load the list of places. Check your connection and reload.";
    if (pinNote) return pinNote;
    if (lookup === 'failed' && missing) return `Couldn't name this spot. Pick your ${missing} from the list.`;
    if (!pin && !province) return 'Pin the map and these fill in, or pick them yourself.';
    if (missing) return `Pick your ${missing}.`;
    if (!pin) return 'Now tap your entrance on the map.';
    if (moved.current) return 'Filled in from the pin. Tap a line to change it.';
    return null;
  }
  const status = statusLine();

  return (
    <Scene
      wide
      eyebrow="Step 2 · Location"
      icon={<LocationIcon />}
      title="Where's your venue?"
      intro="Tap your entrance on the map, then drag the pin to fine-tune it."
    >
      <Block>
        <div className="relative overflow-hidden rounded-panel ring-1 ring-line-strong">
          <Suspense fallback={<div className="grid h-[300px] place-items-center text-fg-3 sm:h-[420px]">Loading map…</div>}>
            <VenueMap
              ref={map}
              pin={pin}
              center={pin ?? METRO_MANILA}
              onChange={movePin}
              className="h-[300px] rounded-none border-0 sm:h-[420px]"
            />
          </Suspense>
          {/* On the map itself, so it costs no extra row. Top left: zoom buttons are top right. */}
          <StageButton
            kind="chip"
            onClick={locateMe}
            disabled={locating}
            className="absolute left-3 top-3 z-10 bg-surface/95 shadow-lg backdrop-blur"
          >
            {locating ? 'Finding you…' : '◎ Use my location'}
          </StageButton>
        </div>
      </Block>

      <Block>
        <div className="sm:max-w-xl">
          {/* Reads like text, but each line opens a search over its list, narrowed by the line above. */}
          <div
            className={`divide-y-2 divide-line rounded-panel border-2 border-line bg-surface transition-opacity ${
              lookup === 'loading' ? 'opacity-50' : ''
            }`}
          >
            <SearchSelect
              label="Province"
              searchLabel="Search provinces"
              value={provinceCode}
              options={provinceOptions}
              disabled={!provinces.data}
              open={picking === 'province'}
              onOpen={() => setPicking('province')}
              onClose={closePicker}
              onPick={pickProvince}
            />
            <SearchSelect
              label="City / municipality"
              searchLabel="Search cities and municipalities"
              value={cityCode}
              options={cityOptions}
              disabled={!province}
              open={picking === 'city'}
              onOpen={() => setPicking('city')}
              onClose={closePicker}
              onPick={pickCity}
            />
            <SearchSelect
              label="Barangay"
              searchLabel="Search barangays"
              value={barangay}
              options={barangayOptions}
              disabled={!barangayList}
              open={picking === 'barangay' && Boolean(barangayList)}
              onOpen={() => setPicking('barangay')}
              onClose={closePicker}
              onPick={pickBarangay}
            />
          </div>
          {status && (
            <p aria-live="polite" className="mt-2 text-sm text-fg-3">
              {status}
            </p>
          )}
        </div>
      </Block>

      <Block label="Street, building or landmark">
        <StageInput
          maxLength={200}
          placeholder="3F Sports Hub, 28th St cor. 5th Ave"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Block>

      <SceneFooter onBack={back} onNext={save} busy={busy} disabled={!ready} error={error} status={saveLabel(auto.state)} />
    </Scene>
  );
}
