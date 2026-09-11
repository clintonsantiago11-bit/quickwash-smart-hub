'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Droplets,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

/* ================================================================== */
/*  LOGIN — "Still Water"                                             */
/*  One glass instrument panel on calm deep water. No machines,       */
/*  no vehicles, no coin gimmicks — instant, focused authentication.  */
/* ================================================================== */

const APP_VERSION = 'QWS v2.5.0';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  // Restore the remembered operator email (client only, post-hydration,
  // so SSR markup and the first client render always match).
  useEffect(() => {
    const remembered = localStorage.getItem('remembered_email');
    if (remembered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  const canSubmit = email.includes('@') && password.trim().length > 0;

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || welcomeName) return;
    setError('');

    try {
      const auth = await api.login(email.trim(), password);
      if (rememberMe) localStorage.setItem('remembered_email', email.trim());
      else localStorage.removeItem('remembered_email');

      const name: string =
        auth?.user?.full_name || auth?.user?.username || 'Operator';
      setWelcomeName(name);
      // One short beat so the success state registers, then hand off.
      setTimeout(() => router.push('/'), 700);
    } catch {
      setError(
        'Incorrect email or password. Check your credentials and try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="login-scene relative grid min-h-screen w-full place-items-center overflow-hidden px-5 py-10">
      {/* ── Backdrop: still water (decorative only) ─────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-grid" />
        <div className="login-horizon" />
        <div className="login-vignette" />
      </div>

      {/* ── The instrument panel ────────────────────────────────── */}
      <main
        className={`login-card relative z-10 w-full max-w-[420px] rounded-3xl p-7 sm:p-9 ${
          welcomeName ? 'login-card-success' : ''
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="login-brand-tile grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
            <Droplets size={22} strokeWidth={2.4} className="login-brand-glyph" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="login-brand-name">
              Quick<span className="login-brand-accent">Wash</span>
            </p>
            <p className="login-brand-sub">SMART HUB CONTROL</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-slate-400">
            {APP_VERSION}
          </span>
        </div>

        {/* Heading */}
        <div className="mt-8">
          <h1 className="login-title">Operator Sign In</h1>
          <p className="login-subtitle">
            Authenticate to access the car wash control room.
          </p>
        </div>
        {/* Error */}
        {error && (
          <div role="alert" className="login-error mt-5 flex items-start gap-2.5">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <p className="text-[13px] leading-snug">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} noValidate className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="login-label">
              Email
            </label>
            <div className="login-field">
              <Mail size={16} className="login-field-icon" aria-hidden />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@quickwash.hub"
                className="login-input"
                aria-invalid={Boolean(error)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="login-password" className="login-label">
                Password
              </label>
              <button
                type="button"
                className="login-forgot"
                title="Contact your administrator to reset your password"
              >
                Forgot?
              </button>
            </div>
            <div className="login-field">
              <Lock size={16} className="login-field-icon" aria-hidden />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="login-input login-input-password"
                aria-invalid={Boolean(error)}
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
          </div>

          {/* Remember me */}
          <label className="flex cursor-pointer select-none items-center gap-2.5 pt-0.5">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="login-checkbox"
            />
            <span className="text-[13px] text-slate-400">
              Remember this operator
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || isLoading || Boolean(welcomeName)}
            className="login-btn group mt-2 w-full"
          >
            {isLoading ? (
              <>
                <Loader2 size={17} className="login-spinner" />
                <span>Authenticating…</span>
              </>
            ) : welcomeName ? (
              <>
                <ShieldCheck size={17} />
                <span>Welcome, {welcomeName}</span>
              </>
            ) : (
              <>
                <span>Sign in to the hub</span>
                <ArrowRight
                  size={17}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </>
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="login-demo">
          <p className="text-[12px] leading-relaxed">
            <span className="login-demo-kicker">Demo access</span>
            <br />
            <code>admin@quickwash.hub</code> · <code>admin123</code>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
          <span className="login-status">
            <span className="login-status-dot" />
            Systems operational
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Secure · TLS
          </span>
        </div>
      </main>
    </div>
  );
}
