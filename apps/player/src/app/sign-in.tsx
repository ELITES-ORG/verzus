import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';

/** Phone one-time-code sign-in. Locally, test numbers in supabase/config.toml accept code 123456. */
export default function SignInScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = sent
      ? await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
      : await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) return setError(error.message);
    if (sent) router.back();
    else setSent(true);
  }

  return (
    <View className="flex-1 gap-4 bg-surface p-6">
      <Text className="text-xl font-semibold text-fg">{sent ? 'Enter the code we sent' : 'Sign in with your phone'}</Text>
      <TextInput
        className="rounded-control border border-line-strong bg-surface px-4 py-3 text-base text-fg placeholder:text-fg-3"
        placeholder="+639170000001"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={phone}
        onChangeText={setPhone}
        editable={!sent}
      />
      {sent && (
        <TextInput
          className="rounded-control border border-line-strong bg-surface px-4 py-3 text-base text-fg placeholder:text-fg-3"
          placeholder="6-digit code"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          value={code}
          onChangeText={setCode}
        />
      )}
      {error && <Text className="text-danger">{error}</Text>}
      <Pressable disabled={busy} onPress={submit} className="items-center rounded-control bg-accent py-3 disabled:opacity-60">
        <Text className="font-medium text-on-accent">{sent ? 'Verify' : 'Send code'}</Text>
      </Pressable>
      {__DEV__ && (
        <Link href="/dev-login" asChild>
          <Pressable className="items-center py-2">
            <Text className="font-medium text-fg-3 underline">Dev login (local only)</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}
