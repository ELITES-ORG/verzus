import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Mark } from '../components/Mark';
import { ThemeSwitch } from '../components/ThemeSwitch';
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
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4">
      <ThemeSwitch className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-end gap-2 text-fg">
          <Mark className="text-[30px]" />
          <span className="pb-0.5 text-sm font-medium text-fg-3">for venues</span>
        </p>

        <div className="space-y-5 rounded-panel border border-line bg-surface p-6 shadow-[0_18px_40px_-26px_rgb(var(--scrim)/0.4)]">
          {step === 'email' ? (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-fg">{invited ? 'Sign in to accept your invite' : 'Sign in'}</h1>
                <p className="text-sm text-fg-3">We'll email you a code. No password needed.</p>
              </div>

              {GOOGLE && (
                <>
                  <button
                    type="button"
                    onClick={google}
                    className="w-full rounded-control border border-line-strong py-2.5 font-semibold text-fg hover:bg-surface-2"
                  >
                    Continue with Google
                  </button>
                  <p className="text-center text-xs text-fg-3">or</p>
                </>
              )}

              <form onSubmit={sendCode} className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-fg-2">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full rounded-control border-2 border-line-strong bg-surface px-3 py-2 text-fg placeholder:text-fg-3 focus:border-violet focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-control bg-accent py-2.5 font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Email me a code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-fg">Check your email</h1>
                <p className="text-sm text-fg-3">
                  We sent a 6-digit code to <span className="font-semibold text-fg">{email}</span>. You can also open the link in
                  that email on this device.
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
                  className="w-full rounded-control border-2 border-line-strong bg-surface px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] text-fg placeholder:text-fg-3 focus:border-violet focus:outline-none"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="w-full rounded-control bg-accent py-2.5 font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60"
                >
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
              </form>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-fg-3 hover:text-fg" onClick={() => setStep('email')}>
                  Use a different email
                </button>
                <button type="button" disabled={busy} className="text-fg-3 hover:text-fg" onClick={() => sendCode()}>
                  Send a new code
                </button>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
        {import.meta.env.DEV && (
          <Link to="/dev-login" className="mt-4 block text-center text-sm font-semibold text-fg-3 underline hover:text-fg">
            Dev login (local only)
          </Link>
        )}
      </div>
    </div>
  );
}
