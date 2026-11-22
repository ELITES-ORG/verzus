import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Match lobby. The same path is a web link and a native deep link
 * (verzus://m/<id>), so one invite works everywhere. Spots fill live via Realtime.
 */
export default function MatchLobby() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const queryClient = useQueryClient();

  const match = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, sport, mode, team_size, status, starts_at, venues(name), match_participants(user_id, team, status)')
        .eq('id', matchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${matchId}` },
        () => queryClient.invalidateQueries({ queryKey: ['match', matchId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  if (match.isLoading) return null;
  if (!match.data) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-fg-2">This match doesn't exist or isn't open to you.</Text>
      </View>
    );
  }

  const m = match.data;
  const active = m.match_participants.filter((p) => p.status === 'held' || p.status === 'paid');
  const spots = m.team_size * 2;

  return (
    <View className="flex-1 gap-2 bg-canvas p-4">
      <Text className="text-xl font-semibold capitalize text-fg">
        {m.sport} · {m.team_size}v{m.team_size} · {m.mode}
      </Text>
      <Text className="text-fg-2">
        {m.venues?.name} · {new Date(m.starts_at).toLocaleString()}
      </Text>
      <Text className="mt-4 text-fg">
        {active.length} of {spots} spots filled
      </Text>
    </View>
  );
}
