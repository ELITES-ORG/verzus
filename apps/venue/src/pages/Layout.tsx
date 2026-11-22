import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Mark } from '../components/Mark';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { isAdmin, useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useMyVenues } from '../lib/venues';

interface Tab {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

/**
 * The portal's frame. Wider screens: one top bar with the logo, the sections, the theme switch and
 * sign out. Phones: a slim top bar with the logo and the venue's name, and the sections as a tab
 * bar at the bottom (thumb reach); the theme switch and sign out live under Account.
 */
export function Layout() {
  const { session } = useSession();
  const venues = useMyVenues();
  const owned = venues.data?.find((v) => v.role === 'owner');
  const venueName = owned?.name ?? venues.data?.[0]?.name;

  const tabs: Tab[] = [
    { to: '/', label: 'Calendar', icon: ICONS.calendar, end: true },
    ...(owned
      ? [
          { to: `/setup/${owned.venueId}`, label: 'Venue', icon: ICONS.venue },
          { to: `/venues/${owned.venueId}/staff`, label: 'Staff', icon: ICONS.staff },
        ]
      : []),
    ...(isAdmin(session) ? [{ to: '/admin', label: 'Admin', icon: ICONS.admin }] : []),
  ];

  const topLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-control px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`;
  const bottomLink = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${isActive ? 'text-accent' : 'text-fg-3 hover:text-fg'}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <NavLink to="/" aria-label="verzus, calendar" className="shrink-0 rounded-control">
          <Mark className="text-[20px]" />
        </NavLink>
        {venueName && (
          <span className="min-w-0 truncate border-l border-line pl-3 text-sm font-semibold text-fg-2">{venueName}</span>
        )}
        <nav aria-label="Sections" className="ml-4 hidden gap-1 sm:flex">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={topLink}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <ThemeSwitch />
          <button
            type="button"
            className="rounded-control px-2 py-1.5 text-sm font-semibold text-fg-2 hover:bg-surface-2 hover:text-fg"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Phones leave room for the tab bar below. */}
      <main className="flex min-h-0 flex-1 flex-col p-4 pb-24 sm:p-6">
        <Outlet />
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={bottomLink}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
        <NavLink to="/account" className={bottomLink}>
          {ICONS.account}
          Account
        </NavLink>
      </nav>
    </div>
  );
}

/** Account, for phones (wider screens have these in the top bar): theme and signing out. */
export function AccountPage() {
  const { session } = useSession();
  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-lg font-bold text-fg">Account</h1>
      <div className="divide-y divide-line rounded-panel border border-line bg-surface">
        <p className="px-4 py-3 text-sm">
          <span className="block text-xs font-semibold text-fg-3">Signed in as</span>
          <span className="block truncate text-fg">{session?.user.email ?? session?.user.phone ?? '—'}</span>
        </p>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-fg">Theme</span>
          <ThemeSwitch />
        </div>
      </div>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-fg hover:border-violet"
      >
        Sign out
      </button>
    </div>
  );
}

const icon = (d: ReactNode) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-5 w-5 fill-none stroke-current"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

const ICONS = {
  calendar: icon(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>,
  ),
  venue: icon(
    <>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9.5 20v-6h5v6" />
    </>,
  ),
  staff: icon(
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </>,
  ),
  admin: icon(<path d="M12 3.5 5 6.5v5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9v-5z" />),
  account: icon(
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>,
  ),
};
