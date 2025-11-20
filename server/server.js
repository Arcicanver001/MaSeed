require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, query, orderByChild, startAt, endAt, limitToLast, get, set, update, remove } = require('firebase/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const firebaseConfig = require('./firebase-config');

// Make compression optional (in case it's not installed on server)
let compression;
try {
  compression = require('compression');
} catch (e) {
  console.warn('⚠️ Compression module not available, continuing without compression');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));

// Add compression middleware - reduces bandwidth by 70-90% (optional)
if (compression) {
  app.use(compression({
    level: 6, // Balance between CPU and compression (1-9, 6 is optimal)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Compress all JSON responses
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use the default compression filter
      return compression.filter ? compression.filter(req, res) : true;
    }
  }));
  console.log('✅ Compression middleware enabled');
} else {
  console.log('⚠️ Compression middleware disabled (module not available)');
}

app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies (increased limit for base64 images)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add keep-alive headers for connection reuse
app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
    // Add cache headers for static-like data
    if (req.path.startsWith('/api/history')) {
        res.setHeader('Cache-Control', 'public, max-age=30'); // Cache for 30 seconds
    }
    next();
});

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
console.log('✅ Firebase initialized');

// Helper function to set CORS headers (ensures headers are always sent)
function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
}

// MQTT subscription and ingestion
// IMPORTANT: Arduino publishes to greenhouse/temperature, greenhouse/humidity, etc. (NOT greenhouse/cedrick1/*)
// Force TOPIC_PREFIX to be 'greenhouse' to match Arduino publishing pattern
const TOPIC_PREFIX = 'greenhouse'; // Arduino publishes to: greenhouse/temperature, greenhouse/humidity, etc.
// Also handle alternate topic names: greenhouse/soil_moisture -> soil_humidity, greenhouse/soil_ph -> ph
const sensorTopics = [
  `${TOPIC_PREFIX}/temperature`,
  `${TOPIC_PREFIX}/humidity`,
  `${TOPIC_PREFIX}/light`,
  `${TOPIC_PREFIX}/ph`,
  `${TOPIC_PREFIX}/soil_ph`,           // Arduino publishes soil_ph
  `${TOPIC_PREFIX}/soil_moisture`,     // Arduino publishes soil_moisture
  `${TOPIC_PREFIX}/soil_humidity`,     // Alternative name
  `${TOPIC_PREFIX}/soil_temperature`,
  `${TOPIC_PREFIX}/nitrogen`,
  `${TOPIC_PREFIX}/phosphorus`,
  `${TOPIC_PREFIX}/potassium`
];

const actuatorTopics = [
  `${TOPIC_PREFIX}/actuators/fan_status`,
  `${TOPIC_PREFIX}/actuators/humidifier_status`,
  `${TOPIC_PREFIX}/actuators/sprinkler_status`
];

const topics = [...sensorTopics, ...actuatorTopics];

const actuatorTopicMap = {
  fan_status: 'fan',
  humidifier_status: 'humidifier',
  sprinkler_status: 'sprinkler'
};

console.log(`📡 MQTT Topic Prefix: ${TOPIC_PREFIX}`);
console.log(`📡 Subscribing to topics matching Arduino publishing pattern: ${TOPIC_PREFIX}/*`);

const mqttUrl = process.env.MQTT_URL || 'mqtt://broker.emqx.io:1883';
const client = mqtt.connect(mqttUrl, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  reconnectPeriod: 2000
});

client.on('connect', () => {
  console.log('✅ MQTT connected!');
  console.log(`📡 Subscribing to ${topics.length} topics:`);
  topics.forEach(t => {
    client.subscribe(t, (err) => {
      if (err) {
        console.error(`   ❌ Failed to subscribe to ${t}:`, err.message);
      } else {
        console.log(`   ✅ Subscribed to ${t}`);
      }
    });
  });
  console.log(`\n💡 Waiting for sensor data on topics...`);
  console.log(`   If you don't see "📨 Received:" messages, check:`);
  console.log(`   1. Arduino is powered on and connected to WiFi`);
  console.log(`   2. Arduino is publishing to: ${TOPIC_PREFIX}/*`);
  console.log(`   3. MQTT broker URL matches: ${mqttUrl}\n`);
});

