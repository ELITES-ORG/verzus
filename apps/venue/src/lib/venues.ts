import { useQuery } from '@tanstack/react-query';
import type { Enums } from '@verzus/db-types';
import { useSession } from './session';
import { supabase } from './supabase';

export interface MyVenue {
  venueId: string;
  role: Enums<'venue_role'>;
  name: string;
  status: Enums<'venue_status'>;
}

/** The venues the signed-in person belongs to, oldest membership first. */
export function useMyVenues() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-venues', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyVenue[]> => {
      const { data, error } = await supabase
        .from('venue_members')
        .select('venue_id, role, venues(name, status)')
        .eq('user_id', userId ?? '')
        .order('created_at');
      if (error) throw error;
      return data.flatMap((m) =>
        m.venues ? [{ venueId: m.venue_id, role: m.role, name: m.venues.name, status: m.venues.status }] : [],
      );
    },
  });
}

/** Copies text to the clipboard; resolves false if the browser refuses. */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const STATUS_LABEL: Record<Enums<'venue_status'>, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  live: 'Live',
  suspended: 'Suspended',
};
