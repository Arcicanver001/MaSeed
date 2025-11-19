// Script to add test data to Firebase for history page testing
require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push } = require('firebase/database');
const firebaseConfig = require('./firebase-config');

const db = getDatabase(initializeApp(firebaseConfig));

const sensors = ['temperature', 'humidity', 'light', 'ph', 'soil_humidity', 'soil_temperature', 'nitrogen', 'phosphorus', 'potassium'];

// Generate test data for the last 24 hours
function generateTestData() {
  const now = Date.now();
  const hoursAgo = 24;
  const intervalMs = 5 * 60 * 1000; // 5 minutes interval
  const dataPoints = Math.floor((hoursAgo * 60 * 60 * 1000) / intervalMs);
  
  console.log(`📊 Generating ${dataPoints} data points per sensor for the last ${hoursAgo} hours...`);
  
  const promises = [];
  
  sensors.forEach(sensor => {
    const sensorRef = ref(db, `readings/${sensor}`);
    let baseValue;
    
    // Set base values for each sensor
    switch(sensor) {
      case 'temperature':
        baseValue = 22;
        break;
      case 'humidity':
        baseValue = 65;
        break;
      case 'light':
        baseValue = 20000;
        break;
      case 'ph':
        baseValue = 6.5;
        break;
      case 'soil_humidity':
        baseValue = 70;
        break;
      case 'soil_temperature':
        baseValue = 24;
        break;
      case 'nitrogen':
        baseValue = 150;
        break;
      case 'phosphorus':
        baseValue = 80;
        break;
      case 'potassium':
        baseValue = 200;
        break;
      default:
        baseValue = 50;
    }
    
    for (let i = 0; i < dataPoints; i++) {
      // Calculate timestamp: start from (now - hoursAgo * 60 * 60 * 1000) and go up to now
      // Ensure the last data point is exactly at 'now' (or very close) for "last hour" queries
      let timestamp;
      if (i === dataPoints - 1) {
        // Last data point: set to current time (or 1ms ago to avoid future timestamps)
        timestamp = now - 1;
      } else {
        // Other data points: evenly distribute from 24 hours ago
        timestamp = now - (hoursAgo * 60 * 60 * 1000) + (i * intervalMs);
      }
      
      // Add some variation to make it realistic
      let variation = 0;
      if (sensor === 'temperature') {
        variation = (Math.sin(i / 10) * 5) + (Math.random() * 2 - 1);
      } else if (sensor === 'light') {
        // Simulate day/night cycle
        const hour = new Date(timestamp).getHours();
        if (hour >= 6 && hour < 20) {
          variation = (Math.sin((hour - 6) / 14 * Math.PI) * 15000) + (Math.random() * 2000 - 1000);
        } else {
          variation = Math.random() * 500 - 250; // Night time - low light
        }
      } else {
        variation = Math.random() * 10 - 5;
      }
      
      const value = Math.max(0, baseValue + variation);
      
      promises.push(
        push(sensorRef, {
          ts: timestamp,
          value: parseFloat(value.toFixed(2))
        })
      );
    }
  });
  
  return Promise.all(promises);
}

console.log('🔥 Starting Firebase test data generation...');
console.log('📊 This will create sample data for the last 24 hours');

generateTestData()
  .then(() => {
    console.log('✅ Test data generated successfully!');
    console.log('📈 You can now check the history page in your dashboard');
    console.log('🌐 Firebase Console: https://console.firebase.google.com/project/smart-greenhouse-19a29/database');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  });

