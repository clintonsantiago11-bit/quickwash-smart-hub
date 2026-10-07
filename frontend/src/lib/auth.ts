/* ==================================================================
 * Auth & vendo domain models — single source of truth for the login
 * screen. Invalid states are unrepresentable by design: the sign-in
 * rail is driven by a phase machine, not loose booleans.
 * ================================================================== */

export type Role = 'admin' | 'manager' | 'technician';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/** Mirrors the Laravel `users` payload returned by /api/auth/login. */
export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  facility_id: number | null;
  designation: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/**
 * The sign-in state machine.
 *
 * This used to carry seven states, four of which existed only to pace a coin
 * reader animation through its drop, scan, rattle and eject. With that gone
 * they collapse into two: one state for "the request is in flight" and one
 * for "it failed".
 *
 * That also removes the artificial wait. A rejected credential used to pause
 * 700ms before the error appeared, so the operator could watch the coin be
 * thrown out. Nothing is lost but the delay.
 */
export type LoginPhase = 'idle' | 'verifying' | 'success' | 'failed';

/** Phases where the form is mid-flight and must not be edited. */
export type BlockingLoginPhase = 'verifying' | 'success';

export function isBlockingPhase(phase: LoginPhase): phase is BlockingLoginPhase {
  return phase === 'verifying' || phase === 'success';
}

export type FieldName = 'email' | 'password';

export interface FieldError {
  field: FieldName;
  message: string;
}

/** Validate credentials at the boundary — returns the first problem. */
export function validateCredentials(
  creds: Pick<LoginCredentials, 'email' | 'password'>
): FieldError | null {
  const email = creds.email.trim();
  if (!email) return { field: 'email', message: 'Enter your email.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  if (!creds.password) return { field: 'password', message: 'Enter your password.' };
  if (creds.password.length < 6) {
    return { field: 'password', message: 'Password must be at least 6 characters.' };
  }
  return null;
}
