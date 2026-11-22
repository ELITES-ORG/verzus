import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AuthCard, AuthError, AuthField, authInput, authLink, authPrimary } from '../components/AuthCard';
import { friendly } from '../lib/auth-errors';
import { callbackUrl, safeNext } from '../lib/next';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

const GOOGLE = import.meta.env.VITE_GOOGLE_SIGN_IN === 'on';

/**
 * Owners and staff sign in with their email and password. Anyone without a password (staff who
 * joined by invite, or someone who forgot theirs) can have a code emailed instead; the link in
 * that email works too, in the browser that asked for it. Google when it's switched on.
 */
export function SignInPage() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'password' | 'email' | 'code'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={next} replace />;

  async function withPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      return setError(
        error.code === 'email_not_confirmed'
          ? 'Confirm your email first: open the link we sent when you registered.'
          : error.status === 400
            ? 'Wrong email or password. No password yet? Get a code by email instead.'
            : friendly(error),
      );
    }
    navigate(next, { replace: true });
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(friendly(error));
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
    if (error) setError(friendly(error));
  }

  const invited = next.startsWith('/join/') || next.startsWith('/staff/');
  const go = (s: typeof step) => {
    setError(null);
    setStep(s);
  };

  const emailField = (
    <AuthField label="Email">
      <input
        type="email"
        required
        autoComplete="email"
        className={authInput}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </AuthField>
  );

  return (
    <AuthCard
      below={
        <>
          {!invited && (
            <p className="mt-4 text-center text-sm text-fg-3">
              New to verzus?{' '}
              <Link to="/register" className={authLink}>
                List your venue
              </Link>
            </p>
          )}
          {import.meta.env.DEV && (
            <Link to="/dev-login" className="mt-3 block text-center text-sm font-semibold text-fg-3 underline hover:text-fg">
              Dev login (local only)
            </Link>
          )}
        </>
      }
    >
      {step === 'password' && (
        <>
          <h1 className="text-xl font-bold text-fg">{invited ? 'Sign in to accept your invite' : 'Sign in'}</h1>
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
          <form onSubmit={withPassword} className="space-y-3">
            {emailField}
            <AuthField label="Password">
              <input
                type="password"
                required
                autoComplete="current-password"
                className={authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </AuthField>
            <button type="submit" disabled={busy} className={authPrimary}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <button type="button" className="text-sm font-semibold text-fg-3 hover:text-fg" onClick={() => go('email')}>
            No password, or forgot it? Email me a code
          </button>
        </>
      )}

      {step === 'email' && (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-fg">Sign in with a code</h1>
            <p className="text-sm text-fg-3">We'll email you a 6-digit code.</p>
          </div>
          <form onSubmit={sendCode} className="space-y-3">
            {emailField}
            <button type="submit" disabled={busy} className={authPrimary}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
          <button type="button" className="text-sm font-semibold text-fg-3 hover:text-fg" onClick={() => go('password')}>
            Sign in with a password instead
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-fg">Check your email</h1>
            <p className="text-sm text-fg-3">
              We sent a 6-digit code to <span className="font-semibold text-fg">{email}</span>. You can also open the link in that
              email on this device.
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
              className={`${authInput} text-center font-mono text-2xl tracking-[0.4em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" disabled={busy || code.length !== 6} className={authPrimary}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-fg-3 hover:text-fg" onClick={() => go('email')}>
              Use a different email
            </button>
            <button type="button" disabled={busy} className="text-fg-3 hover:text-fg" onClick={() => sendCode()}>
              Send a new code
            </button>
          </div>
        </>
      )}

      {error && <AuthError>{error}</AuthError>}
    </AuthCard>
  );
}
