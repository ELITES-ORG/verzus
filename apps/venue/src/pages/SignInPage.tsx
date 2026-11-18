import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Mark } from '../components/Mark';
import { callbackUrl, safeNext } from '../lib/next';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

const GOOGLE = import.meta.env.VITE_GOOGLE_SIGN_IN === 'on';

/**
 * Venue owners and staff sign in with an emailed code (or the link in the same email), or Google.
 * The code works on any device; the link only in the browser that asked for it.
 */
export function SignInPage() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={next} replace />;

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep('code');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setError("That code didn't work. Check it, or send a new one.");
    navigate(next, { replace: true });
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl(next) } });
    if (error) setError(error.message);
  }

  const invited = next.startsWith('/join/') || next.startsWith('/staff/');

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-end gap-2 text-ink-900">
          <Mark className="text-[30px]" />
          <span className="pb-0.5 text-sm font-medium text-ink-500">for venues</span>
        </p>

        <div className="space-y-5 rounded-card border-[3px] border-ink-900 bg-white p-6 shadow-[6px_7px_0_#b8b3ff]">
          {step === 'email' ? (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-ink-900">{invited ? 'Sign in to accept your invite' : 'Sign in'}</h1>
                <p className="text-sm text-ink-500">We'll email you a code. No password needed.</p>
              </div>

              {GOOGLE && (
                <>
                  <button
                    type="button"
                    onClick={google}
                    className="w-full rounded-lg border-2 border-ink-900 py-2.5 font-semibold text-ink-900 hover:bg-ink-50"
                  >
                    Continue with Google
                  </button>
                  <p className="text-center text-xs text-ink-400">or</p>
                </>
              )}

              <form onSubmit={sendCode} className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-ink-700">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full rounded-lg border-2 border-ink-200 px-3 py-2 focus:border-ink-900 focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-ink-900 py-2.5 font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Email me a code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-ink-900">Check your email</h1>
                <p className="text-sm text-ink-500">
                  We sent a 6-digit code to <span className="font-semibold text-ink-800">{email}</span>. You can also open the
                  link in that email on this device.
                </p>
              </div>
              <form onSubmit={verify} className="space-y-3">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="123456"
                  aria-label="6-digit code"
                  className="w-full rounded-lg border-2 border-ink-200 px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] focus:border-ink-900 focus:outline-none"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="w-full rounded-lg bg-ink-900 py-2.5 font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                >
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
              </form>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-ink-500 hover:text-ink-900" onClick={() => setStep('email')}>
                  Use a different email
                </button>
                <button type="button" disabled={busy} className="text-ink-500 hover:text-ink-900" onClick={() => sendCode()}>
                  Send a new code
                </button>
              </div>
            </>
          )}

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
