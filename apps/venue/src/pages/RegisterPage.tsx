import { isEmail, passwordProblem } from '@verzus/schemas/account';
import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { AuthCard, AuthError, AuthField, authInput, authLink, authPrimary } from '../components/AuthCard';
import { friendly } from '../lib/auth-errors';
import { callbackUrl } from '../lib/next';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

/**
 * /register: a venue owner creates their account with an email and a password, then names their
 * venue (/start) and goes straight into onboarding. When the project asks for email confirmation,
 * the confirmation link brings them back to /start.
 */
export function RegisterPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (session && !sentTo) return <Navigate to="/start" replace />;

  const problems = {
    email: isEmail(email) ? null : 'Enter your email address.',
    password: passwordProblem(password),
    confirm: confirm === password ? null : "The passwords don't match.",
  };
  const ok = !problems.email && !problems.password && !problems.confirm;
  // Show what's wrong once they try to continue; the password rule shows as a hint before that.
  const show = (k: keyof typeof problems) => (tried ? problems[k] : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callbackUrl('/start') },
    });
    setBusy(false);
    if (error) {
      return setError(
        error.code === 'user_already_exists' ? 'An account with this email already exists. Sign in instead.' : friendly(error),
      );
    }
    // With email confirmation on, an existing email comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      return setError('An account with this email already exists. Sign in instead.');
    }
    if (data.session) return navigate('/start', { replace: true });
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthCard>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-fg">Confirm your email</h1>
          <p className="text-sm text-fg-2">
            We sent a link to <span className="font-semibold text-fg">{sentTo}</span>. Open it on this device to continue setting
            up your venue.
          </p>
          <p className="text-sm text-fg-3">Nothing there? Check your spam folder.</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      below={
        <p className="mt-4 text-center text-sm text-fg-3">
          Already have an account?{' '}
          <Link to="/sign-in" className={authLink}>
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-fg">List your venue on verzus</h1>
        <p className="text-sm text-fg-3">Create your account, then set up your venue. We review it before it goes live.</p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-3">
        <AuthField label="Email" problem={show('email')}>
          <input
            type="email"
            autoComplete="email"
            className={authInput}
            aria-invalid={Boolean(show('email'))}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>
        <AuthField label="Password" problem={show('password')} hint="At least 8 characters.">
          <input
            type="password"
            autoComplete="new-password"
            className={authInput}
            aria-invalid={Boolean(show('password'))}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>
        <AuthField label="Confirm password" problem={show('confirm')}>
          <input
            type="password"
            autoComplete="new-password"
            className={authInput}
            aria-invalid={Boolean(show('confirm'))}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </AuthField>
        <button type="submit" disabled={busy} className={authPrimary}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
      {error && <AuthError>{error}</AuthError>}
    </AuthCard>
  );
}
