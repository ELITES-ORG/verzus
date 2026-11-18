/**
 * Where to go after signing in. Only paths inside this portal are allowed, so a crafted
 * sign-in link can't bounce someone to another site.
 */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  if (!raw?.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

/** The callback URL an emailed link or Google sends the owner back to. */
export function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
