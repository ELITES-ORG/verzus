import { SPORTS, type Sport } from '@verzus/schemas/constants';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useId, useRef, useState } from 'react';
import { photoUrl, removeVenuePhoto, uploadVenuePhoto } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { peso } from '../../setup/data';
import { saveLabel, useAutosave } from '../autosave';
import { CourtsIcon } from '../icons';
import { SearchSelect } from '../SearchSelect';
import { Block, Scene, SceneFooter, type SceneProps, StageSwitch } from '../stage';

interface Row {
  key: string;
  id?: string;
  name: string;
  sport: Sport | ''; // '' until chosen
  rate: string; // pesos, as typed
  active: boolean;
  photos: string[]; // storage paths
}

/** Photos per court: at least one for a court open for booking (checked on submit too), at most five. */
const MAX_PHOTOS = 5;

const label = (s: Sport) => s[0]?.toUpperCase() + s.slice(1);
const SPORT_OPTIONS = SPORTS.map((s) => ({ value: s, label: label(s) }));
let seq = 0;
// A new court starts empty: its sport and price are chosen for it, not copied from the last one.
const blank = (n: number): Row => ({
  key: `new-${++seq}`,
  name: `Court ${n}`,
  sport: '',
  rate: '',
  active: true,
  photos: [],
});

