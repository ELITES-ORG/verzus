import { useQuery } from '@tanstack/react-query';
import { isInPlacement, tierOf } from '@verzus/rating/tiers';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Ranked tier per sport, computed with the same @verzus/rating code the API uses. */
export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const ratings = useQuery({
    queryKey: ['my-ratings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select('sport, mu, sigma, games_played')
        .eq('user_id', userId as string)
        .eq('mode', 'ranked');
      if (error) throw error;
      return data;
    },
  });

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-50 p-6">
        <Link href="/sign-in" asChild>
          <Pressable className="rounded-full bg-brand-500 px-6 py-3">
            <Text className="font-medium text-white">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ink-50" contentContainerClassName="gap-3 p-4">
      <Text className="text-ink-500">{session.user.phone ?? session.user.email}</Text>

      {ratings.data?.length === 0 && <Text className="text-ink-600">Play a ranked match to get your first rank.</Text>}
      {ratings.data?.map((r) => {
        const placement = isInPlacement(r.games_played);
        return (
          <View key={r.sport} className="rounded-card bg-white p-4">
            <Text className="text-base font-semibold capitalize text-ink-900">{r.sport}</Text>
            <Text className="text-ink-700">{placement ? `Placement ${r.games_played}/5` : tierOf(r).label}</Text>
          </View>
        );
      })}

      <Pressable onPress={() => supabase.auth.signOut()} className="mt-6 items-center rounded-full border border-ink-300 py-3">
        <Text className="text-ink-700">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
