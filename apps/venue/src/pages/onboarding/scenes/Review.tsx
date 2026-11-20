import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { photoUrl } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { peso, progress, type Setup } from '../../setup/data';
import { ReviewIcon } from '../icons';
import { Block, display, rise, Scene, type SceneProps, StageButton, stagger } from '../stage';

const CHECKS = [
  { id: 'basics', label: 'Name and description' },
  { id: 'location', label: 'Pin, city and address' },
  { id: 'courts', label: 'At least one bookable court' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'photos', label: 'Cover photo (recommended)' },
] as const;

const NEXT = [
  { t: 'We check your listing', d: 'A person at verzus looks over the details and photos.' },
  {
    t: 'You go live',
    d: "Players near you can find your courts and book them. If something needs fixing, you'll see a note here.",
  },
  { t: 'Bookings land in your calendar', d: 'Every booking shows up in your calendar the moment it is made.' },
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
      intro="This is how players will see your venue. We check every venue before it goes live."
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <Block>
          <Preview setup={setup} />
        </Block>

        <Block>
          <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-3">
            {CHECKS.map((c, i) => (
              <motion.li key={c.id} variants={rise} className="flex items-center gap-3">
                <Tick on={done[c.id]} delay={0.35 + i * 0.12} />
                <span className={done[c.id] ? 'text-white' : 'text-[#9d97d6]'}>{c.label}</span>
                {!done[c.id] && (
                  <button
                    type="button"
                    onClick={() => goTo(c.id)}
                    className="ml-auto text-sm font-semibold text-[#ff8a92] underline-offset-4 hover:underline"
                  >
                    Add
                  </button>
                )}
              </motion.li>
            ))}
          </motion.ul>

          <div className="mt-8 space-y-3">
            <StageButton onClick={() => setStatus('submitted')} disabled={busy || !ready} className="w-full py-4 text-lg">
              {busy ? 'Submitting…' : 'Submit for review'}
            </StageButton>
            {!ready && <p className="text-center text-sm text-[#9d97d6]">Finish the unticked items first.</p>}
            {error && (
              <p role="alert" className="text-center text-sm font-semibold text-[#ff8a92]">
                {error}
              </p>
            )}
            {back && (
              <StageButton kind="secondary" onClick={back} disabled={busy} className="w-full">
                ← Back
              </StageButton>
            )}
          </div>
        </Block>
      </div>
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
        stroke={on ? '#dd2b37' : '#b8b3ff'}
        strokeOpacity={on ? 1 : 0.35}
        strokeWidth="2.5"
      />
      {on && (
        <>
          <motion.circle
            cx="14"
            cy="14"
            r="12"
            fill="#dd2b37"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{ transformOrigin: '14px 14px' }}
            transition={{ delay, type: 'spring', stiffness: 420, damping: 18 }}
          />
          <motion.path
            d="M8.5 14.5l3.8 3.8 7.5-8"
            fill="none"
            stroke="#fff"
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
      className="overflow-hidden rounded-3xl bg-white text-[#1d1a4a] shadow-[10px_12px_0_#5a4fd8]"
    >
      <div className="relative aspect-[3/1] bg-[#e8e6f5]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-[#8580b0]">No cover photo yet</div>
        )}
        {logo && (
          <img
            src={logo}
            alt=""
            className="absolute -bottom-8 left-5 h-16 w-16 rounded-xl border-[3px] border-white bg-white object-cover shadow"
          />
        )}
      </div>
      <div className={`space-y-2 p-6 ${logo ? 'pt-11' : ''}`}>
        <h2 style={display} className="text-2xl leading-tight">
          {v.name}
        </h2>
        <p className="text-sm text-[#6f6a9c]">{[v.address, v.city].filter(Boolean).join(', ') || 'No address yet'}</p>
        {v.description && <p className="text-[#3b376b]">{v.description}</p>}
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
        className="mt-10 text-[clamp(30px,5vw,52px)] leading-[1.05] text-white"
      >
        {live ? `${v.name} is live.` : `${v.name} is in.`}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: after + 0.1 }}
        className="mx-auto mt-4 max-w-xl text-lg text-[#d9d6ff]"
      >
        {live
          ? 'Players can find and book your courts. Changes you save in setup show up for them right away.'
          : "Thanks! Here's what happens next."}
      </motion.p>

      {!live && (
        <ol className="mx-auto mt-10 max-w-xl space-y-4 text-left">
          {NEXT.map((n, i) => (
            <motion.li
              key={n.t}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: after + 0.25 + i * 0.12, type: 'spring', stiffness: 240, damping: 24 }}
              className="flex gap-4 rounded-2xl border-2 border-[#b8b3ff]/20 bg-white/[0.04] p-4"
            >
              <span style={display} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dd2b37] text-white">
                {i + 1}
              </span>
              <span>
                <span className="block font-bold text-white">{n.t}</span>
                <span className="block text-sm text-[#d9d6ff]">{n.d}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: after + 0.7 }}
        className="mt-10 flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          to="/"
          className="rounded-full bg-[#dd2b37] px-7 py-3.5 font-semibold text-white shadow-[0_10px_30px_-10px_rgba(221,43,55,0.8)] transition hover:bg-[#e7404b]"
        >
          Open your calendar
        </Link>
        <Link
          to={`/venues/${v.id}/staff`}
          className="rounded-full border-2 border-[#b8b3ff]/35 px-6 py-3 font-semibold text-[#d9d6ff] transition hover:border-[#b8b3ff] hover:text-white"
        >
          Invite your staff
        </Link>
      </motion.div>

      {!live && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after + 0.9 }} className="mt-8">
          <StageButton kind="ghost" onClick={props.onUnsubmit} disabled={props.busy} className="text-sm">
            {props.busy ? 'One moment…' : 'Take it back to edit'}
          </StageButton>
          {props.error && (
            <p role="alert" className="text-sm font-semibold text-[#ff8a92]">
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
    <div className="relative mx-auto mt-6 grid h-52 w-52 place-items-center" aria-hidden="true">
      <AnimatePresence>
        {slam &&
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <motion.span
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ring of decorative lines
                key={i}
                className="absolute left-1/2 top-1/2 h-1 w-8 origin-left rounded-full bg-[#ff8a92]"
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
          className="absolute inset-0 rounded-full border-4 border-[#dd2b37]"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1.6, opacity: [0, 0.8, 0] }}
          transition={{ delay: 0.55, duration: 0.7, ease: 'easeOut' }}
        />
      )}
      <motion.svg
        viewBox="0 0 200 200"
        className="h-52 w-52"
        initial={slam ? { scale: 2.6, rotate: -32, opacity: 0, y: -60 } : { scale: 0.8, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: -12, opacity: 1, y: 0 }}
        transition={
          slam
            ? { delay: 0.15, duration: 0.4, ease: [0.55, 0, 1, 0.45], opacity: { delay: 0.15, duration: 0.12 } }
            : { type: 'spring', stiffness: 260, damping: 20 }
        }
      >
        <circle cx="100" cy="100" r="92" fill="none" stroke="#dd2b37" strokeWidth="7" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="#dd2b37" strokeWidth="2.5" strokeDasharray="3 6" />
        <text x="100" y="74" textAnchor="middle" fill="#dd2b37" style={display} fontSize="16" letterSpacing="3">
          VERZUS
        </text>
        <rect x="18" y="86" width="164" height="34" rx="4" fill="#dd2b37" />
        <text
          x="100"
          y={label.length > 5 ? 110 : 112}
          textAnchor="middle"
          fill="#fff"
          style={display}
          fontSize={label.length > 5 ? 18 : 26}
          letterSpacing="2"
          // Long labels are squeezed to fit inside the band.
          textLength={label.length > 5 ? 144 : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {label}
        </text>
        <path d="M78 140l14 14 30-30" fill="none" stroke="#dd2b37" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </div>
  );
}
