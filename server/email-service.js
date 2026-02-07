const AWS = require('aws-sdk');

// Initialize AWS SES
let ses = null;
let fromEmail = null;

function initEmailService() {
  // Get AWS credentials from environment variables
  const awsConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  };

  // Check if credentials are provided
  if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey) {
    console.warn('⚠️ AWS SES not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
    return false;
  }

  fromEmail = process.env.SES_FROM_EMAIL || process.env.EMAIL_USER;
  if (!fromEmail) {
    console.warn('⚠️ SES_FROM_EMAIL not set. Email notifications will be disabled.');
    return false;
  }

  try {
    ses = new AWS.SES(awsConfig);
    console.log('✅ AWS SES initialized');
    console.log(`   Region: ${awsConfig.region}`);
    console.log(`   From Email: ${fromEmail}`);
    return true;
  } catch (error) {
    console.error('❌ AWS SES initialization failed:', error.message);
    return false;
  }
}

// Send threshold alert email via AWS SES
async function sendThresholdAlert(sensorName, value, evaluation, userEmail) {
  if (!ses) {
    if (!initEmailService()) {
      return { success: false, error: 'AWS SES not configured' };
    }
  }

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

  const sensorUnits = {
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

  const label = sensorLabels[sensorName] || sensorName;
  const unit = sensorUnits[sensorName] || '';
  const severity = evaluation.status === 'danger' ? '🚨 CRITICAL' : '⚠️ WARNING';
  const severityColor = evaluation.status === 'danger' ? '#f44336' : '#ff9800';
  const severityBg = evaluation.status === 'danger' ? '#ffebee' : '#fff3e0';
  
  const subject = `${severity} Alert: ${label} Threshold Exceeded`;
  
  // HTML email template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: #ffffff; 
          border-radius: 8px; 
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          font-weight: 600;
        }
        .content { 
          padding: 30px 20px; 
        }
        .alert-box { 
          background: ${severityBg}; 
          border-left: 4px solid ${severityColor}; 
          padding: 20px; 
          margin: 20px 0; 
          border-radius: 4px;
        }
        .alert-box h2 {
          margin: 0 0 10px 0;
          color: ${severityColor};
          font-size: 20px;
        }
        .sensor-info { 
          background: #f9f9f9; 
          padding: 20px; 
          border-radius: 5px; 
          margin: 20px 0; 
          border: 1px solid #e0e0e0;
        }
        .sensor-info p {
          margin: 10px 0;
        }
        .value { 
          font-size: 32px; 
          font-weight: bold; 
          color: ${severityColor}; 
          margin: 10px 0;
        }
        .recommendations {
          background: #e8f5e9;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .recommendations h3 {
          margin-top: 0;
          color: #2e7d32;
        }
        .recommendations ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #e0e0e0; 
          font-size: 12px; 
          color: #666; 
          text-align: center;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #4caf50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌱 Greenhouse Monitoring System</h1>
        </div>
        
        <div class="content">
          <div class="alert-box">
            <h2>${severity} Alert</h2>
            <p>The <strong>${label}</strong> sensor has detected a ${evaluation.status === 'danger' ? 'critical' : 'warning'} condition that requires your attention.</p>
          </div>
          
          <div class="sensor-info">
            <p><strong>Sensor:</strong> ${label}</p>
            <p><strong>Current Value:</strong></p>
            <div class="value">${value}${unit}</div>
            <p><strong>Status:</strong> <span style="color: ${severityColor}; font-weight: bold;">${evaluation.text}</span></p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="recommendations">
            <h3>📋 Recommended Actions:</h3>
            <ul>
              ${getRecommendation(sensorName, value)}
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.DASHBOARD_URL || 'https://maseed.farm'}" class="button">View Dashboard</a>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated alert from your Smart Greenhouse Monitoring System.</p>
          <p>You can manage notification preferences in the dashboard settings.</p>
          <p style="margin-top: 10px; color: #999;">© ${new Date().getFullYear()} Greenhouse Monitoring System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version (required for better deliverability)
  const text = `
${severity} ALERT: ${label} Threshold Exceeded

Sensor: ${label}
Current Value: ${value}${unit}
Status: ${evaluation.text}
Time: ${new Date().toLocaleString()}

Recommended Actions:
${getTextRecommendation(sensorName, value)}

Please check your greenhouse dashboard for more details.
Dashboard: ${process.env.DASHBOARD_URL || 'https://maseed.farm'}

---
This is an automated alert from your Smart Greenhouse Monitoring System.
You can manage notification preferences in the dashboard settings.
  `;

  const params = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [userEmail]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8'
        },
        Text: {
          Data: text,
          Charset: 'UTF-8'
        }
      }
    },
    // Optional: Add tags for tracking
    Tags: [
      {
        Name: 'AlertType',
        Value: 'ThresholdAlert'
      },
      {
        Name: 'Sensor',
        Value: sensorName
      },
      {
        Name: 'Severity',
        Value: evaluation.status
      }
    ]
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log(`✅ Threshold alert email sent via AWS SES to ${userEmail}:`, result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error('❌ Failed to send threshold alert email via AWS SES:', error);
    
    // Handle specific AWS SES errors
    if (error.code === 'MessageRejected') {
      console.error('   Email address not verified or in sandbox mode');
    } else if (error.code === 'Throttling') {
      console.error('   Rate limit exceeded - too many emails sent');
    }
    
    return { success: false, error: error.message, code: error.code };
  }
}

