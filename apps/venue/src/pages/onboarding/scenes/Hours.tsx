import { motion } from 'motion/react';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { HoursIcon } from '../icons';
import { Block, Scene, SceneFooter, type SceneProps, StageButton } from '../stage';

// Weekdays count from Sunday (0) in the database; the list reads Monday first.
const DAYS = [
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
  { day: 0, name: 'Sunday', short: 'Sun' },
];

interface DayHours {
  open: boolean;
  opens: string; // HH:MM
  closes: string;
}

const minutes = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return h * 60 + m;
};

export function HoursScene({ setup, refresh, next, back }: SceneProps) {
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

  const set = (day: number, patch: Partial<DayHours>) => setWeek((w) => ({ ...w, [day]: { ...(w[day] as DayHours), ...patch } }));
  const copyMonday = () => setWeek(Object.fromEntries(DAYS.map(({ day }) => [day, { ...(week[1] as DayHours) }])));

  const bad = DAYS.find(({ day }) => {
    const h = week[day] as DayHours;
    return h.open && h.closes <= h.opens;
  });
  const anyOpen = DAYS.some(({ day }) => week[day]?.open);

  async function save() {
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
    next();
  }

  return (
    <Scene
      eyebrow="Step 4 · Hours"
      icon={<HoursIcon />}
      title="When can players book?"
      intro="Your opening hours, day by day. Closing after midnight isn't supported yet; use 23:59 for late nights."
    >
      <Block>
        <div className="space-y-2">
          {DAYS.map(({ day, name, short }) => {
            const h = week[day] as DayHours;
            const from = (minutes(h.opens) / 1440) * 100;
            const to = (minutes(h.closes) / 1440) * 100;
            const width = h.open && to > from ? to - from : 0;
            return (
              <div key={day} className="grid grid-cols-[76px_1fr] items-center gap-3 sm:grid-cols-[96px_272px_1fr]">
                <StageButton
                  kind={h.open ? 'chipOn' : 'chip'}
                  aria-pressed={h.open}
                  aria-label={`${name}: ${h.open ? 'open' : 'closed'}`}
                  onClick={() => set(day, { open: !h.open })}
                  className="w-full px-2"
                >
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{name.slice(0, 3)}</span>
                </StageButton>
                <div className="flex items-center gap-2">
                  {h.open ? (
                    <>
                      <TimeInput label={`${name} opens`} value={h.opens} onChange={(v) => set(day, { opens: v })} />
                      <span className="text-[#9d97d6]">–</span>
                      <TimeInput label={`${name} closes`} value={h.closes} onChange={(v) => set(day, { closes: v })} />
                    </>
                  ) : (
                    <span className="text-[#6f6a9c]">Closed</span>
                  )}
                </div>
                <div
                  className="relative col-span-2 h-3 overflow-hidden rounded-full bg-white/[0.06] sm:col-span-1"
                  aria-hidden="true"
                >
                  <motion.div
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#b8b3ff] to-[#dd2b37]"
                    initial={false}
                    animate={{ left: `${from}%`, width: `${width}%`, opacity: width ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                  />
                </div>
              </div>
            );
          })}
          <div className="hidden grid-cols-[96px_272px_1fr] gap-3 text-xs text-[#6f6a9c] sm:grid" aria-hidden="true">
            <span />
            <span />
            <span className="flex justify-between">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </span>
          </div>
        </div>
      </Block>

      <Block>
        <StageButton kind="chip" onClick={copyMonday}>
          Use Monday's hours for every day
        </StageButton>
      </Block>

      <SceneFooter
        onBack={back}
        onNext={save}
        busy={busy}
        disabled={Boolean(bad) || !anyOpen}
        error={
          error ?? (bad ? `${bad.name}: closing time must be after opening time.` : anyOpen ? null : 'Open at least one day.')
        }
      />
    </Scene>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ colorScheme: 'dark' }}
      className="min-w-0 flex-1 sm:w-[7.75rem] sm:flex-none rounded-lg border-2 border-[#b8b3ff]/25 bg-transparent px-2 py-1.5 text-white focus:border-[#dd2b37] focus:outline-none"
    />
  );
}
