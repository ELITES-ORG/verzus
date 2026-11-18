import { motion, type Variants } from 'motion/react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Building blocks for the onboarding stage: dark, large type, one question per scene. */

export const display = { fontFamily: "'Dela Gothic One', system-ui, sans-serif" } as const;

/** Children of a scene arrive one after another. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.18 } },
};
export const rise: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

export function Scene(props: {
  eyebrow: string;
  icon: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className={`mx-auto w-full ${props.wide ? 'max-w-5xl' : 'max-w-2xl'}`}
    >
      <motion.div variants={rise} className="mb-6 flex items-center gap-4">
        {props.icon}
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b8b3ff]">{props.eyebrow}</p>
      </motion.div>
      <motion.h1
        variants={rise}
        style={display}
        className="text-[clamp(30px,5vw,52px)] leading-[1.05] tracking-[-0.01em] text-white"
      >
        {props.title}
      </motion.h1>
      {props.intro && (
        <motion.p variants={rise} className="mt-4 max-w-xl text-lg text-[#d9d6ff]">
          {props.intro}
        </motion.p>
      )}
      <div className="mt-10 space-y-8">{props.children}</div>
    </motion.div>
  );
}

/** A labelled block inside a scene; part of the scene's stagger. */
export function Block({ label, hint, children }: { label?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <motion.div variants={rise} className="space-y-2">
      {label && <p className="text-sm font-semibold text-[#d9d6ff]">{label}</p>}
      {children}
      {hint && <p className="text-sm text-[#9d97d6]">{hint}</p>}
    </motion.div>
  );
}

const fieldBase =
  'w-full bg-transparent text-white placeholder:text-[#6f6a9c] border-0 border-b-[3px] border-[#b8b3ff]/40 px-0 py-2 transition-colors focus:border-[#dd2b37] focus:outline-none';

export function BigInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={display} className={`${fieldBase} text-[clamp(22px,3.4vw,34px)] ${props.className ?? ''}`} />;
}

export function StageInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} text-xl ${props.className ?? ''}`} />;
}

export function StageTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border-2 border-[#b8b3ff]/30 bg-white/[0.04] p-4 text-lg text-white placeholder:text-[#6f6a9c] focus:border-[#dd2b37] focus:outline-none ${props.className ?? ''}`}
    />
  );
}

export function StageSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border-2 border-[#b8b3ff]/30 bg-[#24205a] px-4 py-3 text-lg text-white focus:border-[#dd2b37] focus:outline-none ${props.className ?? ''}`}
    />
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'chip' | 'chipOn' };
export function StageButton({ kind = 'primary', className = '', type = 'button', children, ...rest }: BtnProps) {
  const look = {
    primary:
      'bg-[#dd2b37] text-white px-7 py-3.5 rounded-full text-base shadow-[0_10px_30px_-10px_rgba(221,43,55,0.8)] hover:bg-[#e7404b]',
    ghost: 'text-[#d9d6ff] px-4 py-3 rounded-full hover:text-white hover:bg-white/5',
    chip: 'rounded-full border-2 border-[#b8b3ff]/35 px-4 py-2 text-sm text-[#d9d6ff] hover:border-[#b8b3ff] hover:text-white',
    chipOn: 'rounded-full border-2 border-[#dd2b37] bg-[#dd2b37]/15 px-4 py-2 text-sm text-white',
  }[kind];
  return (
    <motion.button
      type={type}
      whileHover={rest.disabled ? undefined : { y: -1 }}
      whileTap={rest.disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

/** Back / Continue row at the bottom of every scene. */
export function SceneFooter(props: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <motion.div variants={rise} className="flex flex-wrap items-center gap-3 pt-4">
      {props.onBack && (
        <StageButton kind="ghost" onClick={props.onBack} disabled={props.busy}>
          ← Back
        </StageButton>
      )}
      <StageButton onClick={props.onNext} disabled={props.busy || props.disabled} className="ml-auto">
        {props.busy ? 'Saving…' : (props.nextLabel ?? 'Continue →')}
      </StageButton>
      {props.error && (
        <p role="alert" className="basis-full text-right text-sm font-semibold text-[#ff8a92]">
          {props.error}
        </p>
      )}
    </motion.div>
  );
}

export interface SceneProps {
  setup: import('../setup/data').Setup;
  refresh: () => Promise<void>;
  next: () => void;
  back?: () => void;
}
