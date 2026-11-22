import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Enums } from '@verzus/db-types';
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, Field, Modal, SaveNote, TextInput } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useMyVenues } from '../lib/venues';

type Source = Enums<'booking_source'>;

// Theme colours as CSS strings, so the board follows the theme: app bookings green, walk-ins
// violet, phone bookings soft violet, blocked time neutral.
const KIND: Record<Source, { label: string; color: string; text: string }> = {
  app: { label: 'App booking', color: 'rgb(var(--accent))', text: 'rgb(var(--on-accent))' },
  walk_in: { label: 'Walk-in', color: 'rgb(var(--violet))', text: 'rgb(var(--surface))' },
  phone: { label: 'Phone booking', color: 'rgb(var(--violet-soft))', text: 'rgb(var(--fg))' },
  block: { label: 'Blocked', color: 'rgb(var(--surface-3))', text: 'rgb(var(--fg-2))' },
};
const MANUAL: Source[] = ['walk_in', 'phone', 'block'];

/** One hour on the board, in pixels. Half-hours are the smallest step. */
const HOUR = 64;
const PX = HOUR / 60;
const STEP = 30;
const DURATIONS = [30, 60, 90, 120, 180];

interface Entry {
  id: string;
  courtId: string;
  source: Source;
  status: string;
  note: string | null;
  start: Date;
  end: Date;
}
interface Slot {
  courtId: string;
  courtName: string;
  start: Date;
  /** The longest it can run: up to the next booking, closing time or midnight. */
  maxMinutes: number;
}

/**
 * The day-to-day screen, a court board: one day, every court side by side, hours down the side
 * and a line at the current time. Tap free time to add a walk-in, phone booking or block; tap an
 * entry to see it or remove it. Overlaps are refused by the database, so two people at the desk
 * can't double-book a slot.
 */
