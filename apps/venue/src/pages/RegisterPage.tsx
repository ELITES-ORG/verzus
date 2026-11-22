import { isEmail, ownerSignUpData, passwordProblem } from '@verzus/schemas/account';
import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { AuthCard, AuthError, AuthField, authInput, authLink, authPrimary } from '../components/AuthCard';
import { emptyOwnerForm, OwnerDetailsFields, type OwnerForm, ownerFormProblems } from '../components/OwnerDetailsFields';
import { friendly } from '../lib/auth-errors';
import { callbackUrl } from '../lib/next';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

/**
 * /register: a venue owner creates their account in two short steps: email and password, then
 * their name and mobile number (verzus reviews every account before it can be used). After the
 * email is confirmed they wait for approval, then name their venue at /start.
 */
export function RegisterPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<'account' | 'details'>('account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [owner, setOwner] = useState<OwnerForm>(emptyOwnerForm);
  const [tried, setTried] = useState({ account: false, details: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (session && !sentTo) return <Navigate to="/start" replace />;

  const problems = {
    email: isEmail(email) ? null : 'Enter your email address.',
    password: passwordProblem(password),
    confirm: confirm === password ? null : "The passwords don't match.",
  };
  const accountOk = !problems.email && !problems.password && !problems.confirm;
  const detailsOk = Object.values(ownerFormProblems(owner)).every((p) => !p);
  // Show what's wrong once they try to continue; the password rule shows as a hint before that.
  const show = (k: keyof typeof problems) => (tried.account ? problems[k] : null);

  function next(e: FormEvent) {
    e.preventDefault();
    setTried((t) => ({ ...t, account: true }));
    if (accountOk) {
      setError(null);
      setStep('details');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried((t) => ({ ...t, details: true }));
    if (!detailsOk) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callbackUrl('/start'), data: ownerSignUpData(owner) },
    });
    setBusy(false);
    const exists = 'An account with this email already exists. Sign in instead.';
    if (error) {
      setStep('account');
      return setError(error.code === 'user_already_exists' ? exists : friendly(error));
    }
    // With email confirmation on, an existing email comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      setStep('account');
      return setError(exists);
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
            We sent a link to <span className="font-semibold text-fg">{sentTo}</span>. Open it on this device. Then we'll review
            your account, and you can set up your venue once it's approved.
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
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-3">Step {step === 'account' ? 1 : 2} of 2</p>
        <h1 className="text-xl font-bold text-fg">{step === 'account' ? 'List your venue on verzus' : 'About you'}</h1>
        <p className="text-sm text-fg-3">
          {step === 'account'
            ? 'Create your account. We review every account, then every venue, before it goes live.'
            : 'So we know who runs the venue. Only verzus sees these.'}
        </p>
      </div>

      {step === 'account' ? (
        <form onSubmit={next} noValidate className="space-y-3">
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
          <button type="submit" className={authPrimary}>
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <OwnerDetailsFields value={owner} onChange={setOwner} showProblems={tried.details} />
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep('account')}
              className="rounded-control border-2 border-line-strong bg-surface px-4 font-semibold text-fg hover:border-violet"
            >
              Back
            </button>
            <button type="submit" disabled={busy} className={authPrimary}>
              {busy ? 'Creating your account…' : 'Create account'}
            </button>
          </div>
        </form>
      )}
      {error && <AuthError>{error}</AuthError>}
    </AuthCard>
  );
}
