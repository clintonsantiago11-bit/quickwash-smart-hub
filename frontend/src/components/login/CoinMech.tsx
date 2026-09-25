'use client';

import { CheckCircle2, RotateCcw, Sparkles, Droplets } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { CoinPhase } from '@/lib/auth';

interface CoinMechProps {
  phase: Exclude<CoinPhase, 'idle'>;
  message: string;
  welcomeName: string | null;
  onRetry: () => void;
}

/**
 * High-Fidelity 3D Mechanical Coin Validator & Terminal Stage.
 * Renders metallic coin physics, optical laser sensors, real-time VFD screen,
 * and chute mechanics.
 */
export default function CoinMech({ phase, message, welcomeName, onRetry }: CoinMechProps) {
  const reduceMotion = useReducedMotion();

  const coinRest = (() => {
    if (reduceMotion) return { y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, opacity: 1 };
    return {};
  })();

  const vfdText =
    phase === 'accepted'
      ? `ACCESS GRANTED — WELCOME, ${(welcomeName ?? 'OPERATOR').toUpperCase()}`
      : phase === 'loading'
        ? 'VALIDATING TOKEN CREDENTIALS...'
        : phase === 'jammed'
          ? 'COIN JAM — EJECT & RETRY'
          : 'CREDENTIALS REJECTED — COIN RETURNED';

  const failed = phase === 'jammed' || phase === 'returned';

  const coinAnimate =
    phase === 'loading'
      ? {
          y: [-60, 0, -4, 2, 0],
          rotateX: [60, 180, 360, 540, 720],
          rotateY: [0, 180, 360],
          scale: [0.8, 1, 1.05, 0.98, 1],
          opacity: 1,
        }
      : phase === 'accepted'
        ? { y: [0, 30, 80], scale: [1, 0.8, 0], opacity: [1, 0.8, 0], rotateZ: 360 }
        : phase === 'jammed'
          ? { y: -6, rotateZ: [-5, 8, -8, 5, 0], scale: 1, opacity: 1 }
          : { y: [0, 40, 90], x: [0, -20, 15], rotateZ: [0, 180, 360], opacity: [1, 0.8, 0] };

  const coinTransition = {
    duration: phase === 'loading' ? 0.85 : 0.65,
    ease: 'easeOut' as const,
  };

  return (
    <div className={`mech mech-${phase} space-y-6 pt-2`} role="status" aria-live="polite">
      {/* 3D Machined Coin Chute Housing */}
      <div className="mech-chute-casing relative mx-auto w-full max-w-[340px] rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-inner overflow-hidden">
        {/* Background Laser Alignment Beams */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px]" />

        {/* Laser Optical Sensor Beam Line */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse shadow-[0_0_8px_#ef4444]" />

        {/* Optical Sensor Status Badge */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-3 select-none">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${phase === 'loading' ? 'bg-amber-400 animate-ping' : phase === 'accepted' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            VALIDATOR: <strong className="text-slate-200">{phase.toUpperCase()}</strong>
          </span>
          <span className="text-cyan-400 font-semibold tracking-wider">OPTICAL-9000</span>
        </div>

        {/* Slot Entry Mouth */}
        <div className="mech-slot relative h-12 w-full rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-700/80 shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden">
          {/* Laser Scanner Sweep Light */}
          <div className="mech-slot-glow" />

          {/* Ripple shockwave rings on coin contact */}
          <div className="mech-ring" />

          {/* 3D Ultra-Realistic Metallic Peso Coin */}
          <motion.div
            className="mech-coin absolute z-20 flex items-center justify-center rounded-full shadow-2xl cursor-pointer select-none"
            initial={reduceMotion ? false : { y: -60, scale: 0.8, rotateX: 60, opacity: 0 }}
            animate={reduceMotion ? coinRest : coinAnimate}
            transition={coinTransition}
          >
            {/* Coin Face Design */}
            <div className="relative h-11 w-11 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 border-2 border-yellow-200 p-0.5 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),_0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center">
              <div className="h-full w-full rounded-full border border-amber-700/60 bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 flex flex-col items-center justify-center text-amber-950">
                <Droplets size={12} className="text-amber-900 fill-amber-900/30 stroke-[2.5]" />
                <span className="text-[11px] font-black font-mono leading-none tracking-tighter">₱</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sensor Chute Laser Status Lights */}
        <div className="flex justify-between items-center mt-3 px-1">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
            <span className="text-[9px] font-mono text-slate-400">IR SENSOR A</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
            <span className="text-[9px] font-mono text-slate-400">IR SENSOR B</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${phase === 'jammed' ? 'bg-rose-500 animate-ping' : 'bg-cyan-500'}`} />
            <span className="text-[9px] font-mono text-slate-400">ESCROW</span>
          </div>
        </div>
      </div>

      {/* Cyberpunk VFD Screen Terminal Output */}
      <div className="mech-window relative rounded-xl bg-slate-950 border border-slate-800 p-4 shadow-2xl overflow-hidden">
        {/* CRT Scanline Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none z-10" />

        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
          <span className="text-[10px] font-mono font-bold text-cyan-400 flex items-center gap-1.5">
            <Sparkles size={12} /> SYSTEM DIAGNOSTIC LOG
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {phase === 'accepted' ? '[200 OK]' : phase === 'loading' ? '[BUSY]' : '[FAULT]'}
          </span>
        </div>

        <p className="mech-vfd min-h-[42px] flex items-center">
          <span className="mech-vfd-text text-xs sm:text-sm font-mono font-bold leading-snug">
            {vfdText}
          </span>
          {phase === 'loading' && <span className="mech-caret" aria-hidden />}
        </p>

        {/* Dynamic connection track bar */}
        {phase === 'loading' && <div className="mech-track mt-3" aria-hidden />}
      </div>

      {/* Status Explanatory Hint */}
      <div className="text-center">
        <p className="mech-hint text-xs text-slate-300 font-medium leading-relaxed px-2">
          {phase === 'loading'
            ? 'The token is verifying credentials with the QuickWash hub...'
            : message}
        </p>
      </div>

      {/* Action Buttons for Failure States */}
      {failed && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          type="button"
          className="login-btn w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-slate-100 border border-slate-600 shadow-lg transition-all"
          onClick={onRetry}
        >
          <RotateCcw size={16} className="text-cyan-400" />
          <span>EJECT & RETRY CREDENTIALS</span>
        </motion.button>
      )}

      {phase === 'accepted' && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mech-ok flex items-center justify-center gap-2 text-sm text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 py-3 rounded-xl"
        >
          <CheckCircle2 size={18} className="text-emerald-400 animate-pulse" />
          <span>AUTHENTICATED — INITIALIZING SESSION...</span>
        </motion.div>
      )}
    </div>
  );
}

