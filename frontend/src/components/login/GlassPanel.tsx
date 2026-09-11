'use client';

import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees (kept subtle — transform-only, GPU friendly). */
  maxTilt?: number;
}

/**
 * Glass panel with a subtle 3D pointer tilt. Springs keep the motion
 * physical; `useReducedMotion` pins it flat for vestibular safety.
 */
export default function GlassPanel({ children, className, maxTilt = 5 }: GlassPanelProps) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(rawX, { stiffness: 140, damping: 20, mass: 0.6 });
  const rotateY = useSpring(rawY, { stiffness: 140, damping: 20, mass: 0.6 });

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rawY.set(px * maxTilt);
    rawX.set(-py * maxTilt);
  };

  const handleLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
