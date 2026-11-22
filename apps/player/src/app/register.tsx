import {
  isEmail,
  normalizeUsername,
  passwordProblem,
  playerSignUpData,
  SUFFIXES,
  type Suffix,
  usernameProblem,
} from '@verzus/schemas/account';
import { SPORTS, type Sport } from '@verzus/schemas/constants';
import { isPhMobile, phMobileInput } from '@verzus/schemas/phone';
import * as Linking from 'expo-linking';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Chip, ErrorText, Field, PrimaryButton, SecondaryButton, TextField } from '@/components/form';
import { PlacePicker } from '@/components/PlacePicker';
import { type City, type Province, useBarangays, useProvinces } from '@/lib/places';
import { supabase } from '@/lib/supabase';

const STEPS = ['Your account', 'Your name', 'Contact and area', 'Your sports'] as const;
const sportLabel = (s: Sport) => s[0]?.toUpperCase() + s.slice(1);

/**
 * Player registration, four short steps: account (username, email, password), name, contact and
 * home area, sports. Everything is sent with the sign-up, and the database creates the profile
 * and the private details with the account (supabase/migrations/…_player_registration.sql), so a
 * half-registered player can't exist. Only the username and sports are public.
 */
export default function RegisterScreen() {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState<boolean[]>([false, false, false, false]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [first, setFirst] = useState('');
  const [middle, setMiddle] = useState('');
  const [last, setLast] = useState('');
  const [suffix, setSuffix] = useState<Suffix | ''>('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState<Province | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [barangay, setBarangay] = useState<string | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const available = useUsernameAvailable(username);
  const provinces = useProvinces();
  const barangays = useBarangays(province?.code ?? null);
  const barangayNames = city ? (barangays.data?.[city.code] ?? []) : [];

  // What's missing or wrong, per step.
  const problems = [
    {
      username: usernameProblem(username) ?? (available === 'taken' ? 'That username is taken.' : null),
      email: isEmail(email) ? null : 'Enter your email address.',
      password: passwordProblem(password),
      confirm: confirm === password ? null : "The passwords don't match.",
    },
    {
      first: first.trim() ? null : 'Enter your first name.',
      last: last.trim() ? null : 'Enter your last name.',
    },
    {
      phone: isPhMobile(phone) ? null : 'Enter the 10 digits of your mobile number.',
      province: province ? null : 'Choose your province.',
      city: city ? null : 'Choose your city or municipality.',
      barangay: barangay ? null : 'Choose your barangay.',
    },
    { sports: sports.length ? null : 'Pick at least one sport.' },
  ] as const;
  const stepOk = (i: number) => Object.values(problems[i] ?? {}).every((p) => !p);
  // A step's problems show once Continue has been tapped on it.
  const show = (i: number, key: string) => (tried[i] ? ((problems[i] as Record<string, string | null>)[key] ?? null) : null);

  async function next() {
    setTried((t) => t.map((v, i) => (i === step ? true : v)));
    if (!stepOk(step) || (step === 0 && available !== 'free')) return;
    setError(null);
    if (step < STEPS.length - 1) return setStep(step + 1);
    await register();
  }

  async function register() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: playerSignUpData({
          username,
          firstName: first,
          middleName: middle,
          lastName: last,
          suffix,
          phone,
          province: province?.name ?? '',
          city: city?.name ?? '',
          barangay: barangay ?? '',
          sports,
        }),
        // The confirmation email brings them back to the app.
        emailRedirectTo: Platform.OS === 'web' ? `${window.location.origin}/` : Linking.createURL('/'),
      },
    });
    setBusy(false);
    const taken = error?.code === 'user_already_exists' || (data.user && !error && data.user.identities?.length === 0);
    if (taken) {
      setStep(0);
      return setError('An account with this email already exists. Sign in instead.');
    }
    if (error) {
      // The database refused the details (most likely the username was taken a moment ago).
      setStep(0);
      return setError("Couldn't create your account. Check your username and details, then try again.");
    }
    if (data.session) return router.replace('/');
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <View className="flex-1 gap-3 bg-surface p-6">
        <Text className="text-2xl font-bold text-fg">Confirm your email</Text>
        <Text className="text-base text-fg-2">
          We sent a link to <Text className="font-semibold text-fg">{sentTo}</Text>. Open it to finish, then sign in with your
          username or email.
        </Text>
        <Text className="text-sm text-fg-3">Nothing there? Check your spam folder.</Text>
        <Link href="/sign-in" replace asChild>
          <Pressable className="mt-4 items-center rounded-control bg-accent py-3.5">
            <Text className="text-base font-semibold text-on-accent">Go to sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-6 pb-10" keyboardShouldPersistTaps="handled">
      {/* Progress: done green, here violet ("you are here"), later grey. */}
      <View className="gap-2">
        <View className="flex-row gap-1.5">
          {STEPS.map((s, i) => (
            <View
              key={s}
              className={`h-1.5 flex-1 rounded-chip ${i < step ? 'bg-accent' : i === step ? 'bg-violet' : 'bg-surface-3'}`}
            />
          ))}
        </View>
        <Text className="text-xs font-semibold uppercase tracking-widest text-fg-3">
          Step {step + 1} of {STEPS.length}
        </Text>
        <Text className="text-2xl font-bold text-fg">{STEPS[step]}</Text>
      </View>

      {step === 0 && (
        <>
          <Field
            label="Username"
            problem={show(0, 'username') ?? (available === 'taken' ? 'That username is taken.' : null)}
            hint={
              available === 'free'
                ? '✓ Available. Other players see this name.'
                : available === 'checking'
                  ? 'Checking…'
                  : '3 to 20 letters, numbers, dots or underscores.'
            }
          >
            <TextField
              value={username}
              onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              maxLength={20}
              invalid={Boolean(show(0, 'username')) || available === 'taken'}
            />
          </Field>
          <Field label="Email" problem={show(0, 'email')}>
            <TextField
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              invalid={Boolean(show(0, 'email'))}
            />
          </Field>
          <Field label="Password" problem={show(0, 'password')} hint="At least 8 characters.">
            <TextField
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              invalid={Boolean(show(0, 'password'))}
            />
          </Field>
          <Field label="Confirm password" problem={show(0, 'confirm')}>
            <TextField
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              invalid={Boolean(show(0, 'confirm'))}
            />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <Field label="First name" problem={show(1, 'first')}>
            <TextField
              value={first}
              onChangeText={setFirst}
              autoComplete="given-name"
              maxLength={60}
              invalid={Boolean(show(1, 'first'))}
            />
          </Field>
          <Field label="Middle name (optional)">
            <TextField value={middle} onChangeText={setMiddle} autoComplete="additional-name" maxLength={60} />
          </Field>
          <Field label="Last name" problem={show(1, 'last')}>
            <TextField
              value={last}
              onChangeText={setLast}
              autoComplete="family-name"
              maxLength={60}
              invalid={Boolean(show(1, 'last'))}
            />
          </Field>
          <Field label="Suffix (optional)">
            <View className="flex-row flex-wrap gap-2">
              {SUFFIXES.map((s) => (
                <Chip key={s} label={s} on={suffix === s} onPress={() => setSuffix(suffix === s ? '' : s)} />
              ))}
            </View>
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Mobile number" problem={show(2, 'phone')} hint="For verzus only. Other players never see it.">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-violet">+63</Text>
              <TextField
                className="flex-1"
                value={phone}
                onChangeText={(t) => setPhone(phMobileInput(t))}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="9XX XXX XXXX"
                // No maxLength: autofill and paste bring "0917…" or "+63 917…", which phMobileInput
                // trims to the 10 digits (a limit would cut the raw text first).
                invalid={Boolean(show(2, 'phone'))}
              />
            </View>
          </Field>
          <Field label="Province" problem={show(2, 'province')}>
            <PlacePicker
              label="Province"
              searchLabel="Search provinces"
              items={provinces.data ?? []}
              name={(p) => p.name}
              value={province?.name ?? null}
              disabled={!provinces.data}
              disabledLabel={provinces.isError ? "Couldn't load the list" : 'Loading…'}
              invalid={Boolean(show(2, 'province'))}
              onPick={(p) => {
                if (p.code === province?.code) return;
                setProvince(p);
                setCity(null);
                setBarangay(null);
              }}
            />
          </Field>
          <Field label="City or municipality" problem={show(2, 'city')}>
            <PlacePicker
              label="City or municipality"
              searchLabel="Search cities and municipalities"
              items={province?.cities ?? []}
              name={(c) => c.name}
              value={city?.name ?? null}
              disabled={!province}
              disabledLabel="Choose a province first"
              invalid={Boolean(show(2, 'city'))}
              onPick={(c) => {
                if (c.code === city?.code) return;
                setCity(c);
                setBarangay(null);
              }}
            />
          </Field>
          <Field label="Barangay" problem={show(2, 'barangay')}>
            <PlacePicker
              label="Barangay"
              searchLabel="Search barangays"
              items={barangayNames}
              name={(b) => b}
              value={barangay}
              disabled={!city || !barangays.data}
              disabledLabel={city ? 'Loading…' : 'Choose a city first'}
              invalid={Boolean(show(2, 'barangay'))}
              onPick={setBarangay}
            />
          </Field>
          <Text className="text-xs text-fg-3">
            Your area helps us find courts and players near you. Only verzus sees your barangay.
          </Text>
        </>
      )}

      {step === 3 && (
        <Field
          label="Which sports do you play?"
          problem={show(3, 'sports')}
          hint="Pick all that apply. You can change them later."
        >
          <View className="flex-row flex-wrap gap-2">
            {SPORTS.map((s) => (
              <Chip
                key={s}
                label={sportLabel(s)}
                on={sports.includes(s)}
                onPress={() => setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
              />
            ))}
          </View>
        </Field>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <View className="flex-row gap-3">
        {step > 0 && <SecondaryButton label="Back" onPress={() => setStep(step - 1)} disabled={busy} />}
        <View className="flex-1">
          <PrimaryButton
            label={step === STEPS.length - 1 ? 'Create account' : 'Continue'}
            busyLabel="Creating your account…"
            busy={busy}
            disabled={step === 0 && available === 'checking'}
            onPress={next}
          />
        </View>
      </View>

      {step === 0 && (
        <View className="flex-row flex-wrap justify-center gap-1">
          <Text className="text-fg-3">Already have an account?</Text>
          <Link href="/sign-in" replace asChild>
            <Pressable accessibilityRole="link">
              <Text className="font-semibold text-fg underline">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      )}
    </ScrollView>
  );
}

/** Whether a username is free, checked a moment after typing stops. */
function useUsernameAvailable(input: string): 'unknown' | 'checking' | 'free' | 'taken' {
  const [state, setState] = useState<'unknown' | 'checking' | 'free' | 'taken'>('unknown');
  useEffect(() => {
    const u = normalizeUsername(input);
    if (usernameProblem(u)) return setState('unknown');
    setState('checking');
    let live = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: u });
      if (live) setState(error ? 'unknown' : data ? 'free' : 'taken');
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [input]);
  return state;
}
