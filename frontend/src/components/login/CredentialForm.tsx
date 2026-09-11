'use client';

import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, ArrowRight, Coins, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CoinPhase, FieldError } from '@/lib/auth';

interface CredentialFormProps {
  phase: CoinPhase;
  welcomeName: string | null;
  onSubmit: (data: { email: string; password: string; rememberMe: boolean }) => void;
  fieldError: FieldError | null;
  formError: string | null;
  onClearError: () => void;
}

const spring = { type: 'spring' as const, stiffness: 190, damping: 22 };

export default function CredentialForm({
  phase,
  welcomeName,
  onSubmit,
  fieldError,
  formError,
  onClearError,
}: CredentialFormProps) {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  // Restore the remembered operator email (client-only, post-hydration).
  useEffect(() => {
    const remembered = localStorage.getItem('remembered_email');
    if (remembered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(remembered);
    }
  }, []);

  const busy = phase === 'dropping' || phase === 'processing' || phase === 'accepted';
  const item = (i: number) => ({
    variants: {
      hidden: { opacity: 0, y: 14 },
      booted: { opacity: 1, y: 0 },
    },
    initial: 'hidden' as const,
    animate: 'booted' as const,
    transition: reduceMotion ? { duration: 0 } : { ...spring, delay: 0.42 + i * 0.09 },
  });

  const errFor = (field: 'email' | 'password') =>
    touched[field] && fieldError?.field === field ? fieldError.message : null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    onSubmit({ email, password, rememberMe });
  };

  return (
    <motion.form onSubmit={submit} noValidate className="mt-5 space-y-4" initial="hidden" animate="booted">
      {/* Email */}
      <motion.div className="space-y-1.5" {...item(0)}>
        <label htmlFor="login-email" className="login-label">Email</label>
        <div className={`login-field ${errFor('email') ? 'login-field-invalid' : ''}`}>
          <Mail size={16} className="login-field-icon" aria-hidden />
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            onChange={(e) => { setEmail(e.target.value); onClearError(); }}
            placeholder="operator@quickwash.hub"
            className="login-input"
            aria-invalid={Boolean(errFor('email'))}
            aria-describedby={errFor('email') ? 'email-error' : undefined}
          />
        </div>
        {errFor('email') && (
          <p id="email-error" className="login-field-message" role="alert">{errFor('email')}</p>
        )}
      </motion.div>
      {/* Password */}
      <motion.div className="space-y-1.5" {...item(1)}>
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" className="login-label">Password</label>
          <button type="button" className="login-forgot" title="Contact your administrator to reset your password">
            Forgot?
          </button>
        </div>
        <div className={`login-field ${errFor('password') ? 'login-field-invalid' : ''}`}>
          <Lock size={16} className="login-field-icon" aria-hidden />
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            onChange={(e) => { setPassword(e.target.value); onClearError(); }}
            placeholder="Enter your password"
            className="login-input login-input-password"
            aria-invalid={Boolean(errFor('password'))}
            aria-describedby={errFor('password') ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="login-eye"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errFor('password') && (
          <p id="password-error" className="login-field-message" role="alert">{errFor('password')}</p>
        )}
      </motion.div>

      {/* Remember me */}
      <motion.label className="flex cursor-pointer select-none items-center gap-2.5 pt-0.5" {...item(2)}>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="lw-checkbox login-checkbox"
        />
        <span className="text-[13px] text-slate-400">Remember this operator</span>
      </motion.label>

      {/* Form-level error (coin rejected) */}
      {formError && (
        <motion.div
          role="alert"
          className="lw-lcd-error flex items-start gap-2.5"
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <p className="text-[13px] leading-snug">{formError}</p>
        </motion.div>
      )}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={busy}
        className="login-btn group w-full"
        {...item(3)}
        whileHover={busy ? undefined : { y: -1 }}
        whileTap={busy ? undefined : { y: 1, scale: 0.99 }}
      >
        {phase === 'processing' ? (
          <><Loader2 size={17} className="login-spinner" /><span>Processing coin…</span></>
        ) : phase === 'accepted' ? (
          <><ShieldCheck size={17} /><span>Accepted — Welcome, {welcomeName ?? 'Operator'}</span></>
        ) : phase === 'dropping' ? (
          <><Coins size={17} /><span>Coin inserted…</span></>
        ) : phase === 'rejected' ? (
          <><Coins size={17} /><span>Try again — insert coin</span></>
        ) : (
          <><Coins size={17} /><span>Insert coin &amp; sign in</span><ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" /></>
        )}
      </motion.button>
    </motion.form>
  );
}
