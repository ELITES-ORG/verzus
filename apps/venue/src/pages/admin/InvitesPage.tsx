import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Button, Field, SaveNote, TextInput } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { copy } from '../../lib/venues';

/** Owner invites: one link per venue owner, single use, 14 days. */
export function InvitesPage() {
  const qc = useQueryClient();
  const invites = useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venue_invites')
        .select('token, note, created_at, expires_at, redeemed_at, venue_id, venues(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const link = (token: string) => `${window.location.origin}/join/${token}`;

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('venue_invites')
      .insert({ note: note.trim() || null })
      .select('token')
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    setNote('');
    await qc.invalidateQueries({ queryKey: ['admin', 'invites'] });
    if (await copy(link(data.token))) setCopied(data.token);
  }

  async function revoke(token: string) {
    const { error } = await supabase.from('venue_invites').delete().eq('token', token);
    if (error) return setError(error.message);
    await qc.invalidateQueries({ queryKey: ['admin', 'invites'] });
  }

  const now = Date.now();

  return (
    <section className="space-y-6">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1">
          <Field label="Who's it for?" hint="Venue and person, so you can tell invites apart later.">
            <TextInput
              placeholder="e.g. Smash Hall BGC, Mark (owner)"
              maxLength={120}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={busy} className="mb-5">
          {busy ? 'Creating…' : 'Create invite link'}
        </Button>
      </form>
      <p className="text-sm text-fg-3">
        The link is copied when you create it. It works once, for 14 days, and lets the owner create one draft venue.
      </p>
      <SaveNote error={error} saved={false} />

      <ul className="divide-y-2 divide-line rounded-panel border-2 border-line bg-surface">
        {invites.data?.map((i) => {
          const used = Boolean(i.redeemed_at);
          const expired = !used && new Date(i.expires_at).getTime() < now;
          return (
            <li key={i.token} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-fg">{i.note || 'Owner invite'}</p>
                <p className="text-sm text-fg-3">
                  {used ? (
                    <>
                      Used:{' '}
                      {i.venue_id ? (
                        <Link to={`/admin/venues/${i.venue_id}`} className="font-semibold underline">
                          {i.venues?.name ?? 'venue'}
                        </Link>
                      ) : (
                        'venue deleted'
                      )}
                    </>
                  ) : expired ? (
                    'Expired'
                  ) : (
                    `Waiting · expires ${new Date(i.expires_at).toLocaleDateString()}`
                  )}
                </p>
              </div>
              {!used && !expired && (
                <>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      if (await copy(link(i.token))) setCopied(i.token);
                    }}
                  >
                    {copied === i.token ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button variant="danger" onClick={() => revoke(i.token)}>
                    Revoke
                  </Button>
                </>
              )}
            </li>
          );
        })}
        {invites.data?.length === 0 && <li className="px-4 py-6 text-center text-fg-3">No invites yet.</li>}
      </ul>
    </section>
  );
}
