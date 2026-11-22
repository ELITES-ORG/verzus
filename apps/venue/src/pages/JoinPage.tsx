import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Mark } from '../components/Mark';
import { supabase } from '../lib/supabase';

/**
 * /join/<token>: an owner opening their invite link. Signing in happens first (the route is
 * behind RequireSession); here they name their venue, which creates it as a draft they own.
 */
export function JoinPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('redeem_venue_invite', { p_token: token, p_venue_name: name.trim() });
    setBusy(false);
    if (error) {
      setError(
        error.code === 'P0002' || error.code === '22P02'
          ? 'This invite link has expired or was already used. Ask verzus for a new one.'
          : error.message,
      );
      return;
    }
    navigate(`/setup/${data}`, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-end gap-2">
          <Mark className="text-[30px]" />
          <span className="pb-0.5 text-sm font-medium text-fg-3">for venues</span>
        </p>
        <form
          onSubmit={create}
          className="space-y-5 rounded-panel border border-line bg-surface p-6 shadow-[0_18px_40px_-26px_rgb(var(--scrim)/0.4)]"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-fg">You're invited to list your venue</h1>
            <p className="text-sm text-fg-3">
              Start with its name. You'll add the address, courts, rates, hours and photos next, then send it to us to review.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-fg-2">Venue name</span>
            <input
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Smash Hall BGC"
              className="w-full rounded-control border-2 border-line px-3 py-2 focus:border-line-strong focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="w-full rounded-control bg-accent py-2.5 font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create my venue'}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
