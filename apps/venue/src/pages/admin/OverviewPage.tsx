import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';

/**
 * The platform at a glance: who is signing up and waiting for review, who is in, and how many
 * bookings there are. "Waiting for email" are sign-ups that haven't confirmed their address yet;
 * they reach the review queue once they do.
 */
export function OverviewPage() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats').single();
      if (error) throw error;
      return data;
    },
  });
  const s = stats.data;

  if (stats.error) return <p className="text-danger">Couldn't load the numbers: {stats.error.message}</p>;
  if (!s) return null;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2">
        <People
          title="Players"
          approved={s.players_approved}
          pending={s.players_pending}
          unconfirmed={s.players_unconfirmed}
          rejected={s.players_rejected}
        />
        <People
          title="Venue owners"
          approved={s.owners_approved}
          pending={s.owners_pending}
          unconfirmed={s.owners_unconfirmed}
          rejected={s.owners_rejected}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-3">Bookings</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Total" value={s.bookings_total} hint="Confirmed, all time" />
          <Tile label="Last 7 days" value={s.bookings_week} hint="Made this week" />
          <Tile label="Upcoming" value={s.bookings_upcoming} hint="Not played yet" />
          <Tile
            label="App · desk"
            value={
              <>
                {s.bookings_app}
                <span className="text-fg-3"> · </span>
                {s.bookings_desk}
              </>
            }
            hint="Booked in the app · walk-in or phone"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-3">Venues</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Live" value={s.venues_live} hint="Players can book them" />
          <Tile
            label="Waiting for review"
            value={s.venues_waiting}
            hint={s.venues_waiting ? <Link to="/admin/review">Review them →</Link> : 'Nothing to review'}
            attention={s.venues_waiting > 0}
          />
        </div>
      </section>
    </div>
  );
}

/** One kind of account: the big number is who's in; below, the pipeline. */
function People(props: { title: string; approved: number; pending: number; unconfirmed: number; rejected: number }) {
  return (
    <div className="space-y-4 rounded-panel border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-3">{props.title}</h2>
        {props.pending > 0 && (
          <Link to="/admin/accounts" className="text-sm font-semibold text-fg underline underline-offset-2 hover:text-violet">
            Review {props.pending} →
          </Link>
        )}
      </div>
      <p>
        <span className="text-4xl font-bold text-fg">{props.approved}</span>
        <span className="ml-2 text-sm text-fg-3">approved</span>
      </p>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Step label="Awaiting review" value={props.pending} tone={props.pending ? 'warn' : 'quiet'} />
        <Step label="Waiting for email" value={props.unconfirmed} tone="quiet" />
        <Step label="Rejected" value={props.rejected} tone="quiet" />
      </dl>
    </div>
  );
}

function Step({ label, value, tone }: { label: string; value: number; tone: 'warn' | 'quiet' }) {
  return (
    <div className={`rounded-control px-3 py-2 ${tone === 'warn' ? 'bg-warn-soft' : 'bg-surface-2'}`}>
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className={`text-lg font-bold ${tone === 'warn' ? 'text-warn' : 'text-fg'}`}>{value}</dd>
    </div>
  );
}

function Tile(props: { label: string; value: ReactNode; hint: ReactNode; attention?: boolean }) {
  return (
    <div className={`rounded-panel border bg-surface p-4 ${props.attention ? 'border-warn' : 'border-line'}`}>
      <p className="text-xs font-semibold text-fg-3">{props.label}</p>
      <p className="mt-1 text-2xl font-bold text-fg">{props.value}</p>
      <p className="mt-1 text-xs text-fg-3">{props.hint}</p>
    </div>
  );
}
