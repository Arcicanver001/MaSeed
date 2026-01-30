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
      const token = localStorage.getItem('authToken');
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

// Export functions
window.showAlertWithPush = showAlertWithPush;
window.sendPushNotification = sendPushNotification;
window.sendEmailNotification = sendEmailNotification;
window.checkSensorAlerts = checkSensorAlerts;


