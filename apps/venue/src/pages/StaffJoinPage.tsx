import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Mark } from '../components/Mark';
import { supabase } from '../lib/supabase';

/** /staff/<token>: someone accepting a staff invite (signed in first via RequireSession). */
export function StaffJoinPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('redeem_staff_invite', { p_token: token });
    setBusy(false);
    if (error) {
      setError(
        error.code === 'P0002' || error.code === '22P02'
          ? 'This invite link has expired or was already used. Ask the venue owner for a new one.'
          : error.message,
      );
      return;
    }
    await qc.invalidateQueries({ queryKey: ['my-venues'] });
    navigate(`/?venue=${data}`, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-end gap-2">
          <Mark className="text-[30px]" />
          <span className="pb-0.5 text-sm font-medium text-ink-500">for venues</span>
        </p>
        <div className="space-y-5 rounded-card border-[3px] border-ink-900 bg-white p-6 shadow-[6px_7px_0_#b8b3ff]">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-ink-900">You're invited to help run a venue</h1>
            <p className="text-sm text-ink-500">
              You'll be able to use its calendar: walk-ins, phone bookings and blocked slots.
            </p>
          </div>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="w-full rounded-lg bg-ink-900 py-2.5 font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
          >
            {busy ? 'Joining…' : 'Accept invite'}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-[#b51f2a]">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
