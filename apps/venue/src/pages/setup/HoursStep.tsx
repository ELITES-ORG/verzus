import { useState } from 'react';
import { Button, SaveNote, TextInput } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { StepFrame, type StepProps } from './StepFrame';

// The database counts weekdays from Sunday (0); the list starts on Monday, as people read a week.
const DAYS = [
  { day: 1, name: 'Monday' },
  { day: 2, name: 'Tuesday' },
  { day: 3, name: 'Wednesday' },
  { day: 4, name: 'Thursday' },
  { day: 5, name: 'Friday' },
  { day: 6, name: 'Saturday' },
  { day: 0, name: 'Sunday' },
];

interface DayHours {
  open: boolean;
  opens: string; // HH:MM
  closes: string;
}

export function HoursStep({ setup, refresh, next }: StepProps) {
  const venueId = setup.venue.id;
  const [week, setWeek] = useState<Record<number, DayHours>>(() => {
    const out: Record<number, DayHours> = {};
    for (const { day } of DAYS) {
      const h = setup.hours.find((x) => x.weekday === day);
      out[day] = h
        ? { open: true, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) }
        : { open: setup.hours.length === 0, opens: '07:00', closes: '22:00' };
    }
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (day: number, patch: Partial<DayHours>) => {
    setSaved(false);
    setWeek((w) => ({ ...w, [day]: { ...(w[day] as DayHours), ...patch } }));
  };
  const copyMonday = () => {
    const mon = week[1] as DayHours;
    setSaved(false);
    setWeek(Object.fromEntries(DAYS.map(({ day }) => [day, { ...mon }])));
  };

  const bad = DAYS.find(({ day }) => {
    const h = week[day] as DayHours;
    return h.open && h.closes <= h.opens;
  });

  async function save(thenNext: boolean) {
    if (bad) return setError(`${bad.name}: closing time must be after opening time.`);
    setBusy(true);
    setError(null);
    const openDays = DAYS.filter(({ day }) => week[day]?.open);
    const closedDays = DAYS.filter(({ day }) => !week[day]?.open).map((d) => d.day);
    const up = await supabase.from('opening_hours').upsert(
      openDays.map(({ day }) => {
        const h = week[day] as DayHours;
        return { venue_id: venueId, weekday: day, opens: h.opens, closes: h.closes };
      }),
      { onConflict: 'venue_id,weekday' },
    );
    const del = closedDays.length
      ? await supabase.from('opening_hours').delete().eq('venue_id', venueId).in('weekday', closedDays)
      : { error: null };
    setBusy(false);
    const err = up.error ?? del.error;
    if (err) return setError(err.message);
    await refresh();
    setSaved(true);
    if (thenNext) next();
  }

  return (
    <StepFrame
      title="Opening hours"
      intro="When players can book. Closing after midnight isn't supported yet: use 23:59 for late nights."
    >
      <div className="max-w-xl space-y-2">
        {DAYS.map(({ day, name }) => {
          const h = week[day] as DayHours;
          return (
            <div key={day} className="grid grid-cols-[120px_1fr] items-center gap-3 rounded-lg bg-white px-3 py-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1d1a4a]"
                  checked={h.open}
                  onChange={(e) => set(day, { open: e.target.checked })}
                />
                {name}
              </label>
              {h.open ? (
                <div className="flex items-center gap-2">
                  <TextInput
                    type="time"
                    aria-label={`${name} opens`}
                    value={h.opens}
                    onChange={(e) => set(day, { opens: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-ink-500">to</span>
                  <TextInput
                    type="time"
                    aria-label={`${name} closes`}
                    value={h.closes}
                    onChange={(e) => set(day, { closes: e.target.value })}
                    className="w-32"
                  />
                </div>
              ) : (
                <span className="text-sm text-ink-500">Closed</span>
              )}
            </div>
          );
        })}
        <Button variant="secondary" onClick={copyMonday}>
          Use Monday's hours for every day
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => save(true)} disabled={busy || !DAYS.some(({ day }) => week[day]?.open)}>
          {busy ? 'Saving…' : 'Save and continue'}
        </Button>
        <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
          Save
        </Button>
        <SaveNote error={error} saved={saved} />
      </div>
    </StepFrame>
  );
}