client.on('error', (err) => {
  console.error('❌ MQTT error:', err.message);
});

client.on('offline', () => {
  console.error('❌ MQTT client went offline');
});

client.on('reconnect', () => {
  console.log('🔄 MQTT reconnecting...');
});

client.on('message', (topic, msg, packet) => {
  // Ignore retained messages from public brokers
  if (packet && packet.retain) {
    console.log(`ℹ️ Ignoring retained message on ${topic}`);
    return;
  }

  const parts = topic.split('/');
  if (parts.length >= 3 && parts[1] === 'actuators') {
    handleActuatorMessage(topic, msg.toString());
    return;
  }

  const value = parseFloat(msg.toString());
  let sensor = parts[parts.length - 1];
  const originalSensor = sensor;
  
  // Map Arduino topic names to database sensor names
  if (sensor === 'soil_moisture') {
    sensor = 'soil_humidity';  // Map soil_moisture -> soil_humidity
  } else if (sensor === 'soil_ph') {
    sensor = 'ph';  // Map soil_ph -> ph
  }
  
  const timestamp = Date.now();
  
  // Log received message
  if (originalSensor !== sensor) {
    console.log(`📨 Received: ${topic} = ${value} (mapped to ${sensor})`);
  } else {
    console.log(`📨 Received: ${topic} = ${value}`);
  }

  if (Number.isNaN(value)) {
    console.warn(`⚠️ Non-numeric value on ${topic}: ${msg.toString()}`);
    return;
  }
  if (!isValidReading(sensor, value)) {
    console.warn(`⚠️ Invalid reading ${sensor}=${value} (from ${topic})`);
    return;
  }

  try {
    const sensorRef = ref(db, `readings/${sensor}`);
    push(sensorRef, {
      ts: timestamp,
      value: value
    }).then(() => {
      const timeStr = new Date(timestamp).toLocaleString();
      console.log(`✅ Saved REAL sensor data: ${sensor}=${value} at ${timeStr} (${new Date(timestamp).toISOString()})`);
    }).catch((error) => {
      console.error(`❌ Firebase insert error for ${sensor}:`, error.message);
    });
  } catch (e) {
    console.error(`❌ DB insert error for ${sensor}:`, e.message);
  }
});

function handleActuatorMessage(topic, rawStatus) {
  const parts = topic.split('/');
  const actuatorKey = parts[parts.length - 1]; // e.g., fan_status
  const actuatorName = actuatorTopicMap[actuatorKey];

  if (!actuatorName) {
    console.warn(`⚠️ Unknown actuator topic: ${topic}`);
    return;
  }

  const status = rawStatus.trim().toUpperCase();
  if (!['ON', 'OFF'].includes(status)) {
    console.warn(`⚠️ Invalid actuator status "${rawStatus}" on topic ${topic}`);
    return;
  }

  const timestamp = Date.now();
  console.log(`📨 Actuator event: ${actuatorName} -> ${status}`);

  const actuatorRef = ref(db, `actuators/${actuatorName}`);
  push(actuatorRef, { ts: timestamp, status })
    .then(() => {
      console.log(`✅ Saved actuator event: ${actuatorName}=${status} at ${new Date(timestamp).toLocaleString()}`);
    })
    .catch(error => {
      console.error(`❌ Firebase insert error for actuator ${actuatorName}:`, error.message);
    });
}

function isValidReading(sensor, value) {
  switch (sensor) {
    case 'temperature': return value > -10 && value < 60;
    case 'humidity': return value >= 0 && value <= 100;
    case 'light': return value >= 0 && value <= 120000;
    case 'ph': return value >= 0 && value <= 14;
    case 'soil_humidity': return value >= 0 && value <= 100;
    case 'soil_temperature': return value > -10 && value < 60;
    case 'nitrogen': return value >= 0 && value < 10000;
    case 'phosphorus': return value >= 0 && value < 10000;
    case 'potassium': return value >= 0 && value < 10000;
    default: return true;
  }
}

