import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@verzus/db-types';
import { formatPhMobile } from '@verzus/schemas/phone';
import { useState } from 'react';
import { Button, Field, Modal, SaveNote, TextArea } from '../../components/ui';
import { supabase } from '../../lib/supabase';

type Status = Database['public']['Enums']['account_status'];
type Account = Database['public']['Functions']['admin_accounts']['Returns'][number];

const TABS: { status: Status; label: string }[] = [
  { status: 'pending', label: 'Awaiting review' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
];

/**
 * Account review: everyone who has confirmed their email, by status. Approve, or reject with a
 * reason the person sees (they can fix their details and send it back). Sign-ups that haven't
 * confirmed their email yet aren't listed; the overview counts them.
 */
export function AccountsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('pending');
  const [rejecting, setRejecting] = useState<Account | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ['admin', 'accounts', status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_accounts', { p_status: status });
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  async function approve(a: Account) {
    setBusy(a.id);
    setError(null);
    const { error } = await supabase.rpc('review_account', { p_user: a.id, p_approve: true });
    setBusy(null);
    if (error) return setError(error.message);
    await refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={status === t.status}
            onClick={() => setStatus(t.status)}
            className={`rounded-control px-3 py-1.5 text-sm font-semibold ${
              status === t.status ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status === 'pending' && (
        <p className="text-fg-2">People who confirmed their email, oldest first. Nobody can use verzus until you approve them.</p>
      )}
      <SaveNote error={error ?? accounts.error?.message ?? null} saved={false} />

      {accounts.data?.length === 0 && (
        <p className="rounded-panel border-2 border-dashed border-line p-8 text-center text-fg-3">
          {status === 'pending' ? 'Nobody is waiting. ' : 'No accounts here yet.'}
        </p>
      )}

      <ul className="space-y-3">
        {accounts.data?.map((a) => (
          <li key={a.id} className="space-y-3 rounded-panel border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-fg">{fullName(a) || a.email}</span>
                  <KindTag kind={a.kind} />
                  {a.username && <span className="text-sm text-fg-3">@{a.username}</span>}
                </p>
                <p className="truncate text-sm text-fg-2">{a.email}</p>
              </div>
              {status !== 'approved' && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="danger" onClick={() => setRejecting(a)} disabled={busy === a.id || status === 'rejected'}>
                    Reject
                  </Button>
                  <Button onClick={() => approve(a)} disabled={busy === a.id}>
                    {busy === a.id ? 'Approving…' : 'Approve'}
                  </Button>
                </div>
              )}
            </div>

            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {a.phone && <Row label="Mobile" value={formatPhMobile(a.phone)} />}
              {a.city && <Row label="Area" value={[a.barangay, a.city, a.province].filter(Boolean).join(', ')} />}
              {a.sports && a.sports.length > 0 && <Row label="Sports" value={a.sports.map(cap).join(', ')} />}
              <Row label="Registered" value={new Date(a.registered_at).toLocaleString()} />
              {status === 'pending' && a.submitted_at !== a.registered_at && a.note && (
                <Row label="Resubmitted" value={new Date(a.submitted_at).toLocaleString()} />
              )}
              {a.reviewed_at && status !== 'pending' && <Row label="Reviewed" value={new Date(a.reviewed_at).toLocaleString()} />}
            </dl>

            {a.note && (
              <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-fg-2">
                <span className="font-semibold text-fg">{status === 'pending' ? 'Rejected before: ' : 'Reason: '}</span>
                {a.note}
              </p>
            )}
            {!a.kind && (
              <p className="text-xs text-fg-3">
                Signed up with an emailed code (staff or an older account), so there are no details.
              </p>
            )}
          </li>
        ))}
      </ul>

      {rejecting && (
        <RejectDialog
          account={rejecting}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            setRejecting(null);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function RejectDialog(props: { account: Account; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reject() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('review_account', { p_user: props.account.id, p_approve: false, p_note: note.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    props.onDone();
  }

  return (
    <Modal title={`Reject ${fullName(props.account) || props.account.email}`} onClose={props.onClose}>
      <Field label="Reason" hint="They see this, fix their details and can send their account back.">
        <TextArea
          maxLength={500}
          value={note}
          placeholder="e.g. Please use your real full name."
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={reject} disabled={busy || note.trim().length < 3}>
          {busy ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
      <SaveNote error={error} saved={false} />
    </Modal>
  );
}

function KindTag({ kind }: { kind: Account['kind'] }) {
  const label = kind === 'player' ? 'Player' : kind === 'venue_owner' ? 'Venue owner' : 'Other';
  const look =
    kind === 'venue_owner' ? 'bg-violet text-surface' : kind === 'player' ? 'bg-accent text-on-accent' : 'bg-surface-3 text-fg-2';
  return <span className={`rounded-chip px-2 py-0.5 text-xs font-semibold ${look}`}>{label}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-fg-3">{label}</dt>
      <dd className="min-w-0 text-fg">{value}</dd>
    </div>
  );
}

function fullName(a: Account): string {
  return [a.first_name, a.middle_name, a.last_name, a.suffix].filter(Boolean).join(' ');
}

const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);
