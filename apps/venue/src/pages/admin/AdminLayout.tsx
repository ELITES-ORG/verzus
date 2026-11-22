import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { supabase } from '../../lib/supabase';

/** verzus admin area. The router only lets admins in; RLS and the admin functions check again. */
export function AdminLayout() {
  // The two queues' sizes, for the tabs (refreshed with the pages that change them).
  const counts = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats').single();
      if (error) throw error;
      return data;
    },
  });
  const accounts = (counts.data?.players_pending ?? 0) + (counts.data?.owners_pending ?? 0);
  const venues = counts.data?.venues_waiting ?? 0;
  const tab = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 border-b-[3px] px-1 pb-2 text-sm font-semibold ${isActive ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg'}`;
  const badge = (n: number) =>
    n > 0 ? <span className="ml-1.5 rounded-chip bg-warn px-1.5 py-0.5 text-[11px] font-bold text-canvas">{n}</span> : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-fg">Admin</h1>
        <nav className="-mx-1 flex gap-6 overflow-x-auto border-b-2 border-line px-1">
          <NavLink to="/admin" end className={tab}>
            Overview
          </NavLink>
          <NavLink to="/admin/accounts" className={tab}>
            Accounts{badge(accounts)}
          </NavLink>
          <NavLink to="/admin/review" className={tab}>
            Venues to review{badge(venues)}
          </NavLink>
          <NavLink to="/admin/venues" className={tab}>
            All venues
          </NavLink>
          <NavLink to="/admin/invites" className={tab}>
            Owner invites
          </NavLink>
          <NavLink to="/admin/disputes" className={tab}>
            Disputes
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
