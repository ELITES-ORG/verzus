import { motion, type Transition } from 'motion/react';

/**
 * Animated scene icons for venue onboarding. Each draws itself in once when its scene opens
 * (line art in the brand's 3.2 stroke), plays one signature move, then rests. With reduced
 * motion, MotionConfig in the onboarding shell turns these into instant final states.
 */

// Colours are theme classes: lines in violet (stroke-violet), accents in green (stroke-accent,
// fill-accent), fills that should read as "background" in canvas. The logo uses its own colours.
const draw = (delay = 0, duration = 0.7): Transition => ({
  pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] },
  opacity: { delay, duration: 0.01 },
});
const line = { fill: 'none', strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const Draw = (props: React.ComponentProps<typeof motion.path> & { delay?: number; dur?: number }) => {
  const { delay = 0, dur = 0.7, className = 'stroke-violet', ...rest } = props;
  return (
    <motion.path
      {...line}
      className={className}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={draw(delay, dur)}
      {...rest}
    />
  );
};

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 120 120" className="h-14 w-14 shrink-0 sm:h-28 sm:w-28" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** The verzus mark: the two bars slide in from either side and clash. */
export function WelcomeIcon() {
  const spring = { type: 'spring', stiffness: 420, damping: 18 } as const;
  return (
    <Frame label="verzus">
      <g transform="translate(14 26) scale(0.132)">
        <motion.path
          d="M0 94L235 94L389 640L193 640Q103 367 0 94Z"
          className="fill-mark"
          initial={{ x: -520, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.15 }}
        />
        <motion.path
          d="M466 94L698 94Q590 385 506 640L389 640L351 506Z"
          className="fill-violet"
          initial={{ x: 520, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.15 }}
        />
      </g>
      {/* Impact lines where the bars meet. */}
      {[
        [60, 18, 60, 8],
        [44, 22, 38, 14],
        [76, 22, 82, 14],
      ].map(([x1, y1, x2, y2], i) => (
        <motion.line
          key={`${x1}-${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className="stroke-accent"
          strokeWidth={3.2}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.45 + i * 0.05, duration: 0.25 }}
        />
      ))}
    </Frame>
  );
}

/** A signboard on two posts swings into place, then its lettering draws. */
export function BasicsIcon() {
  return (
    <Frame label="Venue details">
      <Draw d="M36 108V60M84 108V60" delay={0.05} dur={0.4} />
      <motion.g
        style={{ originX: '60px', originY: '40px' }}
        initial={{ rotate: -14, y: -16, opacity: 0 }}
        animate={{ rotate: 0, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 9, delay: 0.25 }}
      >
        <rect x="18" y="28" width="84" height="38" rx="6" className="fill-canvas stroke-violet" strokeWidth={3.2} />
        <Draw d="M30 41H78" delay={0.6} dur={0.35} className="stroke-accent" />
        <Draw d="M30 53H62" delay={0.75} dur={0.3} />
      </motion.g>
    </Frame>
  );
}

/** A folded map draws in; a pin drops onto it and sends out a ripple. */
export function LocationIcon() {
  return (
    <Frame label="Location">
      <Draw d="M14 44L42 34L78 46L106 36V94L78 104L42 92L14 102Z" dur={0.8} />
      <Draw d="M42 34V92M78 46V104" delay={0.4} dur={0.4} />
      <motion.ellipse
        cx="60"
        cy="84"
        rx="16"
        ry="6"
        fill="none"
        className="stroke-accent"
        strokeWidth={2.4}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.3], opacity: [0, 0.9, 0] }}
        transition={{ delay: 1.05, duration: 0.9, ease: 'easeOut' }}
      />
      <motion.g
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.75 }}
      >
        <path
          d="M60 84C60 84 40 62 40 48A20 20 0 0 1 80 48C80 62 60 84 60 84Z"
          className="fill-accent stroke-canvas"
          strokeWidth={2.4}
        />
        <circle cx="60" cy="48" r="7" fill="#ffffff" />
      </motion.g>
    </Frame>
  );
}

/** A court draws itself in perspective; a shuttle arcs over the net. */
export function CourtsIcon() {
  return (
    <Frame label="Courts">
      <Draw d="M22 104L98 104L84 34L36 34Z" dur={0.8} />
      <Draw d="M60 34V104M29 69H91" delay={0.45} dur={0.45} />
      <Draw d="M26 62V76M94 62V76" delay={0.7} dur={0.25} className="stroke-accent" />
      <motion.g
        initial={{ x: -34, y: 6, opacity: 0, rotate: -30 }}
        animate={{ x: [-34, 0, 34], y: [6, -30, 6], opacity: [0, 1, 1], rotate: [-30, 0, 30] }}
        transition={{ delay: 0.95, duration: 1.1, ease: 'easeInOut', times: [0, 0.5, 1] }}
      >
        <circle cx="60" cy="56" r="4.5" fill="#ffffff" />
        <path d="M57 52L53 44M60 51.5V43M63 52L67 44" className="stroke-violet" strokeWidth={2} strokeLinecap="round" />
      </motion.g>
    </Frame>
  );
}

/** A clock face draws; the hands sweep round and settle. */
export function HoursIcon() {
  const ticks = [0, 90, 180, 270];
  return (
    <Frame label="Opening hours">
      <Draw d="M60 18A42 42 0 1 1 59.99 18" dur={0.9} />
      {ticks.map((a, i) => (
        <motion.line
          key={a}
          x1="60"
          y1="25"
          x2="60"
          y2="31"
          className="stroke-violet"
          strokeWidth={3.2}
          strokeLinecap="round"
          style={{ originX: '60px', originY: '60px', rotate: a }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + i * 0.06 }}
        />
      ))}
      <motion.line
        x1="60"
        y1="60"
        x2="60"
        y2="36"
        className="stroke-violet"
        strokeWidth={3.6}
        strokeLinecap="round"
        style={{ originX: '60px', originY: '60px' }}
        initial={{ rotate: 0 }}
        animate={{ rotate: 300 }}
        transition={{ type: 'spring', stiffness: 40, damping: 12, delay: 0.6 }}
      />
      <motion.line
        x1="60"
        y1="60"
        x2="60"
        y2="28"
        className="stroke-accent"
        strokeWidth={3.2}
        strokeLinecap="round"
        style={{ originX: '60px', originY: '60px' }}
        initial={{ rotate: 0 }}
        animate={{ rotate: 720 + 120 }}
        transition={{ type: 'spring', stiffness: 30, damping: 10, delay: 0.6 }}
      />
      <circle cx="60" cy="60" r="4" className="fill-accent" />
    </Frame>
  );
}

/** A camera draws in, then the flash fires. */
export function PhotosIcon() {
  return (
    <Frame label="Photos">
      <Draw d="M18 44H38L46 32H74L82 44H102V96H18Z" dur={0.8} />
      <Draw d="M60 52A16 16 0 1 1 59.99 52" delay={0.45} dur={0.5} />
      <motion.circle
        cx="60"
        cy="68"
        r="6"
        className="fill-accent"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.9, type: 'spring', stiffness: 500, damping: 15 }}
      />
      <motion.circle
        cx="60"
        cy="68"
        r="60"
        fill="#ffffff"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0] }}
        transition={{ delay: 1.15, duration: 0.45, times: [0, 0.15, 1] }}
      />
    </Frame>
  );
}

/** A rubber stamp comes down and leaves a red mark. */
export function ReviewIcon() {
  return (
    <Frame label="Review and submit">
      <motion.circle
        cx="60"
        cy="92"
        r="20"
        fill="none"
        className="stroke-accent"
        strokeWidth={4}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.62, type: 'spring', stiffness: 600, damping: 18 }}
      />
      <motion.path
        d="M52 92l6 6 12-13"
        fill="none"
        className="stroke-accent"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.75, duration: 0.3 }}
      />
      <motion.g
        initial={{ y: -10 }}
        animate={{ y: [-10, 22, -6] }}
        transition={{ delay: 0.2, duration: 0.7, times: [0, 0.55, 1], ease: ['easeIn', 'easeOut'] }}
      >
        <path d="M50 18H70V40H50Z" className="fill-canvas stroke-violet" strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M40 40H80V52H40Z" className="fill-canvas stroke-violet" strokeWidth={3.2} strokeLinejoin="round" />
      </motion.g>
    </Frame>
  );
}
