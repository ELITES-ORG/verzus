import { lazy, Suspense, useRef, useState } from 'react';
import type { LatLng, VenueMapHandle } from '../../../components/VenueMap';
import { CITIES, METRO_MANILA } from '../../../lib/cities';
import { supabase } from '../../../lib/supabase';
import { LocationIcon } from '../icons';
import { Block, Scene, SceneFooter, type SceneProps, StageButton, StageInput, StageSelect } from '../stage';

const VenueMap = lazy(() => import('../../../components/VenueMap').then((m) => ({ default: m.VenueMap })));
const ELSEWHERE = '__elsewhere__';

export function LocationScene({ setup, refresh, next, back }: SceneProps) {
  const v = setup.venue;
  const known = CITIES.some((c) => c.name === v.city);
  const [city, setCity] = useState(v.city && !known ? ELSEWHERE : (v.city ?? ''));
  const [otherCity, setOtherCity] = useState(v.city && !known ? v.city : '');
  const [address, setAddress] = useState(v.address ?? '');
  const [pin, setPin] = useState<LatLng | null>(v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const map = useRef<VenueMapHandle>(null);

  const cityName = city === ELSEWHERE ? otherCity.trim() : city;
  const start = pin ?? CITIES.find((c) => c.name === city) ?? METRO_MANILA;

  function pickCity(name: string) {
    setCity(name);
    const c = CITIES.find((x) => x.name === name);
    if (c) map.current?.flyTo(c, 14);
  }

  function locateMe() {
    if (!navigator.geolocation) return setError("This browser can't share its location. Tap the map instead.");
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(p);
        map.current?.flyTo(p, 17);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Tap the map where your venue is instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function save() {
    if (!pin) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('venues')
      .update({ city: cityName, address: address.trim(), location: `SRID=4326;POINT(${pin.lng} ${pin.lat})` })
      .eq('id', v.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    next();
  }

  return (
    <Scene
      wide
      eyebrow="Step 2 · Location"
      icon={<LocationIcon />}
      title="Where do players walk in?"
      intro="Pick your city to jump there, then tap the map on your entrance. Drag the pin to fine-tune it."
    >
      <Block>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 sm:max-w-xs">
            <StageSelect aria-label="City" value={city} onChange={(e) => pickCity(e.target.value)}>
              <option value="" disabled>
                Choose a city
              </option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value={ELSEWHERE}>Somewhere else</option>
            </StageSelect>
          </div>
          {city === ELSEWHERE && (
            <div className="min-w-56 flex-1 sm:max-w-xs">
              <StageInput
                aria-label="City or municipality"
                placeholder="City or municipality"
                value={otherCity}
                onChange={(e) => setOtherCity(e.target.value)}
              />
            </div>
          )}
          <StageButton kind="chip" onClick={locateMe} disabled={locating} className="py-3">
            {locating ? 'Finding you…' : '◎ Use my location'}
          </StageButton>
        </div>
      </Block>

      <Block hint={pin ? 'Pinned. Drag it if it is not quite on the entrance.' : 'No pin yet: tap the map.'}>
        <div className="overflow-hidden rounded-3xl ring-2 ring-[#b8b3ff]/30">
          <Suspense fallback={<div className="grid h-[420px] place-items-center text-[#9d97d6]">Loading map…</div>}>
            <VenueMap ref={map} pin={pin} center={start} onChange={setPin} className="h-[420px] rounded-none border-0" />
          </Suspense>
        </div>
      </Block>

      <Block
        label="Address, the way you'd tell a player"
        hint="Street, building or landmark. For example: 3F Sports Hub, 28th St corner 5th Ave, BGC."
      >
        <StageInput maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} />
      </Block>

      <SceneFooter onBack={back} onNext={save} busy={busy} disabled={!pin || !cityName || !address.trim()} error={error} />
    </Scene>
  );
}
