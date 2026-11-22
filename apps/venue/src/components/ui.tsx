import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * Small set of form pieces so every portal screen looks and behaves the same. Colours come from
 * the theme (@verzus/tailwind/theme.css), so they work in light and dark.
 */

const inputBase =
  'w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-fg placeholder:text-fg-3 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/25 disabled:bg-surface-2 disabled:text-fg-3';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children.
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-fg">{label}</span>
      {children}
      {hint && <span className="block text-xs text-fg-3">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} min-h-24 ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' };

/** Green for the main action, an outlined surface for the rest, red text for what deletes or stops. */
export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  const look = {
    primary: 'bg-accent text-on-accent shadow-[0_8px_22px_-14px_rgb(var(--accent)/0.8)] hover:bg-accent-hover',
    secondary: 'border border-line-strong bg-surface text-fg hover:border-violet',
    danger: 'border border-danger/40 bg-surface text-danger hover:bg-danger-soft',
  }[variant];
  return (
    <button
      type={type}
      {...props}
      className={`rounded-control px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/50 disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    />
  );
}

/** Inline result of a save: an error, or a short confirmation. */
export function SaveNote({ error, saved }: { error: string | null; saved: boolean }) {
  if (error)
    return (
      <p role="alert" className="text-sm font-medium text-danger">
        {error}
      </p>
    );
  if (saved)
    return (
      <p role="status" className="text-sm font-medium text-accent">
        Saved.
      </p>
    );
  return null;
}

/**
 * Modal dialog on the native <dialog> element (focus is kept inside, Esc closes it).
 * Rendered only while open.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the backdrop; Esc closes the dialog natively.
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className="w-[min(92vw,420px)] rounded-panel border border-line bg-surface p-0 text-fg shadow-[0_24px_60px_-20px_rgb(var(--scrim)/0.5)] backdrop:bg-scrim/50 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold text-fg">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

/**
 * A venue's status as a solid tag in the colour of what it means: green live, amber waiting for
 * review, red suspended, neutral draft. Text uses the colour that reads on each fill in both themes.
 */
export function StatusPill({ status }: { status: 'draft' | 'submitted' | 'live' | 'suspended' }) {
  const look = {
    draft: 'bg-line-strong text-fg',
    submitted: 'bg-warn text-surface',
    live: 'bg-accent text-on-accent',
    suspended: 'bg-danger text-surface',
  }[status];
  const text = { draft: 'Draft', submitted: 'Waiting for review', live: 'Live', suspended: 'Suspended' }[status];
  return (
    <span className={`inline-flex h-[22px] items-center rounded-chip px-2 text-xs font-semibold leading-none ${look}`}>
      {text}
    </span>
  );
}
