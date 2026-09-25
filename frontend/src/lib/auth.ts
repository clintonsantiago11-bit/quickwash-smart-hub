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
 * Vendo lifecycle:
 *   idle → loading → accepted | jammed | returned → (idle)
 * `loading` mirrors the real network request; `jammed` means the
 * connection failed (no signal / timeout); `returned` means the
 * credentials were rejected. Motion never fakes progress.
 */
export type CoinPhase = 'idle' | 'loading' | 'accepted' | 'jammed' | 'returned';

export interface VendoSession {
  credits: number;
  phase: CoinPhase;
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
  if (!email) return { field: 'email', message: 'Enter your operator email.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { field: 'email', message: 'That does not look like a valid email.' };
  }
  if (!creds.password) return { field: 'password', message: 'Enter your password.' };
  if (creds.password.length < 6) {
    return { field: 'password', message: 'Password must be at least 6 characters.' };
  }
  return null;
}
