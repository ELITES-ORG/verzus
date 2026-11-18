import { useQuery } from '@tanstack/react-query';
import type { Enums } from '@verzus/db-types';
import { useState } from 'react';
import { Link } from 'react-router';
import { Select, StatusPill } from '../../components/ui';
import { supabase } from '../../lib/supabase';

type Status = Enums<'venue_status'>;

/** Venues list. `queue` shows only submitted venues, oldest first: the review queue. */
export function VenuesPage({ queue = false }: { queue?: boolean }) {
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const status: Status | 'all' = queue ? 'submitted' : filter;

  const venues = useQuery({
    queryKey: ['admin', 'venues', status],
    queryFn: async () => {
      let q = supabase.from('venues').select('id, name, city, status, submitted_at, created_at');
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await (queue
        ? q.order('submitted_at', { ascending: true })
        : q.order('created_at', { ascending: false }));
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="space-y-4">
      {queue ? (
        <p className="text-ink-600">Venues waiting for you, oldest first. Open one to approve it or send it back with a note.</p>
      ) : (
        <div className="max-w-xs">
          <Select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as Status | 'all')}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Waiting for review</option>
            <option value="live">Live</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
      )}

      {venues.data?.length === 0 && (
        <p className="rounded-card border-2 border-dashed border-ink-200 p-8 text-center text-ink-500">
          {queue ? 'Nothing to review.' : 'No venues with that status.'}
        </p>
      )}

      <ul className="divide-y-2 divide-ink-100 rounded-card border-2 border-ink-200 bg-white">
        {venues.data?.map((v) => (
          <li key={v.id}>
            <Link to={`/admin/venues/${v.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-ink-50">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{v.name}</p>
                <p className="text-sm text-ink-500">
                  {v.city ?? 'No city yet'}
                  {v.submitted_at && ` · submitted ${new Date(v.submitted_at).toLocaleString()}`}
                </p>
              </div>
              <StatusPill status={v.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const ReviewQueuePage = () => <VenuesPage queue />;
export const AllVenuesPage = () => <VenuesPage />;