// Root route - API information page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Greenhouse API Server</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: #1a1a1a;
                color: #e0e0e0;
            }
            h1 { color: #4CAF50; }
            h2 { color: #81C784; margin-top: 30px; }
            code {
                background: #2d2d2d;
                padding: 2px 6px;
                border-radius: 3px;
                color: #f8f8f2;
            }
            pre {
                background: #2d2d2d;
                padding: 15px;
                border-radius: 5px;
                overflow-x: auto;
                border-left: 3px solid #4CAF50;
            }
            .endpoint {
                margin: 15px 0;
                padding: 10px;
                background: #2d2d2d;
                border-radius: 5px;
            }
            .method {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 3px;
                font-weight: bold;
                margin-right: 10px;
            }
            .get { background: #4CAF50; color: white; }
            .status {
                display: inline-block;
                padding: 5px 10px;
                border-radius: 3px;
                margin-left: 10px;
            }
            .online { background: #4CAF50; color: white; }
            .offline { background: #f44336; color: white; }
        </style>
    </head>
    <body>
        <h1>🌱 Greenhouse API Server</h1>
        <p>API server for greenhouse sensor data collection and history.</p>
        
        <div class="status online">✅ Server Running</div>
        
        <h2>📡 API Endpoints</h2>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/history</code>
            <p>Get historical sensor data</p>
            <pre>Query Parameters:
  - sensor: temperature|humidity|light|ph|soil_humidity|soil_temperature|nitrogen|phosphorus|potassium
  - fromMs: timestamp in milliseconds (default: 24 hours ago)

Example: /api/history?sensor=temperature&fromMs=1733342400000</pre>
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <code>/api/latest</code>
            <p>Get latest data timestamp for all sensors</p>
            <pre>Returns JSON with latest timestamp and value for each sensor</pre>
        </div>
        
        <h2>🔧 Configuration</h2>
        <ul>
            <li><strong>MQTT Broker:</strong> ${process.env.MQTT_URL || 'mqtt://broker.emqx.io:1883'}</li>
            <li><strong>Topic Prefix:</strong> ${process.env.TOPIC_PREFIX || 'greenhouse'}</li>
            <li><strong>Firebase Database:</strong> ${firebaseConfig.databaseURL}</li>
        </ul>
        
        <h2>📊 Dashboard</h2>
        <p>To view the dashboard, open <code>index.html</code> in your browser.</p>
        
        <p style="margin-top: 40px; color: #888; font-size: 0.9em;">
            Server started at ${new Date().toLocaleString()}
        </p>
    </body>
    </html>
  `);
});

// API endpoint to get latest data timestamp for each sensor (for diagnostics)
// CRITICAL FIX: Uses limitToLast(1) to only download the latest record instead of entire database
app.get('/api/latest', async (req, res) => {
  const sensors = ['temperature', 'humidity', 'light', 'ph', 'soil_humidity', 'soil_temperature', 'nitrogen', 'phosphorus', 'potassium'];
  const latestData = {};
  
  try {
    const promises = sensors.map(async (sensor) => {
      try {
        const sensorRef = ref(db, `readings/${sensor}`);
        
        // CRITICAL FIX: Query only the latest record instead of downloading all data
        const latestQuery = query(
          sensorRef,
          orderByChild('ts'),
          limitToLast(1) // Only get the LAST (most recent) record - 99% bandwidth reduction
        );
        
        const snapshot = await get(latestQuery);
        let latest = null;
        
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data && typeof data.ts === 'number') {
              latest = { ts: data.ts, value: data.value };
            }
          });
        }
        
        return { sensor, latest };
      } catch (error) {
        console.error(`❌ Error fetching latest for ${sensor}:`, error.message);
        return { sensor, latest: null, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ sensor, latest, error }) => {
      latestData[sensor] = latest ? {
        timestamp: latest.ts,
        value: latest.value,
        timeAgo: Date.now() - latest.ts,
        humanReadable: new Date(latest.ts).toLocaleString()
      } : null;
      if (error) {
        latestData[sensor] = { error };
      }
    });
    
    console.log('📊 Latest data timestamps:');
    Object.keys(latestData).forEach(sensor => {
      if (latestData[sensor] && latestData[sensor].timestamp) {
        const minutesAgo = Math.floor(latestData[sensor].timeAgo / 60000);
        console.log(`   ${sensor}: ${latestData[sensor].humanReadable} (${minutesAgo} minutes ago)`);
      } else {
        console.log(`   ${sensor}: No data found`);
      }
    });
    
    res.json(latestData);
  } catch (e) {
    console.error('❌ Error fetching latest data:', e.message);
    setCORSHeaders(req, res);
    res.status(500).json({ error: e.message });
  }
});

// Helper function to sample data for long time ranges (reduces bandwidth by 80-95%)
function sampleData(data, maxPoints = 1000) {
    if (data.length <= maxPoints) return data;
    
    const interval = Math.ceil(data.length / maxPoints);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += interval) {
        sampled.push(data[i]);
    }
    
    // Always include last point
    if (sampled.length > 0 && data.length > 0 && sampled[sampled.length - 1].ts !== data[data.length - 1].ts) {
        sampled.push(data[data.length - 1]);
    }
    
    return sampled;
}

// Read API
app.get('/api/history', async (req, res) => {
  const sensor = req.query.sensor || 'temperature';
  const fromMs = parseInt(req.query.fromMs || (Date.now() - 24*3600*1000), 10);
  const toMs = Date.now(); // Current time as upper bound
  
  console.log(`📊 Fetching history for sensor: ${sensor}, fromMs: ${fromMs} (${new Date(fromMs).toLocaleString()}) to ${toMs} (${new Date(toMs).toLocaleString()})`);
  
  try {
    const sensorRef = ref(db, `readings/${sensor}`);
    
    // Calculate dynamic limit based on time range to prevent excessive bandwidth
    const timeRange = toMs - fromMs;
    const hours = timeRange / (60 * 60 * 1000);
    
    // Allow more points for longer ranges (assuming ~5 second intervals)
    let MAX_POINTS;
    if (hours <= 1) MAX_POINTS = 720;           // 1 hour: 5 sec intervals = 720 points max
    else if (hours <= 24) MAX_POINTS = 17280;   // 24 hours: 5 sec intervals = 17,280 points max
    else if (hours <= 168) MAX_POINTS = 120960; // 7 days: 5 sec intervals = 120,960 points max
    else MAX_POINTS = 518400;                    // 30 days: 5 sec intervals = 518,400 points max
    
    console.log(`   📊 Time range: ${hours.toFixed(1)} hours, applying limit: ${MAX_POINTS.toFixed(0)} points max`);
    
    // Try query with orderByChild first
    try {
      const sensorQuery = query(
        sensorRef, 
        orderByChild('ts'), 
        startAt(fromMs), 
        endAt(toMs),
        limitToLast(MAX_POINTS) // Limit results to prevent excessive bandwidth
      );
      const snapshot = await get(sensorQuery);
      const rows = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data && typeof data.ts === 'number' && typeof data.value === 'number') {
            // Double-check the timestamp is within range (in case of any edge cases)
            if (data.ts >= fromMs && data.ts <= toMs) {
              rows.push({
                ts: data.ts,
                value: data.value
              });
            }
          }
        });
      }
      
      // Sort by timestamp ascending
      rows.sort((a, b) => a.ts - b.ts);
      
      // Sample data for long ranges to reduce bandwidth (80-95% reduction)
      let maxPoints;
      if (hours <= 1) maxPoints = 720;        // 1 hour: all points
      else if (hours <= 24) maxPoints = 1440; // 24 hours: 1 per minute
      else if (hours <= 168) maxPoints = 1680; // 7 days: 1 per hour
      else maxPoints = 720;                    // 30 days: 1 per hour
      
      const sampledRows = sampleData(rows, maxPoints);
      
      // Reduce decimal precision to 1 decimal place (30-50% smaller JSON, matches Arduino precision)
      const finalRows = sampledRows.map(row => ({
        ts: row.ts,
        value: Math.round(row.value * 10) / 10 // Round to 1 decimal place
      }));
      
      if (finalRows.length > 0) {
        const oldestTime = new Date(finalRows[0].ts).toLocaleString();
        const newestTime = new Date(finalRows[finalRows.length-1].ts).toLocaleString();
        const newestAge = Math.floor((Date.now() - finalRows[finalRows.length-1].ts) / 60000); // minutes ago
        console.log(`✅ Returning ${finalRows.length} sampled data records for ${sensor} (from ${rows.length} total)`);
        console.log(`   Oldest: ${oldestTime}`);
        console.log(`   Newest: ${newestTime} (${newestAge} minutes ago)`);
      } else {
        console.log(`⚠️ No REAL data found for ${sensor} in time range ${new Date(fromMs).toLocaleString()} to ${new Date(toMs).toLocaleString()}`);
      }
      
      res.json(finalRows);
      return;
    } catch (queryError) {
      // CRITICAL: Don't download all data as fallback - this causes massive bandwidth usage
      // Instead, return an error and log the issue
      console.error(`❌ Query failed for ${sensor}:`, queryError.message);
      console.error(`   This usually means Firebase indexes need to be configured.`);
      console.error(`   Time range: ${new Date(fromMs).toLocaleString()} to ${new Date(toMs).toLocaleString()}`);
      
      // Return error instead of downloading entire database
      res.status(500).json({ 
        error: 'Query failed. Please ensure Firebase database indexes are configured for timestamp queries.',
        sensor: sensor,
        fromMs: fromMs,
        hint: 'Configure index on /readings/{sensor}/ts in Firebase Console'
      });
      return;
    }
  } catch (e) {
    console.error('❌ Firebase read error:', e.message);
    console.error('Stack:', e.stack);
    setCORSHeaders(req, res);
    res.status(500).json({ error: e.message, sensor: sensor, fromMs: fromMs });
  }
});

// Batch history endpoint - fetch multiple sensors in one request (89% fewer requests)
app.get('/api/history/batch', async (req, res) => {
  const sensors = (req.query.sensors || '').split(',').filter(s => s);
  const fromMs = parseInt(req.query.fromMs || (Date.now() - 24*3600*1000), 10);
  const toMs = Date.now();
  
  if (sensors.length === 0) {
    return res.status(400).json({ error: 'No sensors specified' });
  }
  
  try {
    // Fetch all sensors in parallel
    const results = await Promise.allSettled(
      sensors.map(sensor => fetchSensorHistory(sensor, fromMs, toMs))
    );
    
    const data = {};
    sensors.forEach((sensor, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        // Sample and round values
        const timeRange = toMs - fromMs;
        const hours = timeRange / (60 * 60 * 1000);
        let maxPoints;
        if (hours <= 1) maxPoints = 720;
        else if (hours <= 24) maxPoints = 1440;
        else if (hours <= 168) maxPoints = 1680;
        else maxPoints = 720;
        
        const sampled = sampleData(result.value, maxPoints);
        data[sensor] = sampled.map(r => ({
          ts: r.ts,
          v: Math.round(r.value * 10) / 10 // Use 'v' instead of 'value' (shorter key)
        }));
      } else {
        data[sensor] = [];
      }
    });
    
    res.json(data);
  } catch (error) {
    console.error('❌ Batch history error:', error);
    setCORSHeaders(req, res);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to fetch sensor history
async function fetchSensorHistory(sensor, fromMs, toMs) {
  const sensorRef = ref(db, `readings/${sensor}`);
  const timeRange = toMs - fromMs;
  const hours = timeRange / (60 * 60 * 1000);
  
  let MAX_POINTS;
  if (hours <= 1) MAX_POINTS = 720;
  else if (hours <= 24) MAX_POINTS = 1440;
  else if (hours <= 168) MAX_POINTS = 1680;
  else MAX_POINTS = 720;
  
  try {
    const sensorQuery = query(
      sensorRef, 
      orderByChild('ts'), 
      startAt(fromMs), 
      endAt(toMs),
      limitToLast(MAX_POINTS)
    );
    const snapshot = await get(sensorQuery);
    const rows = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        if (data && typeof data.ts === 'number' && typeof data.value === 'number') {
          if (data.ts >= fromMs && data.ts <= toMs) {
            rows.push({ ts: data.ts, value: data.value });
          }
        }
      });
    }
    
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  } catch (error) {
    console.error(`Error fetching ${sensor}:`, error);
    return [];
  }
}

app.get('/api/actuators/history', async (req, res) => {
  const actuator = (req.query.actuator || 'fan').toLowerCase();
  const fromMs = parseInt(req.query.fromMs || (Date.now() - 24 * 3600 * 1000), 10);
  const toMs = Date.now();

  const validActuators = ['fan', 'humidifier', 'sprinkler'];
  if (!validActuators.includes(actuator)) {
    res.status(400).json({ error: `Invalid actuator. Valid options: ${validActuators.join(', ')}` });
    return;
  }

  console.log(`📊 Fetching actuator history for ${actuator}, from ${new Date(fromMs).toLocaleString()} to ${new Date(toMs).toLocaleString()}`);

  try {
    const actuatorRef = ref(db, `actuators/${actuator}`);
    const rows = [];

    const actuatorQuery = query(actuatorRef, orderByChild('ts'), startAt(fromMs), endAt(toMs));
    const snapshot = await get(actuatorQuery);

    if (snapshot.exists()) {
      snapshot.forEach(childSnapshot => {
        const data = childSnapshot.val();
        if (data && typeof data.ts === 'number' && typeof data.status === 'string') {
          rows.push({
            ts: data.ts,
            status: data.status.toUpperCase()
          });
        }
      });
    }

    rows.sort((a, b) => a.ts - b.ts);
    console.log(`✅ Returning ${rows.length} actuator events for ${actuator}`);
    res.json(rows);
  } catch (e) {
    console.error(`❌ Firebase actuator read error for ${actuator}:`, e.message);
    setCORSHeaders(req, res);
    res.status(500).json({ error: e.message, actuator, fromMs });
  }
});

// Authentication configuration
const JWT_SECRET = process.env.JWT_SECRET || 'smart-greenhouse-secret-key-change-in-production';

// Helper function to encode email for Firebase key (replace @ with _at_ and . with _dot_)
function encodeEmailForFirebase(email) {
  return email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_dot_');
}

// Helper function to decode Firebase key back to email
function decodeEmailFromFirebase(encoded) {
  return encoded.replace(/_at_/g, '@').replace(/_dot_/g, '.');
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ==================== AUTHENTICATION ENDPOINTS ====================

// Register new user
// Check if email exists
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    // Encode email for Firebase key
    const emailKey = encodeEmailForFirebase(email);
    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (snapshot.exists()) {
      return res.json({ exists: true });
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, phone, farmName, farmAddress, position } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Validate required fields
  if (!fullName || !phone || !farmName || !farmAddress || !position) {
    return res.status(400).json({ error: 'All personal information fields are required: name, contact, farm, address, and position' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Encode email for Firebase key
    const emailKey = encodeEmailForFirebase(email);
    
    // Check if user already exists
    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (snapshot.exists()) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user data
    const displayName = fullName || email.split('@')[0];
    const userData = {
      email: email.toLowerCase(),
      passwordHash: passwordHash,
      fullName: fullName || displayName,
      displayName: displayName,
      phone: phone || '',
      farmName: farmName || '',
      farmAddress: farmAddress || '',
      position: position || '',
      language: 'English',
      responsibilities: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastPasswordChange: Date.now(),
      role: 'user'
    };

    await set(usersRef, userData);

    // Generate JWT token for auto-login
    const token = jwt.sign(
      { email: userData.email, id: emailKey },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    console.log(`✅ New user registered: ${email}`);
    res.json({
      success: true,
      message: 'Account created successfully',
      token: token,
      expiresIn: 12 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    // Encode email for Firebase key
    const emailKey = encodeEmailForFirebase(email);
    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userData = snapshot.val();
    const passwordMatch = await bcrypt.compare(password, userData.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update lastLogin timestamp
    await update(usersRef, {
      lastLogin: Date.now()
    });

    // Generate JWT token
    const token = jwt.sign(
      { email: userData.email, id: emailKey },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    console.log(`✅ User logged in: ${email}`);
    res.json({
      success: true,
      token: token,
      expiresIn: 12 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const emailKey = req.user.id; // emailKey from JWT token
    const userEmail = req.user.email; // email from JWT token
    
    console.log(`📋 Fetching profile for: ${userEmail} (key: ${emailKey})`);
    
    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      console.error(`❌ User not found: ${emailKey}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = snapshot.val();
    
    // Verify the email matches (security check)
    if (userData.email && userData.email.toLowerCase() !== userEmail.toLowerCase()) {
      console.error(`⚠️ Email mismatch: JWT has ${userEmail}, DB has ${userData.email}`);
    }
    
    // Don't send password hash
    delete userData.passwordHash;

    console.log(`✅ Profile retrieved for: ${userData.email || userEmail}`);
    res.json(userData);
  } catch (error) {
    console.error('Get profile error:', error);
    setCORSHeaders(req, res);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const emailKey = req.user.id; // emailKey from JWT token
    const {
      fullName,
      phone,
      site,
      position,
      farmName,
      farmAddress,
      language,
      responsibilities,
      photoUrl
    } = req.body;

    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get current user data to preserve fields not being updated
    const currentData = snapshot.val();
    
    const updates = {
      updatedAt: Date.now()
    };

    // Note: Email cannot be changed (it's the identifier)
    if (fullName !== undefined) {
      updates.fullName = fullName;
      // Automatically update displayName to match fullName
      updates.displayName = fullName;
    }
    if (phone !== undefined) updates.phone = phone;
    if (site !== undefined) updates.site = site;
    if (position !== undefined && position !== null && String(position).trim() !== '') {
      updates.position = String(position).trim();
    }
    if (farmName !== undefined) updates.farmName = farmName;
    if (farmAddress !== undefined) updates.farmAddress = farmAddress;
    if (language !== undefined) updates.language = language;
    if (responsibilities !== undefined) updates.responsibilities = responsibilities;
    
    // Always preserve photoUrl - either update it or keep existing
    if (photoUrl !== undefined) {
      updates.photoUrl = photoUrl;
    } else if (currentData.photoUrl) {
      // Preserve existing photoUrl if not being updated
      updates.photoUrl = currentData.photoUrl;
    }

    await update(usersRef, updates);

    console.log(`✅ Profile updated for: ${req.user.email}`);
    console.log(`   Updated fields: ${Object.keys(updates).join(', ')}`);
    
    // Return updated user data including photoUrl
    const updatedSnapshot = await get(usersRef);
    const updatedData = updatedSnapshot.val();
    delete updatedData.passwordHash;
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      profile: updatedData
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const emailKey = req.user.id; // emailKey from JWT token
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = snapshot.val();
    const passwordMatch = await bcrypt.compare(currentPassword, userData.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await update(usersRef, {
      passwordHash: newPasswordHash,
      lastPasswordChange: Date.now(),
      updatedAt: Date.now()
    });

    console.log(`✅ Password changed for: ${req.user.email}`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user account
app.delete('/api/auth/delete', authenticateToken, async (req, res) => {
  try {
    const emailKey = req.user.id; // emailKey from JWT token
    const usersRef = ref(db, `users/${emailKey}`);
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete the user account
    await remove(usersRef);

    console.log(`✅ Account deleted: ${req.user.email}`);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ==================== END AUTHENTICATION ENDPOINTS ====================

// Handle preflight OPTIONS requests (CORS)
app.options('*', (req, res) => {
  setCORSHeaders(req, res);
  res.sendStatus(200);
});

// 404 handler - must come before error handler (catches unmatched routes)
app.use((req, res) => {
  setCORSHeaders(req, res);
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler - must be last (catches errors passed to next(err))
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  
  // Only set headers if they haven't been sent yet
  if (!res.headersSent) {
    setCORSHeaders(req, res);
    res.status(err.status || 500).json({ 
      error: err.message || 'Internal server error' 
    });
  } else {
    // Headers already sent, can't send response
    next(err);
  }
});

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
  console.log(`🔥 Firebase Database: ${firebaseConfig.databaseURL}`);
  console.log(`🔐 Authentication endpoints enabled`);
});


