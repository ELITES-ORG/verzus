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
          Let's put <span className="text-[#dd2b37]">{setup.venue.name}</span> on the map.
        </>
      }
      intro="Six short steps, about five minutes. Everything saves as you go, so you can stop and pick it up later."
    >
      <Block>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {ROAD.map((label, i) => (
            <motion.li key={label} variants={rise} className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#b8b3ff]/50 text-xs font-bold text-[#d9d6ff]">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-[#d9d6ff]">{label}</span>
              {i < ROAD.length - 1 && <span className="mx-1 h-px w-6 bg-[#b8b3ff]/30" aria-hidden="true" />}
            </motion.li>
          ))}
        </ol>
      </Block>
      <Block>
        <p className="max-w-xl text-[#9d97d6]">
          When you're done, we check your listing and make it live. Players near you can then find it, book a court and open it as
          a match.
        </p>
      </Block>
      <SceneFooter onNext={next} nextLabel="Let's go →" />
    </Scene>
  );
}
