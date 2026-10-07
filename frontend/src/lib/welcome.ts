/* ==================================================================
 * The greeting shown after a successful sign-in.
 *
 * On a shared terminal the important part is not the welcome but
 * making clear who is now signed in, so the name and role are always
 * shown even when the greeting is "Welcome back".
 * ================================================================== */

export const LAST_SIGN_IN_KEY = 'quickwash_last_sign_in_at';

/** How long the greeting is shown before the dashboard takes over. */
export const WELCOME_MS = 1600;

/**
 * Whether this browser has signed in before.
 *
 * Deliberately not keyed on the remembered email: that is only written when
 * "Remember email" is ticked, so an operator who unticks it would be greeted
 * with "Welcome" every single time. This is written on every success.
 */
export function isReturningVisitor(iso: string | null): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  return Number.isFinite(then) && then > 0;
}

/**
 * The name to greet. Falls back through the fields the API actually sends, so
 * a blank card is impossible.
 */
export function greetingName(user: { full_name?: string | null; username?: string | null } | null): string {
  const name = user?.full_name?.trim();
  if (name) return name;
  const username = user?.username?.trim();
  if (username) return username;
  return 'Operator';
}

/**
 * "Welcome back, Clint" for a browser that has signed in here before,
 * "Welcome, Clint" for a first time.
 */
export function greeting(name: string, returning: boolean): string {
  return returning ? `Welcome back, ${name}` : `Welcome, ${name}`;
}

/** Role as it should read on screen. */
export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'manager':
      return 'Facility Manager';
    case 'technician':
      return 'Technician';
    default:
      return 'Operator';
  }
}

/**
 * The line under the greeting. On a shared machine this is the bit that
 * matters: it names who is signed in and where.
 */
export function welcomeDetail(user: {
  role?: string | null;
  facility_name?: string | null;
} | null): string {
  const role = roleLabel(user?.role);
  const facility = user?.facility_name?.trim();
  return facility ? `Signed in as ${role} at ${facility}.` : `Signed in as ${role}.`;
}