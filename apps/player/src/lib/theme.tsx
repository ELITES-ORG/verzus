import AsyncStorage from '@react-native-async-storage/async-storage';
import { asVars, dark, light, rgb, type Theme } from '@verzus/tailwind/themes';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, vars } from 'nativewind';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

/**
 * Light and dark for the player app, in the verzus palette (@verzus/tailwind/themes).
 *
 * The theme colours (`bg-surface`, `text-fg`, ...) read CSS variables. NativeWind's documented way
 * to switch them is `vars()` on a parent view, picked by its `useColorScheme()`; the navigator
 * (headers, tab bar, screen backgrounds) gets the same palette through a navigation theme.
 *
 * Until the person picks Light or Dark ("system", the default) the app follows the phone (app.json
 * `userInterfaceStyle: automatic`); a pick is stored on the device and restored on launch.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'verzus-theme';
const VARS = { light: vars(asVars(light)), dark: vars(asVars(dark)) };

function navigationTheme(scheme: 'light' | 'dark') {
  const t: Theme = scheme === 'dark' ? dark : light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: rgb(t, 'accent'), // active tab, header back button
      background: rgb(t, 'canvas'),
      card: rgb(t, 'surface'), // headers and tab bar
      text: rgb(t, 'fg'),
      border: rgb(t, 'line'),
      notification: rgb(t, 'danger'),
    },
  };
}

const ChoiceContext = createContext<[ThemeChoice, (c: ThemeChoice) => void]>(['system', () => {}]);

/** Wraps the app: applies the theme on screen to every themed class and to the navigator. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [choice, setChoice] = useState<ThemeChoice>('system');

  // Restore a stored choice on launch. Until it loads (a moment), the phone's setting shows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on launch.
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((c) => {
        if (c === 'light' || c === 'dark') {
          setChoice(c);
          setColorScheme(c);
        }
      })
      .catch(() => {}); // Unreadable: follow the phone.
  }, []);

  const choose = useCallback(
    (c: ThemeChoice) => {
      setChoice(c);
      setColorScheme(c);
      (c === 'system' ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, c)).catch(() => {});
    },
    [setColorScheme],
  );

  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const nav = useMemo(() => navigationTheme(scheme), [scheme]);
  const value = useMemo<[ThemeChoice, (c: ThemeChoice) => void]>(() => [choice, choose], [choice, choose]);

  return (
    <ChoiceContext.Provider value={value}>
      <ThemeProvider value={nav}>
        {/* Status bar icons follow the theme on screen, not the phone's setting. */}
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <View style={[{ flex: 1 }, VARS[scheme]]}>{children}</View>
      </ThemeProvider>
    </ChoiceContext.Provider>
  );
}

/** The person's choice and a setter, for the Appearance setting. */
export function useThemeChoice() {
  return useContext(ChoiceContext);
}
