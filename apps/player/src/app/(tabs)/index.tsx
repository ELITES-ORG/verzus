import { useQuery } from '@tanstack/react-query';
import { SPORTS, type Sport } from '@verzus/schemas/constants';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

// Until location permission is wired up (expo-location), search around Makati.
const DEFAULT_LOCATION = { lat: 14.5547, lng: 121.0244 };

/** Venues near you, filtered by sport, nearest first. */
export default function PlayScreen() {
  const [sport, setSport] = useState<Sport | null>(null);

  const venues = useQuery({
    queryKey: ['venues-near', sport],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('venues_near', {
        p_lat: DEFAULT_LOCATION.lat,
        p_lng: DEFAULT_LOCATION.lng,
        p_radius_m: 15_000,
        ...(sport ? { p_sport: sport } : {}),
      });
      if (error) throw error;
      return data;
    },
  });

  return (
    <View className="flex-1 bg-ink-50">
      <ScrollView horizontal className="max-h-14 grow-0 px-3 py-2" showsHorizontalScrollIndicator={false}>
        {[null, ...SPORTS].map((s) => (
          <Pressable
            key={s ?? 'all'}
            onPress={() => setSport(s)}
            className={`mr-2 rounded-full px-4 py-2 ${sport === s ? 'bg-brand-500' : 'bg-white'}`}
          >
            <Text className={sport === s ? 'font-medium text-white' : 'text-ink-700'}>{s ?? 'All sports'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {venues.error && <Text className="p-4 text-brand-700">Couldn't load venues: {venues.error.message}</Text>}

      <FlatList
        data={venues.data ?? []}
        keyExtractor={(v) => v.id}
        contentContainerClassName="gap-3 p-3"
        ListEmptyComponent={venues.isLoading ? undefined : <Text className="p-4 text-ink-500">No venues nearby yet.</Text>}
        renderItem={({ item }) => (
          <View className="rounded-card bg-white p-4">
            <Text className="text-base font-semibold text-ink-900">{item.name}</Text>
            <Text className="text-ink-500">
              {item.city} · {(item.distance_m / 1000).toFixed(1)} km
            </Text>
            <Text className="mt-1 text-ink-700">From ₱{(item.min_hourly_rate_cents / 100).toFixed(0)} / hour</Text>
          </View>
        )}
      />
    </View>
  );
}
