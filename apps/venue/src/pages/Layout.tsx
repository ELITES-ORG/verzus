import { NavLink, Outlet } from 'react-router';
import { Mark } from '../components/Mark';
import { isAdmin, useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { useMyVenues } from '../lib/venues';

export function Layout() {
  const { session } = useSession();
  const venues = useMyVenues();
  const owned = venues.data?.find((v) => v.role === 'owner');
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`;

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 border-b border-ink-200 bg-white px-6 py-3">
        <span className="flex items-end gap-2">
          <Mark className="text-[22px]" />
          <span className="text-xs font-medium text-ink-500">for venues</span>
        </span>
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>
            Calendar
          </NavLink>
          {owned && (
            <>
              <NavLink to={`/setup/${owned.venueId}`} className={link}>
                Your venue
              </NavLink>
              <NavLink to={`/venues/${owned.venueId}/staff`} className={link}>
                Staff
              </NavLink>
            </>
          )}
          {isAdmin(session) && (
            <NavLink to="/admin" className={link}>
              Admin
            </NavLink>
          )}
        </nav>
        <button type="button" className="ml-auto text-sm text-ink-500 hover:text-ink-800" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
