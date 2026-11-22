import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Suffix } from '@verzus/schemas/account';
import { toPhMobile } from '@verzus/schemas/phone';
import { type FormEvent, useState } from 'react';
import { AuthCard, AuthError, authPrimary } from '../components/AuthCard';
import { OwnerDetailsFields, type OwnerForm, ownerFormProblems } from '../components/OwnerDetailsFields';
import type { AccountReview } from '../lib/account';
import { friendly } from '../lib/auth-errors';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

const PLAYER_URL = import.meta.env.VITE_PLAYER_URL ?? 'https://verzus-player.onrender.com';

/**
 * Shown instead of the portal until verzus approves the account. Pending: what happens next.
 * Rejected: the reason, and (for venue owners) their details to fix and send back.
 */
export function AccountReviewPage({ account }: { account: AccountReview | null }) {
  const status = account?.status ?? 'pending';
  const signOut = (
    <p className="mt-4 text-center text-sm">
      <button type="button" onClick={() => supabase.auth.signOut()} className="font-semibold text-fg-3 underline hover:text-fg">
        Sign out
      </button>
    </p>
  );

  if (account?.kind === 'player') {
    return (
      <AuthCard below={signOut}>
        <h1 className="text-xl font-bold text-fg">This is the venue portal</h1>
        <p className="text-sm text-fg-2">
          Your verzus account is a player account. Open the player app to see where your account stands.
        </p>
        <a href={PLAYER_URL} className={`${authPrimary} block text-center`}>
          Open the player app
        </a>
      </AuthCard>
    );
  }

  if (status === 'rejected') return <Rejected note={account?.note ?? null} below={signOut} />;

  return (
    <AuthCard below={signOut}>
      <p className="text-xs font-semibold uppercase tracking-widest text-warn">Under review</p>
      <h1 className="text-xl font-bold text-fg">We're reviewing your account</h1>
      <p className="text-sm text-fg-2">
        verzus checks every new account before it can be used. Once yours is approved, sign in again and you can name your venue
        and set it up.
      </p>
      {account?.submitted_at && (
        <p className="text-xs text-fg-3">Sent for review {new Date(account.submitted_at).toLocaleString()}.</p>
      )}
    </AuthCard>
  );
}

/** A rejected owner: the reason, their details to fix, and Resubmit. */
function Rejected({ note, below }: { note: string | null; below: React.ReactNode }) {
  const { session } = useSession();
  const qc = useQueryClient();
  const userId = session?.user.id ?? '';
  const details = useQuery({
    queryKey: ['owner-details', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('owner_details')
        .select('first_name, middle_name, last_name, suffix, phone')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<OwnerForm | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = details.data;
  const value: OwnerForm = form ?? {
    firstName: d?.first_name ?? '',
    middleName: d?.middle_name ?? '',
    lastName: d?.last_name ?? '',
    suffix: (d?.suffix ?? '') as Suffix | '',
    phone: (d?.phone ?? '').replace(/^\+63/, ''),
  };

  async function resubmit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(ownerFormProblems(value)).some(Boolean)) return;
    const phone = toPhMobile(value.phone);
    if (!phone) return;
    setBusy(true);
    setError(null);
    const fields = {
      first_name: value.firstName.trim(),
      middle_name: value.middleName.trim() || null,
      last_name: value.lastName.trim(),
      suffix: value.suffix || null,
      phone,
    };
    // Accounts made before owners gave their details have no row yet; only verzus can add one.
    const saved = d ? await supabase.from('owner_details').update(fields).eq('id', userId) : { error: null };
    const sent = saved.error ? saved : await supabase.rpc('resubmit_account');
    setBusy(false);
    if (sent.error) return setError(friendly(sent.error));
    await qc.invalidateQueries({ queryKey: ['my-account'] });
  }

  return (
    <AuthCard below={below}>
      <p className="text-xs font-semibold uppercase tracking-widest text-danger">Not approved</p>
      <h1 className="text-xl font-bold text-fg">Your account needs a change</h1>
      {note && (
        <div className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2.5">
          <p className="text-xs font-semibold text-danger">From verzus</p>
          <p className="text-sm text-fg">{note}</p>
        </div>
      )}
      <p className="text-sm text-fg-2">Fix your details below, then send your account back for review.</p>
      <form onSubmit={resubmit} noValidate className="space-y-3">
        {d && <OwnerDetailsFields value={value} onChange={setForm} showProblems={tried} />}
        <button type="submit" disabled={busy || details.isLoading} className={authPrimary}>
          {busy ? 'Sending…' : 'Send for review again'}
        </button>
      </form>
      {error && <AuthError>{error}</AuthError>}
    </AuthCard>
  );
}
