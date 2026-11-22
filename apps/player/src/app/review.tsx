import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SUFFIXES, type Suffix } from '@verzus/schemas/account';
import { SPORTS, type Sport } from '@verzus/schemas/constants';
import { isPhMobile, phMobileInput, toPhMobile } from '@verzus/schemas/phone';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Chip, ErrorText, Field, PrimaryButton, TextField } from '@/components/form';
import { PlacePicker } from '@/components/PlacePicker';
import { useMyAccount } from '@/lib/account';
import { type City, type Province, useBarangays, useProvinces } from '@/lib/places';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const sportLabel = (s: Sport) => s[0]?.toUpperCase() + s.slice(1);

/**
 * Where a new account stands until verzus approves it (the root layout sends unapproved accounts
 * here). Pending: what happens next. Rejected: the reason, and the player's details to fix and
 * send back for review.
 */
export default function ReviewScreen() {
  const account = useMyAccount();
  const a = account.data;
  const signOut = (
    <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} className="items-center py-3">
      <Text className="font-semibold text-fg-3 underline">Sign out</Text>
    </Pressable>
  );

  if (!a) return <View className="flex-1 bg-surface" />;

  if (a.kind === 'venue_owner') {
    return (
      <View className="flex-1 gap-3 bg-surface p-6">
        <Text className="text-2xl font-bold text-fg">This is the player app</Text>
        <Text className="text-base text-fg-2">
          Your verzus account is a venue owner account. Use the venue portal to see where your account stands.
        </Text>
        {signOut}
      </View>
    );
  }

  if (a.status === 'rejected') return <Rejected note={a.note} signOut={signOut} />;

  return (
    <View className="flex-1 gap-3 bg-surface p-6">
      <Text className="text-xs font-semibold uppercase tracking-widest text-warn">Under review</Text>
      <Text className="text-2xl font-bold text-fg">We're reviewing your account</Text>
      <Text className="text-base text-fg-2">
        verzus checks every new account before it can be used. Once yours is approved, this screen opens the app: courts to book,
        rivals around your level, a rank to earn.
      </Text>
      {a.submitted_at && <Text className="text-xs text-fg-3">Sent for review {new Date(a.submitted_at).toLocaleString()}.</Text>}
      <Pressable
        accessibilityRole="button"
        onPress={() => account.refetch()}
        className="mt-2 items-center rounded-control border-2 border-line-strong py-3"
      >
        <Text className="font-semibold text-fg">{account.isFetching ? 'Checking…' : 'Check again'}</Text>
      </Pressable>
      {signOut}
    </View>
  );
}

