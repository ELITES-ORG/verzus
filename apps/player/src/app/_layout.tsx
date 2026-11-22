import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useMyAccount } from '@/lib/account';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeRoot } from '@/lib/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeRoot>
          <AccountGate />
          {/* Header and tab tints come from the navigation theme (lib/theme.tsx). */}
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
            <Stack.Screen name="register" options={{ title: 'Create your account' }} />
            <Stack.Screen name="review" options={{ title: 'Your account', headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="dev-login" options={{ title: 'Dev login' }} />
            <Stack.Screen name="m/[matchId]" options={{ title: 'Match' }} />
          </Stack>
        </ThemeRoot>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Until verzus approves a signed-in account, the app shows only where it stands (/review). The
 * database enforces the same: an unapproved player can't book, join matches or add allies.
 */
function AccountGate() {
  const { session } = useSession();
  const account = useMyAccount();
  const path = usePathname();
  // Known only once the review has loaded; until then nothing moves.
  const state = !session ? 'signed-out' : !account.isSuccess ? 'loading' : account.data?.status === 'approved' ? 'in' : 'waiting';
  useEffect(() => {
    if (state === 'waiting' && path !== '/review') router.replace('/review');
    if ((state === 'in' || state === 'signed-out') && path === '/review') router.replace('/');
  }, [state, path]);
  return null;
}