export function CourtsScene({ setup, refresh, next, back }: SceneProps) {
  const venueId = setup.venue.id;
  // The open-for-booking switch is for running a venue: closing a court for repairs without
  // deleting it and its bookings. While a venue is being set up (a draft, or waiting for review)
  // every court listed is to be booked, so it doesn't show, except on a court already switched
  // off, so it can be switched back on.
  const running = setup.venue.status === 'live' || setup.venue.status === 'suspended';
  const [switchedOff] = useState(() => new Set(setup.courts.filter((c) => !c.is_active).map((c) => c.id)));
  const [rows, setRows] = useState<Row[]>(() =>
    setup.courts.length
      ? setup.courts.map((c) => ({
          key: c.id,
          id: c.id,
          name: c.name,
          sport: c.sport,
          rate: String(c.hourly_rate_cents / 100),
          active: c.is_active,
          photos: c.photo_paths,
        }))
      : [blank(1)],
  );
  // Bookkeeping for autosave (refs, so it doesn't count as a change to save):
  // - ids of courts saved during this visit, by card;
  // - saved courts removed since the last save (deleted at the next one);
  // - cards removed while their first save was still running (deleted once their id is back);
  // - photos stored on a saved court, and stored photos taken off one (their files are deleted
  //   only after the change is saved, so nothing is lost if a save fails).
  const ids = useRef(new Map<string, string>());
  const removed = useRef<string[]>([]);
  const removedKeys = useRef(new Set<string>());
  const saved = useRef(new Set(setup.courts.flatMap((c) => c.photo_paths)));
  const dropped = useRef<string[]>([]);
  // The court whose photos are uploading, if any.
  const [uploading, setUploading] = useState<string | null>(null);
  // The court whose sport search is open, if any.
  const [pickingSport, setPickingSport] = useState<string | null>(null);
  const closeSport = useCallback(() => setPickingSport(null), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (r: Row) => {
    setRows((rs) => rs.filter((x) => x.key !== r.key));
    const id = r.id ?? ids.current.get(r.key);
    if (id) removed.current.push(id);
    else removedKeys.current.add(r.key);
    // Photos uploaded in this visit and never saved: nothing else points at them.
    for (const p of r.photos) if (!saved.current.has(p)) void removeVenuePhoto(p);
  };
  const add = () => setRows((rs) => [...rs, blank(rs.length + 1)]);

  // Every court has its name, sport and price: needed to save, and before another court is added.
  const named = rows.length > 0 && rows.every((r) => r.name.trim() && r.sport && Number(r.rate) > 0);
  const pictured = rows.every((r) => !r.active || r.photos.length > 0);
  const valid = named && pictured;
  const issues = (r: Row) => ({
    name: !r.name.trim(),
    sport: !r.sport,
    rate: !(Number(r.rate) > 0),
    photo: r.active && r.photos.length === 0,
  });
  const hasIssue = (r: Row) => Object.values(issues(r)).some(Boolean);
  // Set once Continue is tapped with something missing: from then on, missing fields show in red.
  const [tried, setTried] = useState(false);
  const cards = useRef(new Map<string, HTMLDivElement>());

  // Another court can be added only once every court so far is complete (name, sport, price and,
  // if it takes bookings, a photo), and no upload is running. Otherwise the button is locked and
  // says which court to finish and what it still needs.
  const unfinished = rows.find(hasIssue);
  const canAdd = !unfinished && uploading === null;
  const needs = unfinished ? missingText(issues(unfinished)) : '';
  function showUnfinished() {
    if (!unfinished) return;
    setTried(true);
    cards.current.get(unfinished.key)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /** Continue: save, or take the owner to the first court that still needs something. */
  function onContinue() {
    if (valid) return save();
    setTried(true);
    const first = rows.find(hasIssue);
    if (first) cards.current.get(first.key)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function addPhotos(r: Row, files: File[]) {
    const room = MAX_PHOTOS - r.photos.length;
    if (room <= 0 || files.length === 0) return;
    setUploading(r.key);
    setError(null);
    try {
      const paths: string[] = [];
      for (const file of files.slice(0, room)) paths.push(await uploadVenuePhoto(venueId, 'court', file));
      setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, photos: [...x.photos, ...paths] } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.');
    } finally {
      setUploading(null);
    }
  }

  function removePhoto(r: Row, path: string) {
    update(r.key, { photos: r.photos.filter((p) => p !== path) });
    // Never saved: nothing points at the file, so delete it now. Saved: delete it after saving.
    if (saved.current.has(path)) dropped.current.push(path);
    else void removeVenuePhoto(path);
  }
  // Hourly prices of the courts that take bookings, for the summary above the footer.
  const prices = rows.filter((r) => r.active && Number(r.rate) > 0).map((r) => Number(r.rate));

  /** Saves the courts: removed ones deleted (or switched off if they have bookings), the rest written. */
  async function saveCourts(list: Row[]) {
    const toDrop = dropped.current.splice(0);
    try {
      for (const id of removed.current.splice(0)) {
        const { error } = await supabase.from('courts').delete().eq('id', id);
        // A court with bookings keeps its history: switch it off instead of deleting it.
        if (error?.code === '23503') {
          const off = await supabase.from('courts').update({ is_active: false }).eq('id', id);
          if (off.error) throw off.error;
        } else if (error) throw error;
        // Deleted for good: its photos go too.
        else toDrop.push(...(setup.courts.find((x) => x.id === id)?.photo_paths ?? []));
      }
      for (const r of list) {
        const values = {
          name: r.name.trim(),
          sport: r.sport as Sport, // saved only once every court has one (`ready`)
          hourly_rate_cents: Math.round(Number(r.rate) * 100),
          is_active: r.active,
          photo_paths: r.photos,
        };
        const id = r.id ?? ids.current.get(r.key);
        if (id) {
          const { error } = await supabase.from('courts').update(values).eq('id', id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('courts')
            .insert({ ...values, venue_id: venueId })
            .select('id')
            .single();
          if (error) throw error;
          ids.current.set(r.key, data.id);
          // Removed while this first save was running: delete it now that it has an id.
          if (removedKeys.current.delete(r.key)) removed.current.push(data.id);
          else setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, id: data.id } : x)));
        }
        for (const p of r.photos) saved.current.add(p);
      }
    } catch (e) {
      dropped.current.unshift(...toDrop); // not saved: keep those files
      throw e;
    }
    // Files of photos taken off saved courts. A failed delete only leaves an unused file.
    await Promise.allSettled(toDrop.map((p) => removeVenuePhoto(p)));
    await refresh();
  }

  // Saved as they go, whenever every court has a name and a price (photos are needed to submit
  // for review, not to save). Card ids aren't part of what's compared: they come back from a save.
  const ready = named && uploading === null;
  const auto = useAutosave(
    rows.map(({ id: _id, ...r }) => r),
    ready,
    (list) => saveCourts(list.map((r) => ({ ...r, id: ids.current.get(r.key) ?? rows.find((x) => x.key === r.key)?.id }))),
  );

  async function save() {
    setBusy(true);
    setError(null);
    const ok = await auto.flush();
    setBusy(false);
    if (!ok) return setError("Couldn't save the courts. Check your connection and try again.");
    next();
  }

  return (
    <Scene wide eyebrow="Step 3 · Courts" icon={<CourtsIcon />} title="Your courts" intro="Add each court players can book.">
      {/* Raised while a sport search is open: each block is its own animated layer, and the block
          after this one (Add a court) would otherwise paint over the floating search. */}
      <Block className={pickingSport ? 'relative z-30' : ''}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.div
                key={r.key}
                ref={(el) => {
                  if (el) cards.current.set(r.key, el);
                  else cards.current.delete(r.key);
                }}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                // relative: the sport search spans the card. z-20 while it's open: each animated card
                // is its own layer, and the next card would otherwise cover the search.
                className={`relative rounded-panel border-2 p-4 sm:p-5 ${pickingSport === r.key ? 'z-20' : ''} ${
                  r.active ? 'border-line-strong bg-surface' : 'border-dashed border-line bg-transparent'
                }`}
              >
                {/* Card order: the court's name (its title), then what players pay for, then the
                    switches. Decoration only on wider screens. */}
                <div className="mb-3 hidden sm:block">
                  <CourtArt index={i} />
                </div>
                <input
                  aria-label="Court name"
                  placeholder="Court name"
                  value={r.name}
                  maxLength={40}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  className={`w-full border-0 border-b-2 bg-transparent pb-1 text-xl font-bold text-fg placeholder:text-fg-3 hover:border-line-strong focus:border-violet focus:outline-none ${
                    tried && issues(r).name ? 'border-danger' : 'border-line'
                  }`}
                />

                <div className={`mt-4 grid grid-cols-2 gap-3 ${r.active || pickingSport === r.key ? '' : 'opacity-60'}`}>
                  <div className="min-w-0">
                    <span className={FIELD_LABEL} aria-hidden="true">
                      Sport
                    </span>
                    <div className="mt-1.5">
                      <SearchSelect
                        variant="field"
                        invalid={tried && issues(r).sport}
                        label="Sport"
                        searchLabel="Search sports"
                        value={r.sport}
                        options={SPORT_OPTIONS}
                        open={pickingSport === r.key}
                        onOpen={() => setPickingSport(r.key)}
                        onClose={closeSport}
                        onPick={(s) => {
                          update(r.key, { sport: s as Sport });
                          setPickingSport(null);
                        }}
                      />
                    </div>
                  </div>
                  <label className="min-w-0">
                    <span className={FIELD_LABEL}>Per hour</span>
                    <span
                      className={`mt-1.5 flex items-center gap-1.5 rounded-control border-2 px-3 py-2.5 focus-within:border-violet ${
                        tried && issues(r).rate ? 'border-danger' : 'border-line-strong'
                      }`}
                    >
                      <span className="font-bold text-violet">₱</span>
                      <input
                        inputMode="decimal"
                        aria-label="Price per hour, in pesos"
                        value={r.rate}
                        onChange={(e) => update(r.key, { rate: e.target.value.replace(/[^\d.]/g, '') })}
                        className="w-full min-w-0 bg-transparent text-fg placeholder:text-fg-3 focus:outline-none"
                      />
                    </span>
                  </label>
                </div>

                <CourtPhotos
                  photos={r.photos}
                  required={r.active}
                  flagged={tried}
                  uploading={uploading === r.key}
                  disabled={uploading !== null || busy}
                  onAdd={(files) => addPhotos(r, files)}
                  onRemove={(p) => removePhoto(r, p)}
                />

                <div className="mt-4 space-y-3">
                  {(running || (r.id && switchedOff.has(r.id))) && (
                    <StageSwitch
                      checked={r.active}
                      onChange={(on) => update(r.key, { active: on })}
                      label={r.active ? 'Open for booking' : 'Closed for booking'}
                    />
                  )}
                  {/* A real button, full width, in red: removing is the card's one destructive action.
                      Filled on hover; text-canvas reads on the filled red in both themes. */}
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    aria-label={`Remove ${r.name || 'this court'}`}
                    className="w-full rounded-control border border-danger/40 bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-danger hover:text-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-danger/40"
                  >
                    Remove court
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Block>

      <Block>
        <div className="flex flex-wrap items-center gap-3">
          {/* Available: green (go). Locked: dashed and greyed, with a lock, and the reason below. */}
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            aria-describedby={canAdd ? undefined : 'add-court-locked'}
            className={`flex items-center gap-2 rounded-control border-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/50 ${
              canAdd
                ? 'border-accent bg-accent-soft text-accent-soft-fg hover:bg-accent hover:text-on-accent'
                : 'cursor-not-allowed border-dashed border-line-strong bg-transparent text-fg-3'
            }`}
          >
            {canAdd ? (
              <span aria-hidden="true">+</span>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.6">
                <rect x="3" y="7" width="10" height="7" rx="1" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
            )}
            Add a court
          </button>
        </div>
        {unfinished && (
          <p id="add-court-locked" className="text-sm text-fg-2">
            To add another court, finish{' '}
            <button
              type="button"
              onClick={showUnfinished}
              className="font-semibold text-violet underline underline-offset-2 hover:text-fg"
            >
              {unfinished.name.trim() || 'the unnamed court'}
            </button>{' '}
            first: {needs}.
          </p>
        )}
      </Block>

      <SceneFooter
        onBack={back}
        onNext={onContinue}
        busy={busy}
        // What's missing is shown on the court itself (Continue takes you there), not down here.
        disabled={rows.length === 0 || uploading !== null}
        error={error}
        status={saveLabel(auto.state)}
        above={<CourtSummary count={rows.length} prices={prices} />}
      />
    </Scene>
  );
}

