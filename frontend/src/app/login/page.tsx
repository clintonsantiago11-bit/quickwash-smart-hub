'use client';

import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import type { PointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Droplets } from 'lucide-react';
import { api } from '@/lib/api';
import {
  validateCredentials,
  type AuthResponse,
  type CoinPhase,
  type FieldError,
} from '@/lib/auth';
import CoinRail from '@/components/login/CoinRail';
import CredentialForm from '@/components/login/CredentialForm';
import GlassPanel from '@/components/login/GlassPanel';
import StatusStrip from '@/components/login/StatusStrip';

/* ================================================================== */
/*  LOGIN — "Still Water Vendo" (motion edition)                      */
/*  Typed state machine + spring-physics coin rail + boot sequence.   */
/* ================================================================== */

const APP_VERSION = 'QWS v2.5.0';
const CREDIT_PER_INSERT = 20;
const COIN_DROP_MS = 420;

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<CoinPhase>('idle');
  const [credits, setCredits] = useState(0);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const dropCoinThen = useCallback((after: (ms: number) => void) => {
    setPhase('dropping');
    const t = setTimeout(() => {
      setCredits((c) => c + CREDIT_PER_INSERT);
      after(COIN_DROP_MS);
    }, COIN_DROP_MS);
    timers.current.push(t);
  }, []);

  const handleSubmit = useCallback(
    (data: { email: string; password: string; rememberMe: boolean }) => {
      if (phase !== 'idle' && phase !== 'rejected') return;
      setFormError(null);
      setFieldError(null);

      const problem = validateCredentials(data);
      if (problem) {
        setFieldError(problem);
        return;
      }

      dropCoinThen(async () => {
        setPhase('processing');
        try {
          const auth = (await api.login(data.email, data.password)) as AuthResponse;
          if (data.rememberMe) localStorage.setItem('remembered_email', data.email.trim());
          else localStorage.removeItem('remembered_email');

          setWelcomeName(auth?.user?.full_name || auth?.user?.username || 'Operator');
          setPhase('accepted');
          const t = setTimeout(() => router.push('/'), 1100);
          timers.current.push(t);
        } catch {
          setFormError(
            'Invalid coin — rejected. Incorrect email or password; the coin was returned below.'
          );
          setPhase('rejected');
        }
      });
    },
    [phase, dropCoinThen, router]
  );

  const handleSlotClick = useCallback(() => {
    if (phase === 'idle' || phase === 'rejected') {
      setFormError(null);
      dropCoinThen(() => setPhase('idle'));
    }
  }, [phase, dropCoinThen]);

  // Parallax orbs (2 layers, mouse-follow, spring-damped)
  const orbX = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  const orbY = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  const orbX2 = useSpring(useMotionValue(0), { stiffness: 40, damping: 24 });
  const orbY2 = useSpring(useMotionValue(0), { stiffness: 40, damping: 24 });

  const parallax = (e: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const px = (e.clientX / window.innerWidth - 0.5) * 2;
    const py = (e.clientY / window.innerHeight - 0.5) * 2;
    orbX.set(px * 26); orbY.set(py * 18);
    orbX2.set(px * -18); orbY2.set(py * -12);
  };

  return (
    <div
      className="login-scene relative grid min-h-screen w-full place-items-center overflow-hidden px-5 py-10"
      onPointerMove={parallax}
    >
      {/* ── Backdrop: still water + parallax orbs (decorative) ──── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div className="login-orb login-orb-a" style={{ x: orbX, y: orbY }} />
        <motion.div className="login-orb login-orb-b" style={{ x: orbX2, y: orbY2 }} />
        <div className="login-grid" />
        <div className="login-caustics" />
        <div className="login-horizon" />
        <div className="login-vignette" />
      </div>

      {/* ── The vendo terminal panel ────────────────────────────── */}
      <GlassPanel className="relative z-10 w-full max-w-[440px]">
        <motion.main
          variants={{
            hidden: { opacity: 0, y: 26, scale: 0.97 },
            booted: { opacity: 1, y: 0, scale: 1 },
          }}
          initial="hidden"
          animate="booted"
          transition={{ type: 'spring', stiffness: 150, damping: 19 }}
          className={`login-card relative rounded-3xl p-7 sm:p-8 ${
            phase === 'accepted' ? 'login-card-success' : ''
          } ${phase === 'rejected' ? 'login-card-shake' : ''}`}
        >
          {/* Shine sweep on hover */}
          <span className="lw-sheen" aria-hidden />

          {/* Brand row */}
          <div className="flex items-center gap-3">
            <motion.div
              className="login-brand-tile grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
              initial={reduceMotion ? false : { scale: 0.5, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            >
              <Droplets size={22} strokeWidth={2.4} className="login-brand-glyph" />
            </motion.div>
            <div className="min-w-0 leading-tight">
              <p className="login-brand-name">
                Quick<span className="login-brand-accent">Wash</span>
              </p>
              <p className="login-brand-sub">VENDO TERMINAL</p>
            </div>
            <StatusStrip phase={phase} appVersion={APP_VERSION} />
          </div>

          {/* Heading */}
          <motion.div
            className="mt-6"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, type: 'spring', stiffness: 180, damping: 20 }}
          >
            <h1 className="login-title">Operator Sign In</h1>
            <p className="login-subtitle">Insert your credentials to start the wash.</p>
          </motion.div>

          {/* Coin rail */}
          <CoinRail phase={phase} credits={credits} onSlotClick={handleSlotClick} />

          {/* Credential form */}
          <CredentialForm
            phase={phase}
            welcomeName={welcomeName}
            onSubmit={handleSubmit}
            fieldError={fieldError}
            formError={formError}
            onClearError={() => { setFieldError(null); setFormError(null); }}
          />

          {/* Demo credentials */}
          <motion.div
            className="login-demo"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.5 }}
          >
            <p className="text-[12px] leading-relaxed">
              <span className="login-demo-kicker">Demo access</span>
              <br />
              <code>admin@quickwash.hub</code> · <code>admin123</code>
            </p>
          </motion.div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
            <span className="login-status">
              <span className="login-status-dot" />
              Systems operational
            </span>
            <span className="text-[11px] font-medium text-slate-500">Secure · TLS</span>
          </div>
        </motion.main>
      </GlassPanel>
    </div>
  );
}
