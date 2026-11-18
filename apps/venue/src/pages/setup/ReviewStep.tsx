import { useState } from 'react';
import { Button, SaveNote } from '../../components/ui';
import { photoUrl } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { peso, progress } from './data';
import { StepFrame, type StepProps } from './StepFrame';

const CHECKS = [
  { id: 'basics', label: 'Name' },
  { id: 'location', label: 'Pin, city and address' },
  { id: 'courts', label: 'At least one bookable court' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'photos', label: 'Cover photo (recommended)' },
] as const;

export function ReviewStep({ setup, refresh, goTo }: StepProps & { goTo: (step: string) => void }) {
  const v = setup.venue;
  const done = progress(setup);
  const ready = done.basics && done.location && done.courts && done.hours;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: 'submitted' | 'draft') {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('venues').update({ status }).eq('id', v.id);
    setBusy(false);
    if (error) return setError(error.message);
    await refresh();
  }

  const active = setup.courts.filter((c) => c.is_active);
  const cheapest = active.length ? Math.min(...active.map((c) => c.hourly_rate_cents)) : null;
  const sports = [...new Set(active.map((c) => c.sport))];
  const cover = photoUrl(v.cover_path);
  const logo = photoUrl(v.logo_path);

  return (
    <StepFrame
      title="Review and submit"
      intro="This is roughly how players will see your venue. We check every venue before it goes live."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Preview */}
        <article className="overflow-hidden rounded-card border-[3px] border-ink-900 bg-white shadow-[6px_7px_0_#b8b3ff]">
          <div className="relative aspect-[3/1] bg-ink-100">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-ink-400">No cover photo yet</div>
            )}
            {logo && (
              <img
                src={logo}
                alt=""
                className="absolute -bottom-8 left-5 h-16 w-16 rounded-xl border-[3px] border-white bg-white object-cover shadow"
              />
            )}
          </div>
          <div className={`space-y-2 p-5 ${logo ? 'pt-10' : ''}`}>
            <h3 className="text-xl font-bold text-ink-900">{v.name}</h3>
            <p className="text-sm text-ink-500">{[v.address, v.city].filter(Boolean).join(', ') || 'No address yet'}</p>
            {v.description && <p className="text-ink-700">{v.description}</p>}
            <p className="text-sm font-semibold text-ink-800">
              {active.length
                ? `${active.length} court${active.length > 1 ? 's' : ''} · ${sports.map((s) => s[0]?.toUpperCase() + s.slice(1)).join(', ')} · from ${peso(cheapest ?? 0)}/hour`
                : 'No courts yet'}
            </p>
          </div>
        </article>

        {/* Checklist and actions */}
        <div className="space-y-5">
          <ul className="space-y-2">
            {CHECKS.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${
                    done[c.id] ? 'bg-[#dd2b37] text-white' : 'border-2 border-ink-300'
                  }`}
                >
                  {done[c.id] ? '✓' : ''}
                </span>
                <span className={done[c.id] ? 'text-ink-800' : 'text-ink-500'}>
                  {c.label}
                  {!done[c.id] && (
                    <button type="button" onClick={() => goTo(c.id)} className="ml-2 font-semibold text-ink-900 underline">
                      Add
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {v.status === 'draft' && (
            <div className="space-y-2">
              <Button onClick={() => setStatus('submitted')} disabled={busy || !ready} className="w-full py-2.5">
                {busy ? 'Submitting…' : 'Submit for review'}
              </Button>
              {!ready && <p className="text-xs text-ink-500">Finish the unticked items above first.</p>}
            </div>
          )}
          {v.status === 'submitted' && (
            <div className="space-y-2 rounded-lg bg-white p-4 text-sm text-ink-700">
              <p className="font-semibold text-ink-900">Submitted. Thanks!</p>
              <p>We'll check your listing and make it live, or send you a note if something needs fixing.</p>
              <Button variant="secondary" onClick={() => setStatus('draft')} disabled={busy}>
                Take it back to edit
              </Button>
            </div>
          )}
          {v.status === 'live' && (
            <p className="rounded-lg bg-white p-4 text-sm text-ink-700">
              Your venue is live. Changes you save here show up for players right away.
            </p>
          )}
          <SaveNote error={error} saved={false} />
        </div>
      </div>
    </StepFrame>
  );
}
