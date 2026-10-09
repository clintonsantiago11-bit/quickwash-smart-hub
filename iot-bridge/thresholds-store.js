/**
 * Threshold storage and enforcement.
 *
 * Keeps the current thresholds in memory and re-reads them periodically, so a
 * change made on the dashboard applies without restarting the bridge. The
 * restart caveat the settings page shows is therefore only about the MQTT
 * broker, which lives in this process's own environment and genuinely cannot
 * be moved from a database row.
 */

const db = require('./db');
const {
  DEFAULT_THRESHOLDS,
  evaluateLevels,
  describeBreach,
} = require('./thresholds');

/** How often to re-read the thresholds. */
const REFRESH_MS = 60_000;

let cached = { ...DEFAULT_THRESHOLDS };
let lastLoadedAt = 0;
let refreshTimer = null;

/**
 * Read the thresholds, falling back to the defaults.
 *
 * Missing table, missing row, or a query failure all resolve to the defaults
 * rather than throwing. A settings feature must never be able to stop sensor
 * logging or alerting just because the operator has not opened the page yet.
 */
async function loadThresholds() {
  try {
    const [rows] = await db.pool.execute(
      'SELECT low_water_pct, low_soap_pct, low_wax_pct FROM system_settings WHERE id = 1 LIMIT 1'
    );

    if (rows.length > 0) {
      const row = rows[0];
      cached = {
        low_water_pct: Number.isFinite(Number(row.low_water_pct))
          ? Number(row.low_water_pct)
          : DEFAULT_THRESHOLDS.low_water_pct,
        low_soap_pct: Number.isFinite(Number(row.low_soap_pct))
          ? Number(row.low_soap_pct)
          : DEFAULT_THRESHOLDS.low_soap_pct,
        low_wax_pct: Number.isFinite(Number(row.low_wax_pct))
          ? Number(row.low_wax_pct)
          : DEFAULT_THRESHOLDS.low_wax_pct,
      };
      lastLoadedAt = Date.now();
      return cached;
    }

    // No row yet - the migration has not been run, or the seeder has not
    // created one. Defaults are correct behaviour, not an error.
    return cached;
  } catch (error) {
    // The table may not exist on an older database. Say so once per refresh
    // rather than on every sensor message.
    console.warn(
      '[Thresholds] Could not read system_settings, using defaults ' +
        `(${DEFAULT_THRESHOLDS.low_water_pct}% water / ` +
        `${DEFAULT_THRESHOLDS.low_soap_pct}% soap / ` +
        `${DEFAULT_THRESHOLDS.low_wax_pct}% wax): ${error.message}`
    );
    return cached;
  }
}

function getThresholds() {
  return { ...cached };
}

/**
 * Start the periodic refresh. Called once at bridge start; safe to call again.
 */
function startThresholdRefresh(intervalMs = REFRESH_MS) {
  if (refreshTimer) return;

  refreshTimer = setInterval(() => {
    void loadThresholds();
  }, intervalMs);

  // Do not hold the process open for a cache refresh.
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
}

function stopThresholdRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Apply the thresholds to one levels reading.
 *
 * Raises an alert for each tank at or below its threshold, and auto-resolves
 * the ones that came back up. Both use the existing createAlert/resolveAlerts
 * helpers, which already dedupe: createAlert bumps an unresolved row rather
 * than inserting a second one, so a tank that stays low for a week produces one
 * alert, not hundreds.
 *
 * Returns what it did, so a caller can log it and a test can assert on it.
 */
async function checkThresholds(deviceId, levels) {
  const { breaches, recoverable } = evaluateLevels(levels, cached);
  const raised = [];
  const resolved = [];

  for (const breach of breaches) {
    const message = describeBreach(breach);
    await db.createAlert(deviceId, breach.type, message, breach.severity);
    raised.push({ type: breach.type, message, severity: breach.severity });
  }

  for (const type of recoverable) {
    // Only clear a type that is not currently breaching. Without this a
    // reading where tank A is low and tank B is fine would raise LOW_SOAP and
    // then immediately resolve it.
    if (breaches.some((b) => b.type === type)) continue;
    await db.resolveAlerts(deviceId, type);
    resolved.push(type);
  }

  return { raised, resolved };
}

module.exports = {
  REFRESH_MS,
  loadThresholds,
  getThresholds,
  startThresholdRefresh,
  stopThresholdRefresh,
  checkThresholds,
};