/**
 * The courts at a glance: how many, and what an hour costs, from the cheapest to the dearest. It
 * floats just above the Back / Continue bar and changes as courts and prices change; the number
 * that changed pops. Green (the primary colour) but soft, so it never reads as a second Continue.
 */
function CourtSummary({ count, prices }: { count: number; prices: number[] }) {
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const range =
    low == null || high == null ? 'No prices yet' : low === high ? peso(low * 100) : `${peso(low * 100)} – ${peso(high * 100)}`;
  const pop = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring', stiffness: 420, damping: 28 },
  } as const;
  return (
    <div
      aria-live="polite"
      className="flex items-baseline justify-between gap-4 rounded-panel border-2 border-accent bg-accent-soft px-4 py-2 text-sm text-accent-soft-fg shadow-[0_12px_30px_-12px_rgb(var(--scrim)/0.45)]"
    >
      <p className="shrink-0">
        <motion.span key={count} {...pop} className="inline-block text-base font-bold">
          {count}
        </motion.span>{' '}
        court{count === 1 ? '' : 's'}
      </p>
      <p className="min-w-0 truncate text-right">
        <motion.span key={range} {...pop} className="inline-block text-base font-bold">
          {range}
        </motion.span>
        {low != null && ' / hr'}
      </p>
    </div>
  );
}

