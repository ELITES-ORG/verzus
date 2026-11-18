import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Small set of form pieces so every portal screen looks and behaves the same. */

const inputBase =
  'w-full rounded-lg border-2 border-ink-200 bg-white px-3 py-2 text-ink-900 focus:border-ink-900 focus:outline-none disabled:bg-ink-50';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children.
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-ink-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
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

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  const look = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800',
    secondary: 'border-2 border-ink-900 text-ink-900 hover:bg-ink-50',
    danger: 'text-[#b51f2a] hover:bg-[#fdecee]',
  }[variant];
  return (
    <button
      type={type}
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    />
  );
}

/** Inline result of a save: an error, or a short confirmation. */
export function SaveNote({ error, saved }: { error: string | null; saved: boolean }) {
  if (error)
    return (
      <p role="alert" className="text-sm font-medium text-[#b51f2a]">
        {error}
      </p>
    );
  if (saved)
    return (
      <p role="status" className="text-sm font-medium text-ink-600">
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
      className="w-[min(92vw,420px)] rounded-card border-[3px] border-ink-900 p-0 shadow-[6px_7px_0_#b8b3ff] backdrop:bg-ink-900/40"
    >
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function StatusPill({ status }: { status: 'draft' | 'submitted' | 'live' | 'suspended' }) {
  const look = {
    draft: 'bg-ink-100 text-ink-700',
    submitted: 'bg-[#fff4d6] text-[#7a5a00]',
    live: 'bg-[#e5f6ea] text-[#1f6b35]',
    suspended: 'bg-[#fdecee] text-[#b51f2a]',
  }[status];
  const text = { draft: 'Draft', submitted: 'Waiting for review', live: 'Live', suspended: 'Suspended' }[status];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${look}`}>{text}</span>;
}
