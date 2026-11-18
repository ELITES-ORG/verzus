import { SPORTS, type Sport } from '@verzus/schemas/constants';
import { useState } from 'react';
import { Button, SaveNote, Select, TextInput } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { StepFrame, type StepProps } from './StepFrame';

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
const blank = (sport: Sport, n: number): Row => ({ key: `new-${++seq}`, name: `Court ${n}`, sport, rate: '', active: true });

export function CourtsStep({ setup, refresh, next }: StepProps) {
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
  const [saved, setSaved] = useState(false);

  const update = (key: string, patch: Partial<Row>) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const remove = (r: Row) => {
    setSaved(false);
    setRows((rs) => rs.filter((x) => x.key !== r.key));
    if (r.id) setRemoved((ids) => [...ids, r.id as string]);
  };
  const add = () => setRows((rs) => [...rs, blank(rs.at(-1)?.sport ?? 'badminton', rs.length + 1)]);

  const invalid = rows.find((r) => !r.name.trim() || !(Number(r.rate) > 0));

  async function save(thenNext: boolean) {
    if (invalid) return setError('Every court needs a name and an hourly rate above zero.');
    setBusy(true);
    setError(null);
    try {
      for (const id of removed) {
        const { error } = await supabase.from('courts').delete().eq('id', id);
        // A court with bookings can't be deleted (history is kept); switch it off instead.
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
      setSaved(true);
      if (thenNext) next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the courts.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepFrame
      title="Courts and rates"
      intro="One row per court players can book. Rates are per hour, in pesos. Players split the rate between them when they open a match."
    >
      <div className="space-y-3">
        <div className="hidden grid-cols-[1fr_160px_140px_80px_40px] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-ink-500 md:grid">
          <span>Court name</span>
          <span>Sport</span>
          <span>Per hour (₱)</span>
          <span>Bookable</span>
          <span />
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-2 gap-3 rounded-lg border-2 border-ink-200 bg-white p-3 md:grid-cols-[1fr_160px_140px_80px_40px] md:items-center md:border-0 md:bg-transparent md:p-0"
          >
            <TextInput
              aria-label="Court name"
              className="col-span-2 md:col-span-1"
              maxLength={40}
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
            />
            <Select aria-label="Sport" value={r.sport} onChange={(e) => update(r.key, { sport: e.target.value as Sport })}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </Select>
            <TextInput
              aria-label="Rate per hour in pesos"
              inputMode="decimal"
              placeholder="300"
              value={r.rate}
              onChange={(e) => update(r.key, { rate: e.target.value.replace(/[^\d.]/g, '') })}
            />
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1d1a4a]"
                checked={r.active}
                onChange={(e) => update(r.key, { active: e.target.checked })}
              />
              <span className="md:sr-only">Bookable</span>
            </label>
            <Button variant="danger" aria-label={`Remove ${r.name || 'court'}`} onClick={() => remove(r)} className="px-2">
              ✕
            </Button>
          </div>
        ))}
        <Button variant="secondary" onClick={add}>
          Add a court
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => save(true)} disabled={busy || rows.length === 0}>
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
