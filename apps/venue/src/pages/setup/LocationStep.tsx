import { type FormEvent, lazy, Suspense, useRef, useState } from 'react';
import { Button, Field, SaveNote, Select, TextInput } from '../../components/ui';
import type { LatLng, VenueMapHandle } from '../../components/VenueMap';
import { CITIES, METRO_MANILA } from '../../lib/cities';
import { supabase } from '../../lib/supabase';
import { StepFrame, type StepProps } from './StepFrame';

const ELSEWHERE = '__elsewhere__';

// The map library is large; only this step needs it, so it loads when the step opens.
const VenueMap = lazy(() => import('../../components/VenueMap').then((m) => ({ default: m.VenueMap })));

/** City picker centres the map; the owner places the pin on their entrance and types the address. */
export function LocationStep({ setup, refresh, next }: StepProps) {
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
  const ready = Boolean(pin && cityName && address.trim());

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

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pin) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('venues')
      .update({
        city: cityName,
        address: address.trim(),
        // PostGIS reads this text form; longitude comes first.
        location: `SRID=4326;POINT(${pin.lng} ${pin.lat})`,
      })
      .eq('id', v.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
    next();
  }

  const start = pin ?? CITIES.find((c) => c.name === city) ?? METRO_MANILA;

  return (
    <StepFrame
      title="Location"
      intro="Put the pin on your entrance, the spot a player should walk to. Pick your city to jump there, or use your location if you're at the venue now."
    >
      <form onSubmit={save} className="space-y-5">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="City">
            <Select required value={city} onChange={(e) => pickCity(e.target.value)}>
              <option value="" disabled>
                Choose a city
              </option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value={ELSEWHERE}>Somewhere else</option>
            </Select>
          </Field>
          {city === ELSEWHERE && (
            <Field label="City or municipality">
              <TextInput required value={otherCity} onChange={(e) => setOtherCity(e.target.value)} />
            </Field>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-800">
              {pin ? 'Drag the pin to fine-tune it.' : 'Tap the map where your venue is.'}
            </p>
            <Button variant="secondary" onClick={locateMe} disabled={locating}>
              {locating ? 'Finding you…' : 'Use my location'}
            </Button>
          </div>
          <Suspense
            fallback={
              <div className="grid h-80 place-items-center rounded-card border-[3px] border-ink-900 text-sm text-ink-500">
                Loading map…
              </div>
            }
          >
            <VenueMap ref={map} pin={pin} center={start} onChange={setPin} />
          </Suspense>
        </div>

        <div className="max-w-xl">
          <Field
            label="Address"
            hint="As you'd tell a player: street, building or landmark. For example: 3F Sports Hub, 28th St corner 5th Ave, BGC."
          >
            <TextInput required maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || !ready}>
            {busy ? 'Saving…' : 'Save and continue'}
          </Button>
          <SaveNote error={error} saved={false} />
        </div>
      </form>
    </StepFrame>
  );
}
