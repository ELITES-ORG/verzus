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
    <View className="flex-1 gap-4 bg-canvas p-6">
      <Text className="rounded-control border border-dashed border-accent bg-surface p-3 text-fg-2">
        Development only: signs in as seeded local players without a phone code.
      </Text>
      {players.map((p) => (
        <Pressable
          key={p.email}
          disabled={busy !== null}
          onPress={() => signInAs(p.email)}
          className="rounded-panel border-2 border-line-strong bg-surface p-4"
        >
          <Text className="text-base font-bold text-fg">{busy === p.email ? 'Signing in…' : p.name}</Text>
          <Text className="text-fg-3">{p.email}</Text>
          <Text className="text-fg-2">{p.note}</Text>
        </Pressable>
      ))}
      {error && <Text className="text-danger">{error}</Text>}
    </View>
  );
}
