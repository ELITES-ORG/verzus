import { useSyncExternalStore } from 'react';

/**
 * Light or dark. Until the person picks one ("system", the default) the app follows the device;
 * a pick is stored in this browser and set as `data-theme` on <html>, which the theme variables
 * read (webTheme in @verzus/tailwind/theme-plugin). index.html applies it before the first paint.
 * The switch (ThemeSwitch) offers Light and Dark only.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'verzus-theme';
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system'; // storage blocked (private window): follow the device
  }
}

export function setTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Not stored: the choice still holds until the page reloads.
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      setTheme(read());
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, read, () => 'system' as ThemeChoice);
  return [choice, setTheme];
}

const DARK = '(prefers-color-scheme: dark)';

/** The theme on screen right now: the person's choice, or the device's when they haven't chosen. */
export function shownTheme(): 'light' | 'dark' {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia(DARK).matches ? 'dark' : 'light';
}

function subscribeShown(onChange: () => void) {
  const unsubscribe = subscribe(onChange);
  const mq = window.matchMedia(DARK);
  mq.addEventListener('change', onChange);
  return () => {
    unsubscribe();
    mq.removeEventListener('change', onChange);
  };
}

/** For things CSS can't theme (map tiles, canvas): 'light' or 'dark', updating when either changes. */
export function useShownTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeShown, shownTheme, () => 'light' as const);
}
