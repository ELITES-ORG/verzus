import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router';
import { supabase } from '../../lib/supabase';

/** verzus admin area. The router only lets admins in; RLS enforces it again on every query. */
export function AdminLayout() {
  const waiting = useQuery({
    queryKey: ['admin', 'waiting-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('venues')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted');
      if (error) throw error;
      return count ?? 0;
    },
  });
  const tab = ({ isActive }: { isActive: boolean }) =>
    `border-b-[3px] px-1 pb-2 text-sm font-semibold ${isActive ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg'}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-fg">Admin</h1>
        <nav className="flex gap-6 border-b-2 border-line">
          <NavLink to="/admin" end className={tab}>
            Review{waiting.data ? ` (${waiting.data})` : ''}
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
