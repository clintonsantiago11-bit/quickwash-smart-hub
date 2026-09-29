import { redirect } from 'next/navigation';

/**
 * Preferences used to be a second, weaker copy of the settings that now live
 * on the profile: it had its own save path, a non-keyboard-operable toggle
 * pair, and two buttons that did nothing ("Configure" for two-factor auth and
 * "Update password"). Keeping both meant two places to change the same
 * preference, and the two had already drifted apart.
 *
 * /profile is now the single home for preferences and password changes, so
 * this route just sends people there.
 */
export default function PreferencesPage() {
  redirect('/profile');
}
