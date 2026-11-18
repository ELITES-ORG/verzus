import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useParams } from 'react-router';
import { Button, Field, SaveNote, TextInput } from '../components/ui';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { copy, useMyVenues } from '../lib/venues';

/** Owners invite staff with a link, see who has access, and remove people. Staff run the calendar only. */
export function StaffPage() {
  const { venueId = '' } = useParams();
  const { session } = useSession();
  const qc = useQueryClient();
  const venues = useMyVenues();
  const venue = venues.data?.find((v) => v.venueId === venueId);

  const people = useQuery({
    queryKey: ['venue-people', venueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('venue_people', { p_venue_id: venueId });
      if (error) throw error;
      return data;
    },
  });
  const invites = useQuery({
    queryKey: ['staff-invites', venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venue_staff_invites')
        .select('token, note, created_at, expires_at')
        .eq('venue_id', venueId)
        .is('redeemed_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['venue-people', venueId] });
    qc.invalidateQueries({ queryKey: ['staff-invites', venueId] });
  };
  const link = (token: string) => `${window.location.origin}/staff/${token}`;

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('venue_staff_invites')
      .insert({ venue_id: venueId, note: note.trim() || null })
      .select('token')
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    setNote('');
    refresh();
    if (await copy(link(data.token))) setCopied(data.token);
  }

  async function revoke(token: string) {
    const { error } = await supabase.from('venue_staff_invites').delete().eq('token', token);
    if (error) return setError(error.message);
    refresh();
  }

  async function removePerson(userId: string, name: string) {
    if (!window.confirm(`Remove ${name}? They won't be able to open this venue's calendar any more.`)) return;
    const { error } = await supabase.from('venue_members').delete().eq('venue_id', venueId).eq('user_id', userId);
    if (error) return setError(error.message);
    refresh();
  }

  if (venues.isLoading) return null;
  if (venue?.role !== 'owner') return <p className="text-ink-600">Only the venue's owner can manage staff.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{venue.name}</p>
        <h1 className="text-2xl font-bold text-ink-900">Staff</h1>
        <p className="text-ink-600">
          Staff can use the calendar: add walk-ins and phone bookings, block slots. Only you can change the venue's details,
          courts, rates and photos.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-bold text-ink-900">People with access</h2>
        <ul className="divide-y-2 divide-ink-100 rounded-card border-2 border-ink-200 bg-white">
          {people.data?.map((p) => (
            <li key={p.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{p.email}</p>
                <p className="text-sm text-ink-500">{p.role === 'owner' ? 'Owner' : 'Staff'}</p>
              </div>
              {p.user_id !== session?.user.id && (
                <Button variant="danger" onClick={() => removePerson(p.user_id, p.email)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold text-ink-900">Invite someone</h2>
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <Field label="Who's it for?" hint="Only you see this, to tell invites apart.">
              <TextInput
                placeholder="e.g. Ana, front desk"
                maxLength={80}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" disabled={busy} className="mb-5">
            {busy ? 'Creating…' : 'Create invite link'}
          </Button>
        </form>
        <p className="text-sm text-ink-500">
          Send the link to them yourself (Messenger, Viber, SMS). It works once and expires in 7 days.
        </p>
        <SaveNote error={error} saved={false} />

        {invites.data && invites.data.length > 0 && (
          <ul className="space-y-2">
            {invites.data.map((i) => (
              <li
                key={i.token}
                className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-ink-200 bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{i.note || 'Staff invite'}</p>
                  <p className="truncate text-xs text-ink-500">
                    {link(i.token)} · expires {new Date(i.expires_at).toLocaleDateString()}
                  </p>
                </div>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
