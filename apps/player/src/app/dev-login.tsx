import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * DEV ONLY. One-click sign-in as the seeded players in supabase/seed.sql. In production builds
 * __DEV__ is false, so this route only redirects home and the account details below are
 * stripped as unreachable code.
 */
export default function DevLoginRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevLogin />;
}

function DevLogin() {
  const password = 'verzus-dev';
  const players = [
    { email: 'player1@verzus.local', name: 'Pia', note: 'Badminton, Silver II' },
    { email: 'player2@verzus.local', name: 'Paolo', note: 'Badminton, Silver I' },
  ];
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(email: string) {
    setBusy(email);
    setError(null);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) return setError(`${error.message}. Is the local database seeded? Run pnpm db:seed.`);
    router.replace('/profile');
  }

  return (
    <View className="flex-1 gap-4 bg-ink-50 p-6">
      <Text className="rounded-lg border-2 border-dashed border-brand-600 bg-white p-3 text-ink-700">
        Development only: signs in as seeded local players without a phone code.
      </Text>
      {players.map((p) => (
        <Pressable
          key={p.email}
          disabled={busy !== null}
          onPress={() => signInAs(p.email)}
          className="rounded-card border-2 border-ink-900 bg-white p-4"
        >
          <Text className="text-base font-bold text-ink-900">{busy === p.email ? 'Signing in…' : p.name}</Text>
          <Text className="text-ink-500">{p.email}</Text>
          <Text className="text-ink-700">{p.note}</Text>
        </Pressable>
      ))}
      {error && <Text className="text-brand-700">{error}</Text>}
    </View>
  );
}
