import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Mark } from '../../components/Mark';
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
  if (!d.location) return 'basics';
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
      <div className="relative min-h-screen overflow-x-hidden bg-[#16133d] text-white">
        {/* Stage lighting: a lavender glow and screentone dots, fixed behind the scenes. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'radial-gradient(60rem 40rem at 85% -10%, rgba(184,179,255,0.18), transparent 60%), radial-gradient(40rem 30rem at -10% 110%, rgba(221,43,55,0.12), transparent 60%), radial-gradient(rgba(184,179,255,0.10) 1.2px, transparent 1.5px) 0 0 / 14px 14px',
          }}
        />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-4 px-5 pt-5 sm:px-8">
          <Mark onDark className="text-[24px]" />
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#9d97d6] sm:inline">
            {index === 0 ? 'Venue setup' : `Step ${index} of ${STEPS.length - 1}`}
          </span>
          <Link
            to="/"
            className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-[#d9d6ff] hover:bg-white/5 hover:text-white"
          >
            Finish later
          </Link>
        </header>

        {s && open && index > 0 && (
          <nav aria-label="Setup progress" className="relative z-10 mx-auto mt-6 flex max-w-6xl gap-1.5 px-5 sm:px-8">
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
                  <span className="relative block h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full"
                      initial={false}
                      animate={{
                        width: state === 'later' ? '0%' : '100%',
                        backgroundColor: state === 'done' ? '#dd2b37' : '#b8b3ff',
                      }}
                      transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                    />
                  </span>
                  <span
                    className={`mt-2 hidden text-xs font-semibold sm:block ${
                      state === 'here' ? 'text-white' : open[x.id] ? 'text-[#9d97d6] group-hover:text-white' : 'text-[#5a568c]'
                    }`}
                  >
                    {x.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        <main className="relative z-10 px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          {s?.venue.review_note && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mb-10 max-w-2xl rounded-2xl border-2 border-[#dd2b37] bg-[#dd2b37]/10 px-5 py-4"
            >
              <p className="text-sm font-semibold text-[#ff8a92]">A note from verzus</p>
              <p className="text-white">{s.venue.review_note}</p>
            </motion.div>
          )}

          {setup.error && <p className="text-center text-[#ff8a92]">Couldn't load this venue: {setup.error.message}</p>}
          {!setup.isLoading && !s && !setup.error && (
            <p className="text-center text-[#d9d6ff]">That venue doesn't exist, or it isn't yours.</p>
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
