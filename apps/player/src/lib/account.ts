import { useQuery } from '@tanstack/react-query';
import { useSession } from './session';
import { supabase } from './supabase';

/**
 * The signed-in player's account review: pending until verzus approves it (accounts from before
 * reviews began are approved). Re-checked when the app comes back to the foreground.
 */
export function useMyAccount() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-account', userId],
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
    queryFn: async () => {
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
