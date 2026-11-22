import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { VGlyph } from '../../../components/Mark';
import { photoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { useShownTheme } from '../../../lib/theme';
import { fullAddress } from '../../../lib/venues';
import { peso, progress, type Setup } from '../../setup/data';
import { ReviewIcon } from '../icons';
import { Block, display, rise, Scene, SceneFooter, type SceneProps, StageButton, stagger } from '../stage';

const CHECKS = [
  { id: 'basics', label: 'Name and front desk number' },
  { id: 'location', label: 'Pin, city and address' },
  { id: 'courts', label: 'Bookable courts, each with a photo' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'photos', label: 'Cover photo (recommended)' },
] as const;

const NEXT = [
  { t: 'We check your listing', d: "If something needs fixing, you'll see a note here." },
  { t: 'You go live', d: 'Players near you can find and book your courts.' },
  { t: 'Bookings land in your calendar', d: 'The moment they are made.' },
];

export function ReviewScene({ setup, refresh, back, goTo }: SceneProps & { goTo: (step: string) => void }) {
  const v = setup.venue;
  const done = progress(setup);
  const ready = done.basics && done.location && done.courts && done.hours;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  async function setStatus(status: 'submitted' | 'draft') {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('venues').update({ status }).eq('id', v.id);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    await refresh();
    setBusy(false);
    setCelebrate(status === 'submitted');
  }

  if (v.status === 'submitted' || v.status === 'live') {
    return <Submitted setup={setup} slam={celebrate} busy={busy} error={error} onUnsubmit={() => setStatus('draft')} />;
  }

  return (
    <Scene
      wide
      eyebrow="Step 6 · Review"
      icon={<ReviewIcon />}
      title="Ready for tip-off?"
      intro="This is what players will see. We check it before it goes live."
    >
      <div className="grid gap-6 sm:gap-10 lg:grid-cols-[1fr_320px]">
        <Block>
          <Preview setup={setup} />
        </Block>

        <Block>
          <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {CHECKS.map((c, i) => (
              <motion.li key={c.id} variants={rise} className="flex items-center gap-3">
                <Tick on={done[c.id]} delay={0.35 + i * 0.12} />
                <span className={done[c.id] ? 'text-fg' : 'text-fg-3'}>{c.label}</span>
                {!done[c.id] && (
                  <button
                    type="button"
                    onClick={() => goTo(c.id)}
                    className="ml-auto text-sm font-semibold text-danger underline-offset-4 hover:underline"
                  >
                    Add
                  </button>
                )}
              </motion.li>
            ))}
          </motion.ul>

          {!ready && <p className="mt-6 text-sm text-fg-3">Finish the unticked items first.</p>}
        </Block>
      </div>

      {/* Like every step: Back and the next action in the bar at the bottom. */}
      <SceneFooter
        onBack={back}
        onNext={() => setStatus('submitted')}
        nextLabel="Submit for review"
        busy={busy}
        busyLabel="Submitting…"
        disabled={!ready}
        error={error}
      />
    </Scene>
  );
}

/** A checklist circle whose tick draws itself in. */
function Tick({ on, delay }: { on: boolean; delay: number }) {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r="12"
        fill="none"
        className={on ? 'stroke-accent' : 'stroke-violet'}
        strokeOpacity={on ? 1 : 0.35}
        strokeWidth="2.5"
      />
      {on && (
        <>
          <motion.circle
            cx="14"
            cy="14"
            r="12"
            className="fill-accent"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{ transformOrigin: '14px 14px' }}
            transition={{ delay, type: 'spring', stiffness: 420, damping: 18 }}
          />
          <motion.path
            d="M8.5 14.5l3.8 3.8 7.5-8"
            fill="none"
            className="stroke-on-accent"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: delay + 0.15, duration: 0.35, ease: [0.65, 0, 0.35, 1] }}
          />
        </>
      )}
    </svg>
  );
}

/** The venue card as players will see it. */
function Preview({ setup }: { setup: Setup }) {
  const v = setup.venue;
  const active = setup.courts.filter((c) => c.is_active);
  const cheapest = active.length ? Math.min(...active.map((c) => c.hourly_rate_cents)) : null;
  const sports = [...new Set(active.map((c) => c.sport))];
  const cover = photoUrl(v.cover_path);
  const logo = photoUrl(v.logo_path);
  return (
    <motion.article
      initial={{ rotateX: 12, y: 30, opacity: 0 }}
      animate={{ rotateX: 0, y: 0, opacity: 1 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 140, damping: 20 }}
      style={{ transformPerspective: 1200 }}
      className="overflow-hidden rounded-panel border border-line bg-surface text-fg shadow-[0_24px_50px_-24px_rgb(var(--scrim)/0.45)]"
    >
      <div className="relative aspect-[3/1] bg-surface-2">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-fg-3">No cover photo yet</div>
        )}
        {logo && (
          <img
            src={logo}
            alt=""
            className="absolute -bottom-8 left-5 h-16 w-16 rounded-control border-[3px] border-surface bg-surface object-cover shadow"
          />
        )}
      </div>
      <div className={`space-y-2 p-6 ${logo ? 'pt-11' : ''}`}>
        <h2 style={display} className="text-2xl leading-tight">
          {v.name}
        </h2>
        <p className="text-sm text-fg-3">{fullAddress(v) || 'No address yet'}</p>
        {v.description && <p className="text-fg-2">{v.description}</p>}
        <p className="pt-1 text-sm font-semibold">
          {active.length
            ? `${active.length} court${active.length > 1 ? 's' : ''} · ${sports.map((s) => s[0]?.toUpperCase() + s.slice(1)).join(', ')} · from ${peso(cheapest ?? 0)}/hour`
            : 'No courts yet'}
        </p>
      </div>
    </motion.article>
  );
}

