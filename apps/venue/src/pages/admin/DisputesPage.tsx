import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/**
 * Admin area (role-checked in the router and by RLS). Starts with open
 * disputes; resolving them goes through the API, which owns rating changes.
 */
export function DisputesPage() {
  const disputes = useQuery({
    queryKey: ['open-disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('id, match_id, reason, created_at')
        .eq('status', 'open')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">Open disputes</h1>
      {disputes.isLoading && <p>Loading…</p>}
      {disputes.data?.length === 0 && <p className="text-fg-3">No open disputes.</p>}
      <ul className="space-y-2">
        {disputes.data?.map((d) => (
          <li key={d.id} className="rounded-panel bg-surface p-3 shadow">
            <p className="text-sm">{d.reason}</p>
            <p className="text-xs text-fg-3">
              Match {d.match_id} · {new Date(d.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
