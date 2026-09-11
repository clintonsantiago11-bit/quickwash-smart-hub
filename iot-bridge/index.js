/**
 * QuickWash Smart Hub - IoT Bridge
 * 
 * This server acts as the middleman between the ESP32 hardware (via MQTT),
 * the MySQL database, and the Next.js Frontend (via Socket.IO WebSocket).
 * 
 * Hardware (ESP32) -> MQTT Broker -> [This Bridge] -> Socket.IO -> Browser
 *                                       |-> MySQL
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

// Configuration
const PORT = process.env.PORT || 3001;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const FACILITY_ID = process.env.FACILITY_ID || 'quickwash_main';
const API_KEY = process.env.BRIDGE_API_KEY || ''; // Fail closed: empty key = no admin access
// Explicit CORS allowlist (comma-separated). Never use '*' in production.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

// Track ongoing bay sessions so a wash is logged exactly once on completion
const baySessions = new Map(); // deviceId -> { status, cycleType, startedAt }

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST'] }
});

// Simple shared-secret auth for REST admin endpoints. Header-only (never via
// query string, which leaks the key into access logs / URL history). Fails
// closed: if BRIDGE_API_KEY is unset, every request is rejected.
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!API_KEY || key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// MQTT Client
console.log(`Connecting to MQTT Broker: ${MQTT_BROKER}...`);
const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: `quickwash_bridge_${Math.random().toString(16).substring(2, 8)}`,
  reconnectPeriod: 5000,
  connectTimeout: 10000
});

mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT Broker');

  // Subscribe to all QuickWash topics for this facility
  const topicFilter = `quickwash/${FACILITY_ID}/#`;
  mqttClient.subscribe(topicFilter, (err) => {
    if (!err) console.log(`📡 Subscribed to topic: ${topicFilter}`);
  });
});

mqttClient.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT Broker...');
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT error:', err.message);
});

mqttClient.on('offline', () => {
  console.warn('⚠️ MQTT Broker went offline');
});

// Handle incoming messages from ESP32 hardware
mqttClient.on('message', async (topic, message) => {
  const payload = message.toString();
  // console.log(`[MQTT] Received: ${topic} → ${payload}`);

  try {
    const data = JSON.parse(payload);

    // Broadcast the message to all connected browsers via Socket.IO
    io.emit('hardware_update', {
      topic,
      data,
      timestamp: new Date().toISOString()
    });

    // Extract details from topic (e.g. quickwash/quickwash_main/sensor/esp32_bay_1/levels)
    const topicParts = topic.split('/');
    const category = topicParts[2]; // status, sensor, alert, command
    const deviceId = topicParts[3]; // esp32_bay_1, esp32_vending, etc.
    const detail = topicParts[4];   // levels, flow_temp, vending

    if (!deviceId) return;

    // Mark the device online whenever we hear from it
    if (category === 'status') {
      await db.ensureDevice(deviceId, data.deviceType || inferDeviceType(topic));
    }

    // Log to Database based on topic category
    if (category === 'sensor' || category === 'vending') {
      if (detail === 'levels') {
        await db.ensureDevice(deviceId, 'controller');
        await db.logSensorData(deviceId, {
          water: data.water,
          soap_a: data.soap_a,
          soap_b: data.soap_b,
          wax: data.wax
        });
      } else if (detail === 'flow_temp') {
        await db.ensureDevice(deviceId, 'controller');
        await db.logSensorData(deviceId, {
          flow: data.flow_lpm,
          temp: data.temp_c
        });
      } else if (detail === 'vending' || category === 'vending') {
        if (data.event === 'coin_inserted' || data.action === 'coin_drop') {
          await db.logVendingTransaction(deviceId, data.amount);
        }
      }
    } else if (category === 'alert') {
      await db.createAlert(deviceId, data.type || 'SYSTEM_ALERT', data.message || '', data.severity || 'warning');
    } else if (category === 'status') {
      if (data.status === 'error') {
        await db.createAlert(deviceId, 'JAM_ERROR', 'Motor resistance detected on roller assembly', 'critical');
        const session = baySessions.get(deviceId);
        if (session && session.status === 'active') {
          await db.logWashCompletion(deviceId, session.cycleType, session.startedAt, Date.now());
        }
        baySessions.delete(deviceId);
      } else if (data.status === 'available' || data.status === 'active') {
        // Bay is healthy again -> auto-resolve outstanding jam alerts
        await db.resolveAlerts(deviceId, 'JAM_ERROR');

        const session = baySessions.get(deviceId);
        if (data.status === 'active') {
          // Wash just started -> begin tracking it
          if (!session || session.status !== 'active') {
            baySessions.set(deviceId, {
              status: 'active',
              cycleType: data.type || 'standard',
              startedAt: Date.now()
            });
          } else {
            session.cycleType = data.type || session.cycleType;
            baySessions.set(deviceId, session);
          }
        } else if (data.status === 'available' && session && session.status === 'active') {
          // Wash finished -> log completion
          await db.logWashCompletion(deviceId, session.cycleType, session.startedAt, Date.now());
          baySessions.delete(deviceId);
        }
      }
    }

  } catch (e) {
    console.error(`Error parsing MQTT message payload: ${payload}`, e.message);
  }
});

// Infer device type from the topic path so new hardware registers correctly
function inferDeviceType(topic) {
  const t = topic.toLowerCase();
  if (t.includes('cam')) return 'camera';
  if (t.includes('vend')) return 'vending';
  return 'controller';
}

// Handle Socket.IO connections from Browser
// NOTE: Device commands are NOT accepted over this channel. All commands go
// through the authenticated Laravel API (POST /api/devices/{id}/command)
// which publishes to MQTT itself - this avoids an unauthenticated control
// path and double-sending.
io.on('connection', (socket) => {
  console.log(`💻 Browser connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`💻 Browser disconnected: ${socket.id}`);
  });
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'online', mqtt: mqttClient.connected ? 'connected' : 'disconnected' });
});

// Profile Endpoints (protected by API key)
app.get('/api/user/profile', requireApiKey, async (req, res) => {
  try {
    const user = await db.getUserById(1);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/user/profile', requireApiKey, async (req, res) => {
  try {
    await db.updateUserProfile(1, req.body);
    await db.createAuditLog(req.body.full_name || 'Admin', 'UPDATE_PROFILE', 'User updated their personal details and designation');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 IoT Bridge running on http://localhost:${PORT}`);
});

// NAEK edge agent: polls the stock NAEK carwash timer page and syncs it
// (config via NAEK_* env vars; set NAEK_ENABLED=false to disable)
if (process.env.NAEK_ENABLED !== 'false') {
  const naekAgent = require('./naek-agent');
  naekAgent.start(io);
}

// Sweep for stale heartbeats every 30s and audit offline transitions
setInterval(async () => {
  try {
    const stale = await db.markStaleDevicesOffline();
    for (const device of stale) {
      await db.createAuditLog('System', 'DEVICE_OFFLINE', `The ${device.name} went offline (stopped responding for over 30 seconds)`);
      console.log(`📴 Device offline (heartbeat timeout): ${device.id}`);
    }
  } catch (error) {
    console.error('[Sweeper Error]', error.message);
  }
}, 30000);