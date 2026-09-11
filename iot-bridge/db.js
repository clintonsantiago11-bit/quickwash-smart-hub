const mysql = require('mysql2/promise');

// Connection pool to MySQL (configurable via env vars, defaults target XAMPP)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quickwash_hub',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Dedupe for DEVICE_ONLINE audits so bursty first-contact topics log once
const lastOnlineAudit = {}; // deviceId -> epoch ms

// Friendly labels so the audit log reads like plain English
const ALERT_TYPE_LABELS = {
  JAM_ERROR: 'Motor jam',
  LOW_SOAP: 'Low soap supply',
  LOW_WATER: 'Low water level',
  SYSTEM_ALERT: 'System'
};
const CYCLE_LABELS = { standard: 'Standard', premium: 'Premium' };
const deviceNameCache = {}; // deviceId -> friendly name

async function getDeviceName(deviceId) {
  if (deviceNameCache[deviceId]) return deviceNameCache[deviceId];
  try {
    const [rows] = await pool.execute('SELECT name FROM devices WHERE id = ?', [deviceId]);
    if (rows.length > 0) {
      deviceNameCache[deviceId] = rows[0].name;
      return rows[0].name;
    }
  } catch (error) {
    console.error('[DB Error] Failed to fetch device name:', error.message);
  }
  return deviceId;
}

