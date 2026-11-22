/**
 * The verzus wordmark: the v mark (brand/verzus-mark.svg) followed by "erzus" in Dela Gothic One.
 * Size it with font-size, like text.
 */
export function Mark({
  className = '',
  onDark = false,
}: {
  className?: string;
  /** Always on a dark ground (white text). Otherwise the text follows the theme. */
  onDark?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="verzus"
      className={`inline-block whitespace-nowrap leading-none tracking-[-0.02em] ${onDark ? 'text-white' : 'text-fg'} ${className}`}
      style={{ fontFamily: "'Dela Gothic One', system-ui, sans-serif" }}
    >
      <svg viewBox="0 94 698 546" aria-hidden="true" className="mr-[0.02em] inline-block h-[0.546em] w-[0.698em] align-baseline">
        <path fill="#22c55e" d="M0 94L235 94L389 640L193 640Q103 367 0 94Z" />
        {/* The second bar: violet, deep on light grounds and lavender on dark ones. */}
        <path className={onDark ? 'fill-[#b8b3ff]' : 'fill-violet'} d="M466 94L698 94Q590 385 506 640L389 640L351 506Z" />
      </svg>
      erzus
    </span>
  );
}

/**
 * The v mark alone, in its colours, as tall as a capital letter of the text around it (the `cap`
 * unit), e.g. "Enter [v]erzus". `ground` is the colour it sits on: the violet bar is deep on light
 * grounds and lavender on dark ones (brand/README.md). Never on green: its green bar would vanish.
 */
export function VGlyph({ ground, className = '' }: { ground: 'light' | 'dark'; className?: string }) {
  return (
    <svg
      viewBox="0 94 698 546"
      aria-hidden="true"
      className={`inline-block h-[1cap] w-[calc(1cap*698/546)] align-baseline ${className}`}
    >
      <path fill="#22c55e" d="M0 94L235 94L389 640L193 640Q103 367 0 94Z" />
      <path fill={ground === 'dark' ? '#b8b3ff' : '#5a4fd8'} d="M466 94L698 94Q590 385 506 640L389 640L351 506Z" />
    </svg>
  );
}
