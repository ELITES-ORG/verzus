import { motion } from 'motion/react';
import { WelcomeIcon } from '../icons';
import { Block, rise, Scene, SceneFooter, type SceneProps } from '../stage';

const ROAD = ['Basics', 'Location', 'Courts', 'Hours', 'Photos', 'Review'];

export function WelcomeScene({ setup, next }: SceneProps) {
  return (
    <Scene
      eyebrow="Welcome to verzus"
      icon={<WelcomeIcon />}
      title={
        <>
          Let's put <span className="text-accent">{setup.venue.name}</span> on the map.
        </>
      }
      intro="6 quick steps, about 5 minutes. It saves as you go."
    >
      <Block>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {ROAD.map((label, i) => (
            <motion.li key={label} variants={rise} className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-chip border border-line-strong bg-surface text-xs font-bold text-fg-2">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-fg-2">{label}</span>
              {i < ROAD.length - 1 && <span className="mx-1 h-px w-4 bg-line-strong sm:w-6" aria-hidden="true" />}
            </motion.li>
          ))}
        </ol>
      </Block>
      <SceneFooter onNext={next} nextLabel="Let's go →" />
    </Scene>
  );
}
