'use client';

import Header from '@/components/Header';
import {
  Activity, Briefcase, Camera, Check, KeyRound, Loader2, Mail, MapPin,
  Phone, Save, ShieldCheck, User, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useUI } from '@/providers/UIProvider';
import {
  activityLabel, fieldErrorsFrom, initials, isDirty, isPasswordComplete,
  passwordProblems, passwordStrength, relativeTime, roleLabel, toDraft,
  toPayload, memberSince, toProfile, validateAvatar, validateDraft,
  type ActivityEntry, type FieldErrors, type Profile, type ProfileDraft,
} from '@/lib/profile';

type Banner = { kind: 'ok' | 'error'; text: string } | null;

const inputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-4 pl-14 text-sm outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60';

function Field({
  id, label, icon: Icon, error, children,
}: {
  id: string;
  label: string;
  icon: typeof User;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <div className="relative">
        <Icon size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        {children}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, action, children,
}: {
  title: string;
  icon: typeof User;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest opacity-80">
          <Icon size={18} className="text-[var(--accent)]" aria-hidden="true" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const { isDarkMode, setTheme } = useUI();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saved, setSaved] = useState<ProfileDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityState, setActivityState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [changingPassword, setChangingPassword] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const showBanner = useCallback((next: Banner) => {
    setBanner(next);
    if (next) window.setTimeout(() => setBanner(null), 4000);
  }, []);

  /**
   * One request for the profile, one for activity, in parallel. The activity
   * feed is secondary, so it never blocks the page becoming usable.
   */
  useEffect(() => {
    let cancelled = false;

    api.getProfile()
      .then((raw) => {
        if (cancelled) return;
        const next = toProfile(raw);
        setProfile(next);
        setDraft(toDraft(next));
        setSaved(toDraft(next));
      })
      .catch(() => {
        if (!cancelled) setLoadError('We could not load your profile. Check your connection and try again.');
      });

    api.getProfileActivity(8)
      .then((body) => {
        if (!cancelled) setActivity(Array.isArray(body?.data) ? body.data : []);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      })
      .finally(() => {
        if (!cancelled) setActivityState('ready');
      });

    return () => { cancelled = true; };
  }, []);

  const dirty = useMemo(
    () => (draft && saved ? isDirty(draft, saved) : false),
    [draft, saved]
  );

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  /**
   * The server copy of the theme is the durable one, so reconcile it with the
   * live theme once the profile lands. Without this the two drift and the
   * preference a user saves here is ignored on the next visit.
   */
  useEffect(() => {
    if (profile && profile.is_dark_mode !== isDarkMode) setTheme(profile.is_dark_mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_dark_mode]);

  const handleField = (field: keyof ProfileDraft) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;

    const local = validateDraft(draft);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const body = await api.updateProfile(toPayload(draft));
      const next = toProfile(body?.user);
      setProfile(next);
      setDraft(toDraft(next));
      setSaved(toDraft(next));
      showBanner({ kind: 'ok', text: 'Profile saved.' });
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      if (Object.keys(fields).length > 0) {
        setErrors(fields);
        showBanner({ kind: 'error', text: 'Some details could not be saved.' });
      } else {
        showBanner({ kind: 'error', text: 'We could not save your profile. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (changingPassword) return;

    if (!isPasswordComplete(newPassword, confirmPassword)) {
      setPasswordErrors({ password: 'Your new password does not meet the requirements yet.' });
      return;
    }
    if (currentPassword.length === 0) {
      setPasswordErrors({ current_password: 'Enter your current password to confirm this change.' });
      return;
    }

    setChangingPassword(true);
    setPasswordErrors({});
    try {
      const body = await api.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showBanner({
        kind: 'ok',
        text: body?.revoked_sessions
          ? `Password changed. ${body.revoked_sessions} other session was signed out.`
          : 'Password changed.',
      });
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      if (Object.keys(fields).length > 0) {
        setPasswordErrors(fields);
      } else {
        showBanner({ kind: 'error', text: 'We could not change your password. Please try again.' });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const problem = validateAvatar(file);
    if (problem) {
      showBanner({ kind: 'error', text: problem });
      return;
    }

    setUploading(true);
    try {
      const body = await api.uploadAvatar(file);
      setProfile((prev) => (prev ? { ...prev, avatar_url: body?.avatar_url ?? prev.avatar_url } : prev));
      showBanner({ kind: 'ok', text: 'Photo updated.' });
    } catch {
      showBanner({ kind: 'error', text: 'We could not upload that photo. Please try another.' });
    } finally {
      setUploading(false);
    }
  };

  if (loadError) {
    return (
      <>
        <Header title="User Profile" subtitle="Manage your account" />
        <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
          <div className="card p-10 text-center" role="alert">
            <h2 className="font-display text-lg font-bold">Profile unavailable</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">{loadError}</p>
            <button type="button" className="btn btn-primary mx-auto mt-6" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!profile || !draft) {
    return (
      <>
        <Header title="User Profile" subtitle="Manage your account" />
        <PageSkeleton label="Loading your profile…" />
      </>
    );
  }

  return (
    <>
      <Header title="User Profile" subtitle="Manage your identity, sign-in and preferences" />

      <main className="mx-auto w-full max-w-7xl overflow-x-hidden p-3 pb-24 sm:p-4 sm:pb-6 md:p-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Identity */}
          <div className="space-y-6 lg:col-span-4">
            <section className="card flex flex-col items-center p-8 text-center">
              <div className="group relative mb-6">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-32 w-32 rounded-full border-2 border-[var(--accent)] object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--accent-glow)]">
                    <span className="font-display text-4xl font-bold text-[var(--accent)]" aria-hidden="true">
                      {initials(profile.full_name)}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile photo"
                  className="absolute bottom-0 right-0 rounded-full bg-[var(--accent)] p-2 text-[var(--bg-base)] shadow-lg transition-transform hover:scale-110 disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatar}
                  className="sr-only"
                  tabIndex={-1}
                />
              </div>

              <h2 className="font-display text-xl font-black">{profile.full_name}</h2>
              <p className="mb-6 text-sm font-medium text-[var(--text-muted)]">{profile.email}</p>

              <dl className="w-full space-y-3 border-t border-[var(--border)] pt-5 text-left">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-[var(--text-muted)]">Role</dt>
                  <dd className="badge badge-online">{roleLabel(profile.role)}</dd>
                </div>
                {profile.facility_name && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-[var(--text-muted)]">Facility</dt>
                    <dd className="flex items-center gap-1.5 text-xs font-medium">
                      <MapPin size={13} className="text-[var(--text-muted)]" aria-hidden="true" />
                      {profile.facility_name}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-[var(--text-muted)]">Last sign-in</dt>
                  <dd className="text-xs font-medium">{relativeTime(profile.last_login_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-[var(--text-muted)]">Member since</dt>
                  <dd className="text-xs font-medium">{memberSince(profile.created_at)}</dd>
                </div>
              </dl>
            </section>
          </div>

          {/* Details + security */}
          <div className="space-y-6 lg:col-span-8">
            {banner && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: banner.kind === 'ok' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)',
                  background: banner.kind === 'ok' ? 'rgba(6,78,59,0.25)' : 'rgba(127,29,29,0.25)',
                  color: banner.kind === 'ok' ? '#A7F3D0' : '#FECACA',
                }}
              >
                {banner.kind === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <X size={16} className="mt-0.5 shrink-0" />}
                <span>{banner.text}</span>
              </div>
            )}

            <form onSubmit={handleSave} noValidate>
              <Section
                title="Account details"
                icon={User}
                action={
                  <button
                    type="submit"
                    className="btn btn-primary flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest"
                    disabled={!dirty || saving}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving' : 'Save'}
                  </button>
                }
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Field id="profile-name" label="Full name" icon={User} error={errors.full_name}>
                    <input
                      id="profile-name"
                      name="full_name"
                      type="text"
                      className={inputClass}
                      value={draft.full_name}
                      onChange={handleField('full_name')}
                      aria-invalid={Boolean(errors.full_name)}
                      aria-describedby={errors.full_name ? 'profile-name-error' : undefined}
                      autoComplete="name"
                    />
                  </Field>

                  <Field id="profile-email" label="Email address" icon={Mail} error={errors.email}>
                    <input
                      id="profile-email"
                      name="email"
                      type="email"
                      className={inputClass}
                      value={draft.email}
                      onChange={handleField('email')}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'profile-email-error' : undefined}
                      autoComplete="email"
                      spellCheck={false}
                    />
                  </Field>

                  <Field id="profile-phone" label="Phone number" icon={Phone} error={errors.phone}>
                    <input
                      id="profile-phone"
                      name="phone"
                      type="tel"
                      className={inputClass}
                      value={draft.phone}
                      onChange={handleField('phone')}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
                      autoComplete="tel"
                      placeholder="+63 9XX XXX XXXX"
                    />
                  </Field>

                  <Field id="profile-designation" label="Designation" icon={Briefcase} error={errors.designation}>
                    <input
                      id="profile-designation"
                      name="designation"
                      type="text"
                      className={inputClass}
                      value={draft.designation}
                      onChange={handleField('designation')}
                      aria-invalid={Boolean(errors.designation)}
                      aria-describedby={errors.designation ? 'profile-designation-error' : undefined}
                      autoComplete="organization-title"
                      placeholder="Facility Manager"
                    />
                  </Field>
                </div>

                {dirty && (
                  <p className="mt-5 text-xs text-[var(--text-muted)]">
                    You have unsaved changes.
                  </p>
                )}
              </Section>
            </form>

            <Section title="Preferences" icon={ShieldCheck}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-4">
                  <span>
                    <span className="block text-sm font-bold">Email alerts</span>
                    <span className="block text-xs text-[var(--text-muted)]">Get an email when a device reports a fault.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={profile.email_alerts}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setProfile((p) => (p ? { ...p, email_alerts: next } : p));
                      api.updatePreferences({
                        is_dark_mode: profile.is_dark_mode,
                        email_alerts: next,
                        timezone: profile.timezone,
                        locale: profile.locale,
                      }).catch(() => {
                        setProfile((p) => (p ? { ...p, email_alerts: !next } : p));
                        showBanner({ kind: 'error', text: 'We could not save that preference.' });
                      });
                    }}
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-4">
                  <span>
                    <span className="block text-sm font-bold">Dark theme</span>
                    <span className="block text-xs text-[var(--text-muted)]">Use the deep charcoal palette across the hub.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={(e) => {
                      const next = e.target.checked;
                      const previous = isDarkMode;
                      setTheme(next);
                      setProfile((p) => (p ? { ...p, is_dark_mode: next } : p));
                      api.updatePreferences({
                        is_dark_mode: next,
                        email_alerts: profile.email_alerts,
                        timezone: profile.timezone,
                        locale: profile.locale,
                      }).catch(() => {
                        setTheme(previous);
                        setProfile((p) => (p ? { ...p, is_dark_mode: previous } : p));
                        showBanner({ kind: 'error', text: 'We could not save that preference.' });
                      });
                    }}
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                </label>
              </div>
            </Section>

            <Section title="Password" icon={KeyRound}>
              <form onSubmit={handlePassword} noValidate className="max-w-md space-y-4">
                <Field id="current-password" label="Current password" icon={KeyRound} error={passwordErrors.current_password}>
                  <input
                    id="current-password"
                    type="password"
                    className={inputClass}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordErrors((p) => ({ ...p, current_password: undefined }));
                    }}
                    aria-invalid={Boolean(passwordErrors.current_password)}
                    aria-describedby={passwordErrors.current_password ? 'current-password-error' : undefined}
                    autoComplete="current-password"
                  />
                </Field>

                <Field id="new-password" label="New password" icon={KeyRound} error={passwordErrors.password}>
                  <input
                    id="new-password"
                    type="password"
                    className={inputClass}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordErrors((p) => ({ ...p, password: undefined }));
                    }}
                    onBlur={() => newPassword && confirmRef.current?.focus()}
                    aria-invalid={Boolean(passwordErrors.password)}
                    aria-describedby="password-requirements"
                    autoComplete="new-password"
                  />
                </Field>

                <Field id="confirm-password" label="Confirm new password" icon={KeyRound}>
                  <input
                    ref={confirmRef}
                    id="confirm-password"
                    type="password"
                    className={inputClass}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={confirmPassword.length > 0 && newPassword !== confirmPassword}
                    autoComplete="new-password"
                  />
                </Field>

                {newPassword && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span style={{ color: strength.colour }}>{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${(strength.score / 4) * 100}%`, background: strength.colour }}
                      />
                    </div>
                    <ul id="password-requirements" className="space-y-1 text-[var(--text-muted)]">
                      {passwordProblems(newPassword, confirmPassword).map((problem) => (
                        <li key={problem}>Needs: {problem}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary flex w-full items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest"
                  disabled={changingPassword || !isPasswordComplete(newPassword, confirmPassword) || currentPassword.length === 0}
                >
                  {changingPassword ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  {changingPassword ? 'Changing' : 'Change password'}
                </button>

                <p className="text-xs text-[var(--text-muted)]">
                  Changing your password signs out every other device.
                </p>
              </form>
            </Section>

            <Section
              title="Recent activity"
              icon={Activity}
              action={
                activityState === 'loading' ? (
                  <span className="text-xs text-[var(--text-muted)]">Loading…</span>
                ) : null
              }
            >
              {activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                  No account activity recorded yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{activityLabel(entry.action)}</p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {entry.details}
                          {entry.ip ? ` · ${entry.ip}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                        {relativeTime(entry.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </main>
    </>
  );
}