function humanDuration(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s}s` : `${m} minutes`;
}

/**
 * Ensure a device row exists (required by foreign keys) and mark it online.
 * Unknown devices are auto-registered with safe defaults instead of failing silently.
 * The device type is only upgraded when the incoming message is more specific
 * (camera/vending) so a controller type never clobbers a known node type.
 */
async function ensureDevice(deviceId, type = 'controller') {
  try {
    const [rows] = await pool.execute(
      'SELECT status, name FROM devices WHERE id = ?',
      [deviceId]
    );
    const wasOnline = rows.length > 0 && rows[0].status === 'online';

    await pool.execute(
      `INSERT INTO devices (id, facility_id, name, type, status, last_seen)
       VALUES (?, 1, ?, ?, 'online', NOW())
       ON DUPLICATE KEY UPDATE
         status = 'online',
         last_seen = NOW(),
         type = IF(VALUES(type) != 'controller', VALUES(type), devices.type)`,
      [deviceId, deviceId, type]
    );

    // Audit the online transition (deduped so a burst of topics logs once)
    if (!wasOnline) {
      const now = Date.now();
      if (!lastOnlineAudit[deviceId] || now - lastOnlineAudit[deviceId] > 60000) {
        lastOnlineAudit[deviceId] = now;
        const name = await getDeviceName(deviceId);
        await createAuditLog('System', 'DEVICE_ONLINE', `${name} came online`);
      }
    }
    return { online: true, wasOnline };
  } catch (error) {
    console.error(`[DB Error] Failed to register device ${deviceId}:`, error.message);
    return { online: false, wasOnline: true };
  }
}

/**
 * Mark devices offline when their heartbeat goes stale (used by a periodic sweeper).
 * Returns the list of devices that transitioned to offline so callers can audit.
 */
async function markStaleDevicesOffline() {
  try {
    // 90s grace window tolerates public-broker latency and slow heartbeats
    const [rows] = await pool.execute(
      `SELECT id, name FROM devices
       WHERE status = 'online'
         AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 90 SECOND))`
    );
    if (rows.length === 0) return [];

    await pool.execute(
      `UPDATE devices SET status = 'offline'
       WHERE status = 'online'
         AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 90 SECOND))`
    );
    return rows;
  } catch (error) {
    console.error('[DB Error] Failed to mark stale devices offline:', error.message);
    return [];
  }
}

/**
 * Log sensor readings
 */
async function logSensorData(deviceId, data) {
  const { water, soap_a, soap_b, wax, temp, flow } = data;
  await ensureDevice(deviceId, 'controller');
  try {
    const [result] = await pool.execute(
      'INSERT INTO sensor_logs (device_id, water_level, soap_a_level, soap_b_level, wax_level, temperature, flow_rate, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        deviceId,
        water !== undefined ? water : null,
        soap_a !== undefined ? soap_a : null,
        soap_b !== undefined ? soap_b : null,
        wax !== undefined ? wax : null,
        temp !== undefined ? temp : null,
        flow !== undefined ? flow : null
      ]
    );
    return result;
  } catch (error) {
    console.error('[DB Error] Failed to log sensor data:', error.message);
  }
}

/**
 * Log a vending transaction (Coin drop)
 */
async function logVendingTransaction(deviceId, amount) {
  await ensureDevice(deviceId, 'vending');
  try {
    const [result] = await pool.execute(
      'INSERT INTO vending_transactions (device_id, amount, payment_method, transaction_time) VALUES (?, ?, ?, NOW())',
      [deviceId, amount, 'coin']
    );
    const name = await getDeviceName(deviceId);
    await createAuditLog('System', 'COIN_ACCEPTED', `A ₱${amount} coin was accepted by the ${name}`);
    return result;
  } catch (error) {
    console.error('[DB Error] Failed to log vending transaction:', error.message);
  }
}

/**
 * Create a new system alert.
 * Dedupes by (device, type) while unresolved: repeated sensor reports for the
 * same ongoing fault bump the existing alert instead of flooding the table.
 */
async function createAlert(deviceId, type, message, severity) {
  await ensureDevice(deviceId, 'controller');
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM alerts WHERE device_id = ? AND type = ? AND resolved = 0 ORDER BY id DESC LIMIT 1',
      [deviceId, type]
    );
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE alerts SET message = ?, severity = ?, created_at = NOW() WHERE id = ?',
        [message, severity, existing[0].id]
      );
      return existing[0].id;
    }
    const [result] = await pool.execute(
      'INSERT INTO alerts (device_id, type, message, severity, resolved, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [deviceId, type, message, severity]
    );
    const name = await getDeviceName(deviceId);
    const label = ALERT_TYPE_LABELS[type] || 'system';
    await createAuditLog('System', 'ALERT_TRIGGERED', `Detected ${label} issue on the ${name} — ${message}`);
    return result.insertId;
  } catch (error) {
    console.error('[DB Error] Failed to create alert:', error.message);
  }
}

/**
 * Resolve all unresolved alerts of a given type for a device
 * (e.g. auto-resolve JAM_ERROR once the bay reports healthy again).
 */
async function resolveAlerts(deviceId, type) {
  try {
    const [result] = await pool.execute(
      'UPDATE alerts SET resolved = 1 WHERE device_id = ? AND type = ? AND resolved = 0',
      [deviceId, type]
    );
    if (result.affectedRows > 0) {
      const name = await getDeviceName(deviceId);
      const label = ALERT_TYPE_LABELS[type] || 'system';
      const detail = result.affectedRows > 1
        ? `The ${label} alerts on the ${name} cleared automatically (${result.affectedRows} alerts)`
        : `The ${label} alert on the ${name} cleared automatically`;
      await createAuditLog('System', 'ALERT_RESOLVED', detail);
    }
    return result.affectedRows;
  } catch (error) {
    console.error('[DB Error] Failed to resolve alerts:', error.message);
  }
}

/**
 * Log a completed wash cycle
 */
async function logWashCompletion(deviceId, cycleType, startedAt, completedAt) {
  try {
    const [priceRows] = await pool.execute(
      `SELECT
         CASE WHEN ? = 'premium' THEN premium_price ELSE standard_price END AS price
       FROM vendo_settings WHERE id = 1`,
      [cycleType]
    );
    const price = priceRows.length > 0 ? priceRows[0].price : 0;
    const duration = startedAt ? Math.max(0, Math.round((completedAt - startedAt) / 1000)) : 0;

    const [result] = await pool.execute(
      `INSERT INTO wash_logs (device_id, cycle_type, price, started_at, completed_at, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [deviceId, cycleType || 'standard', price, startedAt ? new Date(startedAt) : null, new Date(completedAt), duration]
    );
    const name = await getDeviceName(deviceId);
    const cycleLabel = CYCLE_LABELS[cycleType] || cycleType;
    await createAuditLog('System', 'WASH_COMPLETED', `A ${cycleLabel} wash cycle finished on the ${name} — ₱${price}, took ${humanDuration(duration)}`);
    return result.insertId;
  } catch (error) {
    console.error('[DB Error] Failed to log wash completion:', error.message);
  }
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, full_name, email, role, avatar_url, phone, designation, is_dark_mode, email_alerts FROM users WHERE id = ?',
      [userId]
    );
    return rows[0];
  } catch (error) {
    console.error('[DB Error] Failed to fetch user:', error.message);
    return null;
  }
}

/**
 * Update user profile
 */
async function updateUserProfile(userId, data) {
  const { full_name, email, phone, designation, is_dark_mode, email_alerts } = data;
  try {
    const [result] = await pool.execute(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, designation = ?, is_dark_mode = ?, email_alerts = ? WHERE id = ?',
      [full_name, email, phone, designation, is_dark_mode ? 1 : 0, email_alerts ? 1 : 0, userId]
    );
    return result;
  } catch (error) {
    console.error('[DB Error] Failed to update user profile:', error.message);
    throw error;
  }
}

async function createAuditLog(user, action, details, ip = null) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO audit_logs (user, action, details, ip_address, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [user, action, details, ip]
    );
    return result;
  } catch (error) {
    console.error('[DB Error] Failed to create audit log:', error.message);
  }
}

module.exports = {
  pool,
  ensureDevice,
  markStaleDevicesOffline,
  logSensorData,
  logVendingTransaction,
  logWashCompletion,
  createAlert,
  resolveAlerts,
  getUserById,
  updateUserProfile,
  createAuditLog
};