/** What a court still needs, as a phrase: "choose a sport, set a price and add a photo". */
function missingText(i: { name: boolean; sport: boolean; rate: boolean; photo: boolean }): string {
  const parts = [i.name && 'name it', i.sport && 'choose a sport', i.rate && 'set a price', i.photo && 'add a photo'].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
}

const FIELD_LABEL = 'block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-3';

/**
 * A court's photos: up to five square thumbnails and a tile to add more. A court open for booking
 * needs at least one: until it has one, the count and a hint show in red (the add tile too, once
 * Continue has been tapped).
 */
function CourtPhotos(props: {
  photos: string[];
  required: boolean;
  /** Continue was tapped with something missing: a missing photo shows in red. */
  flagged: boolean;
  uploading: boolean;
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (path: string) => void;
}) {
  const id = useId();
  const missing = props.required && props.photos.length === 0;
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <span className={FIELD_LABEL}>Photos</span>
        <span className={`text-xs ${missing ? 'font-semibold text-danger' : 'text-fg-3'}`}>
          {props.photos.length} of {MAX_PHOTOS}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-2">
        {props.photos.map((p) => (
          <figure key={p} className="relative aspect-square overflow-hidden rounded-chip">
            <img src={photoUrl(p) ?? ''} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => props.onRemove(p)}
              disabled={props.disabled}
              aria-label="Remove this photo"
              className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[10px] font-bold text-white hover:bg-danger hover:text-surface"
            >
              ✕
            </button>
          </figure>
        ))}
        {props.photos.length < MAX_PHOTOS && (
          <label
            htmlFor={id}
            className={`relative grid aspect-square cursor-pointer place-items-center rounded-chip border-2 border-dashed text-xl text-fg-2 hover:border-violet ${
              missing && props.flagged ? 'border-danger' : 'border-line-strong'
            } ${props.disabled ? 'pointer-events-none opacity-50' : ''}`}
          >
            {props.uploading ? (
              <motion.span
                className="h-5 w-5 rounded-full border-2 border-line-strong border-t-accent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: 'linear' }}
              />
            ) : (
              '+'
            )}
            <input
              id={id}
              type="file"
              accept="image/*"
              multiple
              aria-label="Add photos of this court"
              className="sr-only"
              onChange={(e) => {
                props.onAdd([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {missing && <p className="mt-1.5 text-xs font-semibold text-danger">Add at least one photo of this court.</p>}
    </div>
  );
}

/** A small top-down court that draws itself when the card appears. */
function CourtArt({ index }: { index: number }) {
  const d = 0.08 * index;
  const path = (p: string, delay: number) => (
    <motion.path
      d={p}
      fill="none"
      className="stroke-violet"
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
        className="stroke-accent"
        strokeWidth={3.2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: d + 0.6, duration: 0.3 }}
      />
    </svg>
  );
}
