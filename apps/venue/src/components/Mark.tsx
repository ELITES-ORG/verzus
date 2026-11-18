/**
 * The verzus wordmark: the v mark (brand/verzus-mark.svg) followed by "erzus" in Dela Gothic One.
 * Size it with font-size, like text.
 */
export function Mark({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span
      role="img"
      aria-label="verzus"
      className={`inline-block whitespace-nowrap leading-none tracking-[-0.02em] ${onDark ? 'text-white' : 'text-ink-900'} ${className}`}
      style={{ fontFamily: "'Dela Gothic One', system-ui, sans-serif" }}
    >
      <svg viewBox="0 94 698 546" aria-hidden="true" className="mr-[0.02em] inline-block h-[0.546em] w-[0.698em] align-baseline">
        <path fill="#dd2b37" d="M0 94L235 94L389 640L193 640Q103 367 0 94Z" />
        <path fill={onDark ? '#b8b3ff' : '#5a4fd8'} d="M466 94L698 94Q590 385 506 640L389 640L351 506Z" />
      </svg>
      erzus
    </span>
  );
}
