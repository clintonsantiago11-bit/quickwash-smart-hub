'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Droplets } from 'lucide-react';
import { api, LoginError } from '@/lib/api';
import {
  validateCredentials,
  type AuthResponse,
  type CoinPhase,
  type FieldError,
} from '@/lib/auth';
import CoinMech from '@/components/login/CoinMech';
import CredentialForm from '@/components/login/CredentialForm';
import Faceplate from '@/components/login/Faceplate';

/* ================================================================== */
/*  LOGIN — "Coin Op": realistic interactive coin mechanism.         */
/*  Submitting drops a 3D coin into the validator slot while the       */
/*  REAL request is in flight. Jams on disconnect, returns on bad key. */
/* ================================================================== */

const REDIRECT_MS = 900;
const RETURN_RESET_MS = 2400;

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<CoinPhase>('idle');
  const [failMsg, setFailMsg] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Track mouse position for dynamic ambient spotlight effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // A returned coin resets to the form on its own; a jam waits for Retry.
  useEffect(() => {
    if (phase !== 'returned') return;
    const t = setTimeout(() => setPhase('idle'), RETURN_RESET_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase]);

  const handleRetry = useCallback(() => {
    setFailMsg('');
    setPhase('idle');
  }, []);

  const handleSubmit = useCallback(
    (data: { email: string; password: string; rememberMe: boolean }) => {
      if (phase !== 'idle') return;
      setFieldError(null);

      const problem = validateCredentials(data);
      if (problem) {
        setFieldError(problem);
        return;
      }

      setPhase('loading');
      void (async () => {
        try {
          const auth = (await api.login(data.email, data.password)) as AuthResponse;
          if (data.rememberMe) localStorage.setItem('remembered_email', data.email.trim());
          else localStorage.removeItem('remembered_email');

          setWelcomeName(auth?.user?.full_name || auth?.user?.username || 'Operator');
          setPhase('accepted');
          timers.current.push(setTimeout(() => router.push('/'), REDIRECT_MS));
        } catch (err) {
          const kind = err instanceof LoginError ? err.kind : 'server';
          if (kind === 'network') setFailMsg('No signal — the hub is unreachable; the coin jammed.');
          else if (kind === 'timeout') setFailMsg('Signal too weak — the hub stopped responding; the coin jammed.');
          else if (kind === 'credentials') setFailMsg('Invalid email or password — the coin jammed in the slot.');
          else setFailMsg('The hub reported an error — the coin jammed.');
          setPhase('jammed');
        }
      })();
    },
    [phase, router]
  );

  const swap = phase !== 'idle';
  const swapMotion = (key: string) => ({
    key,
    initial: reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.98 },
    transition: { duration: 0.28, ease: 'easeOut' as const },
  });

  return (
    <div className="login-scene min-h-screen w-full relative bg-slate-950 text-slate-100 flex items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Dynamic Cursor Spotlight Effect */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(56, 189, 248, 0.08), transparent 80%)`,
        }}
      />

      {/* Floating Animated Bubbles and Water Particles in Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />

        {/* Ambient Grid Mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      </div>

      {/* Industrial Background Watermark */}
      <span className="login-watermark select-none pointer-events-none absolute text-[120px] sm:text-[180px] lg:text-[220px] font-black tracking-widest text-slate-800/20 font-mono top-6 left-1/2 -translate-x-1/2 z-0" aria-hidden>
        BAY-01
      </span>

      {/* Main Login Stage */}
      <main className="login-stage relative z-10 w-full max-w-md">
        <Faceplate>
          {/* Brand Header Row */}
          <div className="flex items-center gap-3.5">
            <div className="login-brand-tile grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-sky-600 via-cyan-500 to-sky-400 p-0.5 shadow-lg shadow-cyan-500/20 border border-white/30">
              <Droplets size={24} className="text-white drop-shadow" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-2">
                <p className="login-brand-name font-bold text-xl tracking-tight text-white">
                  Quick<span className="text-cyan-400">Wash</span>
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/80">
                  HUB
                </span>
              </div>
              <p className="login-brand-sub text-[10px] font-mono tracking-widest text-slate-400 mt-0.5">
                SMART VENDING & LAUNDRY
              </p>
            </div>
            <span className="login-brand-led h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse shrink-0" aria-hidden />
          </div>

          <div className="login-waterline my-4 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" aria-hidden />

          <AnimatePresence mode="wait" initial={false}>
            {swap ? (
              <motion.div {...swapMotion('mech')}>
                <CoinMech
                  phase={phase}
                  message={failMsg}
                  welcomeName={welcomeName}
                  onRetry={handleRetry}
                />
              </motion.div>
            ) : (
              <motion.div {...swapMotion('form')}>
                <div className="mt-2">
                  <h1 className="login-title text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    Operator Access
                  </h1>
                  <p className="login-subtitle text-xs text-slate-400 mt-1">
                    Insert your credentials to activate the washing station hub.
                  </p>
                </div>

                <CredentialForm
                  onSubmit={handleSubmit}
                  fieldError={fieldError}
                  onClearError={() => setFieldError(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Faceplate>
      </main>
    </div>
  );
}

