import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { display } from './stage';

/** "HH:MM" -> minutes since midnight. "24:00" (midnight at the end of the day) is 1440. */
export const minutes = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return h * 60 + m;
};

/** "19:00" -> "7:00 PM"; "24:00" -> "Midnight". */
export function formatTime(value: string): string {
  if (value === '24:00') return 'Midnight';
  const [h = 0, m = 0] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

interface Draft {
  h12: number; // 1-12
  minute: number;
  pm: boolean;
  midnight: boolean; // closing at midnight, the end of the day ("24:00")
}

function toDraft(value: string): Draft {
  if (value === '24:00') return { h12: 12, minute: 0, pm: false, midnight: true };
  const [h = 0, m = 0] = value.split(':').map(Number);
  return { h12: h % 12 || 12, minute: m, pm: h >= 12, midnight: false };
}

function toValue(d: Draft): string {
  if (d.midnight) return '24:00';
  const h = (d.h12 % 12) + (d.pm ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
}

/**
 * Picks a time of day in at most three taps: AM or PM, the hour, the minutes. Slides up from
 * the bottom on phones (where thumbs are), a centred dialog on wider screens.
 *
 * `after`: for a closing time, the opening time it must come after; earlier times can't be set.
 * `allowMidnight`: offers "Midnight", the end of the day, for closing times.
 */
export function TimePicker(props: {
  open: boolean;
  title: string;
  value: string;
  after?: string;
  allowMidnight?: boolean;
  onSet: (value: string) => void;
  onClose: () => void;
}) {
  return createPortal(<AnimatePresence>{props.open && <Sheet {...props} key="sheet" />}</AnimatePresence>, document.body);
}

function Sheet({ title, value, after, allowMidnight, onSet, onClose }: Parameters<typeof TimePicker>[0]) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => toDraft(value));
  const picked = toValue(draft);
  const tooEarly = after != null && minutes(picked) <= minutes(after);
  // A saved time off the quarter hour (e.g. 3:11) stays pickable as it is.
  const minuteChoices = MINUTES.includes(draft.minute) ? MINUTES : [...MINUTES, draft.minute].sort((a, b) => a - b);

  const close = useRef(onClose);
  close.current = onClose;

  // While open: the page behind doesn't scroll, focus moves into the sheet and stays there,
  // Escape closes it, and focus goes back to the time that opened it. Runs once per opening.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input:checked, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      // Tab stops: buttons, and the chosen radio of each group (arrows move within a group).
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:checked')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, midnight: false, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-scrim/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="relative w-full max-w-md rounded-t-panel border border-b-0 border-line bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-fg shadow-[0_-20px_60px_-12px_rgb(var(--scrim)/0.45)] sm:rounded-panel sm:border-b sm:pb-5"
      >
        {/* A grab handle: reads as a sheet on phones. */}
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />

        <p id={titleId} className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-violet">
          {title}
        </p>
        <p style={display} className="mt-1 text-center text-[44px] leading-tight" aria-live="polite">
          {formatTime(picked)}
        </p>
        <p className={`h-5 text-center text-sm font-semibold ${tooEarly ? 'text-danger' : 'text-transparent'}`}>
          {after ? `Must be after ${formatTime(after)}` : ''}
        </p>

        <div className={`mt-3 space-y-4 transition-opacity ${draft.midnight ? 'opacity-40' : ''}`}>
          <fieldset className="grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1">
            <legend className="sr-only">Morning or afternoon</legend>
            {(['AM', 'PM'] as const).map((p) => (
              <Choice
                key={p}
                name={`${titleId}-ampm`}
                on={!draft.midnight && draft.pm === (p === 'PM')}
                onPick={() => set({ pm: p === 'PM' })}
                look="segment"
              >
                {p}
              </Choice>
            ))}
          </fieldset>

          <fieldset className="grid grid-cols-6 gap-2">
            <legend className="sr-only">Hour</legend>
            {HOURS.map((h) => (
              <Choice key={h} name={`${titleId}-hour`} on={!draft.midnight && draft.h12 === h} onPick={() => set({ h12: h })}>
                {h}
              </Choice>
            ))}
          </fieldset>

          <fieldset className="flex gap-2">
            <legend className="sr-only">Minutes</legend>
            {minuteChoices.map((m) => (
              <Choice
                key={m}
                name={`${titleId}-minute`}
                on={!draft.midnight && draft.minute === m}
                onPick={() => set({ minute: m })}
                wide
              >
                :{String(m).padStart(2, '0')}
              </Choice>
            ))}
          </fieldset>
        </div>

        {allowMidnight && (
          <button
            type="button"
            role="switch"
            aria-checked={draft.midnight}
            onClick={() => setDraft((d) => ({ ...d, midnight: !d.midnight }))}
            className={`mt-4 w-full rounded-control border-2 py-3 text-base font-semibold transition-colors ${
              draft.midnight
                ? 'border-accent bg-accent-soft text-accent-soft-fg'
                : 'border-line-strong text-fg-2 hover:border-violet'
            }`}
          >
            {draft.midnight ? '✓ ' : ''}Closes at midnight
          </button>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control px-5 py-3.5 font-semibold text-fg-2 hover:bg-surface-2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={tooEarly}
            onClick={() => onSet(picked)}
            className="flex-[2] rounded-control bg-accent px-5 py-3.5 font-semibold text-on-accent shadow-[0_10px_28px_-14px_rgb(var(--accent)/0.7)] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set {formatTime(picked)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * One choice in a group (an hour, a minute, AM or PM): a native radio button, hidden, under a
 * large tap target. Native radios give arrow-key moves within the group and the right screen
 * reader announcements.
 */
function Choice(props: {
  name: string;
  on: boolean;
  onPick: () => void;
  wide?: boolean;
  /** "segment": the AM | PM switch; otherwise a tile. */
  look?: 'segment';
  children: React.ReactNode;
}) {
  const segment = props.look === 'segment';
  return (
    <label className={`cursor-pointer ${props.wide ? 'flex-1' : ''}`}>
      <input type="radio" name={props.name} checked={props.on} onChange={props.onPick} className="peer sr-only" />
      <span
        className={`grid place-items-center font-semibold transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-violet/50 ${
          segment ? 'rounded-control py-2.5 text-base font-bold' : 'h-12 rounded-control text-lg'
        } ${
          props.on
            ? segment
              ? 'bg-surface text-fg shadow-sm'
              : 'bg-accent text-on-accent'
            : segment
              ? 'text-fg-2 hover:text-fg'
              : 'bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg'
        }`}
      >
        {props.children}
      </span>
    </label>
  );
}
