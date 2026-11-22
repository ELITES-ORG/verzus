import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

/** Lower case without accents, so "las pinas" finds "Las Piñas City". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The options whose name contains the search, best first: names that start with it, then names
 * with a word that starts with it ("cem" -> "South Cembo"), then the rest.
 */
export function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const q = fold(query.trim());
  if (!q) return options;
  const rank = (label: string) => {
    const l = fold(label);
    if (l.startsWith(q)) return 0;
    if (l.split(/[\s\-(/]+/).some((w) => w.startsWith(q))) return 1;
    return l.includes(q) ? 2 : -1;
  };
  return options
    .map((o) => ({ o, r: rank(o.label) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.o);
}

/**
 * A pick-one list with a search box: every list in venue onboarding works this way. Tapped, it
 * opens a search over its options that narrows with every character typed.
 * Keyboard: arrows move, Enter picks, Escape closes.
 *
 * Two looks:
 * - "row": a line of a card that reads like text, "PROVINCE … Biliran" (the address card). The
 *   search opens inline, pushing the lines below down.
 * - "field": a boxed field under a label the caller shows (a court's sport). The search floats
 *   over what is below, as wide as the nearest positioned parent (give the card `relative`), so
 *   it isn't squeezed into a narrow column.
 */
export function SearchSelect(props: {
  label: string;
  /** Shown in the search box, e.g. "Search provinces". */
  searchLabel: string;
  value: string | null;
  options: SelectOption[];
  variant?: 'row' | 'field';
  disabled?: boolean;
  /** Field look only: a required choice still missing, outlined in red. */
  invalid?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = useMemo(() => filterOptions(props.options, query), [props.options, query]);
  const current = props.options.find((o) => o.value === props.value);
  const { open, onClose } = props;
  const field = props.variant === 'field';

  // Opening starts a fresh search, focuses it and brings it into view (the phone keyboard is coming).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    input.current?.focus({ preventScroll: true });
    if (field) panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    else box.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [open, field]);

  // A tap anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, onClose]);

  // Keep the highlighted option in view while moving with the arrow keys.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function pick(o: SelectOption | undefined) {
    if (!o) return;
    props.onPick(o.value);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  const chevron = (
    <span aria-hidden="true" className={`text-xs text-fg-3 transition-transform ${open ? 'rotate-180' : ''}`}>
      ▼
    </span>
  );

  return (
    <div ref={box} className="scroll-mt-4">
      {field ? (
        <button
          type="button"
          disabled={props.disabled}
          onClick={open ? onClose : props.onOpen}
          aria-expanded={open}
          aria-label={`${props.label}: ${current?.label ?? 'not chosen'}`}
          className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-control border-2 bg-surface-2 px-3 py-2.5 text-left text-fg disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'border-violet' : props.invalid ? 'border-danger' : 'border-line-strong'}`}
        >
          <span className={`truncate ${current ? '' : 'text-violet'}`}>{current?.label ?? 'Choose'}</span>
          {chevron}
        </button>
      ) : (
        <button
          type="button"
          disabled={props.disabled}
          onClick={open ? onClose : props.onOpen}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-3">{props.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-base font-semibold ${current ? 'text-fg' : 'text-violet'}`}>
              {current?.label ?? 'Choose'}
            </span>
            {chevron}
          </span>
        </button>
      )}

      {open && (
        <div
          ref={panel}
          className={
            field
              ? // No `top`: it sits right under the field. inset-x: as wide as the card, inside its padding.
                'absolute inset-x-3 z-30 mt-2 scroll-mb-28 rounded-panel border border-line-strong bg-surface p-3 shadow-[0_20px_50px_-12px_rgb(var(--scrim)/0.5)]'
              : 'px-3 pb-3'
          }
        >
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-label={props.searchLabel}
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="done"
            placeholder={`${props.searchLabel}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            className="w-full rounded-control border-2 border-line-strong bg-surface-2 px-3 py-2.5 text-base text-fg placeholder:text-fg-3 focus:border-violet focus:outline-none"
          />
          {/* A listbox of options (the ARIA combobox pattern). Focus stays in the search box, which
              points at the highlighted option with aria-activedescendant; options take focus only
              programmatically (tabIndex -1). */}
          <div
            ref={list}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label={props.label}
            className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-control bg-surface-2"
          >
            {shown.map((o, i) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: arrows and Enter in the search box pick options.
              <div
                key={o.value}
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                tabIndex={-1}
                aria-selected={o.value === props.value}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-base ${
                  i === active ? 'bg-surface-3 text-fg' : 'text-fg-2'
                }`}
              >
                <span>{o.label}</span>
                {o.value === props.value && <span className="text-accent">✓</span>}
              </div>
            ))}
          </div>
          {shown.length === 0 && <p className="px-3 py-3 text-sm text-fg-3">No matches for “{query.trim()}”.</p>}
          <p className="sr-only" aria-live="polite">
            {shown.length} {shown.length === 1 ? 'match' : 'matches'}
          </p>
        </div>
      )}
    </div>
  );
}