export function CalendarPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const venues = useMyVenues();
  const venue = venues.data?.find((v) => v.venueId === params.get('venue')) ?? venues.data?.[0];
  const venueId = venue?.venueId;
  const day = fromKey(params.get('date')) ?? startOfDay(new Date());
  const now = useNow();

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
  const courtIds = courts.map((c) => c.id);

  const dayEnd = addDays(day, 1);
  const bookings = useQuery({
    queryKey: ['bookings', venueId, toKey(day)],
    enabled: courtIds.length > 0,
    // App bookings arrive while the desk has this open.
    refetchInterval: 30_000,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, court_id, during, source, status, note')
        .in('court_id', courtIds)
        .in('status', ['held', 'confirmed'])
        .overlaps('during', `[${day.toISOString()},${dayEnd.toISOString()})`);
      if (error) throw error;
      return data.map((b) => {
        const [start, end] = parseRange(b.during as unknown as string);
        return {
          id: b.id,
          courtId: b.court_id,
          source: b.source,
          status: b.status,
          note: b.note,
          start: new Date(start),
          end: new Date(end),
        };
      });
    },
  });

  const [slot, setSlot] = useState<Slot | null>(null);
  const [opened, setOpened] = useState<Entry | null>(null);
  const reload = () => qc.invalidateQueries({ queryKey: ['bookings', venueId] });

  const choose = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const goTo = (d: Date) => choose({ date: sameDay(d, now) ? null : toKey(d) });

  if (venues.isLoading || (venueId && setup.isLoading)) return null;

  if (!venue) {
    return (
      <Empty title="You're not part of a venue yet">
        Own a venue?{' '}
        <Link to="/start" className="font-semibold text-fg underline">
          Set it up
        </Link>
        . Joining a venue's staff? Open the invite link the owner sent you while signed in.
      </Empty>
    );
  }

  if (courts.length === 0) {
    return venue.role === 'owner' ? (
      <Empty title="Add your courts first">
        The calendar shows your courts side by side.{' '}
        <Link to={`/setup/${venue.venueId}?step=courts`} className="font-semibold text-fg underline">
          Add courts and rates
        </Link>
        .
      </Empty>
    ) : (
      <Empty title="No courts yet">The owner hasn't added this venue's courts yet.</Empty>
    );
  }

  // The day's opening hours (weekday 0 is Sunday, as in the database). The board runs from the
  // hour the venue opens to the hour after it closes, widened for any booking outside them; on a
  // closed day it shows the venue's usual span, shaded.
  const hours = setup.data?.hours ?? [];
  const today = hours.find((h) => h.weekday === day.getDay());
  const open = today ? minutes(today.opens) : null;
  const close = today ? minutes(today.closes) : null;
  const usualOpen = hours.length ? Math.min(...hours.map((h) => minutes(h.opens))) : 6 * 60;
  const usualClose = hours.length ? Math.max(...hours.map((h) => minutes(h.closes))) : 24 * 60;
  const entries = bookings.data ?? [];
  const inDay = (d: Date) => Math.min(Math.max((d.getTime() - day.getTime()) / 60_000, 0), 24 * 60);
  const first = Math.min(open ?? usualOpen, ...entries.map((e) => inDay(e.start)));
  const last = Math.max(close ?? usualClose, ...entries.map((e) => inDay(e.end)));
  const from = Math.floor(first / 60) * 60;
  const to = Math.min(Math.ceil(last / 60) * 60, 24 * 60);
  const isToday = sameDay(day, now);
  const nowMin = isToday ? inDay(now) : null;

  function tap(courtId: string, courtName: string, minute: number) {
    const start = Math.floor(minute / STEP) * STEP;
    if (open == null || close == null || start < open || start >= close) return; // closed
    const taken = entries.filter((e) => e.courtId === courtId);
    if (taken.some((e) => inDay(e.start) <= start && inDay(e.end) > start)) return;
    const next = Math.min(close, ...taken.map((e) => inDay(e.start)).filter((m) => m > start));
    setSlot({ courtId, courtName, start: new Date(day.getTime() + start * 60_000), maxMinutes: next - start });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DateBar
        day={day}
        now={now}
        closed={
          !today
            ? 'Closed'
            : nowMin != null && open != null && close != null && (nowMin < open || nowMin >= close)
              ? 'Closed now'
              : null
        }
        onPick={goTo}
        venuePicker={
          (venues.data?.length ?? 0) > 1 ? (
            <select
              aria-label="Venue"
              value={venue.venueId}
              onChange={(e) => choose({ venue: e.target.value })}
              className="rounded-control border border-line-strong bg-surface px-2 py-1.5 text-sm font-semibold text-fg"
            >
              {venues.data?.map((v) => (
                <option key={v.venueId} value={v.venueId}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      <Board
        key={`${venueId}-${toKey(day)}`}
        courts={courts}
        entries={entries}
        from={from}
        to={to}
        open={open}
        close={close}
        nowMin={nowMin}
        inDay={inDay}
        onTap={tap}
        onOpen={setOpened}
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2" aria-label="Colours">
        {(['app', ...MANUAL] as Source[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-line-strong" style={{ background: KIND[s].color }} />
            {KIND[s].label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-accent" />
          Awaiting payment
        </li>
      </ul>

      {slot && (
        <AddDialog
          slot={slot}
          onDone={() => {
            setSlot(null);
            reload();
          }}
          onCancel={() => setSlot(null)}
        />
      )}
      {opened && (
        <DetailsDialog
          entry={opened}
          courtName={courts.find((c) => c.id === opened.courtId)?.name ?? ''}
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

/** The day's title, a Today button, and the week as a strip of days to tap. */
function DateBar(props: {
  day: Date;
  now: Date;
  /** "Closed" on a day the venue doesn't open, "Closed now" today outside its hours. */
  closed: string | null;
  onPick: (d: Date) => void;
  venuePicker: React.ReactNode;
}) {
  const monday = addDays(props.day, -((props.day.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const isToday = sameDay(props.day, props.now);
  const arrow =
    'grid h-9 w-8 shrink-0 place-items-center rounded-control text-fg-2 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 truncate text-lg font-bold text-fg">
          {props.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </h1>
        {props.closed && (
          <span className="shrink-0 rounded-chip bg-surface-3 px-2 py-0.5 text-xs font-semibold text-fg-2">{props.closed}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {props.venuePicker}
          <button
            type="button"
            onClick={() => props.onPick(props.now)}
            disabled={isToday}
            className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-fg hover:border-violet disabled:cursor-default disabled:opacity-40 disabled:hover:border-line-strong"
          >
            Today
          </button>
        </span>
      </div>
      <div className="flex max-w-2xl items-center gap-1">
        <button type="button" aria-label="Previous week" onClick={() => props.onPick(addDays(props.day, -7))} className={arrow}>
          ‹
        </button>
        <div role="tablist" aria-label="Day" className="grid flex-1 grid-cols-7 gap-1">
          {week.map((d) => {
            const on = sameDay(d, props.day);
            const today = sameDay(d, props.now);
            return (
              <button
                key={toKey(d)}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                onClick={() => props.onPick(d)}
                className={`flex flex-col items-center rounded-control py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                  on ? 'bg-accent text-on-accent' : 'text-fg-2 hover:bg-surface-2'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
                </span>
                <span className="text-base font-bold leading-tight">{d.getDate()}</span>
                {/* Today, marked in violet ("you are here") when it isn't the day shown. */}
                <span className={`mt-0.5 h-1 w-1 rounded-full ${today && !on ? 'bg-violet' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Next week" onClick={() => props.onPick(addDays(props.day, 7))} className={arrow}>
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * The board: a scroll box as tall as the space left on screen, with the court names pinned to its
 * top and the hours pinned to its left, so both stay in view while scrolling either way. Phones
 * show about two courts and swipe sideways for the rest.
 */
function Board(props: {
  courts: { id: string; name: string; sport: string }[];
  entries: Entry[];
  from: number;
  to: number;
  open: number | null;
  close: number | null;
  nowMin: number | null;
  inDay: (d: Date) => number;
  onTap: (courtId: string, courtName: string, minute: number) => void;
  onOpen: (e: Entry) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [hover, setHover] = useState<{ courtId: string; min: number } | null>(null);
  const span = props.to - props.from;
  const y = (min: number) => (min - props.from) * PX;

  // Fill the screen below the board's top, leaving room for the legend and, on phones, the tab bar.
  useLayoutEffect(() => {
    const fit = () => {
      const el = box.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const reserve = window.matchMedia('(max-width: 639.98px)').matches ? 124 : 64;
      setHeight(Math.max(320, window.innerHeight - top - reserve));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Open on the current time today, otherwise on opening time; once, after the board has its height
  // (scrolling earlier is clamped to the wrong height). The board is keyed by venue and day.
  const scrolled = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the height is known, not on later changes.
  useEffect(() => {
    if (height == null || scrolled.current) return;
    scrolled.current = true;
    const target = Math.min(Math.max(props.nowMin ?? props.open ?? props.from, props.from), props.to);
    box.current?.scrollTo({ top: Math.max(0, y(target) - 96) });
  }, [height]);

  const minuteAt = (e: MouseEvent<HTMLElement>) => props.from + (e.clientY - e.currentTarget.getBoundingClientRect().top) / PX;
  const lines = `repeating-linear-gradient(to bottom, rgb(var(--line)) 0 1px, transparent 1px ${HOUR / 2}px, rgb(var(--line) / 0.45) ${HOUR / 2}px ${HOUR / 2 + 1}px, transparent ${HOUR / 2 + 1}px ${HOUR}px)`;

  return (
    <div
      ref={box}
      style={{ height: height ?? 480 }}
      className="relative snap-x overflow-auto overscroll-contain rounded-panel border border-line bg-surface scroll-pl-14"
    >
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `3.5rem repeat(${props.courts.length}, minmax(8.5rem, 1fr))`, width: 'max-content' }}
      >
        {/* Court names, pinned to the top. */}
        <div className="sticky left-0 top-0 z-30 border-b border-line bg-surface" />
        {props.courts.map((c) => (
          <div key={c.id} className="sticky top-0 z-20 snap-start border-b border-l border-line bg-surface px-3 py-2">
            <p className="truncate text-sm font-bold text-fg">{c.name}</p>
            <p className="truncate text-xs capitalize text-fg-3">{c.sport}</p>
          </div>
        ))}

        {/* Hours, pinned to the left. */}
        <div className="sticky left-0 z-10 border-r border-line bg-surface" style={{ height: span * PX }}>
          {Array.from({ length: span / 60 }, (_, i) => props.from + i * 60).map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-fg-3" style={{ top: y(m) }}>
              {m === props.from ? '' : hourLabel(m)}
            </span>
          ))}
          {props.nowMin != null && props.nowMin >= props.from && props.nowMin <= props.to && (
            <span
              className="absolute right-1 z-10 -translate-y-1/2 rounded-chip bg-violet px-1 text-[10px] font-bold text-surface"
              style={{ top: y(props.nowMin) }}
            >
              {timeLabel(props.nowMin)}
            </span>
          )}
        </div>

        {props.courts.map((c) => {
          const mine = props.entries.filter((e) => e.courtId === c.id);
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: free time is picked by pointer; the add dialog is keyboard-usable, and entries are buttons.
            <div
              key={c.id}
              className="relative cursor-pointer border-l border-line"
              style={{ height: span * PX, backgroundImage: lines }}
              onClick={(e) => props.onTap(c.id, c.name, minuteAt(e))}
              onPointerMove={(e) => {
                if (e.pointerType === 'mouse') setHover({ courtId: c.id, min: Math.floor(minuteAt(e) / STEP) * STEP });
              }}
              onPointerLeave={() => setHover(null)}
            >
              {/* Closed time, shaded. */}
              {props.open == null || props.close == null ? (
                <div className="absolute inset-0 bg-surface-3/60" />
              ) : (
                <>
                  {props.open > props.from && (
                    <div className="absolute inset-x-0 top-0 bg-surface-3/60" style={{ height: y(props.open) }} />
                  )}
                  {props.close < props.to && (
                    <div className="absolute inset-x-0 bottom-0 bg-surface-3/60" style={{ top: y(props.close) }} />
                  )}
                </>
              )}

              {/* Where a click would add, on screens with a mouse. */}
              {hover?.courtId === c.id &&
                props.open != null &&
                props.close != null &&
                hover.min >= props.open &&
                hover.min < props.close &&
                !mine.some((e) => props.inDay(e.start) <= hover.min && props.inDay(e.end) > hover.min) && (
                  <div
                    className="pointer-events-none absolute inset-x-1 flex items-center rounded-chip border border-dashed border-accent bg-accent-soft/60 px-2 text-xs font-semibold text-accent-soft-fg"
                    style={{ top: y(hover.min) + 1, height: STEP * PX - 2 }}
                  >
                    + {timeLabel(hover.min)}
                  </div>
                )}

              {mine.map((e) => {
                const top = y(props.inDay(e.start));
                const h = Math.max((props.inDay(e.end) - props.inDay(e.start)) * PX - 2, 22);
                const held = e.status === 'held';
                const k = KIND[e.source];
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      props.onOpen(e);
                    }}
                    className="absolute inset-x-1 z-[1] overflow-hidden rounded-chip px-2 py-1 text-left text-xs leading-tight shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                    style={{
                      top: top + 1,
                      height: h,
                      background: held ? 'rgb(var(--surface))' : k.color,
                      color: held ? k.color : k.text,
                      border: held ? `1.5px dashed ${k.color}` : undefined,
                    }}
                  >
                    <span className="block truncate font-bold">{held ? 'Awaiting payment' : e.note || k.label}</span>
                    {h >= 36 && (
                      <span className="block truncate opacity-80">
                        {held || !e.note ? '' : `${k.label} · `}
                        {clock(e.start)}–{clock(e.end)}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Now: violet, "you are here". Under the entries, so it never runs through their text. */}
              {props.nowMin != null && props.nowMin >= props.from && props.nowMin <= props.to && (
                <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-violet" style={{ top: y(props.nowMin) }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddDialog(props: { slot: Slot; onDone: () => void; onCancel: () => void }) {
  const lengths = DURATIONS.filter((d) => d <= props.slot.maxMinutes);
  const [length, setLength] = useState(lengths.includes(60) ? 60 : (lengths.at(-1) ?? STEP));
  const [source, setSource] = useState<Source>('walk_in');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = new Date(props.slot.start.getTime() + length * 60_000);
  const chip = (on: boolean) =>
    `rounded-control border px-3 py-1.5 text-sm font-semibold transition-colors ${
      on
        ? 'border-accent bg-accent-soft text-accent-soft-fg'
        : 'border-line-strong bg-surface text-fg-2 hover:border-violet hover:text-fg'
    }`;

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('bookings').insert({
      court_id: props.slot.courtId,
      during: `[${props.slot.start.toISOString()},${end.toISOString()})`,
      status: 'confirmed',
      source,
      note: note.trim() || null,
    });
    setBusy(false);
    // 23P01: the database refused an overlap (someone else just took that time).
    if (error) return setError(error.code === '23P01' ? 'That time was just taken. Pick another slot.' : error.message);
    props.onDone();
  }

  return (
    <Modal title={`${props.slot.courtName}, ${when(props.slot.start, end)}`} onClose={props.onCancel}>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-fg">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {MANUAL.map((s) => (
            <label
              key={s}
              className={`cursor-pointer ${chip(source === s)} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet`}
            >
              <input type="radio" name="kind" className="sr-only" checked={source === s} onChange={() => setSource(s)} />
              {KIND[s].label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-fg">How long?</legend>
        <div className="flex flex-wrap gap-2">
          {lengths.map((d) => (
            <label
              key={d}
              className={`cursor-pointer ${chip(length === d)} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet`}
            >
              <input type="radio" name="length" className="sr-only" checked={length === d} onChange={() => setLength(d)} />
              {d < 60 ? `${d} min` : `${d / 60} hr`}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Note (optional)">
        <TextInput
          maxLength={120}
          value={note}
          placeholder={source === 'block' ? 'Why it is blocked' : 'Customer name or number'}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Add'}
        </Button>
      </div>
      <SaveNote error={error} saved={false} />
    </Modal>
  );
}

function DetailsDialog(props: { entry: Entry; courtName: string; onClose: () => void; onDeleted: () => void }) {
  const { entry } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manual = entry.source !== 'app';

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('bookings').delete().eq('id', entry.id);
    setBusy(false);
    if (error) return setError(error.message);
    props.onDeleted();
  }

  return (
    <Modal title={KIND[entry.source].label} onClose={props.onClose}>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 font-semibold text-fg-2">Court</dt>
          <dd>{props.courtName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 font-semibold text-fg-2">When</dt>
          <dd>{when(entry.start, entry.end)}</dd>
        </div>
        {entry.note && (
          <div className="flex gap-2">
            <dt className="w-16 font-semibold text-fg-2">Note</dt>
            <dd>{entry.note}</dd>
          </div>
        )}
        {entry.status === 'held' && <p className="text-fg-2">A player is paying for this slot right now.</p>}
      </dl>
      {!manual && <p className="text-sm text-fg-3">Booked and paid through the app. It can't be removed here.</p>}
      <div className="flex justify-end gap-2">
        {manual && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        )}
        <Button variant="secondary" onClick={props.onClose}>
          Close
        </Button>
      </div>
      <SaveNote error={error} saved={false} />
    </Modal>
  );
}

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-2 rounded-panel border-2 border-dashed border-line p-8 text-center">
      <h1 className="font-bold text-fg">{title}</h1>
      <p className="text-sm text-fg-2">{children}</p>
    </div>
  );
}

/** The time now, updated every minute (moves the now line). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function fromKey(s: string | null): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
/** "13:30:00" -> 810; "24:00:00" -> 1440. */
function minutes(t: string): number {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) * 60 + Number(m);
}
const at = (min: number) => new Date(2000, 0, 1, Math.floor(min / 60), min % 60);
const hourLabel = (min: number) => at(min).toLocaleTimeString(undefined, { hour: 'numeric' });
const timeLabel = (min: number) => at(Math.floor(min)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function when(start: Date, end: Date): string {
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${clock(start)} to ${clock(end)}`;
}

/** Postgres returns tstzrange as text like ["2026-12-01 10:00:00+00","2026-12-01 11:00:00+00"). */
function parseRange(text: string): [string, string] {
  const [a = '', b = ''] = text.slice(1, -1).split(',');
  return [a.replaceAll('"', ''), b.replaceAll('"', '')];
}
