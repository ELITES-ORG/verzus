import { motion, type Variants } from 'motion/react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Building blocks for the onboarding stage: large type, one question per scene. Colours come from
 * the theme (@verzus/tailwind/theme.css), so every scene works in light and dark.
 */

export const display = { fontFamily: "'Dela Gothic One', system-ui, sans-serif" } as const;

/** Children of a scene arrive one after another. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.18 } },
};
export const rise: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

export function Scene(props: {
  eyebrow: string;
  icon: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className={`mx-auto w-full ${props.wide ? 'max-w-5xl' : 'max-w-2xl'}`}
    >
      {/* Phones skip the icon and step label: the progress bar above already says where they are. */}
      <motion.div variants={rise} className="mb-6 hidden items-center gap-4 sm:flex">
        {props.icon}
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet">{props.eyebrow}</p>
      </motion.div>
      <motion.h1
        variants={rise}
        style={display}
        className="text-[clamp(26px,5vw,52px)] leading-[1.05] tracking-[-0.01em] text-fg"
      >
        {props.title}
      </motion.h1>
      {props.intro && (
        <motion.p variants={rise} className="mt-2 max-w-xl text-base text-fg-2 sm:mt-4 sm:text-lg">
          {props.intro}
        </motion.p>
      )}
      <div className="mt-6 space-y-6 sm:mt-10 sm:space-y-8">{props.children}</div>
    </motion.div>
  );
}

/** A labelled block inside a scene; part of the scene's stagger. */
export function Block({
  label,
  hint,
  children,
  className = '',
}: {
  label?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={rise} className={`space-y-2 ${className}`}>
      {label && <p className="text-sm font-semibold text-fg-2">{label}</p>}
      {children}
      {hint && <p className="text-sm text-fg-3">{hint}</p>}
    </motion.div>
  );
}

const fieldBase =
  'w-full bg-transparent text-fg placeholder:text-fg-3 border-0 border-b-[3px] border-line-strong px-0 py-2 transition-colors focus:border-violet focus:outline-none';

export function BigInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={display} className={`${fieldBase} text-[clamp(22px,3.4vw,34px)] ${props.className ?? ''}`} />;
}

export function StageInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} text-xl ${props.className ?? ''}`} />;
}

export function StageTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-control border-2 border-line-strong bg-surface p-4 text-lg text-fg placeholder:text-fg-3 focus:border-violet focus:outline-none ${props.className ?? ''}`}
    />
  );
}

export function StageSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-control border-2 border-line-strong bg-surface-2 px-4 py-3 text-lg text-fg focus:border-violet focus:outline-none ${props.className ?? ''}`}
    />
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'primary' | 'secondary' | 'ghost' | 'chip' | 'chipOn';
};
export function StageButton({ kind = 'primary', className = '', type = 'button', children, ...rest }: BtnProps) {
  const look = {
    primary:
      'bg-accent text-on-accent px-7 py-3.5 rounded-control text-base shadow-[0_10px_28px_-14px_rgb(var(--accent)/0.7)] hover:bg-accent-hover',
    secondary: 'rounded-control border-2 border-line-strong bg-surface px-6 py-3 text-base text-fg hover:border-violet',
    ghost: 'text-fg-2 px-4 py-3 rounded-control hover:text-fg hover:bg-surface-2',
    chip: 'rounded-control border-2 border-line-strong bg-surface px-4 py-2 text-sm text-fg-2 hover:border-violet hover:text-fg',
    chipOn: 'rounded-control border-2 border-accent bg-accent-soft px-4 py-2 text-sm text-accent-soft-fg',
  }[kind];
  return (
    <motion.button
      type={type}
      whileHover={rest.disabled ? undefined : { y: -1 }}
      whileTap={rest.disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/50 disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

/**
 * An on/off switch with its label beside it. `ariaLabel` names it for screen readers when the
 * visible label alone is too short to say what it does (a day's "Mon" means "Monday open").
 */
export function StageSwitch(props: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      onClick={() => props.onChange(!props.checked)}
      className={`flex items-center gap-2.5 text-sm font-semibold text-fg-2 ${props.className ?? ''}`}
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${props.checked ? 'bg-accent' : 'bg-line-strong'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${props.checked ? 'left-[1.125rem]' : 'left-0.5'}`}
        />
      </span>
      {props.label}
    </button>
  );
}

