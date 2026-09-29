/* ==================================================================
 * Profile domain logic — kept pure so it can be tested without a
 * browser. The page stays presentational.
 * ================================================================== */

export interface Profile {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'technician';
  facility_id: number | null;
  facility_name: string | null;
  is_dark_mode: boolean;
  email_alerts: boolean;
  timezone: string;
  locale: string;
  last_login_at: string | null;
  created_at: string | null;
}

export interface ProfileDraft {
  full_name: string;
  email: string;
  phone: string;
  designation: string;
}

export interface FieldErrors {
  [field: string]: string | undefined;
}

export type ActivityAction = 'LOGIN' | 'LOGOUT' | 'UPDATE_PROFILE' | 'UPDATE_PREFERENCES' | 'CHANGE_PASSWORD';

export interface ActivityEntry {
  id: number;
  action: ActivityAction;
  details: string;
  ip: string | null;
  time: string | null;
}

export const emptyProfile: Profile = {
  id: 0,
  username: '',
  full_name: '',
  email: '',
  phone: null,
  designation: null,
  avatar_url: null,
  role: 'technician',
  facility_id: null,
  facility_name: null,
  is_dark_mode: true,
  email_alerts: false,
  timezone: 'Asia/Manila',
  locale: 'en',
  last_login_at: null,
  created_at: null,
};

/** The API returns a sparse object; fill in anything it omitted. */
export function toProfile(raw: Partial<Profile> | null | undefined): Profile {
  return { ...emptyProfile, ...(raw ?? {}) };
}

export function toDraft(profile: Profile): ProfileDraft {
  return {
    full_name: profile.full_name ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    designation: profile.designation ?? '',
  };
}

/** Only send the fields the operator can actually change. */
export function toPayload(draft: ProfileDraft) {
  return {
    full_name: draft.full_name.trim(),
    email: draft.email.trim().toLowerCase(),
    phone: draft.phone.trim(),
    designation: draft.designation.trim(),
  };
}

export function isDirty(draft: ProfileDraft, saved: ProfileDraft): boolean {
  const a = toPayload(draft);
  const b = toPayload(saved);
  return a.full_name !== b.full_name || a.email !== b.email || a.phone !== b.phone || a.designation !== b.designation;
}

/**
 * Client-side mirror of the server's UpdateProfileRequest rules, so an
 * obvious typo is caught before a round trip. The server stays the
 * authority — this never replaces it.
 */
export function validateDraft(draft: ProfileDraft): FieldErrors {
  const errors: FieldErrors = {};
  const fullName = draft.full_name.trim();
  const email = draft.email.trim();
  const phone = draft.phone.trim();

  if (fullName.length < 2) errors.full_name = 'Enter your full name.';
  if (!email) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (phone && !/^[0-9+()\-.\s]+$/.test(phone)) errors.phone = 'Enter a valid phone number.';

  return errors;
}

const PHONE_RULES = /^[0-9+()\-.\s]+$/;
const EMAIL_RULES = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors ChangePasswordRequest: 8+ chars with upper, lower and a digit. */
export function passwordProblems(pw: string, confirm: string): string[] {
  const problems: string[] = [];
  if (pw.length < 8) problems.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) problems.push('An uppercase letter');
  if (!/[a-z]/.test(pw)) problems.push('A lowercase letter');
  if (!/[0-9]/.test(pw)) problems.push('A number');
  if (confirm.length > 0 && pw !== confirm) problems.push('The two entries match');
  return problems;
}

export function isPasswordComplete(pw: string, confirm: string): boolean {
  return pw.length >= 8 && pw === confirm && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colour: string;
}

/** Simple, honest strength read-out. Not a security control. */
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: 'Empty', colour: 'var(--text-muted)' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  const table: Record<number, { label: string; colour: string }> = {
    0: { label: 'Too short', colour: '#F87171' },
    1: { label: 'Weak', colour: '#F87171' },
    2: { label: 'Fair', colour: '#FBBF24' },
    3: { label: 'Good', colour: '#22D3EE' },
    4: { label: 'Strong', colour: '#34D399' },
  };
  const capped = Math.min(4, score) as PasswordStrength['score'];
  return { score: capped, ...table[capped] };
}

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Rejects an oversized or wrong-typed avatar before the upload starts. */
export function validateAvatar(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > MAX_AVATAR_BYTES) return 'Choose an image under 2 MB.';
  return null;
}

const ROLE_LABELS: Record<Profile['role'], string> = {
  admin: 'Administrator',
  manager: 'Facility Manager',
  technician: 'Technician',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'Unknown';
  return ROLE_LABELS[role as Profile['role']] ?? role;
}

const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  UPDATE_PROFILE: 'Profile updated',
  UPDATE_PREFERENCES: 'Preferences updated',
  CHANGE_PASSWORD: 'Password changed',
};

export function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action as ActivityAction] ?? action;
}

/** Human relative time, falling back to an absolute date past a week. */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Join date. Reusing relativeTime here would read "Never" for a missing
 * created_at, which is nonsense for a date that has already happened.
 */
export function memberSince(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  return new Date(then).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** First letters for the avatar fallback, e.g. "Clint Santiago" -> "CS". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Turns a Laravel 422 body into a flat field -> first message map. */
export function fieldErrorsFrom(error: unknown): FieldErrors {
  const body = (error as { body?: { errors?: Record<string, string[]> } } | null)?.body;
  const errors = body?.errors;
  if (!errors || typeof errors !== 'object') return {};

  const out: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages) && messages[0]) out[field] = messages[0];
  }
  return out;
}

export const isValidEmail = (value: string) => EMAIL_RULES.test(value.trim());
export const isValidPhone = (value: string) => !value.trim() || PHONE_RULES.test(value.trim());