/** A rejected player: the reason, their details to fix, and Send for review again. */
function Rejected({ note, signOut }: { note: string | null; signOut: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const qc = useQueryClient();
  const current = useQuery({
    queryKey: ['player-details', userId],
    queryFn: async () => {
      const [details, profile] = await Promise.all([
        supabase.from('player_details').select('*').eq('id', userId).maybeSingle(),
        supabase.from('profiles').select('sports').eq('id', userId).single(),
      ]);
      if (details.error) throw details.error;
      if (profile.error) throw profile.error;
      return { d: details.data, sports: profile.data.sports };
    },
  });

  if (!current.data) return <View className="flex-1 bg-surface" />;
  return <EditForm note={note} signOut={signOut} initial={current.data} userId={userId} onSent={() => qc.invalidateQueries()} />;
}

function EditForm(props: {
  note: string | null;
  signOut: React.ReactNode;
  userId: string;
  initial: { d: Record<string, string | null> | null; sports: Sport[] };
  onSent: () => void;
}) {
  const d = props.initial.d;
  const [first, setFirst] = useState(d?.first_name ?? '');
  const [middle, setMiddle] = useState(d?.middle_name ?? '');
  const [last, setLast] = useState(d?.last_name ?? '');
  const [suffix, setSuffix] = useState<Suffix | ''>((d?.suffix as Suffix | null) ?? '');
  const [phone, setPhone] = useState(phMobileInput(d?.phone ?? ''));
  const [provinceName, setProvinceName] = useState(d?.province ?? null);
  const [cityName, setCityName] = useState(d?.city ?? null);
  const [barangay, setBarangay] = useState<string | null>(d?.barangay ?? null);
  const [sports, setSports] = useState<Sport[]>(props.initial.sports);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provinces = useProvinces();
  const province: Province | null = useMemo(
    () => provinces.data?.find((p) => p.name === provinceName) ?? null,
    [provinces.data, provinceName],
  );
  const city: City | null = province?.cities.find((c) => c.name === cityName) ?? null;
  const barangays = useBarangays(province?.code ?? null);
  const barangayNames = city ? (barangays.data?.[city.code] ?? []) : [];

  const problems = {
    first: first.trim() ? null : 'Enter your first name.',
    last: last.trim() ? null : 'Enter your last name.',
    phone: isPhMobile(phone) ? null : 'Enter the 10 digits of your mobile number.',
    area: provinceName && cityName && barangay ? null : 'Choose your province, city and barangay.',
    sports: sports.length ? null : 'Pick at least one sport.',
  };
  const show = (k: keyof typeof problems) => (tried ? problems[k] : null);

  async function send() {
    setTried(true);
    if (Object.values(problems).some(Boolean) || !d) return;
    setBusy(true);
    setError(null);
    const details = await supabase
      .from('player_details')
      .update({
        first_name: first.trim(),
        middle_name: middle.trim() || null,
        last_name: last.trim(),
        suffix: suffix || null,
        phone: toPhMobile(phone) ?? '',
        province: provinceName ?? '',
        city: cityName ?? '',
        barangay: barangay ?? '',
      })
      .eq('id', props.userId);
    const profile = details.error
      ? details
      : await supabase
          .from('profiles')
          .update({ sports, display_name: first.trim().slice(0, 40), home_city: cityName })
          .eq('id', props.userId);
    const sent = profile.error ? profile : await supabase.rpc('resubmit_account');
    setBusy(false);
    if (sent.error) return setError("Couldn't send it. Check your details and connection, then try again.");
    props.onSent();
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-6 pb-10" keyboardShouldPersistTaps="handled">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-widest text-danger">Not approved</Text>
        <Text className="text-2xl font-bold text-fg">Your account needs a change</Text>
        {props.note && (
          <View className="gap-1 rounded-control border border-danger/40 bg-danger-soft px-3 py-2.5">
            <Text className="text-xs font-semibold text-danger">From verzus</Text>
            <Text className="text-base text-fg">{props.note}</Text>
          </View>
        )}
        <Text className="text-base text-fg-2">Fix your details below, then send your account back for review.</Text>
      </View>

      {d ? (
        <>
          <Field label="First name" problem={show('first')}>
            <TextField value={first} onChangeText={setFirst} maxLength={60} invalid={Boolean(show('first'))} />
          </Field>
          <Field label="Middle name (optional)">
            <TextField value={middle} onChangeText={setMiddle} maxLength={60} />
          </Field>
          <Field label="Last name" problem={show('last')}>
            <TextField value={last} onChangeText={setLast} maxLength={60} invalid={Boolean(show('last'))} />
          </Field>
          <Field label="Suffix (optional)">
            <View className="flex-row flex-wrap gap-2">
              {SUFFIXES.map((s) => (
                <Chip key={s} label={s} on={suffix === s} onPress={() => setSuffix(suffix === s ? '' : s)} />
              ))}
            </View>
          </Field>
          <Field label="Mobile number" problem={show('phone')}>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-violet">+63</Text>
              <TextField
                className="flex-1"
                value={phone}
                onChangeText={(t) => setPhone(phMobileInput(t))}
                keyboardType="phone-pad"
                placeholder="9XX XXX XXXX"
                invalid={Boolean(show('phone'))}
              />
            </View>
          </Field>
          <Field label="Province" problem={show('area')}>
            <PlacePicker
              label="Province"
              searchLabel="Search provinces"
              items={provinces.data ?? []}
              name={(p) => p.name}
              value={provinceName}
              disabled={!provinces.data}
              disabledLabel="Loading…"
              onPick={(p) => {
                if (p.name === provinceName) return;
                setProvinceName(p.name);
                setCityName(null);
                setBarangay(null);
              }}
            />
          </Field>
          <Field label="City or municipality">
            <PlacePicker
              label="City or municipality"
              searchLabel="Search cities and municipalities"
              items={province?.cities ?? []}
              name={(c) => c.name}
              value={cityName}
              disabled={!province}
              disabledLabel="Choose a province first"
              onPick={(c) => {
                if (c.name === cityName) return;
                setCityName(c.name);
                setBarangay(null);
              }}
            />
          </Field>
          <Field label="Barangay">
            <PlacePicker
              label="Barangay"
              searchLabel="Search barangays"
              items={barangayNames}
              name={(b) => b}
              value={barangay}
              disabled={!city || !barangays.data}
              disabledLabel={city ? 'Loading…' : 'Choose a city first'}
              onPick={setBarangay}
            />
          </Field>
          <Field label="Your sports" problem={show('sports')}>
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
        </>
      ) : (
        <Text className="text-base text-fg-2">
          This account has no player details to change. Contact verzus if you think the decision is wrong.
        </Text>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {d && <PrimaryButton label="Send for review again" busyLabel="Sending…" busy={busy} onPress={send} />}
      {props.signOut}
    </ScrollView>
  );
}
