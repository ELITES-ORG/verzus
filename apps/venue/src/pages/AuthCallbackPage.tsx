import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { safeNext } from '../lib/next';
import { useSession } from '../lib/session';

/**
 * Where emailed links and Google send people back. supabase-js exchanges the ?code= for a
 * session on load; this page waits for it, then continues to `next`.
 */
export function AuthCallbackPage() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const failure = params.get('error_description');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);

  if (session) return <Navigate to={next} replace />;

  const retry = `/sign-in?next=${encodeURIComponent(next)}`;
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="max-w-sm space-y-3 text-center text-ink-700">
        {failure || slow ? (
          <>
            <p className="font-semibold text-ink-900">That sign-in link didn't work here.</p>
            <p className="text-sm">
              Links only work in the browser where you asked for them, and only once. Use the 6-digit code from the same email
              instead.
            </p>
            <Link to={retry} className="inline-block font-semibold text-[#b51f2a] underline">
              Back to sign in
            </Link>
          </>
        ) : (
          <p>Signing you in…</p>
        )}
      </div>
    </div>
  );
}
