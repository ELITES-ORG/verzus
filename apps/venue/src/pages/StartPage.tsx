import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthCard, AuthError, AuthField, authInput, authLink, authPrimary } from '../components/AuthCard';
import { friendly } from '../lib/auth-errors';
import { supabase } from '../lib/supabase';
import { useMyVenues } from '../lib/venues';

/**
 * /start: a signed-in owner names their venue; that creates it as a draft they own, and onboarding
 * takes over. Someone who already owns a venue can pick up where they left off instead.
 */
export function StartPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const venues = useMyVenues();
  const owned = venues.data?.filter((v) => v.role === 'owner') ?? [];
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('create_my_venue', { p_venue_name: name.trim() });
    setBusy(false);
    if (error) return setError(error.code === '23514' ? error.message.replace(/^./, (c) => c.toUpperCase()) : friendly(error));
    await qc.invalidateQueries({ queryKey: ['my-venues'] });
    navigate(`/setup/${data}`, { replace: true });
  }

  if (venues.isLoading) return null;

  return (
    <AuthCard
      below={
        <p className="mt-4 text-center text-sm text-fg-3">
          <Link to="/" className={authLink}>
            Go to your dashboard
          </Link>
        </p>
      }
    >
      {owned.length > 0 && (
        <div className="space-y-2 border-b border-line pb-5">
          <p className="text-sm font-semibold text-fg-2">Continue setting up</p>
          {owned.map((v) => (
            <Link
              key={v.venueId}
              to={`/setup/${v.venueId}`}
              className="flex items-center justify-between rounded-control border border-line-strong px-3 py-2.5 font-semibold text-fg hover:border-violet"
            >
              {v.name}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}
      <form onSubmit={create} className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-fg">{owned.length ? 'Add another venue' : "What's your venue called?"}</h1>
          <p className="text-sm text-fg-3">
            You'll add the address, courts, rates, hours and photos next, then send it to us to review.
          </p>
        </div>
        <AuthField label="Venue name">
          <input
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. Smash Hall BGC"
            className={authInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </AuthField>
        <button type="submit" disabled={busy || name.trim().length < 2} className={authPrimary}>
          {busy ? 'Creating…' : 'Start setting up'}
        </button>
      </form>
      {error && <AuthError>{error}</AuthError>}
    </AuthCard>
  );
}
