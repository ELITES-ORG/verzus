import { setTheme, useShownTheme } from '../lib/theme';

const CHOICES = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4Z" />,
  },
] as const;

/**
 * Light or dark, as two small icon buttons. Until the person picks one, the app follows the
 * device's setting and the switch shows whichever theme that is; a pick is kept from then on.
 */
export function ThemeSwitch({ className = '' }: { className?: string }) {
  const shown = useShownTheme();
  return (
    <fieldset className={`flex rounded-control border border-line bg-surface-2 p-0.5 ${className}`}>
      <legend className="sr-only">Theme</legend>
      {CHOICES.map((c) => (
        <label key={c.value} title={c.label} className="cursor-pointer">
          <input
            type="radio"
            name="verzus-theme"
            value={c.value}
            checked={shown === c.value}
            onChange={() => setTheme(c.value)}
            className="peer sr-only"
          />
          <span className="sr-only">{c.label}</span>
          <span
            aria-hidden="true"
            className="grid h-7 w-8 place-items-center rounded-chip text-fg-3 transition-colors hover:text-fg peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-violet"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {c.icon}
            </svg>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
