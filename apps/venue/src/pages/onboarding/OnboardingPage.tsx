import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Mark } from '../../components/Mark';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { progress, type Setup, useSetup } from '../setup/data';
import { BasicsScene } from './scenes/Basics';
import { CourtsScene } from './scenes/Courts';
import { HoursScene } from './scenes/Hours';
import { LocationScene } from './scenes/Location';
import { PhotosScene } from './scenes/Photos';
import { ReviewScene } from './scenes/Review';
import { WelcomeScene } from './scenes/Welcome';

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'basics', label: 'Basics' },
  { id: 'location', label: 'Location' },
  { id: 'courts', label: 'Courts' },
  { id: 'hours', label: 'Hours' },
  { id: 'photos', label: 'Photos' },
  { id: 'review', label: 'Review' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

/** Which steps can be opened: everything up to the first unfinished required step. */
function reachable(s: Setup): Record<StepId, boolean> {
  const d = progress(s);
  return {
    welcome: true,
    basics: true,
    location: d.basics,
    courts: d.basics && d.location,
    hours: d.basics && d.location && d.courts,
    photos: d.basics && d.location && d.courts && d.hours,
    review: d.basics && d.location && d.courts && d.hours,
  };
}

const indexOf = (id: StepId) => STEPS.findIndex((x) => x.id === id);

/** Closes every step past `furthest`, whatever the data says. */
function gate(open: Record<StepId, boolean>, furthest: number): Record<StepId, boolean> {
  return Object.fromEntries(STEPS.map((x, i) => [x.id, open[x.id] && i <= furthest])) as Record<StepId, boolean>;
}

/** Where a returning owner picks up: the welcome for a fresh draft, else the first unfinished step. */
function resumeAt(s: Setup): StepId {
  const d = progress(s);
  const fresh = !d.location && !s.venue.description && !s.venue.phone;
  if (s.venue.status === 'draft' && fresh) return 'welcome';
  // Basics can be unfinished after later steps are done (e.g. the phone became required later).
  if (!d.basics || !d.location) return 'basics';
  if (!d.courts) return 'courts';
  if (!d.hours) return 'hours';
  return s.venue.status === 'draft' && !s.venue.cover_path ? 'photos' : 'review';
}

/**
 * Venue onboarding: a full-screen, one-question-at-a-time flow. Each Continue saves; owners can
 * go back to finished steps but not skip ahead. Also how owners edit their venue later.
 */
export function OnboardingPage() {
  const { venueId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const setup = useSetup(venueId);
  const lastIndex = useRef(0);
  // The furthest step reached on this visit. A step opens only once the owner has walked up to it
  // (or comes back to a venue that is finished that far), so a fresh draft is taken in order even
  // though its name is already filled in from the invite.
  const [walked, setWalked] = useState(0);

  const s = setup.data;
  const furthest = s ? Math.max(walked, indexOf(resumeAt(s))) : 0;
  const open = s ? gate(reachable(s), furthest) : null;
  const asked = params.get('step') as StepId | null;
  const step: StepId = s && open ? (asked && open[asked] ? asked : resumeAt(s)) : 'welcome';
  const index = indexOf(step);
  const direction = index >= lastIndex.current ? 1 : -1;

  useEffect(() => {
    lastIndex.current = index;
  }, [index]);

  const go = (id: StepId) => {
    setWalked((w) => Math.max(w, indexOf(id)));
    setParams({ step: id }, { replace: false });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const next = () => go(STEPS[Math.min(index + 1, STEPS.length - 1)]?.id ?? 'review');
  const back = index > 1 ? () => go(STEPS[index - 1]?.id ?? 'basics') : undefined;

  return (
    <MotionConfig reducedMotion="user">
      {/* overflow-x-clip, not hidden: hidden would make this div a scroll box of its own. */}
      <div className="theme-scheme relative min-h-screen overflow-x-clip bg-canvas text-fg">
        {/* Stage lighting: two soft glows, fixed behind the scenes. No pattern: it made text harder to read. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'radial-gradient(60rem 40rem at 85% -10%, rgb(var(--violet) / 0.12), transparent 60%), radial-gradient(40rem 30rem at -10% 110%, rgb(var(--accent) / 0.07), transparent 60%)',
          }}
        />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-2 px-5 pt-5 sm:gap-4 sm:px-8">
          {/* Every step saves as you go, so the logo is the way out: back to the dashboard. */}
          <Link
            to="/"
            aria-label="verzus, back to your dashboard"
            title="Back to your dashboard"
            className="rounded-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/50"
          >
            <Mark className="text-[24px]" />
          </Link>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-fg-3 sm:inline">
            {index === 0 ? 'Venue setup' : `Step ${index} of ${STEPS.length - 1}`}
          </span>
          <ThemeSwitch className="ml-auto" />
        </header>

        {s && open && index > 0 && (
          <nav aria-label="Setup progress" className="relative z-10 mx-auto mt-4 flex sm:mt-6 max-w-6xl gap-1.5 px-5 sm:px-8">
            {STEPS.slice(1).map((x, i) => {
              const at = i + 1;
              const state = at < index ? 'done' : at === index ? 'here' : 'later';
              return (
                <button
                  key={x.id}
                  type="button"
                  disabled={!open[x.id]}
                  onClick={() => go(x.id)}
                  aria-current={state === 'here' ? 'step' : undefined}
                  aria-label={`${x.label}${open[x.id] ? '' : ' (locked)'}`}
                  className="group flex-1 text-left disabled:cursor-not-allowed"
                >
                  {/* Done: green. Here: violet. Colours come from the theme; only the width animates. */}
                  <span className="relative block h-1.5 overflow-hidden rounded-[2px] bg-surface-3">
                    <motion.span
                      className={`absolute inset-y-0 left-0 rounded-[2px] transition-colors ${state === 'done' ? 'bg-accent' : 'bg-violet'}`}
                      initial={false}
                      animate={{ width: state === 'later' ? '0%' : '100%' }}
                      transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                    />
                  </span>
                  <span
                    className={`mt-2 hidden text-xs font-semibold sm:block ${
                      state === 'here' ? 'text-fg' : open[x.id] ? 'text-fg-3 group-hover:text-fg' : 'text-fg-3/50'
                    }`}
                  >
                    {x.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Room under the fixed Back / Continue bar on phones comes from the bar itself (SceneFooter). */}
        <main className="relative z-10 px-5 pb-8 pt-6 sm:px-8 sm:pb-24 sm:pt-14">
          {s?.venue.review_note && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mb-10 max-w-2xl rounded-panel border border-warn/40 bg-warn-soft px-5 py-4"
            >
              <p className="text-sm font-semibold text-warn">A note from verzus</p>
              <p className="text-fg">{s.venue.review_note}</p>
            </motion.div>
          )}

          {setup.error && <p className="text-center text-danger">Couldn't load this venue: {setup.error.message}</p>}
          {!setup.isLoading && !s && !setup.error && (
            <p className="text-center text-fg-2">That venue doesn't exist, or it isn't yours.</p>
          )}

          {s && (
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                variants={{
                  enter: (d: number) => ({ x: d * 90, opacity: 0, filter: 'blur(10px)' }),
                  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                  exit: (d: number) => ({ x: d * -90, opacity: 0, filter: 'blur(10px)' }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 240, damping: 30, mass: 0.9 }}
              >
                {step === 'welcome' && <WelcomeScene setup={s} refresh={setup.refresh} next={next} />}
                {step === 'basics' && <BasicsScene setup={s} refresh={setup.refresh} next={next} />}
                {step === 'location' && <LocationScene setup={s} refresh={setup.refresh} next={next} back={back} />}
                {step === 'courts' && <CourtsScene setup={s} refresh={setup.refresh} next={next} back={back} />}
                {step === 'hours' && <HoursScene setup={s} refresh={setup.refresh} next={next} back={back} />}
                {step === 'photos' && <PhotosScene setup={s} refresh={setup.refresh} next={next} back={back} />}
                {step === 'review' && (
                  <ReviewScene setup={s} refresh={setup.refresh} next={next} back={back} goTo={(id) => go(id as StepId)} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </MotionConfig>
  );
}
