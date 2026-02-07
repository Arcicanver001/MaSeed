// Push Notification Integration
// Integrates push notifications with existing alert system

// Enhanced showAlert function that also sends push notifications
function showAlertWithPush(message, type = 'info', options = {}) {
  // Call original showAlert function
  if (typeof showAlert === 'function') {
    showAlert(message, type);
  }

  // Send push notification if enabled and subscribed
  if (window.pushNotificationManager && window.pushNotificationManager.isSupported) {
    sendPushNotification(message, type, options).catch(error => {
      console.error('[Push] Error sending push notification:', error);
    });
  }
}

// Send push notification
async function sendPushNotification(message, type = 'info', options = {}) {
  if (!window.pushNotificationManager) {
    return;
  }

  // Check if user is subscribed
  const isSubscribed = await window.pushNotificationManager.isSubscribed();
  if (!isSubscribed) {
    return; // User not subscribed, don't send
  }

  // Check if push notifications are enabled in settings
  const pushEnabled = localStorage.getItem('pushNotificationsEnabled') !== 'false';
  if (!pushEnabled) {
    return; // Push notifications disabled by user
  }

  // Determine notification settings based on type
  const notificationSettings = {
    danger: {
      title: '🚨 Critical Alert',
      requireInteraction: true,
      priority: 'high'
    },
    warning: {
      title: '⚠️ Warning',
      requireInteraction: false,
      priority: 'normal'
    },
    success: {
      title: '✅ Success',
      requireInteraction: false,
      priority: 'normal'
    },
    info: {
      title: 'ℹ️ Information',
      requireInteraction: false,
      priority: 'normal'
    }
  };

  const settings = notificationSettings[type] || notificationSettings.info;
  
  // Only send push for important alerts (danger, warning) by default
  // User can customize this in settings
  const sendForType = localStorage.getItem(`pushNotification_${type}`) !== 'false';
  if (!sendForType && type !== 'danger' && type !== 'warning') {
    return; // Don't send for this type
  }

  // Always send critical alerts
  if (type === 'danger' || type === 'warning') {
    try {
      const token = localStorage.getItem('sg_auth_token');
      const apiBase = window.getApiBase ? window.getApiBase() : 'https://api.maseed.farm/api';
      
      await fetch(`${apiBase}/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          title: settings.title,
          body: message,
          icon: options.icon || '/assets/icon-192x192.png',
          url: options.url || '/',
          tag: options.tag || `alert-${type}`,
          requireInteraction: settings.requireInteraction
        })
      });
    } catch (error) {
      console.error('[Push] Failed to send push notification:', error);
    }
  }
}

// Monitor sensor values and send push notifications for critical issues
let lastAlertTime = {}; // Track last alert time per sensor to avoid spam
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown between alerts for same sensor

// Send email notification via AWS SES
async function sendEmailNotification(sensorName, value, evaluation) {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.log('[Email] User not logged in, skipping email notification');
    return; // User not logged in
  }

  // Check if email notifications are enabled
  const emailEnabled = localStorage.getItem('emailNotificationsEnabled') !== 'false';
  if (!emailEnabled) {
    console.log('[Email] Email notifications disabled by user');
    return;
  }

  try {
    const apiBase = window.getApiBase ? window.getApiBase() : 'https://api.maseed.farm/api';
    const response = await fetch(`${apiBase}/notifications/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sensorName: sensorName,
        value: value,
        evaluation: evaluation
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Email] Email notification sent via AWS SES:', result.messageId);
    } else {
      const error = await response.json();
      console.error('[Email] Failed to send email notification:', error);
    }
  } catch (error) {
    console.error('[Email] Error sending email notification:', error);
  }
}

function checkSensorAlerts(sensorName, value, evaluation) {
  // Only send push/email for critical (danger) alerts
  if (evaluation.status === 'danger') {
    const alertKey = `${sensorName}-danger`;
    const lastAlert = lastAlertTime[alertKey] || 0;
    const now = Date.now();

    // Check cooldown to avoid spam
    if (now - lastAlert < ALERT_COOLDOWN) {
      return;
    }

    lastAlertTime[alertKey] = now;

    const sensorLabels = {
      temperature: 'Temperature',
      humidity: 'Humidity',
      light: 'Light Intensity',
      ph: 'pH Level',
      soilHumidity: 'Soil Humidity',
      soilTemperature: 'Soil Temperature',
      nitrogen: 'Nitrogen',
      phosphorus: 'Phosphorus',
      potassium: 'Potassium'
    };

    const label = sensorLabels[sensorName] || sensorName;
    const message = `Critical: ${label} is ${evaluation.text} (${value}${getSensorUnit(sensorName)})`;
    
    // Send push notification (if supported)
    if (window.pushNotificationManager && window.pushNotificationManager.isSupported) {
      sendPushNotification(message, 'danger', {
        tag: `sensor-${sensorName}`,
        url: '/'
      });
    }

    // Send email notification via AWS SES
    sendEmailNotification(sensorName, value, evaluation);
  }
}

function getSensorUnit(sensorName) {
  const units = {
    temperature: '°C',
    humidity: '%',
    light: ' lux',
    ph: '',
    soilHumidity: '%',
    soilTemperature: '°C',
    nitrogen: ' mg/kg',
    phosphorus: ' mg/kg',
    potassium: ' mg/kg'
  };
  return units[sensorName] || '';
}

