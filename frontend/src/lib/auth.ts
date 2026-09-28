/* ==================================================================
 * Auth & vendo domain models — single source of truth for the login
 * terminal. Invalid states are unrepresentable by design: the coin
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
 * `rejecting` is the jam itself: the coin is stuck in the reader and being
 * thrown back out. It settles into `jam`, the resting state that leaves the
 * form editable so the operator can correct the credential and feed it again.
 */
export type LoginPhase =
  | 'idle'
  | 'inserting'
  | 'authenticating'
  | 'rejecting'
  | 'success'
  | 'jam'
  | 'error';

/** Phases where the card is dimmed and the form cannot be edited. */
export type BlockingLoginPhase = 'inserting' | 'authenticating' | 'rejecting' | 'success';

export function isBlockingPhase(phase: LoginPhase): phase is BlockingLoginPhase {
  return (
    phase === 'inserting' ||
    phase === 'authenticating' ||
    phase === 'rejecting' ||
    phase === 'success'
  );
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
