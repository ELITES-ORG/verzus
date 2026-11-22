import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Mark } from '../components/Mark';
import { supabase } from '../lib/supabase';

/**
 * DEV ONLY. One-click sign-in as the seeded accounts in supabase/seed.sql. The route is only
 * registered when import.meta.env.DEV is true, so production builds don't contain this file,
 * and it refuses to run against anything but a local Supabase.
 */
const PASSWORD = 'verzus-dev';
/** The new owner's unused invite from supabase/seed.sql. */
const DEV_OWNER_INVITE = 'dddddddd-0000-4000-8000-000000000001';

type Account = { email: string; role: string; does: string; to: string | 'owner' };
const ACCOUNTS: Account[] = [
  { email: 'admin@verzus.local', role: 'verzus admin', does: 'Review queue, owner invites, all venues', to: '/admin' },
  {
    email: 'owner@verzus.local',
    role: 'New venue owner',
    does: 'First time: the invite, naming the venue and the setup wizard. Afterwards: their venue.',
    to: 'owner',
  },
  {
    email: 'venues@verzus.local',
    role: 'Established venue owner',
    does: 'Owns the sample venues: two live, one waiting for review',
    to: 'owner',
  },
  { email: 'staff@verzus.local', role: 'Venue staff', does: 'Calendar at BGC Smash Hall only', to: '/' },
];

/**
 * Where an owner lands, like a real owner would: no venue yet means onboarding through the
 * invite; a draft or a venue in review means the setup wizard; a live venue means the calendar.
 */
async function ownerLanding(userId: string): Promise<string> {
  const { data } = await supabase
    .from('venue_members')
    .select('venue_id, venues(status)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!data) return `/join/${DEV_OWNER_INVITE}`;
  return data.venues?.status === 'live' ? '/' : `/setup/${data.venue_id}`;
}

const url = new URL(import.meta.env.VITE_SUPABASE_URL as string);
// `.trycloudflare.com`: a `pnpm tunnel` quick tunnel, which only ever leads to the Supabase on the
// machine running it, never to the hosted project.
const LOCAL =
  ['localhost', '127.0.0.1'].includes(url.hostname) ||
  /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(url.hostname) ||
  url.hostname.endsWith('.trycloudflare.com');

export function DevLoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(account: Account) {
    setBusy(account.email);
    setError(null);
    await supabase.auth.signOut();
    qc.clear();
    const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password: PASSWORD });
    if (error) {
      setBusy(null);
      setError(`${error.message}. Is the local database seeded? Run pnpm db:seed.`);
      return;
    }
    const to = account.to === 'owner' ? await ownerLanding(data.user.id) : account.to;
    setBusy(null);
    navigate(to, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md space-y-5">
        <p className="flex items-end gap-2">
          <Mark className="text-[30px]" />
          <span className="pb-0.5 text-sm font-medium text-ink-500">dev login</span>
        </p>
        <div className="rounded-lg border-2 border-dashed border-[#dd2b37] bg-white px-4 py-3 text-sm text-ink-700">
          Development only: signs in as the seeded local accounts without email. Not part of production builds.
        </div>

        {!LOCAL ? (
          <p className="text-sm font-medium text-[#b51f2a]">Disabled: this app points at {url.host}, not a local Supabase.</p>
        ) : (
          <ul className="space-y-3">
            {ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => signInAs(a)}
                  className="w-full rounded-card border-[3px] border-ink-900 bg-white p-4 text-left shadow-[5px_6px_0_#b8b3ff] hover:-translate-y-0.5 disabled:opacity-60"
                >
                  <span className="block font-bold text-ink-900">{busy === a.email ? 'Signing in…' : a.role}</span>
                  <span className="block text-sm text-ink-500">{a.email}</span>
                  <span className="mt-1 block text-sm text-ink-700">{a.does}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-[#b51f2a]">
            {error}
          </p>
        )}
        <p className="text-xs text-ink-500">
          Players sign in on the player app's dev login (player1@verzus.local, player2@verzus.local). Password for all:{' '}
          <code>{PASSWORD}</code>.
        </p>
      </div>
    </div>
  );
}
