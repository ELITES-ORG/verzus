import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Open public matches. Fairness ordering (@verzus/matchmaking) comes from the API later. */
export default function MatchesScreen() {
  const { session } = useSession();

  const matches = useQuery({
    queryKey: ['open-matches'],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, sport, mode, team_size, starts_at, venues(name)')
        .eq('status', 'open_public')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas p-6">
        <Text className="mb-4 text-center text-fg-2">Sign in to see open matches near you.</Text>
        <Link href="/sign-in" asChild>
          <Pressable className="rounded-control bg-accent px-6 py-3">
            <Text className="font-medium text-on-accent">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-canvas"
      contentContainerClassName="gap-3 p-3"
      data={matches.data ?? []}
      keyExtractor={(m) => m.id}
      ListEmptyComponent={matches.isLoading ? undefined : <Text className="p-4 text-fg-3">No open matches right now.</Text>}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/m/[matchId]', params: { matchId: item.id } }} asChild>
          <Pressable className="rounded-panel bg-surface p-4">
            <Text className="font-semibold text-fg">
              {item.sport} · {item.team_size}v{item.team_size} · {item.mode}
            </Text>
            <Text className="text-fg-3">
              {item.venues?.name} · {new Date(item.starts_at).toLocaleString()}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}