/** After submitting (or when coming back to a submitted or live venue). */
function Submitted(props: { setup: Setup; slam: boolean; busy: boolean; error: string | null; onUnsubmit: () => void }) {
  const v = props.setup.venue;
  const live = v.status === 'live';
  const shown = useShownTheme();
  // The stamp lands at 0.55s when slamming; everything else waits for it.
  const after = props.slam ? 0.9 : 0.15;
  return (
    <motion.div
      className="mx-auto max-w-3xl text-center"
      animate={props.slam ? { x: [0, -10, 9, -6, 4, 0], y: [0, 6, -4, 2, 0] } : undefined}
      transition={{ delay: 0.55, duration: 0.42 }}
    >
      <Stamp slam={props.slam} label={live ? 'LIVE' : 'SUBMITTED'} />

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: after, type: 'spring', stiffness: 220, damping: 24 }}
        style={display}
        className="mt-6 text-[clamp(26px,5vw,52px)] leading-[1.05] text-fg sm:mt-10"
      >
        {live ? `${v.name} is live.` : `${v.name} is in.`}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: after + 0.1 }}
        className="mx-auto mt-4 max-w-xl text-lg text-fg-2"
      >
        {live ? 'Players can find and book your courts. Changes you save show up right away.' : "Here's what happens next."}
      </motion.p>

      {!live && (
        <ol className="mx-auto mt-6 max-w-xl space-y-3 text-left sm:mt-10 sm:space-y-4">
          {NEXT.map((n, i) => (
            <motion.li
              key={n.t}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: after + 0.25 + i * 0.12, type: 'spring', stiffness: 240, damping: 24 }}
              className="flex gap-4 rounded-panel border-2 border-line bg-surface p-4"
            >
              <span style={display} className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-violet text-surface">
                {i + 1}
              </span>
              <span>
                <span className="block font-bold text-fg">{n.t}</span>
                <span className="block text-sm text-fg-2">{n.d}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: after + 0.7 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-10"
      >
        {/* "Enter verzus", its v the logo itself, as tall as the E. The logo's green would vanish on
            a green button, so this one is the inverse of the page (dark on light, light on dark),
            which shows the logo in its real colours. */}
        <Link
          to="/"
          aria-label="Enter verzus"
          className="rounded-control bg-fg px-7 py-3.5 font-semibold text-canvas shadow-[0_10px_28px_-14px_rgb(var(--scrim)/0.6)] transition hover:bg-fg/90"
        >
          Enter <VGlyph ground={shown === 'dark' ? 'light' : 'dark'} />
          erzus
        </Link>
      </motion.div>

      {!live && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after + 0.9 }} className="mt-8">
          <StageButton kind="ghost" onClick={props.onUnsubmit} disabled={props.busy} className="text-sm">
            {props.busy ? 'One moment…' : 'Take it back to edit'}
          </StageButton>
          {props.error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {props.error}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/** A red rubber stamp. When slamming it drops from above, lands with a thud and throws out impact lines. */
function Stamp({ slam, label }: { slam: boolean; label: string }) {
  return (
    <div className="relative mx-auto mt-2 grid h-40 w-40 place-items-center sm:mt-6 sm:h-52 sm:w-52" aria-hidden="true">
      <AnimatePresence>
        {slam &&
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <motion.span
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ring of decorative lines
                key={i}
                className="absolute left-1/2 top-1/2 h-1 w-8 origin-left rounded-full bg-accent"
                style={{ rotate: `${(a * 180) / Math.PI}deg` }}
                initial={{ x: 0, y: 0, opacity: 0, scaleX: 0.2 }}
                animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 130, opacity: [0, 1, 0], scaleX: [0.2, 1, 0.4] }}
                transition={{ delay: 0.55, duration: 0.6, ease: 'easeOut' }}
              />
            );
          })}
      </AnimatePresence>
      {slam && (
        <motion.span
          className="absolute inset-0 rounded-full border-4 border-accent"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1.6, opacity: [0, 0.8, 0] }}
          transition={{ delay: 0.55, duration: 0.7, ease: 'easeOut' }}
        />
      )}
      <motion.svg
        viewBox="0 0 200 200"
        className="h-40 w-40 sm:h-52 sm:w-52"
        initial={slam ? { scale: 2.6, rotate: -32, opacity: 0, y: -60 } : { scale: 0.8, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: -12, opacity: 1, y: 0 }}
        transition={
          slam
            ? { delay: 0.15, duration: 0.4, ease: [0.55, 0, 1, 0.45], opacity: { delay: 0.15, duration: 0.12 } }
            : { type: 'spring', stiffness: 260, damping: 20 }
        }
      >
        <circle cx="100" cy="100" r="92" fill="none" className="stroke-accent" strokeWidth="7" />
        <circle cx="100" cy="100" r="78" fill="none" className="stroke-accent" strokeWidth="2.5" strokeDasharray="3 6" />
        <text x="100" y="74" textAnchor="middle" className="fill-accent" style={display} fontSize="16" letterSpacing="3">
          VERZUS
        </text>
        <rect x="18" y="86" width="164" height="34" rx="4" className="fill-accent" />
        <text
          x="100"
          y={label.length > 5 ? 110 : 112}
          textAnchor="middle"
          className="fill-on-accent"
          style={display}
          fontSize={label.length > 5 ? 18 : 26}
          letterSpacing="2"
          // Long labels are squeezed to fit inside the band.
          textLength={label.length > 5 ? 144 : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {label}
        </text>
        <path
          d="M78 140l14 14 30-30"
          fill="none"
          className="stroke-accent"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </div>
  );
}
