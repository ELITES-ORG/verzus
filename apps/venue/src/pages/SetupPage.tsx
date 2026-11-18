import { useParams, useSearchParams } from 'react-router';
import { BasicsStep } from './setup/BasicsStep';
import { CourtsStep } from './setup/CourtsStep';
import { progress, useSetup } from './setup/data';
import { HoursStep } from './setup/HoursStep';
import { LocationStep } from './setup/LocationStep';
import { PhotosStep } from './setup/PhotosStep';
import { ReviewStep } from './setup/ReviewStep';

const STEPS = [
  { id: 'basics', label: 'Basics' },
  { id: 'location', label: 'Location' },
  { id: 'courts', label: 'Courts and rates' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'photos', label: 'Logo and photos' },
  { id: 'review', label: 'Review and submit' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

const STATUS_NOTE: Record<string, string> = {
  draft: 'Draft: only you can see it.',
  submitted: "Submitted: we're reviewing it. You can keep editing.",
  live: 'Live: players can find and book it.',
  suspended: 'Hidden from players. See the note below.',
};

/** The venue setup wizard. Every step saves on its own, so owners can stop and come back. */
export function SetupPage() {
  const { venueId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const setup = useSetup(venueId);

  if (setup.isLoading) return null;
  if (setup.error) return <p className="text-[#b51f2a]">Couldn't load this venue: {setup.error.message}</p>;
  if (!setup.data) return <p className="text-ink-600">That venue doesn't exist, or it isn't yours.</p>;

  const s = setup.data;
  const done = progress(s);
  const step: StepId = STEPS.some((x) => x.id === params.get('step')) ? (params.get('step') as StepId) : 'basics';
  const index = STEPS.findIndex((x) => x.id === step);
  const go = (id: StepId) => {
    setParams({ step: id });
    window.scrollTo({ top: 0 });
  };
  const next = () => go(STEPS[Math.min(index + 1, STEPS.length - 1)]?.id ?? 'review');
  const props = { setup: s, refresh: setup.refresh, next };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Set up your venue</p>
          <h1 className="text-xl font-bold text-ink-900">{s.venue.name}</h1>
          <p className="mt-1 text-xs text-ink-500">{STATUS_NOTE[s.venue.status]}</p>
        </div>
        <ol className="space-y-1">
          {STEPS.map((x, i) => {
            const complete = x.id !== 'review' && done[x.id];
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => go(x.id)}
                  aria-current={x.id === step ? 'step' : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    x.id === step ? 'bg-ink-900 font-semibold text-white' : 'text-ink-700 hover:bg-ink-100'
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs ${
                      complete ? 'border-[#dd2b37] bg-[#dd2b37] text-white' : 'border-current'
                    }`}
                    aria-hidden="true"
                  >
                    {complete ? '✓' : i + 1}
                  </span>
                  {x.label}
                  {x.id === 'photos' && !complete && <span className="ml-auto text-xs opacity-70">optional</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="min-w-0">
        {s.venue.review_note && (
          <div className="mb-6 rounded-lg border-2 border-[#dd2b37] bg-[#fdecee] px-4 py-3 text-sm text-ink-900">
            <p className="font-semibold">A note from verzus</p>
            <p>{s.venue.review_note}</p>
          </div>
        )}
        {step === 'basics' && <BasicsStep {...props} />}
        {step === 'location' && <LocationStep {...props} />}
        {step === 'courts' && <CourtsStep {...props} />}
        {step === 'hours' && <HoursStep {...props} />}
        {step === 'photos' && <PhotosStep {...props} />}
        {step === 'review' && <ReviewStep {...props} goTo={(id) => go(id as StepId)} />}
      </section>
    </div>
  );
}
