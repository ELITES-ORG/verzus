import type { ReactNode } from 'react';
import type { Setup } from './data';

export interface StepProps {
  setup: Setup;
  refresh: () => Promise<void>;
  next: () => void;
}

/** Title, short explanation and body for one wizard step. */
export function StepFrame({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold text-ink-900">{title}</h2>
        <p className="max-w-prose text-ink-600">{intro}</p>
      </header>
      {children}
    </div>
  );
}