// Get HTML recommendation
function getRecommendation(sensorName, value) {
  const recommendations = {
    temperature: value < 15 
      ? '<li>Consider heating or insulation to raise temperature</li><li>Check heating system functionality</li>'
      : '<li>Increase ventilation or activate cooling systems</li><li>Check fan and cooling equipment</li>',
    humidity: value < 50
      ? '<li>Add humidifier to increase humidity levels</li><li>Check humidifier system</li>'
      : '<li>Improve ventilation or activate dehumidifier</li><li>Check ventilation systems</li>',
    light: value < 10000
      ? '<li>Increase artificial lighting for optimal growth</li><li>Check grow lights functionality</li>'
      : '<li>Add shade to reduce light intensity</li><li>Adjust light exposure</li>',
    ph: value < 6.0
      ? '<li>Add lime to increase pH levels</li><li>Test soil pH adjustment</li>'
      : '<li>Add sulfur to decrease pH levels</li><li>Test soil pH adjustment</li>',
    soilHumidity: value < 50
      ? '<li>Water immediately - plants need consistent moisture</li><li>Check irrigation system</li>'
      : '<li>Improve drainage to prevent root rot</li><li>Check drainage systems</li>',
    soilTemperature: value < 18
      ? '<li>Add heating or insulation for root zone</li><li>Check soil heating systems</li>'
      : '<li>Cool soil with mulch or irrigation</li><li>Check cooling systems</li>',
    nitrogen: value < 30
      ? '<li>Apply nitrogen fertilizer immediately</li><li>Test soil nutrient levels</li>'
      : '<li>Monitor nitrogen levels closely</li>',
    phosphorus: value < 30
      ? '<li>Apply phosphorus fertilizer immediately</li><li>Test soil nutrient levels</li>'
      : '<li>Monitor phosphorus levels closely</li>',
    potassium: value < 30
      ? '<li>Apply potassium fertilizer immediately</li><li>Test soil nutrient levels</li>'
      : '<li>Monitor potassium levels closely</li>'
  };
  return recommendations[sensorName] || '<li>Check sensor and take appropriate action</li><li>Review system logs for details</li>';
}

// Get text recommendation
function getTextRecommendation(sensorName, value) {
  const recommendations = {
    temperature: value < 15 
      ? '- Consider heating or insulation to raise temperature\n- Check heating system functionality'
      : '- Increase ventilation or activate cooling systems\n- Check fan and cooling equipment',
    humidity: value < 50
      ? '- Add humidifier to increase humidity levels\n- Check humidifier system'
      : '- Improve ventilation or activate dehumidifier\n- Check ventilation systems',
    light: value < 10000
      ? '- Increase artificial lighting for optimal growth\n- Check grow lights functionality'
      : '- Add shade to reduce light intensity\n- Adjust light exposure',
    ph: value < 6.0
      ? '- Add lime to increase pH levels\n- Test soil pH adjustment'
      : '- Add sulfur to decrease pH levels\n- Test soil pH adjustment',
    soilHumidity: value < 50
      ? '- Water immediately - plants need consistent moisture\n- Check irrigation system'
      : '- Improve drainage to prevent root rot\n- Check drainage systems',
    soilTemperature: value < 18
      ? '- Add heating or insulation for root zone\n- Check soil heating systems'
      : '- Cool soil with mulch or irrigation\n- Check cooling systems',
    nitrogen: value < 30
      ? '- Apply nitrogen fertilizer immediately\n- Test soil nutrient levels'
      : '- Monitor nitrogen levels closely',
    phosphorus: value < 30
      ? '- Apply phosphorus fertilizer immediately\n- Test soil nutrient levels'
      : '- Monitor phosphorus levels closely',
    potassium: value < 30
      ? '- Apply potassium fertilizer immediately\n- Test soil nutrient levels'
      : '- Monitor potassium levels closely'
  };
  return recommendations[sensorName] || '- Check sensor and take appropriate action\n- Review system logs for details';
}

