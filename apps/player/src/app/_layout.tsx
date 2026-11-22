import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SessionProvider } from '@/lib/session';
import { ThemeRoot } from '@/lib/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeRoot>
          {/* Header and tab tints come from the navigation theme (lib/theme.tsx). */}
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
            <Stack.Screen name="register" options={{ title: 'Create your account' }} />
            <Stack.Screen name="dev-login" options={{ title: 'Dev login' }} />
            <Stack.Screen name="m/[matchId]" options={{ title: 'Match' }} />
          </Stack>
        </ThemeRoot>
      </SessionProvider>
    </QueryClientProvider>
  );
}
