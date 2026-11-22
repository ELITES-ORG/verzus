import { motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { saveLabel, useAutosave } from '../autosave';
import { HoursIcon } from '../icons';
import { Block, Scene, SceneFooter, type SceneProps, StageButton, StageSwitch } from '../stage';
import { formatTime, minutes, TimePicker } from '../TimePicker';

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
  // The time being picked, if any: which day, and opening or closing.
  const [picking, setPicking] = useState<{ day: number; which: 'opens' | 'closes' } | null>(null);
  // The last one picked: the sheet keeps showing it while it slides away after closing.
  const lastPicked = useRef<{ day: number; which: 'opens' | 'closes' }>({ day: 1, which: 'opens' });
  if (picking) lastPicked.current = picking;
  const sheet = picking ?? lastPicked.current;
  const closePicker = useCallback(() => setPicking(null), []);

  const set = (day: number, patch: Partial<DayHours>) => setWeek((w) => ({ ...w, [day]: { ...(w[day] as DayHours), ...patch } }));
  const copyMonday = () => setWeek(Object.fromEntries(DAYS.map(({ day }) => [day, { ...(week[1] as DayHours) }])));

  const bad = DAYS.find(({ day }) => {
    const h = week[day] as DayHours;
    return h.open && minutes(h.closes) <= minutes(h.opens);
  });
  const anyOpen = DAYS.some(({ day }) => week[day]?.open);

  /** Open days upserted, closed days removed. */
  async function saveWeek(w: Record<number, DayHours>) {
    const openDays = DAYS.filter(({ day }) => w[day]?.open);
    const closedDays = DAYS.filter(({ day }) => !w[day]?.open).map((d) => d.day);
    const up = await supabase.from('opening_hours').upsert(
      openDays.map(({ day }) => {
        const h = w[day] as DayHours;
        return { venue_id: venueId, weekday: day, opens: h.opens, closes: h.closes };
      }),
      { onConflict: 'venue_id,weekday' },
    );
    if (up.error) throw up.error;
    if (closedDays.length) {
      const del = await supabase.from('opening_hours').delete().eq('venue_id', venueId).in('weekday', closedDays);
      if (del.error) throw del.error;
    }
    await refresh();
  }

  // Saved as they change it, whenever the week is valid.
  const ready = !bad && anyOpen;
  const auto = useAutosave(week, ready, saveWeek);

  async function save() {
    setBusy(true);
    setError(null);
    let ok: boolean;
    if (setup.hours.length === 0 && !auto.unsaved) {
      // Nothing stored yet and the suggested week left as it is: Continue saves it.
      ok = await saveWeek(week).then(
        () => true,
        () => false,
      );
    } else ok = await auto.flush();
    setBusy(false);
    if (!ok) return setError("Couldn't save. Check your connection and try again.");
    next();
  }

  return (
    <Scene eyebrow="Step 4 · Hours" icon={<HoursIcon />} title="When can players book?">
      <Block>
        <StageButton kind="chip" onClick={copyMonday}>
          Copy Monday to every day
        </StageButton>
      </Block>

      <Block>
        <div className="space-y-2">
          {DAYS.map(({ day, name, short }) => {
            const h = week[day] as DayHours;
            const from = (minutes(h.opens) / 1440) * 100;
            const to = (minutes(h.closes) / 1440) * 100;
            const width = h.open && to > from ? to - from : 0;
            const wrong = minutes(h.closes) <= minutes(h.opens);
            const timeField = (which: 'opens' | 'closes') => (
              <button
                type="button"
                onClick={() => setPicking({ day, which })}
                aria-label={`${name} ${which}: ${formatTime(h[which])}. Change`}
                className={`min-w-0 flex-1 truncate rounded-control border-2 bg-surface-2 px-2 py-2 text-center text-[15px] font-semibold text-fg hover:border-violet sm:text-base ${
                  which === 'closes' && wrong ? 'border-danger' : 'border-line-strong'
                }`}
              >
                {formatTime(h[which])}
              </button>
            );
            return (
              <div key={day} className="grid grid-cols-[92px_1fr] items-center gap-2 sm:grid-cols-[112px_272px_1fr] sm:gap-3">
                {/* On: open that day, with its hours. Off: closed. */}
                <StageSwitch
                  checked={h.open}
                  onChange={(on) => set(day, { open: on })}
                  ariaLabel={`${name} open`}
                  label={<span className={`text-base ${h.open ? 'text-fg' : 'text-fg-3'}`}>{short}</span>}
                  className="py-2"
                />
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  {h.open ? (
                    <>
                      {timeField('opens')}
                      <span className="text-fg-3" aria-hidden="true">
                        –
                      </span>
                      {timeField('closes')}
                    </>
                  ) : (
                    <span className="py-2 text-fg-3">Closed</span>
                  )}
                </div>
                {/* The day at a glance. Phones skip it: it would double each day's height. */}
                <div className="relative hidden h-3 overflow-hidden rounded-[2px] bg-surface-2 sm:block" aria-hidden="true">
                  <motion.div
                    className="absolute inset-y-0 rounded-[2px] bg-gradient-to-r from-violet to-accent"
                    initial={false}
                    animate={{ left: `${from}%`, width: `${width}%`, opacity: width ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                  />
                </div>
              </div>
            );
          })}
          <div className="hidden grid-cols-[112px_272px_1fr] gap-3 text-xs text-fg-3 sm:grid" aria-hidden="true">
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

      {/* What's stopping Continue, right under the week (the bar at the bottom only holds buttons). */}
      {(bad || !anyOpen) && (
        <p role="status" className="text-sm font-semibold text-danger">
          {bad ? `${bad.name} closes before it opens. Pick a later closing time.` : 'Switch on at least one day.'}
        </p>
      )}

      <TimePicker
        open={Boolean(picking)}
        title={`${DAYS.find((d) => d.day === sheet.day)?.name} ${sheet.which === 'opens' ? 'opens' : 'closes'}`}
        value={week[sheet.day]?.[sheet.which] ?? '07:00'}
        after={sheet.which === 'closes' ? week[sheet.day]?.opens : undefined}
        allowMidnight={sheet.which === 'closes'}
        onSet={(v) => {
          set(sheet.day, { [sheet.which]: v });
          setPicking(null);
        }}
        onClose={closePicker}
      />

      <SceneFooter onBack={back} onNext={save} busy={busy} disabled={!ready} error={error} status={saveLabel(auto.state)} />
    </Scene>
  );
}