// Override showAlert to include push notifications
(function() {
  const originalShowAlert = window.showAlert;
  if (originalShowAlert) {
    window.showAlert = function(message, type = 'info') {
      originalShowAlert(message, type);
      
      // Send push notification for important alerts
      if (type === 'danger' || type === 'warning') {
        sendPushNotification(message, type, {
          tag: 'dashboard-alert'
        });
      }
    };
  }
})();

// Override showActuatorNotification to include push notifications
(function() {
  const originalShowActuatorNotification = window.showActuatorNotification;
  if (originalShowActuatorNotification) {
    window.showActuatorNotification = function(message, type = 'info') {
      originalShowActuatorNotification(message, type);
      
      // Send push notification for actuator changes
      if (type === 'danger' || type === 'warning') {
        sendPushNotification(`Actuator: ${message}`, type, {
          tag: 'actuator-alert'
        });
      }
    };
  }
})();

// Manual trigger function to send ONE consolidated email for all critical sensors
// Bypasses cooldown period - use for testing
async function manualTriggerEmailAlerts() {
  console.log('📧 Manual Email Trigger: Checking all sensors...');
  
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.error('❌ ERROR: User not logged in! Please log in first.');
    return { sent: 0, results: [], error: 'Not logged in' };
  }
  
  const emailEnabled = localStorage.getItem('emailNotificationsEnabled') !== 'false';
  if (!emailEnabled) {
    console.error('❌ ERROR: Email notifications are disabled! Enable them in Settings.');
    return { sent: 0, results: [], error: 'Email notifications disabled' };
  }
  
  // Helper to get current value from DOM
  function getCurrentValue(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return null;
    const text = element.textContent.trim();
    if (!text || text === 'N/A' || text === '--') return null;
    const value = parseFloat(text);
    return isNaN(value) ? null : value;
  }
  
  // Check all sensors
  const sensors = [
    { type: 'temperature', value: getCurrentValue('tempValue'), evaluate: evaluateTemperature },
    { type: 'humidity', value: getCurrentValue('humidityValue'), evaluate: evaluateHumidity },
    { type: 'light', value: getCurrentValue('lightValue'), evaluate: evaluateLight },
    { type: 'ph', value: getCurrentValue('phValue'), evaluate: evaluatePH },
    { type: 'soilHumidity', value: getCurrentValue('soilHumidityValue'), evaluate: evaluateSoilHumidity },
    { type: 'soilTemperature', value: getCurrentValue('soilTempValue'), evaluate: evaluateSoilTemperature },
    { type: 'nitrogen', value: getCurrentValue('nitrogenValue'), evaluate: (v) => evaluateNPK(v, 'N') },
    { type: 'phosphorus', value: getCurrentValue('phosphorusValue'), evaluate: (v) => evaluateNPK(v, 'P') },
    { type: 'potassium', value: getCurrentValue('potassiumValue'), evaluate: (v) => evaluateNPK(v, 'K') }
  ];
  
  // Collect all critical sensors
  const criticalSensors = [];
  
  for (const sensor of sensors) {
    if (sensor.value === null || sensor.value === undefined) {
      console.log(`⏭️  ${sensor.type}: No value`);
      continue;
    }
    
    const evaluation = sensor.evaluate(sensor.value);
    if (!evaluation) {
      console.log(`⏭️  ${sensor.type}: Cannot evaluate`);
      continue;
    }
    
    if (evaluation.status === 'danger') {
      console.log(`🚨 ${sensor.type}: ${sensor.value} - CRITICAL`);
      criticalSensors.push({
        sensorName: sensor.type,
        value: sensor.value,
        evaluation: evaluation
      });
    } else {
      console.log(`✅ ${sensor.type}: ${sensor.value} - ${evaluation.text}`);
    }
  }
  
  if (criticalSensors.length === 0) {
    console.log('✅ No critical sensors found. All sensors are within normal range.');
    return { sent: 0, results: [], message: 'No critical sensors' };
  }
  
  console.log(`\n📧 Sending ONE consolidated email for ${criticalSensors.length} critical sensor(s)...`);
  
  try {
    const apiBase = window.getApiBase ? window.getApiBase() : 'https://api.maseed.farm/api';
    const response = await fetch(`${apiBase}/notifications/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sensors: criticalSensors
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Consolidated email sent! Message ID: ${result.messageId}`);
      console.log(`📊 Included ${criticalSensors.length} critical sensor(s) in the email:`);
      criticalSensors.forEach(s => {
        console.log(`   - ${s.sensorName}: ${s.value}`);
      });
      return { sent: 1, results: criticalSensors, messageId: result.messageId };
    } else {
      const error = await response.json();
      console.error(`❌ Failed to send email:`, error);
      return { sent: 0, results: criticalSensors, error: error.error || error.message };
    }
  } catch (error) {
    console.error(`❌ Error sending email:`, error);
    return { sent: 0, results: criticalSensors, error: error.message };
  }
}

// Export functions
window.showAlertWithPush = showAlertWithPush;
window.sendPushNotification = sendPushNotification;
window.sendEmailNotification = sendEmailNotification;
window.checkSensorAlerts = checkSensorAlerts;
window.manualTriggerEmailAlerts = manualTriggerEmailAlerts;
window.triggerEmail = manualTriggerEmailAlerts; // Shorter alias


