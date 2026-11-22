import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ErrorText, Field, PrimaryButton, TextField } from '@/components/form';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with a username or email, and a password. An email goes straight to Supabase; a
 * username goes through the verzus API, which looks up its email on the server (emails are never
 * sent to the app) and hands back the session.
 */
export default function SignInScreen() {
  const [who, setWho] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const id = who.trim();
    if (!id || !password) return setError('Enter your username or email, and your password.');
    setBusy(true);
    setError(null);
    try {
      if (id.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({ email: id, password });
        if (error) {
          return setError(
            error.code === 'email_not_confirmed'
              ? 'Confirm your email first: open the link we sent when you registered.'
              : 'Wrong email or password.',
          );
        }
      } else {
        const res = await api.auth['username-sign-in'].$post({ json: { username: id.toLowerCase(), password } });
        if (res.status === 429) return setError('Too many tries. Wait a few minutes, then try again.');
        if (!res.ok) return setError('Wrong username or password.');
        const session = await res.json();
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) return setError(error.message);
      }
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      setError("Couldn't reach verzus. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
      <Field label="Username or email">
        <TextField
          value={who}
          onChangeText={setWho}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
        />
      </Field>
      <Field label="Password">
        <TextField
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Field>
      {error && <ErrorText>{error}</ErrorText>}
      <PrimaryButton label="Sign in" busyLabel="Signing in…" busy={busy} onPress={submit} />
      <View className="flex-row flex-wrap justify-center gap-1">
        <Text className="text-fg-3">New to verzus?</Text>
        <Link href="/register" replace asChild>
          <Pressable accessibilityRole="link">
            <Text className="font-semibold text-fg underline">Create an account</Text>
          </Pressable>
        </Link>
      </View>
      {__DEV__ && (
        <Link href="/dev-login" asChild>
          <Pressable className="items-center py-2">
            <Text className="font-medium text-fg-3 underline">Dev login (local only)</Text>
          </Pressable>
        </Link>
      )}
    </ScrollView>
  );
}
