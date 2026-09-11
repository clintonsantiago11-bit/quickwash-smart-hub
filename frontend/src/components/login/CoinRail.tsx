'use client';

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';
import type { CoinPhase } from '@/lib/auth';

interface CoinRailProps {
  phase: CoinPhase;
  credits: number;
  /** Slot click = drop a demo coin (never triggers auth). */
  onSlotClick: () => void;
}

const active = (p: CoinPhase) => p === 'dropping' || p === 'processing';
const accepted = (p: CoinPhase) => p === 'accepted';

export default function CoinRail({ phase, credits, onSlotClick }: CoinRailProps) {
  const reduceMotion = useReducedMotion();

  // Odometer-style count-up for the credit meter.
  const meter = useMotionValue(0);
  const display = useTransform(meter, (v) => `₱${Math.round(v)}`);
  useEffect(() => {
    if (reduceMotion) {
      meter.set(credits);
      return;
    }
    const controls = animate(meter, credits, { duration: 0.55, ease: 'easeOut' });
    return () => controls.stop();
  }, [credits, meter, reduceMotion]);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.98 },
        booted: { opacity: 1, y: 0, scale: 1 },
      }}
      initial="hidden"
      animate="booted"
      transition={{ type: 'spring', stiffness: 170, damping: 20, delay: 0.28 }}
      className={`lw-vendo ${active(phase) ? 'lw-vendo-active' : ''} ${
        accepted(phase) ? 'lw-vendo-accepted' : ''
      } ${phase === 'rejected' ? 'lw-vendo-rejected' : ''}`}
    >
      {/* The slot itself is interactive — a coin, just not your credentials */}
      <button type="button" onClick={onSlotClick} className="lw-slot" aria-label="Coin slot — drop a demo coin">
        <div className="lw-slot-line" />
        <div className="flex items-center justify-between">
          <span className="lw-slot-label">INSERT COIN</span>
          <div className="lw-chips" aria-hidden>
            <span className="lw-chip">₱5</span>
            <span className="lw-chip">₱10</span>
            <span className="lw-chip">₱20</span>
          </div>
        </div>
      </button>

      {/* VFD credit meter */}
      <div className="lw-meter" aria-live="polite" aria-label={`Credits inserted: ${credits}`}>
        <motion.span className="lw-vfd">{display}</motion.span>
        <span className="lw-meter-label">CREDIT</span>
      </div>

      {/* Spring-physics coin drop */}
      <AnimatePresence>
        {phase === 'dropping' && !reduceMotion && (
          <motion.span
            className="lw-coin"
            aria-hidden
            initial={{ y: -26, rotate: 0, scale: 1, opacity: 1 }}
            animate={{
              y: [null, 12, 24, 30],
              rotate: [0, 170, 200, 210],
              scale: [1, 0.97, 0.62, 0.5],
              opacity: [1, 1, 0.65, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.5,
              times: [0, 0.45, 0.8, 1],
              ease: [0.55, 0, 0.85, 0.36],
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
