import { useQuery } from '@tanstack/react-query';
import { isInPlacement, tierOf } from '@verzus/rating/tiers';
import { Link } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { type ThemeChoice, useThemeChoice } from '@/lib/theme';

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
      <View className="flex-1 items-center justify-center bg-canvas p-6">
        <Link href="/sign-in" asChild>
          <Pressable className="rounded-control bg-accent px-6 py-3">
            <Text className="font-medium text-on-accent">Sign in</Text>
          </Pressable>
        </Link>
        <View className="w-full max-w-xs">
          <Appearance />
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="gap-3 p-4">
      <Text className="text-fg-3">{session.user.phone ?? session.user.email}</Text>

      {ratings.data?.length === 0 && <Text className="text-fg-2">Play a ranked match to get your first rank.</Text>}
      {ratings.data?.map((r) => {
        const placement = isInPlacement(r.games_played);
        return (
          <View key={r.sport} className="rounded-panel bg-surface p-4">
            <Text className="text-base font-semibold capitalize text-fg">{r.sport}</Text>
            <Text className="text-fg-2">{placement ? `Placement ${r.games_played}/5` : tierOf(r).label}</Text>
          </View>
        );
      })}

      <Appearance />

      <Pressable
        onPress={() => supabase.auth.signOut()}
        className="mt-6 items-center rounded-control border border-line-strong py-3"
      >
        <Text className="text-fg-2">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const CHOICES: { value: Exclude<ThemeChoice, 'system'>; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Light or dark. Until the person picks one, the app follows the phone and this shows whichever
 * theme that is; a pick is kept on this device.
 */
function Appearance() {
  const [, setChoice] = useThemeChoice();
  const { colorScheme } = useColorScheme();
  const shown = colorScheme === 'dark' ? 'dark' : 'light';
  return (
    <View className="mt-4 gap-2">
      <Text className="text-xs font-semibold uppercase tracking-widest text-fg-3">Appearance</Text>
      <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-control border border-line bg-surface-2 p-1">
        {CHOICES.map((c) => {
          const on = shown === c.value;
          return (
            <Pressable
              key={c.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setChoice(c.value)}
              className={`flex-1 items-center rounded-chip py-2 ${on ? 'bg-surface' : ''}`}
            >
              <Text className={on ? 'font-semibold text-fg' : 'text-fg-2'}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
