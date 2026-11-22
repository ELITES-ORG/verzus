import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import './fonts.css';
import './index.css';
import { isAdmin, SessionProvider, useSession } from './lib/session';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { JoinPage } from './pages/JoinPage';
import { AccountPage, Layout } from './pages/Layout';
import { SignInPage } from './pages/SignInPage';
import { StaffJoinPage } from './pages/StaffJoinPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

/** Signed-out visitors go to sign-in, then come back to where they were heading (e.g. an invite). */
function RequireSession() {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return null;
  if (session) return <Outlet />;
  const next = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/sign-in?next=${next}`} replace />;
}

function RequireAdmin() {
  const { session } = useSession();
  return isAdmin(session) ? <Outlet /> : <Navigate to="/" replace />;
}

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  // Development only: Vite replaces import.meta.env.DEV with false in production builds, so this
  // route and the page it loads are left out of them entirely.
  ...(import.meta.env.DEV
    ? [{ path: '/dev-login', lazy: async () => ({ Component: (await import('./pages/DevLoginPage')).DevLoginPage }) }]
    : []),
  {
    element: <RequireSession />,
    children: [
      { path: '/join/:token', element: <JoinPage /> },
      { path: '/staff/:token', element: <StaffJoinPage /> },
      // Venue onboarding is full-screen, outside the portal chrome. It carries the map library and
      // Motion, so it loads only when an owner opens it.
      {
        path: '/setup/:venueId',
        lazy: async () => ({ Component: (await import('./pages/onboarding/OnboardingPage')).OnboardingPage }),
      },
      {
        element: <Layout />,
        children: [
          // Loaded on demand: FullCalendar is most of the bundle, and sign-in shouldn't wait for it.
          { index: true, lazy: async () => ({ Component: (await import('./pages/CalendarPage')).CalendarPage }) },
          { path: 'account', element: <AccountPage /> },
          { path: 'venues/:venueId/staff', lazy: async () => ({ Component: (await import('./pages/StaffPage')).StaffPage }) },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              {
                lazy: async () => ({ Component: (await import('./pages/admin/AdminLayout')).AdminLayout }),
                children: [
                  { index: true, lazy: async () => ({ Component: (await import('./pages/admin/VenuesPage')).ReviewQueuePage }) },
                  { path: 'venues', lazy: async () => ({ Component: (await import('./pages/admin/VenuesPage')).AllVenuesPage }) },
                  {
                    path: 'venues/:venueId',
                    lazy: async () => ({ Component: (await import('./pages/admin/VenueReviewPage')).VenueReviewPage }),
                  },
                  { path: 'invites', lazy: async () => ({ Component: (await import('./pages/admin/InvitesPage')).InvitesPage }) },
                  {
                    path: 'disputes',
                    lazy: async () => ({ Component: (await import('./pages/admin/DisputesPage')).DisputesPage }),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
