import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Enums } from '@verzus/db-types';
import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, Field, Modal, SaveNote, StatusPill, TextArea } from '../../components/ui';
import { photoUrl } from '../../lib/photos';
import { supabase } from '../../lib/supabase';
import { peso } from '../setup/data';

const VenueMap = lazy(() => import('../../components/VenueMap').then((m) => ({ default: m.VenueMap })));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Action = { status: Enums<'venue_status'>; needsNote: boolean; label: string; title: string };

/** Everything an admin needs to approve a venue, send it back, or take it down. */
export function VenueReviewPage() {
  const { venueId = '' } = useParams();
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['admin', 'venue', venueId],
    queryFn: async () => {
      const [venue, courts, hours, people] = await Promise.all([
        supabase.from('venues').select('*').eq('id', venueId).maybeSingle(),
        supabase
          .from('courts')
          .select('id, name, sport, hourly_rate_cents, is_active')
          .eq('venue_id', venueId)
          .order('created_at'),
        supabase.from('opening_hours').select('weekday, opens, closes').eq('venue_id', venueId).order('weekday'),
        supabase.rpc('venue_people', { p_venue_id: venueId }),
      ]);
      for (const r of [venue, courts, hours, people]) if (r.error) throw r.error;
      return { venue: venue.data, courts: courts.data ?? [], hours: hours.data ?? [], people: people.data ?? [] };
    },
  });
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data.isLoading) return null;
  const v = data.data?.venue;
  if (!v || !data.data) return <p className="text-ink-600">Venue not found.</p>;
  const { courts, hours, people } = data.data;

  const actions: Action[] =
    v.status === 'submitted'
      ? [
          { status: 'live', needsNote: false, label: 'Approve', title: `Make ${v.name} live?` },
          { status: 'draft', needsNote: true, label: 'Send back', title: 'Send back to the owner' },
        ]
      : v.status === 'live'
        ? [{ status: 'suspended', needsNote: true, label: 'Suspend', title: `Hide ${v.name} from players` }]
        : v.status === 'suspended'
          ? [{ status: 'live', needsNote: false, label: 'Reinstate', title: `Make ${v.name} live again?` }]
          : [];

  async function apply() {
    if (!action) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('venues')
      .update({ status: action.status, review_note: action.needsNote ? note.trim() : null })
      .eq('id', venueId);
    setBusy(false);
    if (error) return setError(error.message);
    setAction(null);
    setNote('');
    await qc.invalidateQueries({ queryKey: ['admin'] });
  }

  const cover = photoUrl(v.cover_path);
  const logo = photoUrl(v.logo_path);
  const owner = people.find((p) => p.role === 'owner');

  return (
    <div className="space-y-6">
      <Link to="/admin" className="text-sm font-semibold text-ink-500 hover:text-ink-900">
        ← Review queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-ink-900">{v.name}</h2>
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <StatusPill status={v.status} />
            {owner && <span>Owner: {owner.email}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {actions.map((a) => (
            <Button key={a.label} variant={a.status === 'live' ? 'primary' : 'secondary'} onClick={() => setAction(a)}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {v.review_note && (
        <p className="rounded-lg border-2 border-ink-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold">Note shown to the owner:</span> {v.review_note}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative aspect-[3/1] overflow-hidden rounded-card border-2 border-ink-200 bg-ink-100">
            {cover ? (
              <img src={cover} alt="Cover" className="h-full w-full object-cover" />
            ) : (
              <p className="grid h-full place-items-center text-sm text-ink-400">No cover photo</p>
            )}
            {logo && (
              <img
                src={logo}
                alt="Logo"
                className="absolute bottom-2 left-2 h-14 w-14 rounded-lg border-2 border-white object-cover"
              />
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Description">{v.description || '—'}</Row>
            <Row label="Phone">{v.phone || '—'}</Row>
            <Row label="Address">{[v.address, v.city].filter(Boolean).join(', ') || '—'}</Row>
          </dl>
          {v.photo_paths.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {v.photo_paths.map((p) => (
                <img key={p} src={photoUrl(p) ?? ''} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {v.lat != null && v.lng != null ? (
            <Suspense fallback={<div className="h-80 rounded-card border-[3px] border-ink-900" />}>
              <VenueMap pin={{ lat: v.lat, lng: v.lng }} center={{ lat: v.lat, lng: v.lng }} readOnly />
            </Suspense>
          ) : (
            <p className="rounded-card border-2 border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">No pin yet</p>
          )}
          <div>
            <h3 className="mb-2 font-semibold text-ink-900">Courts</h3>
            <ul className="space-y-1 text-sm">
              {courts.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span className={c.is_active ? '' : 'text-ink-400 line-through'}>
                    {c.name} · {c.sport}
                  </span>
                  <span className="font-semibold">{peso(c.hourly_rate_cents)}/h</span>
                </li>
              ))}
              {courts.length === 0 && <li className="text-ink-500">None</li>}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-ink-900">Opening hours</h3>
            <ul className="space-y-1 text-sm">
              {hours.map((h) => (
                <li key={h.weekday} className="flex justify-between">
                  <span>{DAYS[h.weekday]}</span>
                  <span>
                    {h.opens.slice(0, 5)} to {h.closes.slice(0, 5)}
                  </span>
                </li>
              ))}
              {hours.length === 0 && <li className="text-ink-500">None</li>}
            </ul>
          </div>
        </div>
      </div>

      {action && (
        <Modal title={action.title} onClose={() => setAction(null)}>
          {action.needsNote ? (
            <Field label="Note to the owner" hint="They see this at the top of their setup page.">
              <TextArea required value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          ) : (
            <p className="text-sm text-ink-600">
              {action.status === 'live' ? 'Players will be able to find and book it straight away.' : ''}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy || (action.needsNote && note.trim().length < 3)}>
              {busy ? 'Saving…' : action.label}
            </Button>
          </div>
          <SaveNote error={error} saved={false} />
        </Modal>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="font-semibold text-ink-700">{label}</dt>
      <dd className="text-ink-800">{children}</dd>
    </div>
  );
}
