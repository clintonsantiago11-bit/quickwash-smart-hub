/* ==================================================================
 * Audit retention messaging.
 *
 * Deleting audit rows is irreversible, so the wording is the safety
 * feature: an operator is told what is about to disappear, how long
 * they have, and how to keep a copy. Pure so it can be tested.
 * ================================================================== */

export interface RetentionPreview {
  retention_days: number;
  cutoff_at: string;
  warn_at: string;
  days_until_delete: number;
  expiring_count: number;
  approaching_count: number;
  warn_days_before_delete: number;
}

export type RetentionUrgency = 'none' | 'soon' | 'urgent';

/**
 * How alarmed the notice should sound.
 *
 * urgent means rows are deleted on the next run, so the count in
 * expiring_count is about to be real. soon means the window is closing
 * but nothing has gone yet.
 */
export function retentionUrgency(preview: RetentionPreview): RetentionUrgency {
  if (preview.expiring_count <= 0) return 'none';
  if (preview.days_until_delete <= 1) return 'urgent';
  return 'soon';
}

/** True when there is anything at all worth telling the operator. */
export function shouldWarnAboutRetention(preview: RetentionPreview | null): boolean {
  if (!preview) return false;
  return preview.expiring_count > 0 || preview.approaching_count > 0;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

/**
 * The warning itself. States the cutoff as a date so it can be checked
 * against a calendar, and says plainly that deletion cannot be undone.
 */
export function retentionMessage(preview: RetentionPreview): string {
  const cutoff = new Date(preview.cutoff_at);
  const cutoffLabel = Number.isNaN(cutoff.getTime())
    ? 'the retention cutoff'
    : cutoff.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const being = plural(preview.expiring_count, 'record', 'records');
  const coming = plural(preview.approaching_count, 'record', 'records');
  // Hyphenated adjective, so it reads "the 90-day window" and not
  // "the 90 days window".
  const window = `${preview.retention_days}-day`;

  if (preview.expiring_count > 0 && preview.days_until_delete <= 1) {
    return `${being} will be permanently deleted on the next automatic cleanup. Records older than ${cutoffLabel} are removed and cannot be recovered — export anything still needed.`;
  }

  if (preview.expiring_count > 0) {
    return `${being} will be permanently deleted within ${plural(preview.days_until_delete, 'day', 'days')}. A further ${coming} will follow. Records older than ${cutoffLabel} are removed and cannot be recovered — export anything still needed.`;
  }

  return `${coming} will pass the ${window} retention window within ${plural(preview.days_until_delete, 'day', 'days')} and be permanently deleted. Deletion cannot be recovered — export anything still needed.`;
}

/** Short label for the notice header. */
export function retentionTitle(preview: RetentionPreview): string {
  if (preview.expiring_count > 0 && preview.days_until_delete <= 1) {
    return 'Audit records being deleted';
  }
  if (preview.expiring_count > 0) {
    return 'Audit records approaching deletion';
  }
  return 'Audit retention';
}