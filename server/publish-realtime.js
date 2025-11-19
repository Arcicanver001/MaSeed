// Script to continuously publish real-time sensor data to MQTT for dashboard testing
const mqtt = require('mqtt');
require('dotenv').config();

const MQTT_URL = process.env.MQTT_URL || 'mqtt://broker.emqx.io:1883';
const TOPIC_PREFIX = process.env.TOPIC_PREFIX || 'greenhouse/cedrick1';

const sensors = {
    'temperature': { base: 22, min: 18, max: 28, variation: 2 },
    'humidity': { base: 65, min: 55, max: 75, variation: 5 },
    'light': { base: 20000, min: 15000, max: 25000, variation: 3000 },
    'ph': { base: 6.5, min: 6.0, max: 7.0, variation: 0.3 },
    'soil_humidity': { base: 70, min: 60, max: 80, variation: 5 },
    'soil_temperature': { base: 24, min: 20, max: 28, variation: 2 },
    'nitrogen': { base: 150, min: 120, max: 180, variation: 20 },
    'phosphorus': { base: 80, min: 60, max: 100, variation: 10 },
    'potassium': { base: 200, min: 170, max: 230, variation: 20 }
};

// Also publish to topics that dashboard expects (without prefix)
const dashboardTopics = {
    'greenhouse/temperature': 'temperature',
    'greenhouse/humidity': 'humidity',
    'greenhouse/light': 'light',
    'greenhouse/ph': 'ph',
    'greenhouse/soil_moisture': 'soil_humidity',
    'greenhouse/soil_humidity': 'soil_humidity',
    'greenhouse/soil_temperature': 'soil_temperature',
    'greenhouse/nitrogen': 'nitrogen',
    'greenhouse/phosphorus': 'phosphorus',
    'greenhouse/potassium': 'potassium'
};

const client = mqtt.connect(MQTT_URL, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    reconnectPeriod: 2000
});

client.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    console.log(`📡 Publishing to broker: ${MQTT_URL}`);
    console.log(`📋 Topics prefix: ${TOPIC_PREFIX}`);
    console.log('🔄 Starting real-time sensor data simulation...\n');
    
    // Publish data every 5 seconds
    setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n📊 Publishing sensor data at ${timestamp}`);
        
        Object.keys(sensors).forEach(sensor => {
            const config = sensors[sensor];
            // Generate realistic value with variation
            const variation = (Math.random() - 0.5) * config.variation;
            let value = config.base + variation;
            
            // Keep within bounds
            value = Math.max(config.min, Math.min(config.max, value));
            
            // Format value based on sensor type
            if (sensor === 'ph') {
                value = parseFloat(value.toFixed(2));
            } else if (['temperature', 'humidity', 'soil_humidity', 'soil_temperature'].includes(sensor)) {
                value = parseFloat(value.toFixed(1));
            } else {
                value = Math.round(value);
            }
            
            // Publish to server topic (with prefix)
            const serverTopic = `${TOPIC_PREFIX}/${sensor}`;
            client.publish(serverTopic, value.toString(), { qos: 1 }, (err) => {
                if (err) {
                    console.error(`❌ Error publishing ${serverTopic}:`, err.message);
                } else {
                    console.log(`  ✅ ${serverTopic}: ${value}`);
                }
            });
            
            // Also publish to dashboard topics (without prefix)
            const dashboardTopic = Object.keys(dashboardTopics).find(t => dashboardTopics[t] === sensor);
            if (dashboardTopic) {
                client.publish(dashboardTopic, value.toString(), { qos: 1 }, (err) => {
                    if (err) {
                        console.error(`❌ Error publishing ${dashboardTopic}:`, err.message);
                    }
                });
            }
        });
        
        console.log('✅ All sensor data published\n');
    }, 5000); // Publish every 5 seconds
    
    console.log('🎯 Real-time data publishing started!');
    console.log('📡 Data will be published every 5 seconds');
    console.log('🔄 Press Ctrl+C to stop\n');
});

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
});

client.on('disconnect', () => {
    console.log('⚠️ Disconnected from MQTT broker');
});

client.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping sensor data publisher...');
    client.end(() => {
        console.log('✅ Disconnected from MQTT broker');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Stopping sensor data publisher...');
    client.end(() => {
        console.log('✅ Disconnected from MQTT broker');
        process.exit(0);
    });
});

