import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@verzus/db-types';
import { useSession } from './session';
import { supabase } from './supabase';

export type AccountReview = Pick<Tables<'account_reviews'>, 'kind' | 'status' | 'note' | 'submitted_at'>;

/**
 * The signed-in person's account review: pending until verzus approves it. Everyone who existed
 * before reviews began is approved. Null while loading or signed out.
 */
export function useMyAccount() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-account', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AccountReview | null> => {
      const { data, error } = await supabase
        .from('account_reviews')
        .select('kind, status, note, submitted_at')
        .eq('id', userId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
