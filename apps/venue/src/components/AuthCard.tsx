import type { ReactNode } from 'react';
import { Mark } from './Mark';
import { ThemeSwitch } from './ThemeSwitch';

/** The look shared by sign-in, registration and "name your venue": the logo over one card. */
export function AuthCard({ children, below }: { children: ReactNode; below?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <ThemeSwitch className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-end gap-2 text-fg">
          <Mark className="text-[30px]" />
          <span className="pb-0.5 text-sm font-medium text-fg-3">for venues</span>
        </p>
        <div className="space-y-5 rounded-panel border border-line bg-surface p-6 shadow-[0_18px_40px_-26px_rgb(var(--scrim)/0.4)]">
          {children}
        </div>
        {below}
      </div>
    </div>
  );
}

export const authInput =
  'w-full rounded-control border-2 border-line-strong bg-surface px-3 py-2 text-fg placeholder:text-fg-3 focus:border-violet focus:outline-none aria-[invalid=true]:border-danger';
export const authPrimary =
  'w-full rounded-control bg-accent py-2.5 font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50';
export const authLink = 'font-semibold text-fg underline underline-offset-2 hover:text-violet';

/** A labelled field with an optional message under it (red when it's a problem). */
export function AuthField(props: { label: string; children: ReactNode; problem?: string | null; hint?: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children.
    <label className="block space-y-1">
      <span className="text-sm font-medium text-fg-2">{props.label}</span>
      {props.children}
      {props.problem ? (
        <span className="block text-xs font-semibold text-danger">{props.problem}</span>
      ) : props.hint ? (
        <span className="block text-xs text-fg-3">{props.hint}</span>
      ) : null}
    </label>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-danger">
      {children}
    </p>
  );
}
