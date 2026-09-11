'use client';

import { motion, useReducedMotion } from 'motion/react';

interface StatusStripProps {
  phase: 'idle' | 'dropping' | 'processing' | 'accepted' | 'rejected';
  appVersion: string;
}

const LED_COUNT = 5;

/** Boot-style LED chase on the right of the brand row. */
export default function StatusStrip({ phase, appVersion }: StatusStripProps) {
  const reduceMotion = useReducedMotion();
  const chaseColor =
    phase === 'accepted' ? '#34d399' : phase === 'rejected' ? '#f87171' : '#38bdf8';

  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: LED_COUNT }, (_, i) => (
        <motion.span
          key={i}
          className="lw-led"
          initial={{ opacity: 0.18 }}
          animate={
            reduceMotion
              ? { opacity: 0.55 }
              : {
                  opacity: [0.18, 1, 0.18],
                  backgroundColor: [chaseColor, chaseColor, chaseColor],
                }
          }
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: reduceMotion ? 0 : i * 0.14,
            ease: 'easeInOut',
          }}
          style={{ backgroundColor: chaseColor }}
        />
      ))}
      <span className="ml-1.5 shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-slate-400">
        {appVersion}
      </span>
    </div>
  );
}