// Send consolidated email with multiple critical sensors
async function sendMultipleThresholdAlerts(sensors, userEmail) {
  if (!ses) {
    if (!initEmailService()) {
      return { success: false, error: 'AWS SES not configured' };
    }
  }

  if (!sensors || sensors.length === 0) {
    return { success: false, error: 'No sensors provided' };
  }

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

  const sensorUnits = {
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

  const criticalCount = sensors.length;
  const subject = `🚨 CRITICAL Alert: ${criticalCount} Sensor${criticalCount > 1 ? 's' : ''} Require Attention`;

  // Build sensor list HTML
  let sensorsHtml = '';
  let sensorsText = '';

  sensors.forEach((sensor) => {
    const label = sensorLabels[sensor.sensorName] || sensor.sensorName;
    const unit = sensorUnits[sensor.sensorName] || '';
    const severityColor = '#f44336';
    
    // Ensure value is displayed correctly even if 0
    const displayValue = (sensor.value !== null && sensor.value !== undefined) ? sensor.value : 'N/A';
    
    // Log each sensor being added to email (for debugging)
    console.log(`📧 Adding sensor to email: ${label} = ${displayValue}${unit} (${sensor.evaluation.text})`);
    
    sensorsHtml += `
      <div style="background: #ffebee; border-left: 4px solid ${severityColor}; padding: 15px; margin: 15px 0; border-radius: 4px;">
        <h3 style="margin: 0 0 10px 0; color: ${severityColor}; font-size: 18px;">${label}</h3>
        <p style="margin: 5px 0;"><strong>Current Value:</strong> <span style="font-size: 24px; font-weight: bold; color: ${severityColor};">${displayValue}${unit}</span></p>
        <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${severityColor}; font-weight: bold;">${sensor.evaluation.text}</span></p>
        <div style="margin-top: 10px; padding: 10px; background: #fff; border-radius: 4px;">
          <strong>Recommended Actions:</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${getRecommendation(sensor.sensorName, sensor.value)}
          </ul>
        </div>
      </div>
    `;

    sensorsText += `
${label}
Current Value: ${displayValue}${unit}
Status: ${sensor.evaluation.text}
Recommended Actions:
${getTextRecommendation(sensor.sensorName, sensor.value)}
---
`;
  });

  // HTML email template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: #ffffff; 
          border-radius: 8px; 
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          font-weight: 600;
        }
        .content { 
          padding: 30px 20px; 
        }
        .alert-box { 
          background: #ffebee; 
          border-left: 4px solid #f44336; 
          padding: 20px; 
          margin: 20px 0; 
          border-radius: 4px;
        }
        .alert-box h2 {
          margin: 0 0 10px 0;
          color: #f44336;
          font-size: 20px;
        }
        .summary {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          text-align: center;
        }
        .summary strong {
          font-size: 18px;
          color: #f44336;
        }
        .footer { 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #e0e0e0; 
          font-size: 12px; 
          color: #666; 
          text-align: center;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #4caf50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 Critical Alert</h1>
        </div>
        
        <div class="content">
          <div class="alert-box">
            <h2>Multiple Sensors Require Attention</h2>
            <p>Your greenhouse monitoring system has detected <strong>${criticalCount} critical sensor${criticalCount > 1 ? 's' : ''}</strong> that require immediate attention.</p>
          </div>
          
          <div class="summary">
            <p><strong>${criticalCount} Critical Sensor${criticalCount > 1 ? 's' : ''} Detected</strong></p>
            <p style="margin: 5px 0; color: #666;">Time: ${new Date().toLocaleString()}</p>
          </div>
          
          ${sensorsHtml}
          
          <div style="text-align: center;">
            <a href="${process.env.DASHBOARD_URL || 'https://maseed.farm'}" class="button">View Dashboard</a>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated alert from your Smart Greenhouse Monitoring System.</p>
          <p>You can manage notification preferences in the dashboard settings.</p>
          <p style="margin-top: 10px; color: #999;">© ${new Date().getFullYear()} Greenhouse Monitoring System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version
  const text = `
🚨 CRITICAL ALERT: ${criticalCount} Sensor${criticalCount > 1 ? 's' : ''} Require Attention

Your greenhouse monitoring system has detected ${criticalCount} critical sensor${criticalCount > 1 ? 's' : ''} that require immediate attention.

Time: ${new Date().toLocaleString()}

${sensorsText}

Please check your greenhouse dashboard for more details.
Dashboard: ${process.env.DASHBOARD_URL || 'https://maseed.farm'}

---
This is an automated alert from your Smart Greenhouse Monitoring System.
You can manage notification preferences in the dashboard settings.
  `;

  const params = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [userEmail]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8'
        },
        Text: {
          Data: text,
          Charset: 'UTF-8'
        }
      }
    },
    Tags: [
      {
        Name: 'AlertType',
        Value: 'MultipleThresholdAlert'
      },
      {
        Name: 'SensorCount',
        Value: criticalCount.toString()
      }
    ]
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log(`✅ Consolidated threshold alert email sent via AWS SES to ${userEmail}:`, result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error('❌ Failed to send consolidated threshold alert email via AWS SES:', error);
    
    if (error.code === 'MessageRejected') {
      console.error('   Email address not verified or in sandbox mode');
    } else if (error.code === 'Throttling') {
      console.error('   Rate limit exceeded - too many emails sent');
    }
    
    return { success: false, error: error.message, code: error.code };
  }
}

module.exports = {
  initEmailService,
  sendThresholdAlert,
  sendMultipleThresholdAlerts
};



