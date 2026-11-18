import FullCalendar, { type DateSelectInfo, type EventClickInfo, type EventInput } from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Enums } from '@verzus/db-types';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, Field, Modal, SaveNote, Select, TextInput } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useMyVenues } from '../lib/venues';

type Source = Enums<'booking_source'>;

const KIND: Record<Source, { label: string; color: string; text: string }> = {
  app: { label: 'App booking', color: '#dd2b37', text: '#ffffff' },
  walk_in: { label: 'Walk-in', color: '#5a4fd8', text: '#ffffff' },
  phone: { label: 'Phone booking', color: '#b8b3ff', text: '#1d1a4a' },
  block: { label: 'Blocked', color: '#1d1a4a', text: '#ffffff' },
};
const MANUAL: Source[] = ['walk_in', 'phone', 'block'];

interface Picked {
  start: Date;
  end: Date;
}
interface Opened {
  id: string;
  source: Source;
  status: string;
  note: string | null;
  start: Date;
  end: Date;
}

/**
 * The day-to-day screen: one calendar per court for app bookings, walk-ins, phone bookings and
 * blocks. Drag across free time to add one; click an entry to see or remove it. Overlaps are
 * refused by the database, so two people at the desk can't double-book a slot.
 */
export function CalendarPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const venues = useMyVenues();
  const venue = venues.data?.find((v) => v.venueId === params.get('venue')) ?? venues.data?.[0];
  const venueId = venue?.venueId;

  const setup = useQuery({
    queryKey: ['calendar-setup', venueId],
    enabled: Boolean(venueId),
    queryFn: async () => {
      const [courts, hours] = await Promise.all([
        supabase
          .from('courts')
          .select('id, name, sport')
          .eq('venue_id', venueId ?? '')
          .eq('is_active', true)
          .order('created_at'),
        supabase
          .from('opening_hours')
          .select('weekday, opens, closes')
          .eq('venue_id', venueId ?? ''),
      ]);
      if (courts.error) throw courts.error;
      if (hours.error) throw hours.error;
      return { courts: courts.data, hours: hours.data };
    },
  });
  const courts = setup.data?.courts ?? [];
  const court = courts.find((c) => c.id === params.get('court')) ?? courts[0];
  const courtId = court?.id;

  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const bookings = useQuery({
    queryKey: ['bookings', courtId, range?.start.toISOString()],
    enabled: Boolean(courtId && range),
    // App bookings arrive while the desk has this open.
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!courtId || !range) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('id, during, source, status, note')
        .eq('court_id', courtId)
        .in('status', ['held', 'confirmed'])
        .overlaps('during', `[${range.start.toISOString()},${range.end.toISOString()})`);
      if (error) throw error;
      return data;
    },
  });

  const [picked, setPicked] = useState<Picked | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const reload = () => qc.invalidateQueries({ queryKey: ['bookings', courtId] });

  const choose = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    setParams(next, { replace: true });
  };

  if (venues.isLoading || (venueId && setup.isLoading)) return null;

  if (!venue) {
    return (
      <Empty title="You're not part of a venue yet">
        If you got an invite link from verzus or a venue owner, open it again while signed in.
      </Empty>
    );
  }

  if (courts.length === 0) {
    return venue.role === 'owner' ? (
      <Empty title="Add your courts first">
        The calendar shows one court at a time.{' '}
        <Link to={`/setup/${venue.venueId}?step=courts`} className="font-semibold text-ink-900 underline">
          Add courts and rates
        </Link>
        .
      </Empty>
    ) : (
      <Empty title="No courts yet">The owner hasn't added this venue's courts yet.</Empty>
    );
  }

  const hours = setup.data?.hours ?? [];
  const earliest = hours.length ? hours.map((h) => h.opens).sort()[0] : '06:00:00';
  const latest = hours.length
    ? hours
        .map((h) => h.closes)
        .sort()
        .at(-1)
    : '24:00:00';
  const businessHours = hours.map((h) => ({ daysOfWeek: [h.weekday], startTime: h.opens, endTime: h.closes }));
  const phone = typeof window !== 'undefined' && window.innerWidth < 768;

  const events: EventInput[] = (bookings.data ?? []).map((b) => {
    const [start, end] = parseRange(b.during as unknown as string);
    const kind = KIND[b.source];
    const held = b.status === 'held';
    return {
      id: b.id,
      start,
      end,
      title: held ? 'Held: awaiting payment' : b.note ? `${kind.label} · ${b.note}` : kind.label,
      // FullCalendar 7: `color` is the fill, `contrastColor` the text. Held slots are outlined in white.
      color: held ? '#ffffff' : kind.color,
      contrastColor: held ? kind.color : kind.text,
      extendedProps: { source: b.source, status: b.status, note: b.note },
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {(venues.data?.length ?? 0) > 1 && (
          <div className="w-56">
            <Field label="Venue">
              <Select value={venue.venueId} onChange={(e) => choose({ venue: e.target.value, court: '' })}>
                {venues.data?.map((v) => (
                  <option key={v.venueId} value={v.venueId}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <div role="tablist" aria-label="Court" className="flex flex-wrap gap-1">
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === courtId}
              onClick={() => choose({ court: c.id })}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                c.id === courtId ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 hover:bg-ink-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <ul className="ml-auto flex flex-wrap gap-3 text-xs text-ink-600">
          {MANUAL.concat('app').map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: KIND[s].color }} />
              {KIND[s].label}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-ink-500">
        {phone ? 'Press and hold' : 'Drag across'} free time to add a walk-in, phone booking or block. Click an entry to see it.
      </p>

      <div className="rounded-card border-2 border-ink-200 bg-white p-3">
        <FullCalendar
          key={courtId}
          plugins={[timeGridPlugin, interactionPlugin, classicThemePlugin]}
          initialView={phone ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek' }}
          allDaySlot={false}
          nowIndicator
          firstDay={1}
          slotMinTime={earliest}
          slotMaxTime={latest}
          businessHours={businessHours.length ? businessHours : undefined}
          selectable
          selectMirror
          selectOverlap={false}
          selectLongPressDelay={300}
          select={(sel: DateSelectInfo) => {
            setPicked({ start: sel.start, end: sel.end });
            sel.view.calendar.unselect();
          }}
          eventClick={(info: EventClickInfo) => {
            const e = info.event;
            setOpened({
              id: e.id,
              source: e.extendedProps.source as Source,
              status: e.extendedProps.status as string,
              note: (e.extendedProps.note as string | null) ?? null,
              start: e.start as Date,
              end: e.end as Date,
            });
          }}
          datesSet={(info) => setRange({ start: info.start, end: info.end })}
          events={events}
          height="auto"
        />
      </div>

      {picked && courtId && (
        <AddDialog
          courtId={courtId}
          courtName={court?.name ?? ''}
          picked={picked}
          onDone={() => {
            setPicked(null);
            reload();
          }}
          onCancel={() => setPicked(null)}
        />
      )}
      {opened && (
        <DetailsDialog
          entry={opened}
          onClose={() => setOpened(null)}
          onDeleted={() => {
            setOpened(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function AddDialog(props: { courtId: string; courtName: string; picked: Picked; onDone: () => void; onCancel: () => void }) {
  const [source, setSource] = useState<Source>('walk_in');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('bookings').insert({
      court_id: props.courtId,
      during: `[${props.picked.start.toISOString()},${props.picked.end.toISOString()})`,
      status: 'confirmed',
      source,
      note: note.trim() || null,
    });
    setBusy(false);
    // 23P01: the database refused an overlap (someone else just took that time).
    if (error)
      return setError(error.code === '23P01' ? 'That time was just taken. Refresh and pick another slot.' : error.message);
    props.onDone();
  }

  return (
    <Modal title={`${props.courtName}, ${when(props.picked.start, props.picked.end)}`} onClose={props.onCancel}>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-ink-800">What is it?</legend>
        {MANUAL.map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm text-ink-800">
            <input
              type="radio"
              name="kind"
              className="h-4 w-4 accent-[#1d1a4a]"
              checked={source === s}
              onChange={() => setSource(s)}
            />
            {KIND[s].label}
            {s === 'block' && <span className="text-ink-500">(maintenance, private event)</span>}
          </label>
        ))}
      </fieldset>
      <Field label="Note (optional)" hint={source === 'block' ? 'Why it is blocked.' : 'Customer name or number.'}>
        <TextInput maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <SaveNote error={error} saved={false} />
    </Modal>
  );
}

function DetailsDialog({ entry, onClose, onDeleted }: { entry: Opened; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manual = entry.source !== 'app';

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('bookings').delete().eq('id', entry.id);
    setBusy(false);
    if (error) return setError(error.message);
    onDeleted();
  }

  return (
    <Modal title={KIND[entry.source].label} onClose={onClose}>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 font-semibold text-ink-700">When</dt>
          <dd>{when(entry.start, entry.end)}</dd>
        </div>
        {entry.note && (
          <div className="flex gap-2">
            <dt className="w-16 font-semibold text-ink-700">Note</dt>
            <dd>{entry.note}</dd>
          </div>
        )}
        {entry.status === 'held' && <p className="text-ink-600">A player is paying for this slot right now.</p>}
      </dl>
      {!manual && <p className="text-sm text-ink-500">Booked and paid through the app. It can't be removed here.</p>}
      <div className="flex justify-end gap-2">
        {manual && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <SaveNote error={error} saved={false} />
    </Modal>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-2 rounded-card border-2 border-dashed border-ink-200 p-8 text-center">
      <h1 className="font-bold text-ink-900">{title}</h1>
      <p className="text-sm text-ink-600">{children}</p>
    </div>
  );
}

function when(start: Date, end: Date): string {
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${t(start)} to ${t(end)}`;
}

/** Postgres returns tstzrange as text like ["2026-12-01 10:00:00+00","2026-12-01 11:00:00+00"). */
function parseRange(text: string): [string, string] {
  const [a = '', b = ''] = text.slice(1, -1).split(',');
  return [a.replaceAll('"', ''), b.replaceAll('"', '')];
}
