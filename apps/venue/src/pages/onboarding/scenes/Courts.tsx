import { SPORTS, type Sport } from '@verzus/schemas/constants';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { peso } from '../../setup/data';
import { CourtsIcon } from '../icons';
import { Block, Scene, SceneFooter, type SceneProps } from '../stage';

interface Row {
  key: string;
  id?: string;
  name: string;
  sport: Sport;
  rate: string; // pesos, as typed
  active: boolean;
}

const label = (s: Sport) => s[0]?.toUpperCase() + s.slice(1);
let seq = 0;
const blank = (sport: Sport, n: number, rate = ''): Row => ({
  key: `new-${++seq}`,
  name: `Court ${n}`,
  sport,
  rate,
  active: true,
});

export function CourtsScene({ setup, refresh, next, back }: SceneProps) {
  const venueId = setup.venue.id;
  const [rows, setRows] = useState<Row[]>(() =>
    setup.courts.length
      ? setup.courts.map((c) => ({
          key: c.id,
          id: c.id,
          name: c.name,
          sport: c.sport,
          rate: String(c.hourly_rate_cents / 100),
          active: c.is_active,
        }))
      : [blank('badminton', 1)],
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (r: Row) => {
    setRows((rs) => rs.filter((x) => x.key !== r.key));
    if (r.id) setRemoved((ids) => [...ids, r.id as string]);
  };
  const add = () => setRows((rs) => [...rs, blank(rs.at(-1)?.sport ?? 'badminton', rs.length + 1, rs.at(-1)?.rate ?? '')]);

  const valid = rows.length > 0 && rows.every((r) => r.name.trim() && Number(r.rate) > 0);
  const bookable = rows.filter((r) => r.active && Number(r.rate) > 0);
  const cheapest = bookable.length ? Math.min(...bookable.map((r) => Number(r.rate))) : null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const id of removed) {
        const { error } = await supabase.from('courts').delete().eq('id', id);
        // A court with bookings keeps its history: switch it off instead of deleting it.
        if (error?.code === '23503') {
          const off = await supabase.from('courts').update({ is_active: false }).eq('id', id);
          if (off.error) throw off.error;
        } else if (error) throw error;
      }
      for (const r of rows) {
        const values = {
          name: r.name.trim(),
          sport: r.sport,
          hourly_rate_cents: Math.round(Number(r.rate) * 100),
          is_active: r.active,
        };
        const { error } = r.id
          ? await supabase.from('courts').update(values).eq('id', r.id)
          : await supabase.from('courts').insert({ ...values, venue_id: venueId });
        if (error) throw error;
      }
      setRemoved([]);
      await refresh();
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the courts.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Scene
      wide
      eyebrow="Step 3 · Courts"
      icon={<CourtsIcon />}
      title="Which courts can players book?"
      intro="One card per court. Rates are per hour; players split the rate between them when they open a match."
    >
      <Block>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.div
                key={r.key}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className={`relative rounded-3xl border-2 p-5 ${r.active ? 'border-[#b8b3ff]/30 bg-white/[0.05]' : 'border-dashed border-[#b8b3ff]/20 bg-transparent opacity-70'}`}
              >
                <CourtArt index={i} />
                <button
                  type="button"
                  onClick={() => remove(r)}
                  aria-label={`Remove ${r.name || 'court'}`}
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[#9d97d6] hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
                <input
                  aria-label="Court name"
                  value={r.name}
                  maxLength={40}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  className="mt-3 w-full border-0 border-b-2 border-[#b8b3ff]/30 bg-transparent pb-1 text-lg font-bold text-white focus:border-[#dd2b37] focus:outline-none"
                />
                <select
                  aria-label="Sport"
                  value={r.sport}
                  onChange={(e) => update(r.key, { sport: e.target.value as Sport })}
                  className="mt-3 w-full rounded-xl border-2 border-[#b8b3ff]/25 bg-[#24205a] px-3 py-2 text-white focus:border-[#dd2b37] focus:outline-none"
                >
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
                <label className="mt-3 flex items-center gap-2 rounded-xl border-2 border-[#b8b3ff]/25 px-3 py-2 focus-within:border-[#dd2b37]">
                  <span className="font-bold text-[#b8b3ff]">₱</span>
                  <input
                    aria-label="Rate per hour in pesos"
                    inputMode="decimal"
                    placeholder="300"
                    value={r.rate}
                    onChange={(e) => update(r.key, { rate: e.target.value.replace(/[^\d.]/g, '') })}
                    className="w-full bg-transparent text-white placeholder:text-[#6f6a9c] focus:outline-none"
                  />
                  <span className="text-sm text-[#9d97d6]">/hour</span>
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-[#d9d6ff]">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => update(r.key, { active: e.target.checked })}
                    className="h-4 w-4 accent-[#dd2b37]"
                  />
                  Players can book it
                </label>
              </motion.div>
            ))}
            <motion.button
              key="add"
              layout
              type="button"
              onClick={add}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="grid min-h-48 place-items-center rounded-3xl border-2 border-dashed border-[#b8b3ff]/35 text-[#d9d6ff] hover:border-[#b8b3ff] hover:text-white"
            >
              <span className="text-center">
                <span className="block text-4xl leading-none">+</span>
                <span className="mt-2 block font-semibold">Add a court</span>
              </span>
            </motion.button>
          </AnimatePresence>
        </div>
      </Block>

      <Block>
        <p className="text-lg text-[#d9d6ff]" aria-live="polite">
          <span className="font-bold text-white">
            {bookable.length} court{bookable.length === 1 ? '' : 's'}
          </span>
          {cheapest != null && <> · from {peso(cheapest * 100)}/hour</>}
        </p>
      </Block>

      <SceneFooter
        onBack={back}
        onNext={save}
        busy={busy}
        disabled={!valid}
        error={error ?? (valid ? null : rows.length ? 'Every court needs a name and a rate.' : null)}
      />
    </Scene>
  );
}

/** A small top-down court that draws itself when the card appears. */
function CourtArt({ index }: { index: number }) {
  const d = 0.08 * index;
  const path = (p: string, delay: number) => (
    <motion.path
      d={p}
      fill="none"
      stroke="#b8b3ff"
      strokeWidth={2.4}
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ delay: d + delay, duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
    />
  );
  return (
    <svg viewBox="0 0 160 70" className="h-14 w-32" aria-hidden="true">
      {path('M8 8H152V62H8Z', 0.1)}
      {path('M80 8V62M8 35H38M122 35H152', 0.35)}
      <motion.path
        d="M80 4V66"
        stroke="#dd2b37"
        strokeWidth={3.2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: d + 0.6, duration: 0.3 }}
      />
    </svg>
  );
}
