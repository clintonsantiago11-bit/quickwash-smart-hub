/**
 * Supply thresholds: the logic that decides when a tank is low.
 *
 * This is the piece that makes the dashboard's threshold settings mean
 * something. Before it existed, the levels reported on the
 * .../sensor/<device>/levels topic were written to sensor_logs and nothing
 * else happened: no code anywhere compared a level to a threshold, so the
 * "Low water alert (%)" and "Low soap alert (%)" fields on the settings screen
 * were stored in a browser and read by nobody.
 *
 * The comparison lives in a module with no database import on purpose, so it
 * can be unit tested without MySQL. Everything that touches the pool is in
 * thresholds-store.js.
 */

const DEFAULT_THRESHOLDS = {
  low_water_pct: 20,
  low_soap_pct: 15,
  low_wax_pct: 15,
};

/**
 * Severities, kept here so the mapping is stated once.
 *
 * An empty or almost-empty tank is a warning; a tank that has run dry stops
 * the machine, so that is critical.
 */
const CRITICAL_AT_PCT = 5;

/** The sensor columns we monitor, and the alert type each raises. */
const MONITORED = [
  { field: 'water', thresholdKey: 'low_water_pct', type: 'LOW_WATER', label: 'Water tank' },
  { field: 'soap_a', thresholdKey: 'low_soap_pct', type: 'LOW_SOAP', label: 'Soap tank A' },
  { field: 'soap_b', thresholdKey: 'low_soap_pct', type: 'LOW_SOAP', label: 'Soap tank B' },
  { field: 'wax', thresholdKey: 'low_wax_pct', type: 'LOW_WAX', label: 'Wax tank' },
];

/**
 * A reading is usable only if it is a finite number.
 *
 * The firmware omits a level it has no sensor for, so `undefined` and `null`
 * both mean "not reported" and must not be compared - `null < 20` is true in
 * JavaScript, which would raise a low-water alert for a tank nobody is
 * reporting on.
 */
function isUsableLevel(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Compare one reading against its threshold.
 *
 * Breaches at or below the threshold, not below it. A tank sitting exactly on
 * the configured value has not been replenished, so treating it as healthy
 * would mean the number the operator set does not mean what they think.
 */
function evaluateOne(level, thresholdPct) {
  if (!isUsableLevel(level)) return null;
  if (!Number.isFinite(thresholdPct)) return null;

  // A threshold outside 0-100 is ignored rather than clamped. Clamping 900 to
  // 100 would make every tank look empty and raise a flood of alerts; ignoring
  // it keeps the previous behaviour until the value is corrected. The
  // controller rejects these with a 422, so this only guards against a
  // hand-edited or corrupted row.
  if (thresholdPct < 0 || thresholdPct > 100) return null;

  const threshold = thresholdPct;

  if (level > threshold) return null;

  return {
    breached: true,
    level,
    threshold,
    severity: level <= CRITICAL_AT_PCT ? 'critical' : 'warning',
  };
}

/**
 * Evaluate every monitored tank in one reading.
 *
 * `breaches` is what needs an alert raised. `recoverable` is what may now be
 * auto-resolved, and is deliberately separate: a tank that was reported at 80%
 * is not evidence that a tank that was never reported has recovered, so the
 * two must not be conflated.
 *
 * The two soap tanks share one alert type, so they are folded into a single
 * entry naming whichever tank is lower. createAlert dedupes on (device, type)
 * and bumps the existing row, so one LOW_SOAP alert covers both tanks and does
 * not double up.
 */
function evaluateLevels(levels, thresholds) {
  const config = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };

  const breaches = [];
  // A tank that came back ABOVE its threshold, which is the only evidence that
  // warrants clearing an existing alert. A breach is not recovery: resolveAlerts
  // clears by (device, type), so a breaching type listed here would have its
  // alert raised and cleared on the same reading.
  const recoverable = [];

  let soapLowest = null;
  let soapLowestTank = null;

  for (const item of MONITORED) {
    const level = levels?.[item.field];
    const threshold = config[item.thresholdKey];

    // Recovery is tracked per alert TYPE, which is what resolveAlerts clears.
    // Only a usable reading strictly above the threshold counts.
    if (isUsableLevel(level) && Number.isFinite(threshold) && level > threshold) {
      if (!recoverable.includes(item.type)) recoverable.push(item.type);
    }

    const outcome = evaluateOne(level, threshold);
    if (!outcome) continue;

    if (item.type === 'LOW_SOAP') {
      // Both tanks raise LOW_SOAP; keep the worse reading for the message.
      if (soapLowest === null || outcome.level < soapLowest.level) {
        soapLowest = outcome;
        soapLowestTank = item.label;
      }
      continue;
    }

    breaches.push({
      type: item.type,
      label: item.label,
      ...outcome,
    });
  }

  if (soapLowest) {
    breaches.push({
      type: 'LOW_SOAP',
      label: soapLowestTank,
      ...soapLowest,
    });
  }

  return { breaches, recoverable };
}

/**
 * The human sentence that goes into the alert.
 *
 * States the reading and the threshold the operator configured, because
 * "Low water level" on its own gives them nothing to compare against.
 */
function describeBreach(breach) {
  const pct = Math.round(breach.level);
  const at = Math.round(breach.threshold);
  return (
    `${breach.label} at ${pct}% of capacity, ` +
    (breach.level <= at ? 'at or below' : 'below') +
    ` the ${at}% low-supply threshold`
  );
}

module.exports = {
  DEFAULT_THRESHOLDS,
  CRITICAL_AT_PCT,
  MONITORED,
  isUsableLevel,
  evaluateOne,
  evaluateLevels,
  describeBreach,
};