/** Phones: below Tailwind's `sm` breakpoint. */
const PHONE = '(max-width: 639.98px)';

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * Back / Continue row at the bottom of every scene.
 *
 * On phones it is a bar fixed to the bottom of the screen, so the next step is always one tap
 * away and never moves. It is rendered into <body> through a portal: the scene transitions leave
 * a transform and filter on the scene's wrappers, and a fixed element inside those is fixed to
 * the wrapper instead of the screen. The page leaves room for it (OnboardingPage's bottom padding).
 * On wider screens it is an ordinary row at the end of the scene.
 */
export function SceneFooter(props: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  /** Shown on the next button while busy; "Saving…" by default. */
  busyLabel?: string;
  disabled?: boolean;
  error?: string | null;
  /** Autosave status: "Saving…", "✓ Saved" or "Not saved" (see autosave.ts). */
  status?: string | null;
  /** A summary that floats just above the bar on phones (above the buttons on wider screens). */
  above?: ReactNode;
}) {
  const phone = useIsPhone();
  // "✓ Saved" shows for a moment, then fades; "Saving…" and a failed save ("Not saved") stay.
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    setStatus(props.status ?? null);
    if (!props.status?.startsWith('✓')) return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [props.status]);
  const tone = status?.startsWith('✓') ? 'text-accent' : status === 'Not saved' ? 'text-danger' : 'text-fg-3';
  const buttons = (
    <>
      {props.onBack && (
        <StageButton kind="secondary" onClick={props.onBack} disabled={props.busy}>
          ← Back
        </StageButton>
      )}
      <span className="flex-1" />
      <StageButton onClick={props.onNext} disabled={props.busy || props.disabled}>
        {props.busy ? (props.busyLabel ?? 'Saving…') : (props.nextLabel ?? 'Continue →')}
      </StageButton>
      {props.error && (
        <p role="alert" className="basis-full text-right text-sm font-semibold text-danger">
          {props.error}
        </p>
      )}
    </>
  );

  // The save status: a small tag pinned to the top centre of the screen, where it is noticed. At the
  // top of the page it sits in the header row, between the logo and the theme switch (the header's
  // pt-5 plus half its 34px row, less half the tag); it stays put while the page scrolls. Portalled
  // for the same reason as the phone bar below.
  const tag = createPortal(
    <span
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 top-[max(1.5rem,env(safe-area-inset-top))] z-40 -translate-x-1/2 whitespace-nowrap rounded-chip border border-line bg-surface px-3 py-1 text-xs font-semibold shadow-md transition-[opacity,transform] duration-200 sm:text-sm ${tone} ${status ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      {status}
    </span>,
    document.body,
  );

  if (phone) {
    // The bar floats over the page, so it leaves a spacer the same height in the page: the last
    // field can scroll clear of it, and steps without the bar get no empty space.
    return (
      <>
        <div aria-hidden="true" className={props.above ? 'h-36' : 'h-20'} />
        {tag}
        {createPortal(
          <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-3 border-t border-line bg-surface px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-fg">
            {props.above && <div className="absolute inset-x-5 bottom-full mb-3">{props.above}</div>}
            {buttons}
          </div>,
          document.body,
        )}
      </>
    );
  }
  return (
    <motion.div variants={rise} className="flex flex-wrap items-center gap-3 pt-4">
      {tag}
      {props.above && <div className="basis-full">{props.above}</div>}
      {buttons}
    </motion.div>
  );
}

export interface SceneProps {
  setup: import('../setup/data').Setup;
  refresh: () => Promise<void>;
  next: () => void;
  back?: () => void;
}
