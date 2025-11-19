// MQTT Configuration
let mqttClient = null;
let isConnected = false;


// Data storage for charts (keep last 20 data points)
const maxDataPoints = 20;
const chartData = {
    labels: [],
    temperature: [],
    humidity: [],
    light: [],
    ph: [],
    soilHumidity: [],
    soilTemperature: [],
    nitrogen: [],
    phosphorus: [],
    potassium: []
};

const actuatorHistory = {
    fan: [],
    humidifier: [],
    sprinkler: []
};

window.actuatorHistory = actuatorHistory;

// Enhanced summary statistics tracking
const summaryStats = {
    temperature: { min: null, max: null, values: [] },
    humidity: { min: null, max: null, values: [] },
    light: { min: null, max: null, values: [] },
    ph: { min: null, max: null, values: [] },
    soilHumidity: { min: null, max: null, values: [] },
    soilTemperature: { min: null, max: null, values: [] },
    nitrogen: { min: null, max: null, values: [] },
    phosphorus: { min: null, max: null, values: [] },
    potassium: { min: null, max: null, values: [] }
};

function updateSummaryStats(sensor, value) {
    if (summaryStats[sensor]) {
        summaryStats[sensor].values.push(value);
        
        // Keep only last 100 values for performance
        if (summaryStats[sensor].values.length > 100) {
            summaryStats[sensor].values.shift();
        }
        
        // Update min/max
        if (summaryStats[sensor].min === null || value < summaryStats[sensor].min) {
            summaryStats[sensor].min = value;
        }
        if (summaryStats[sensor].max === null || value > summaryStats[sensor].max) {
            summaryStats[sensor].max = value;
        }
        
        updateSummaryDisplay();
    }
}

function updateSummaryDisplay() {
    // Update ranges
    updateRangeDisplay('tempRange', summaryStats.temperature.min, summaryStats.temperature.max, '°C');
    updateRangeDisplay('humidityRange', summaryStats.humidity.min, summaryStats.humidity.max, '%');
    updateRangeDisplay('lightRange', summaryStats.light.min, summaryStats.light.max, 'lux');
    updateRangeDisplay('phRange', summaryStats.ph.min, summaryStats.ph.max, 'pH');
    updateRangeDisplay('soilHumidityRange', summaryStats.soilHumidity.min, summaryStats.soilHumidity.max, '%');
    updateRangeDisplay('soilTempRange', summaryStats.soilTemperature.min, summaryStats.soilTemperature.max, '°C');
    
    // Update soil nutrition range display
    const soilNutritionRangeEl = document.getElementById('soilNutritionRange');
    if (soilNutritionRangeEl) {
        const nRange = formatNutrientRange(summaryStats.nitrogen.min, summaryStats.nitrogen.max, 'N');
        const pRange = formatNutrientRange(summaryStats.phosphorus.min, summaryStats.phosphorus.max, 'P');
        const kRange = formatNutrientRange(summaryStats.potassium.min, summaryStats.potassium.max, 'K');
        soilNutritionRangeEl.textContent = `${nRange} ${pRange} ${kRange}`;
    }
    
    // Update status indicators
    updateSummaryStatus('tempSummaryStatus', summaryStats.temperature.max, 'temperature');
    updateSummaryStatus('humiditySummaryStatus', summaryStats.humidity.max, 'humidity');
    updateSummaryStatus('lightSummaryStatus', summaryStats.light.max, 'light');
    updateSummaryStatus('phSummaryStatus', summaryStats.ph.max, 'ph');
    updateSummaryStatus('soilHumiditySummaryStatus', summaryStats.soilHumidity.max, 'soilHumidity');
    updateSummaryStatus('soilTempSummaryStatus', summaryStats.soilTemperature.max, 'soilTemperature');
    updateSummaryStatus('nutrientSummaryStatus', summaryStats.nitrogen.max, 'npk');
    
    // Update overall health
    updateOverallHealth();
    
    // Update current status and recommendations
    updateCurrentStatus();
}

// Update range display
function updateRangeDisplay(elementId, min, max, unit) {
    const element = document.getElementById(elementId);
    if (!element) return;
    if (min !== null && max !== null) {
        element.textContent = `${min.toFixed(1)}${unit} to ${max.toFixed(1)}${unit}`;
    } else if (min !== null) {
        element.textContent = `${min.toFixed(1)}${unit} to --${unit}`;
    } else if (max !== null) {
        element.textContent = `--${unit} to ${max.toFixed(1)}${unit}`;
    } else {
        element.textContent = `--${unit} to --${unit}`;
    }
}

// Format nutrient range for display
function formatNutrientRange(min, max, label) {
    if (min !== null && max !== null) {
        return `${label}: ${min.toFixed(0)} to ${max.toFixed(0)}`;
    } else if (min !== null) {
        return `${label}: ${min.toFixed(0)} to --`;
    } else if (max !== null) {
        return `${label}: -- to ${max.toFixed(0)}`;
    } else {
        return `${label}: -- to --`;
    }
}

// Update summary status indicators
function updateSummaryStatus(elementId, value, sensorType) {
    const element = document.getElementById(elementId);
    if (value === null) {
        element.textContent = 'No data';
        element.className = 'summary-status';
        return;
    }
    
    let evaluation;
    switch(sensorType) {
        case 'temperature':
            evaluation = evaluateTemperature(value);
            break;
        case 'humidity':
            evaluation = evaluateHumidity(value);
            break;
        case 'light':
            evaluation = evaluateLight(value);
            break;
        case 'ph':
            evaluation = evaluatePH(value);
            break;
        case 'soilHumidity':
            evaluation = evaluateSoilHumidity(value);
            break;
        case 'soilTemperature':
            evaluation = evaluateSoilTemperature(value);
            break;
        case 'npk':
            evaluation = evaluateNPK(value, 'N');
            break;
    }
    
    element.textContent = evaluation.text;
    element.className = `summary-status ${evaluation.status}`;
}

// Update overall health assessment
function updateOverallHealth() {
    const healthElement = document.getElementById('overallHealth');
    const statusElement = document.getElementById('overallHealthStatus');
    
    let goodCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let totalCount = 0;
    
    // Count statuses for each sensor
    const sensors = ['temperature', 'humidity', 'light', 'ph', 'soilHumidity', 'soilTemperature'];
    sensors.forEach(sensor => {
        const value = summaryStats[sensor].max;
        if (value !== null) {
            totalCount++;
            let evaluation;
            switch(sensor) {
                case 'temperature':
                    evaluation = evaluateTemperature(value);
                    break;
                case 'humidity':
                    evaluation = evaluateHumidity(value);
                    break;
                case 'light':
                    evaluation = evaluateLight(value);
                    break;
                case 'ph':
                    evaluation = evaluatePH(value);
                    break;
                case 'soilHumidity':
                    evaluation = evaluateSoilHumidity(value);
                    break;
                case 'soilTemperature':
                    evaluation = evaluateSoilTemperature(value);
                    break;
            }
            
            if (evaluation.status === 'good') goodCount++;
            else if (evaluation.status === 'warning') warningCount++;
            else if (evaluation.status === 'danger') criticalCount++;
        }
    });
    
    if (totalCount === 0) {
        healthElement.textContent = 'Awaiting Data';
        statusElement.textContent = 'No data';
        statusElement.className = 'summary-status';
    } else {
        const healthPercentage = (goodCount / totalCount) * 100;
        healthElement.textContent = `${healthPercentage.toFixed(0)}% Optimal`;
        
        if (criticalCount > 0) {
            statusElement.textContent = 'Critical Issues';
            statusElement.className = 'summary-status critical';
        } else if (warningCount > 0) {
            statusElement.textContent = 'Needs Attention';
            statusElement.className = 'summary-status warning';
        } else {
            statusElement.textContent = 'All Good';
            statusElement.className = 'summary-status good';
        }
    }
}

// Update current status and recommendations
function updateCurrentStatus() {
    const statusElement = document.getElementById('currentStatus');
    const recommendationsElement = document.getElementById('currentRecommendations');
    
    let statusText = '';
    let recommendations = [];
    
    // Check each sensor for current status
    const sensors = [
        { name: 'Air Temperature', value: summaryStats.temperature.max, type: 'temperature' },
        { name: 'Air Humidity', value: summaryStats.humidity.max, type: 'humidity' },
        { name: 'Light Intensity', value: summaryStats.light.max, type: 'light' },
        { name: 'Soil pH', value: summaryStats.ph.max, type: 'ph' },
        { name: 'Soil Moisture', value: summaryStats.soilHumidity.max, type: 'soilHumidity' },
        { name: 'Soil Temperature', value: summaryStats.soilTemperature.max, type: 'soilTemperature' }
    ];
    
    let criticalIssues = [];
    let warnings = [];
    
    sensors.forEach(sensor => {
        if (sensor.value !== null) {
            let evaluation;
            switch(sensor.type) {
                case 'temperature':
                    evaluation = evaluateTemperature(sensor.value);
                    break;
                case 'humidity':
                    evaluation = evaluateHumidity(sensor.value);
                    break;
                case 'light':
                    evaluation = evaluateLight(sensor.value);
                    break;
                case 'ph':
                    evaluation = evaluatePH(sensor.value);
                    break;
                case 'soilHumidity':
                    evaluation = evaluateSoilHumidity(sensor.value);
                    break;
                case 'soilTemperature':
                    evaluation = evaluateSoilTemperature(sensor.value);
                    break;
            }
            
            if (evaluation.status === 'danger') {
                criticalIssues.push(sensor.name);
            } else if (evaluation.status === 'warning') {
                warnings.push(sensor.name);
            }
        }
    });
    
    if (criticalIssues.length > 0) {
        statusText = `⚠️ Critical issues detected in: ${criticalIssues.join(', ')}`;
        recommendations.push('Immediate action required for critical parameters');
    } else if (warnings.length > 0) {
        statusText = `⚠️ Attention needed for: ${warnings.join(', ')}`;
        recommendations.push('Monitor warning parameters closely');
    } else {
        statusText = '✅ All parameters within optimal ranges for Brassicaceae';
        recommendations.push('Continue current management practices');
    }
    
    // Add Brassicaceae-specific recommendations
    if (summaryStats.temperature.max > 30) {
        recommendations.push('Consider cooling systems for high temperatures');
    }
    if (summaryStats.humidity.max > 85) {
        recommendations.push('Improve ventilation to reduce humidity');
    }
    if (summaryStats.ph.max < 6.0) {
        recommendations.push('Consider adding lime to raise soil pH');
    }
    
    statusElement.textContent = statusText;
    recommendationsElement.textContent = recommendations.join(' • ');
}

// Connect to MQTT Broker
function connectMQTT() {
    const brokerInput = document.getElementById('mqttBroker');
    const userInput = document.getElementById('mqttUser');
    const passInput = document.getElementById('mqttPass');
    
    let broker = brokerInput ? brokerInput.value.trim() : 'wss://broker.emqx.io:8084/mqtt';
    let username = userInput ? userInput.value.trim() : '';
    let password = passInput ? passInput.value : '';
    
    // Use default broker if empty
    if (!broker) {
        console.warn('⚠️ No broker URL provided, using default');
        const defaultBroker = 'wss://broker.emqx.io:8084/mqtt';
        if (brokerInput) brokerInput.value = defaultBroker;
        broker = defaultBroker;
    }
    
    // If no credentials provided in UI/localStorage, default to Arduino credentials
    if (!username) {
        username = 'myuser';
        if (userInput) userInput.value = username;
    }
    if (!password) {
        password = '*smart2025!';
        if (passInput) passInput.value = password;
    }
    
    // Check if we're on HTTPS and using insecure WebSocket
    if (window.location.protocol === 'https:' && broker.startsWith('ws://')) {
        console.warn('⚠️ HTTPS page detected with insecure WebSocket - connection may fail');
        console.warn('   Consider using wss:// for secure WebSocket connection');
    }

    console.log('🔌 Attempting MQTT connection...');
    console.log('📡 Broker:', broker);
    console.log('👤 Username:', username || 'Not provided');
    console.log('🔐 Password:', password ? '***' : 'Not provided');

    // Save to localStorage
    localStorage.setItem('mqttBroker', broker);
    localStorage.setItem('mqttUser', username);
    localStorage.setItem('mqttPass', password);

    const options = {
        clean: true,
        connectTimeout: 4000,
        clientId: 'greenhouse_dashboard_' + Math.random().toString(16).substr(2, 8)
    };

    if (username && password) {
        options.username = username;
        options.password = password;
    }

    try {
        console.log('🚀 Creating MQTT client with options:', {
            broker: broker,
            clientId: options.clientId,
            hasAuth: !!(username && password),
            connectTimeout: options.connectTimeout
        });

        mqttClient = mqtt.connect(broker, options);
        
        // Update window.mqttClient reference
        window.mqttClient = mqttClient;

        mqttClient.on('connect', () => {
            console.log('✅ Successfully connected to MQTT broker');
            console.log('🔗 Client ID:', mqttClient.options.clientId);
            console.log('🌐 Broker URL:', broker);
            isConnected = true;
            updateConnectionStatus(true);
            
            // Subscribe to all topics - matching Arduino ESP32 topics
            const topics = [
                'greenhouse/temperature',
                'greenhouse/humidity', 
                'greenhouse/light',
                'greenhouse/ph',
                'greenhouse/soil_ph',           // Arduino publishes soil_ph
                'greenhouse/soil_moisture',     // Arduino publishes soil_moisture
                'greenhouse/soil_humidity',     // Alternative name
                'greenhouse/soil_temperature',
                'greenhouse/soil_ec',           // Optional: Electrical Conductivity
                'greenhouse/nitrogen',
                'greenhouse/phosphorus',
                'greenhouse/potassium',
                'greenhouse/actuators/fan_status',
                'greenhouse/actuators/humidifier_status',
                'greenhouse/actuators/sprinkler_status'
            ];
            
            console.log('📋 Subscribing to topics:', topics);
            topics.forEach(topic => {
                mqttClient.subscribe(topic, { qos: 1 }, (err) => {
                    if (err) {
                        console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
                    } else {
                        console.log(`✅ Subscribed to: ${topic}`);
                    }
                });
            });

            showAlert('✅ Successfully connected to MQTT broker - Real-time data active!', 'success');
            
            // Stop Firebase fallback updates when MQTT is connected
            console.log('🔄 Real-time MQTT updates active - Firebase fallback disabled');
        });

        mqttClient.on('error', (error) => {
            console.error('❌ MQTT Connection Error:');
            console.error('   Error Code:', error.code);
            console.error('   Error Message:', error.message);
            console.error('   Broker:', broker);
            console.error('   Full Error:', error);
            
            // Check for WebSocket security issues
            if (error.message.includes('WebSocket') || error.message.includes('insecure')) {
                console.error('🔒 WebSocket Security Issue Detected');
                if (window.location.protocol === 'https:' && broker.startsWith('ws://')) {
                    showAlert('🔒 WebSocket blocked: HTTPS pages require secure WebSocket (wss://). Please update broker URL to use wss://', 'warning');
                } else {
                    showAlert(`WebSocket connection error: ${error.message}`, 'warning');
                }
            } else {
                showAlert(`MQTT connection error: ${error.message}`, 'warning');
            }
            
            updateConnectionStatus(false);
        });

        mqttClient.on('disconnect', () => {
            console.log('🔌 Disconnected from MQTT broker');
            console.log('📊 Connection state:', mqttClient.connectionState);
            updateConnectionStatus(false);
        });

        mqttClient.on('message', (topic, message) => {
            const messageStr = message.toString();
            console.log(`📨 Received MQTT message:`);
            console.log(`   Topic: "${topic}"`);
            console.log(`   Raw Message: "${messageStr}"`);
            console.log(`   Message Type: ${typeof messageStr}`);
            console.log(`   Message Length: ${messageStr.length}`);
            console.log(`   Timestamp: ${new Date().toISOString()}`);
            
            // Check if topic matches expected patterns
            const expectedTopics = [
                'greenhouse/temperature',
                'greenhouse/humidity',
                'greenhouse/light',
                'greenhouse/ph',
                'greenhouse/soil_ph',
                'greenhouse/soil_moisture',
                'greenhouse/soil_humidity',
                'greenhouse/soil_temperature',
                'greenhouse/soil_ec',
                'greenhouse/nitrogen',
                'greenhouse/phosphorus',
                'greenhouse/potassium',
                'greenhouse/actuators/fan_status',
                'greenhouse/actuators/humidifier_status',
                'greenhouse/actuators/sprinkler_status'
            ];
            
            const isExpectedTopic = expectedTopics.includes(topic);
            if (!isExpectedTopic) {
                console.warn(`⚠️ Received unexpected topic: "${topic}"`);
                console.warn(`   This topic is not in expected list:`, expectedTopics);
            } else {
                console.log(`✅ Topic "${topic}" is in expected list`);
            }
            
            // Handle actuator status updates FIRST (before handleMessage which expects numbers)
            if (topic === 'greenhouse/actuators/fan_status') {
                console.log(`🎛️ Updating fan status: ${messageStr}`);
                updateActuatorStatus('fan', messageStr);
                return; // Don't call handleMessage for actuator status
            } else if (topic === 'greenhouse/actuators/humidifier_status') {
                console.log(`🎛️ Updating humidifier status: ${messageStr}`);
                updateActuatorStatus('humidifier', messageStr);
                return; // Don't call handleMessage for actuator status
            } else if (topic === 'greenhouse/actuators/sprinkler_status') {
                console.log(`🎛️ Updating sprinkler status: ${messageStr}`);
                updateActuatorStatus('sprinkler', messageStr);
                return; // Don't call handleMessage for actuator status
            }
            
            // Process the message and update dashboard (only for sensor data - numeric values)
            console.log(`🔄 Calling handleMessage for topic: "${topic}"`);
            try {
                handleMessage(topic, messageStr);
                console.log(`✅ handleMessage completed for topic: "${topic}"`);
            } catch (error) {
                console.error(`❌ Error in handleMessage for topic "${topic}":`, error);
                console.error(`   Error stack:`, error.stack);
            }
            
            // Show visual indicator that real-time data is updating
            const statusIndicator = document.getElementById('navStatusDot');
            if (statusIndicator) {
                statusIndicator.classList.add('connected');
                statusIndicator.style.animation = 'pulse 0.5s ease';
                setTimeout(() => {
                    statusIndicator.style.animation = '';
                }, 500);
            }
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 MQTT client reconnecting...');
            showAlert('Reconnecting to MQTT broker...', 'info');
        });

        mqttClient.on('offline', () => {
            console.log('📴 MQTT client went offline');
            updateConnectionStatus(false);
            showAlert('MQTT connection lost - attempting to reconnect', 'warning');
        });

    } catch (error) {
        console.error('💥 Failed to create MQTT client:');
        console.error('   Error:', error);
        console.error('   Broker:', broker);
        console.error('   Stack trace:', error.stack);
        showAlert(`Failed to connect to MQTT broker: ${error.message}`, 'warning');
    }
}

// Brassicaceae-specific thresholds for Lucban, Quezon Province
const brassicaceaeThresholds = {
    temperature: { optimal: { min: 18, max: 25 }, warning: { min: 15, max: 30 }, critical: { min: 10, max: 35 } },
    humidity: { optimal: { min: 60, max: 80 }, warning: { min: 50, max: 85 }, critical: { min: 40, max: 90 } },
    ph: { optimal: { min: 6.0, max: 7.0 }, warning: { min: 5.5, max: 7.5 }, critical: { min: 5.0, max: 8.0 } },
    soilHumidity: { optimal: { min: 60, max: 80 }, warning: { min: 50, max: 85 }, critical: { min: 40, max: 90 } },
    soilTemperature: { optimal: { min: 20, max: 28 }, warning: { min: 18, max: 30 }, critical: { min: 15, max: 35 } },
    light: { optimal: { min: 15000, max: 25000 }, warning: { min: 10000, max: 35000 }, critical: { min: 5000, max: 50000 } }
};

// Status evaluation functions for Brassicaceae
function evaluateTemperature(value) {
    const t = brassicaceaeThresholds.temperature;
    if (value < t.critical.min || value > t.critical.max) return { status: 'danger', text: 'Critical' };
    if (value < t.warning.min || value > t.warning.max) return { status: 'warning', text: 'Warning' };
    return { status: 'good', text: 'Good' };
}

function evaluateHumidity(value) {
    const t = brassicaceaeThresholds.humidity;
    if (value < t.critical.min || value > t.critical.max) return { status: 'danger', text: 'Critical' };
    if (value < t.warning.min || value > t.warning.max) return { status: 'warning', text: 'Warning' };
    return { status: 'good', text: 'Good' };
}

function evaluateLight(value) {
    const t = brassicaceaeThresholds.light;
    if (value < t.critical.min || value > t.critical.max) return { status: 'danger', text: 'Critical' };
    if (value < t.warning.min || value > t.warning.max) return { status: 'warning', text: 'Warning' };
    return { status: 'good', text: 'Good' };
}

function evaluatePH(value) {
    const t = brassicaceaeThresholds.ph;
    if (value < t.critical.min || value > t.critical.max) return { status: 'danger', text: 'Critical' };
    if (value < t.warning.min || value > t.warning.max) return { status: 'warning', text: 'Warning' };
    return { status: 'good', text: 'Good' };
}

function evaluateSoilHumidity(value) {
    const t = brassicaceaeThresholds.soilHumidity;
    if (value < t.critical.min || value > t.critical.max) return { status: 'danger', text: 'Critical' };
    if (value < t.warning.min || value > t.warning.max) return { status: 'warning', text: 'Warning' };
    return { status: 'good', text: 'Good' };
}

function evaluateSoilTemperature(value) {
    const t = brassicaceaeThresholds.soilTemperature;
    if (value < t.critical.min || value > t.critical.max) return { status: 'danger', text: 'Critical' };
    if (value < t.warning.min || value > t.warning.max) return { status: 'warning', text: 'Warning' };
    return { status: 'good', text: 'Good' };
}

function evaluateNPK(value, nutrient) {
    const thresholds = { N: 100, P: 50, K: 150 };
    if (value < 30) return { status: 'danger', text: 'Critical' };
    if (value < thresholds[nutrient]) return { status: 'warning', text: 'Low' };
    return { status: 'good', text: 'Good' };
}

function updateStatus(elementId, evaluation) {
    const element = document.getElementById(elementId);
    element.textContent = evaluation.text;
    element.className = `status-indicator status-${evaluation.status}`;
}

function updateRecommendation(elementId, sensor, value) {
    const element = document.getElementById(elementId);
    let recommendation = '';
    
    switch(sensor) {
        case 'temperature':
            if (value < 15) recommendation = '💡 Consider heating or insulation for Brassicaceae';
            else if (value > 30) recommendation = '💡 Increase ventilation or cooling - Brassicaceae prefer cooler temps';
            break;
        case 'humidity':
            if (value < 50) recommendation = '💡 Add humidifier - Brassicaceae need higher humidity';
            else if (value > 85) recommendation = '💡 Improve ventilation or dehumidify to prevent disease';
            break;
        case 'light':
            if (value < 10000) recommendation = '💡 Increase artificial lighting for Brassicaceae growth';
            else if (value > 35000) recommendation = '💡 Add shade - Brassicaceae prefer moderate light';
            break;
        case 'ph':
            if (value < 6.0) recommendation = '💡 Add lime to increase pH for Brassicaceae';
            else if (value > 7.0) recommendation = '💡 Add sulfur to decrease pH - Brassicaceae prefer slightly acidic';
            break;
        case 'soilHumidity':
            if (value < 50) recommendation = '💡 Water immediately - Brassicaceae need consistent moisture';
            else if (value > 85) recommendation = '💡 Improve drainage - prevent root rot in Brassicaceae';
            break;
        case 'soilTemperature':
            if (value < 18) recommendation = '💡 Add heating or insulation for Brassicaceae roots';
            else if (value > 30) recommendation = '💡 Cool soil with mulch or irrigation';
            break;
    }
    
    if (recommendation) {
        element.textContent = recommendation;
        element.style.display = 'block';
    } else {
        element.style.display = 'none';
    }
}

// Test function to verify sensor elements exist and can be updated
function testSensorElements() {
    console.log('🧪 Testing sensor HTML elements...');
    
    const sensors = [
        { name: 'humidity', id: 'humidityValue', timeId: 'humidityTime' },
        { name: 'light', id: 'lightValue', timeId: 'lightTime' },
        { name: 'soilTemp', id: 'soilTempValue', timeId: 'soilTempTime' },
        { name: 'soilHumidity', id: 'soilHumidityValue', timeId: 'soilHumidityTime' },
        { name: 'ph', id: 'phValue', timeId: 'phTime' },
        { name: 'nitrogen', id: 'nitrogenValue', timeId: 'npkTime' },
        { name: 'phosphorus', id: 'phosphorusValue', timeId: null },
        { name: 'potassium', id: 'potassiumValue', timeId: null }
    ];
    
    sensors.forEach(sensor => {
        const valueElement = document.getElementById(sensor.id);
        const timeElement = sensor.timeId ? document.getElementById(sensor.timeId) : null;
        
        if (valueElement) {
            console.log(`✅ ${sensor.name} value element found: ${sensor.id}`);
            // Test update
            valueElement.textContent = 'TEST';
            setTimeout(() => {
                valueElement.textContent = '--';
            }, 1000);
        } else {
            console.error(`❌ ${sensor.name} value element NOT FOUND: ${sensor.id}`);
        }
        
        if (sensor.timeId) {
            if (timeElement) {
                console.log(`✅ ${sensor.name} time element found: ${sensor.timeId}`);
            } else {
                console.error(`❌ ${sensor.name} time element NOT FOUND: ${sensor.timeId}`);
            }
        }
    });
    
    console.log('🧪 Element test complete. Check if elements flashed "TEST" briefly.');
}

// Make test function globally available
window.testSensorElements = testSensorElements;

// Handle incoming MQTT messages
function handleMessage(topic, message) {
    console.log(`\n🎯 handleMessage called:`);
    console.log(`   Topic: "${topic}"`);
    console.log(`   Message: "${message}"`);
    console.log(`   Type: ${typeof message}`);
    
    const value = parseFloat(message);
    const timestamp = new Date();
    const labelValue = timestamp.toISOString();
    const displayTime = timestamp.toLocaleTimeString();

    console.log(`🔄 REAL-TIME MQTT DATA UPDATE:`);
    console.log(`   Topic: "${topic}"`);
    console.log(`   Raw Value: "${message}"`);
    console.log(`   Parsed Value: ${value}`);
    console.log(`   Is NaN: ${isNaN(value)}`);
    console.log(`   Timestamp: ${displayTime}`);
    console.log(`   ✅ Updating dashboard with real-time sensor data`);

    // Validate value
    if (isNaN(value)) {
        console.error(`❌ Invalid value received for topic "${topic}": "${message}"`);
        console.error(`   Cannot parse as number. Value: "${message}"`);
        return;
    }

    console.log(`✅ Value is valid: ${value}`);

    switch(topic) {
        case 'greenhouse/temperature':
            console.log(`🌡️ Updating temperature: ${value}°C`);
            document.getElementById('tempValue').textContent = value.toFixed(1);
            document.getElementById('tempTime').textContent = 'Updated: ' + displayTime;
            
            // Update status and recommendations
            const tempEvaluation = evaluateTemperature(value);
            console.log(`   Status: ${tempEvaluation.status} (${tempEvaluation.text})`);
            updateStatus('tempStatus', tempEvaluation);
            updateRecommendation('tempRecommendation', 'temperature', value);
            
            // Update summary statistics
            updateSummaryStats('temperature', value);
            
            // Add to chart only if it's a new timestamp
            if (chartData.labels.length === 0 || chartData.labels[chartData.labels.length - 1] !== labelValue) {
                addTimestamp(timestamp);
            }
            chartData.temperature.push(value);
            break;

        case 'greenhouse/humidity':
            console.log(`💧 Updating humidity: ${value}%`);
            const humidityElement = document.getElementById('humidityValue');
            const humidityTimeElement = document.getElementById('humidityTime');
            if (humidityElement) {
                humidityElement.textContent = value.toFixed(1);
                console.log(`   ✅ Updated humidityValue to: ${value.toFixed(1)}`);
            } else {
                console.error('❌ humidityValue element not found!');
                console.error('   Current page:', window.location.hash);
                console.error('   Available elements:', document.querySelectorAll('[id*="humidity"]').length);
            }
            if (humidityTimeElement) {
                humidityTimeElement.textContent = 'Updated: ' + displayTime;
            } else {
                console.error('❌ humidityTime element not found!');
            }
            
            // Update status and recommendations
            const humidityEvaluation = evaluateHumidity(value);
            console.log(`   Status: ${humidityEvaluation.status} (${humidityEvaluation.text})`);
            updateStatus('humidityStatus', humidityEvaluation);
            updateRecommendation('humidityRecommendation', 'humidity', value);
            
            // Update summary statistics
            updateSummaryStats('humidity', value);
            
            chartData.humidity.push(value);
            break;

        case 'greenhouse/light':
            console.log(`💡 Updating light: ${value} lux`);
            const lightElement = document.getElementById('lightValue');
            const lightTimeElement = document.getElementById('lightTime');
            if (lightElement) {
                lightElement.textContent = value.toFixed(1);
                console.log(`   ✅ Updated lightValue to: ${value.toFixed(1)}`);
            } else {
                console.error('❌ lightValue element not found!');
            }
            if (lightTimeElement) {
                lightTimeElement.textContent = 'Updated: ' + displayTime;
            } else {
                console.error('❌ lightTime element not found!');
            }
            
            // Update status and recommendations
            const lightEvaluation = evaluateLight(value);
            console.log(`   Status: ${lightEvaluation.status} (${lightEvaluation.text})`);
            updateStatus('lightStatus', lightEvaluation);
            updateRecommendation('lightRecommendation', 'light', value);
            
            // Update summary statistics
            updateSummaryStats('light', value);
            
            chartData.light.push(value);
            break;

        case 'greenhouse/soil_ph':
            // Handle both soil_ph and ph
        case 'greenhouse/ph':
            console.log(`🧪 Updating pH: ${value}`);
            const phElement = document.getElementById('phValue');
            const phTimeElement = document.getElementById('phTime');
            if (phElement) {
                phElement.textContent = value.toFixed(1);
            } else {
                console.error('❌ phValue element not found!');
            }
            if (phTimeElement) {
                phTimeElement.textContent = 'Updated: ' + displayTime;
            } else {
                console.error('❌ phTime element not found!');
            }
            
            // Update status and recommendations
            const phEvaluation = evaluatePH(value);
            console.log(`   Status: ${phEvaluation.status} (${phEvaluation.text})`);
            updateStatus('phStatus', phEvaluation);
            updateRecommendation('phRecommendation', 'ph', value);
            
            // Update summary statistics
            updateSummaryStats('ph', value);
            
            chartData.ph.push(value);
            break;

        case 'greenhouse/soil_moisture':
            // Handle both soil_moisture and soil_humidity
        case 'greenhouse/soil_humidity':
            console.log(`🌱 Updating soil humidity: ${value}%`);
            const soilHumidityElement = document.getElementById('soilHumidityValue');
            const soilHumidityTimeElement = document.getElementById('soilHumidityTime');
            if (soilHumidityElement) {
                soilHumidityElement.textContent = value.toFixed(1);
            } else {
                console.error('❌ soilHumidityValue element not found!');
            }
            if (soilHumidityTimeElement) {
                soilHumidityTimeElement.textContent = 'Updated: ' + displayTime;
            } else {
                console.error('❌ soilHumidityTime element not found!');
            }
            
            // Update status and recommendations
            const soilHumidityEvaluation = evaluateSoilHumidity(value);
            console.log(`   Status: ${soilHumidityEvaluation.status} (${soilHumidityEvaluation.text})`);
            updateStatus('soilHumidityStatus', soilHumidityEvaluation);
            updateRecommendation('soilHumidityRecommendation', 'soilHumidity', value);
            
            // Update summary statistics
            updateSummaryStats('soilHumidity', value);
            
            chartData.soilHumidity.push(value);
            break;

        case 'greenhouse/soil_temperature':
            console.log(`🌡️ Updating soil temperature: ${value}°C`);
            const soilTempElement = document.getElementById('soilTempValue');
            const soilTempTimeElement = document.getElementById('soilTempTime');
            if (soilTempElement) {
                soilTempElement.textContent = value.toFixed(1);
            } else {
                console.error('❌ soilTempValue element not found!');
            }
            if (soilTempTimeElement) {
                soilTempTimeElement.textContent = 'Updated: ' + displayTime;
            } else {
                console.error('❌ soilTempTime element not found!');
            }
            
            // Update status and recommendations
            const soilTempEvaluation = evaluateSoilTemperature(value);
            console.log(`   Status: ${soilTempEvaluation.status} (${soilTempEvaluation.text})`);
            updateStatus('soilTempStatus', soilTempEvaluation);
            updateRecommendation('soilTempRecommendation', 'soilTemperature', value);
            
            // Update summary statistics
            updateSummaryStats('soilTemperature', value);
            
            chartData.soilTemperature.push(value);
            break;

        case 'greenhouse/soil_ec':
            console.log(`⚡ Updating soil EC: ${value} µS/cm`);
            // Optional: You can add an EC display element if needed
            // document.getElementById('soilECValue').textContent = value.toFixed(0);
            break;

        case 'greenhouse/nitrogen':
            console.log(`🧬 Updating nitrogen: ${value.toFixed(1)} mg/kg`);
            const nitrogenElement = document.getElementById('nitrogenValue');
            const npkTimeElement = document.getElementById('npkTime');
            if (nitrogenElement) {
                nitrogenElement.textContent = Math.round(value);
            } else {
                console.error('❌ nitrogenValue element not found!');
            }
            if (npkTimeElement) {
                npkTimeElement.textContent = 'Updated: ' + displayTime;
            } else {
                console.error('❌ npkTime element not found!');
            }
            
            // Update status
            const nitrogenEvaluation = evaluateNPK(value, 'N');
            console.log(`   Status: ${nitrogenEvaluation.status} (${nitrogenEvaluation.text})`);
            updateStatus('nitrogenStatus', nitrogenEvaluation);
            
            // Update summary statistics
            updateSummaryStats('nitrogen', value);
            
            chartData.nitrogen.push(value);
            break;

        case 'greenhouse/phosphorus':
            console.log(`🧬 Updating phosphorus: ${value.toFixed(1)} mg/kg`);
            const phosphorusElement = document.getElementById('phosphorusValue');
            if (phosphorusElement) {
                phosphorusElement.textContent = Math.round(value);
            } else {
                console.error('❌ phosphorusValue element not found!');
            }
            
            // Update status
            const phosphorusEvaluation = evaluateNPK(value, 'P');
            console.log(`   Status: ${phosphorusEvaluation.status} (${phosphorusEvaluation.text})`);
            updateStatus('phosphorusStatus', phosphorusEvaluation);
            
            // Update summary statistics
            updateSummaryStats('phosphorus', value);
            
            chartData.phosphorus.push(value);
            break;

        case 'greenhouse/potassium':
            console.log(`🧬 Updating potassium: ${value.toFixed(1)} mg/kg`);
            const potassiumElement = document.getElementById('potassiumValue');
            if (potassiumElement) {
                potassiumElement.textContent = Math.round(value);
            } else {
                console.error('❌ potassiumValue element not found!');
            }
            
            // Update status
            const potassiumEvaluation = evaluateNPK(value, 'K');
            console.log(`   Status: ${potassiumEvaluation.status} (${potassiumEvaluation.text})`);
            updateStatus('potassiumStatus', potassiumEvaluation);
            
            // Update summary statistics
            updateSummaryStats('potassium', value);
            
            chartData.potassium.push(value);
            break;

        default:
            console.warn(`❓ Unknown topic received: "${topic}"`);
            console.warn(`   Message: "${message}"`);
            console.warn(`   This topic is not handled in the switch statement.`);
            console.warn(`   Available cases: greenhouse/temperature, greenhouse/humidity, greenhouse/light, greenhouse/ph, greenhouse/soil_ph, greenhouse/soil_moisture, greenhouse/soil_humidity, greenhouse/soil_temperature, greenhouse/nitrogen, greenhouse/phosphorus, greenhouse/potassium`);
    }

    // Update charts only if updateChartData function exists
    if (typeof updateChartData === 'function') {
        try {
    updateChartData();
        } catch (error) {
            console.warn('⚠️ Error updating charts:', error.message);
        }
    } else {
        console.warn('⚠️ updateChartData function not found');
    }
}


// Update connection status
function updateConnectionStatus(connected) {
    const navStatusDot = document.getElementById('navStatusDot');
    const navStatusText = document.getElementById('navStatusText');
    
    if (connected) {
        navStatusDot.classList.add('connected');
        navStatusText.textContent = 'Connected';
    } else {
        navStatusDot.classList.remove('connected');
        navStatusText.textContent = 'Disconnected';
    }
}

// Reconnect to MQTT
function reconnectMQTT() {
    console.log('🔄 Attempting MQTT reconnection...');
    
    if (mqttClient) {
        console.log('🔌 Closing existing MQTT client...');
        try {
            mqttClient.end(true); // Force close
            console.log('✅ Existing client closed');
        } catch (error) {
            console.error('⚠️ Error closing existing client:', error);
        }
    }
    
    // Clear the client reference
    mqttClient = null;
    isConnected = false;
    updateConnectionStatus(false);
    
    // Wait a moment before reconnecting
    setTimeout(() => {
        console.log('🔄 Starting fresh MQTT connection...');
        connectMQTT();
    }, 2000);
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertsDiv = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    alertsDiv.appendChild(alert);

    // Remove alert after 5 seconds
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.5s ease';
        setTimeout(() => alert.remove(), 500);
    }, 5000);
}

// Function to initialize summary stats from historical data
let summaryStatsInitialized = false; // Cache flag to prevent duplicate initialization

async function initializeSummaryStatsFromHistory() {
    // Only initialize once per session to prevent excessive bandwidth usage
    if (summaryStatsInitialized) {
        console.log('⏭️ Summary stats already initialized, skipping...');
        return;
    }
    
    const apiBase = window.getApiBase ? window.getApiBase() : 'https://maseed.onrender.com/api';
    const sensors = ['temperature', 'humidity', 'light', 'ph', 'soil_humidity', 'soil_temperature', 'nitrogen', 'phosphorus', 'potassium'];
    const fromMs = Date.now() - (2 * 60 * 60 * 1000); // Last 2 hours (reduced from 24h to save bandwidth)
    
    console.log('📊 Initializing summary stats from historical data (last 24 hours)...');
    
    try {
        const promises = sensors.map(sensor => 
            fetch(`${apiBase}/history?sensor=${sensor}&fromMs=${fromMs}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => [])
        );
        
        const results = await Promise.all(promises);
        
        // Initialize summary stats from all historical data
        sensors.forEach((sensor, index) => {
            const data = results[index];
            if (data && data.length > 0 && summaryStats[sensor]) {
                const values = data.map(d => d.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                
                // Initialize summary stats
                summaryStats[sensor].min = min;
                summaryStats[sensor].max = max;
                // Add values (up to 100 for performance)
                values.slice(-100).forEach(v => {
                    summaryStats[sensor].values.push(v);
                });
                
                console.log(`✅ Initialized ${sensor} range: ${min.toFixed(1)} to ${max.toFixed(1)} (${data.length} data points)`);
            }
        });
        
        // Update summary display after initialization
        updateSummaryDisplay();
        summaryStatsInitialized = true; // Mark as initialized
        console.log('✅ Summary stats initialized from historical data');
    } catch (error) {
        console.error('❌ Error initializing summary stats:', error);
    }
}

// Function to load latest sensor values from Firebase API as fallback
// ONLY runs when MQTT is NOT connected
async function loadLatestValuesFromFirebase() {
    // CRITICAL: Don't load from Firebase if MQTT is connected and working
    if (mqttClient && mqttClient.connected && isConnected) {
        console.log('⏭️ Skipping Firebase fallback - MQTT is connected and active');
        return;
    }
    
    const apiBase = window.getApiBase ? window.getApiBase() : 'https://maseed.onrender.com/api';
    const sensors = ['temperature', 'humidity', 'light', 'ph', 'soil_humidity', 'soil_temperature', 'nitrogen', 'phosphorus', 'potassium'];
    const fromMs = Date.now() - (10 * 60 * 1000); // Last 10 minutes (reduced from 1 hour to save bandwidth)
    
    console.log('📊 Loading latest values from Firebase API (fallback mode)...');
    
    try {
        const promises = sensors.map(sensor => 
            fetch(`${apiBase}/history?sensor=${sensor}&fromMs=${fromMs}`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => [])
        );
        
        const results = await Promise.all(promises);
        
        // Get the latest value for each sensor AND initialize summary stats from historical data
        sensors.forEach((sensor, index) => {
            const data = results[index];
            if (data && data.length > 0) {
                // Get the most recent value (last in array since it's sorted)
                const latest = data[data.length - 1];
                const value = latest.value;
                
                // Initialize summary stats from all historical data (for min/max ranges)
                if (data.length > 0) {
                    const values = data.map(d => d.value);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    
                    // Initialize summary stats if not already set
                    if (summaryStats[sensor]) {
                        // Only initialize if we don't have data yet, or if historical data has wider range
                        if (summaryStats[sensor].min === null || min < summaryStats[sensor].min) {
                            summaryStats[sensor].min = min;
                        }
                        if (summaryStats[sensor].max === null || max > summaryStats[sensor].max) {
                            summaryStats[sensor].max = max;
                        }
                        // Add all values to the values array (up to 100)
                        values.forEach(v => {
                            if (summaryStats[sensor].values.length < 100) {
                                summaryStats[sensor].values.push(v);
                            }
                        });
                    }
                }
                
                // Update the dashboard based on sensor type
                updateSensorDisplay(sensor, value, latest.ts);
                console.log(`✅ Loaded ${sensor}: ${value} (Firebase fallback)`);
            }
        });
        
        // Update summary display after initializing from historical data
        updateSummaryDisplay();
        
        console.log('✅ Latest values loaded from Firebase (fallback)');
    } catch (error) {
        console.error('❌ Error loading latest values from Firebase:', error);
    }
}

// Function to update sensor display on dashboard
function updateSensorDisplay(sensor, value, timestamp) {
    const now = new Date(timestamp).toLocaleTimeString();
    
    switch(sensor) {
        case 'temperature':
            if (document.getElementById('tempValue')) {
                document.getElementById('tempValue').textContent = value.toFixed(1);
                document.getElementById('tempTime').textContent = 'Updated: ' + now;
                const tempEvaluation = evaluateTemperature(value);
                updateStatus('tempStatus', tempEvaluation);
                updateRecommendation('tempRecommendation', 'temperature', value);
                updateSummaryStats('temperature', value);
            }
            break;
        case 'humidity':
            if (document.getElementById('humidityValue')) {
                document.getElementById('humidityValue').textContent = value.toFixed(1);
                document.getElementById('humidityTime').textContent = 'Updated: ' + now;
                const humidityEvaluation = evaluateHumidity(value);
                updateStatus('humidityStatus', humidityEvaluation);
                updateRecommendation('humidityRecommendation', 'humidity', value);
                updateSummaryStats('humidity', value);
            }
            break;
        case 'light':
            if (document.getElementById('lightValue')) {
                document.getElementById('lightValue').textContent = value.toFixed(1);
                document.getElementById('lightTime').textContent = 'Updated: ' + now;
                const lightEvaluation = evaluateLight(value);
                updateStatus('lightStatus', lightEvaluation);
                updateRecommendation('lightRecommendation', 'light', value);
                updateSummaryStats('light', value);
            }
            break;
        case 'ph':
            if (document.getElementById('phValue')) {
                document.getElementById('phValue').textContent = value.toFixed(1);
                document.getElementById('phTime').textContent = 'Updated: ' + now;
                const phEvaluation = evaluatePH(value);
                updateStatus('phStatus', phEvaluation);
                updateRecommendation('phRecommendation', 'ph', value);
                updateSummaryStats('ph', value);
            }
            break;
        case 'soil_humidity':
            if (document.getElementById('soilHumidityValue')) {
                document.getElementById('soilHumidityValue').textContent = value.toFixed(1);
                document.getElementById('soilHumidityTime').textContent = 'Updated: ' + now;
                const soilHumidityEvaluation = evaluateSoilHumidity(value);
                updateStatus('soilHumidityStatus', soilHumidityEvaluation);
                updateRecommendation('soilHumidityRecommendation', 'soilHumidity', value);
                updateSummaryStats('soilHumidity', value);
            }
            break;
        case 'soil_temperature':
            if (document.getElementById('soilTempValue')) {
                document.getElementById('soilTempValue').textContent = value.toFixed(1);
                document.getElementById('soilTempTime').textContent = 'Updated: ' + now;
                const soilTempEvaluation = evaluateSoilTemperature(value);
                updateStatus('soilTempStatus', soilTempEvaluation);
                updateRecommendation('soilTempRecommendation', 'soilTemperature', value);
                updateSummaryStats('soilTemperature', value);
            }
            break;
        case 'nitrogen':
            if (document.getElementById('nitrogenValue')) {
                document.getElementById('nitrogenValue').textContent = Math.round(value);
                document.getElementById('npkTime').textContent = 'Updated: ' + now;
                const nitrogenEvaluation = evaluateNPK(value, 'N');
                updateStatus('nitrogenStatus', nitrogenEvaluation);
                updateSummaryStats('nitrogen', value);
            }
            break;
        case 'phosphorus':
            if (document.getElementById('phosphorusValue')) {
                document.getElementById('phosphorusValue').textContent = Math.round(value);
                const phosphorusEvaluation = evaluateNPK(value, 'P');
                updateStatus('phosphorusStatus', phosphorusEvaluation);
                updateSummaryStats('phosphorus', value);
            }
            break;
        case 'potassium':
            if (document.getElementById('potassiumValue')) {
                document.getElementById('potassiumValue').textContent = Math.round(value);
                const potassiumEvaluation = evaluateNPK(value, 'K');
                updateStatus('potassiumStatus', potassiumEvaluation);
                updateSummaryStats('potassium', value);
            }
            break;
    }
}

// Manual connection status check with detailed debugging
function checkConnectionStatus() {
    console.log('🔍 Manual connection status check:');
    console.log('   MQTT Client exists:', !!mqttClient);
    console.log('   MQTT Client connected:', mqttClient ? mqttClient.connected : 'No client');
    console.log('   isConnected flag:', isConnected);
    console.log('   Client state:', mqttClient ? mqttClient.connectionState : 'No client');
    
    if (mqttClient && mqttClient.connected) {
        console.log('✅ MQTT is connected and working');
        console.log('📋 Subscribed topics:');
        if (mqttClient.options && mqttClient.options.properties) {
            console.log('   Properties:', mqttClient.options.properties);
        }
        console.log('   Expected subscriptions:');
        console.log('     - greenhouse/temperature');
        console.log('     - greenhouse/humidity');
        console.log('     - greenhouse/light');
        console.log('     - greenhouse/ph');
        console.log('     - greenhouse/soil_ph');
        console.log('     - greenhouse/soil_moisture');
        console.log('     - greenhouse/soil_humidity');
        console.log('     - greenhouse/soil_temperature');
        console.log('     - greenhouse/nitrogen');
        console.log('     - greenhouse/phosphorus');
        console.log('     - greenhouse/potassium');
        
        // Check if HTML elements exist
        console.log('📊 Checking HTML elements:');
        const elements = [
            'humidityValue', 'lightValue', 'soilTempValue', 
            'soilHumidityValue', 'phValue', 'nitrogenValue', 
            'phosphorusValue', 'potassiumValue'
        ];
        elements.forEach(id => {
            const elem = document.getElementById(id);
            console.log(`   ${id}: ${elem ? '✅ Found' : '❌ NOT FOUND'}`);
        });
        
        showAlert('✅ MQTT connection is active - Check console for details', 'success');
        return true;
    } else {
        console.log('❌ MQTT is not connected');
        console.log('   Try clicking "Reconnect" button');
        showAlert('❌ MQTT is disconnected - click Reconnect', 'warning');
        return false;
    }
}

// Update actuator status from MQTT messages
function updateActuatorStatus(actuatorType, status) {
    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : status;
    const isOn = normalizedStatus === 'ON' || normalizedStatus === '1' || normalizedStatus === 1 || normalizedStatus === true;
    const statusLabel = isOn ? 'ON' : 'OFF';
    
    // Map actuator types to power consumption
    const powerConsumption = {
        fan: 250,
        humidifier: 150,
        sprinkler: 100
    };
    
    const buttonElement = document.getElementById(`${actuatorType}Button`);
    const indicatorElement = document.getElementById(`${actuatorType}Indicator`);
    const statusElement = document.getElementById(`${actuatorType}Status`);
    const powerElement = document.getElementById(`${actuatorType}Power`);
    const timeElement = document.getElementById(`${actuatorType}Time`);
    
    if (!buttonElement || !statusElement) {
        console.warn(`⚠️ Actuator elements not found for ${actuatorType}`);
        return;
    }
    
    // Update the state
    if (actuatorType === 'fan') {
        if (typeof window.fanState !== 'undefined') {
            window.fanState = isOn;
        }
        // Also update local variable if accessible
        try {
            if (typeof fanState !== 'undefined') {
                fanState = isOn;
            }
        } catch(e) {}
    } else if (actuatorType === 'humidifier') {
        if (typeof window.humidifierState !== 'undefined') {
            window.humidifierState = isOn;
        }
        try {
            if (typeof humidifierState !== 'undefined') {
                humidifierState = isOn;
            }
        } catch(e) {}
    } else if (actuatorType === 'sprinkler') {
        if (typeof window.sprinklerState !== 'undefined') {
            window.sprinklerState = isOn;
        }
        try {
            if (typeof sprinklerState !== 'undefined') {
                sprinklerState = isOn;
            }
        } catch(e) {}
    }
    
    // Update visual indicators
    if (isOn) {
        buttonElement.classList.add('active');
        buttonElement.style.borderColor = '#28a745';
        statusElement.textContent = 'ON';
        statusElement.style.color = '#28a745';
        statusElement.style.fontSize = '1.5rem';
        statusElement.style.fontWeight = 'bold';
        if (powerElement) powerElement.textContent = `${powerConsumption[actuatorType] || 0}W`;
        if (timeElement) timeElement.textContent = new Date().toLocaleTimeString();
    } else {
        buttonElement.classList.remove('active');
        buttonElement.style.borderColor = '#dc3545';
        statusElement.textContent = 'OFF';
        statusElement.style.color = '#dc3545';
        statusElement.style.fontSize = '1.5rem';
        statusElement.style.fontWeight = 'bold';
        if (powerElement) powerElement.textContent = '0W';
        if (timeElement) timeElement.textContent = 'Ready';
    }
    
    const historyArray = actuatorHistory[actuatorType];
    if (historyArray) {
        historyArray.push({ ts: Date.now(), status: statusLabel });
        if (historyArray.length > 5000) {
            historyArray.shift();
        }
    }
    
    console.log(`📡 MQTT: ${actuatorType} status updated to ${statusLabel}`);
}

// Make updateActuatorStatus globally available
window.updateActuatorStatus = updateActuatorStatus;

// Make functions globally available
window.connectMQTT = connectMQTT;
window.reconnectMQTT = reconnectMQTT;
window.checkConnectionStatus = checkConnectionStatus;
window.loadLatestValuesFromFirebase = loadLatestValuesFromFirebase;
window.handleMessage = handleMessage; // Make handleMessage available for testing
window.testSensorElements = testSensorElements;
window.mqttClient = mqttClient;

// Load saved settings and connect on page load
window.addEventListener('load', () => {
    console.log('🚀 Page loaded - initializing dashboard...');
    
    const savedBroker = localStorage.getItem('mqttBroker');
    const savedUser = localStorage.getItem('mqttUser');
    const savedPass = localStorage.getItem('mqttPass');

    console.log('📋 Loading saved MQTT settings:');
    console.log('   Broker:', savedBroker || 'Not saved');
    console.log('   User:', savedUser || 'Not saved');
    console.log('   Pass:', savedPass ? '***' : 'Not saved');

    if (savedBroker && document.getElementById('mqttBroker')) {
        document.getElementById('mqttBroker').value = savedBroker;
    }
    if (savedUser && document.getElementById('mqttUser')) {
        document.getElementById('mqttUser').value = savedUser;
    }
    if (savedPass && document.getElementById('mqttPass')) {
        document.getElementById('mqttPass').value = savedPass;
    }

    // Sync settings page MQTT credentials to dashboard panel
    const settingsBroker = document.getElementById('settingsMqttBroker');
    const settingsUser = document.getElementById('settingsMqttUser');
    const settingsPass = document.getElementById('settingsMqttPass');
    
    if (settingsBroker && settingsUser && settingsPass) {
        // Copy from settings page to dashboard panel if dashboard panel is empty
        const dashboardBroker = document.getElementById('mqttBroker');
        const dashboardUser = document.getElementById('mqttUser');
        const dashboardPass = document.getElementById('mqttPass');
        
        if (dashboardBroker && !dashboardBroker.value.trim() && settingsBroker.value.trim()) {
            dashboardBroker.value = settingsBroker.value;
        }
        if (dashboardUser && !dashboardUser.value.trim() && settingsUser.value.trim()) {
            dashboardUser.value = settingsUser.value;
        }
        if (dashboardPass && !dashboardPass.value.trim() && settingsPass.value.trim()) {
            dashboardPass.value = settingsPass.value;
        }
    }
    
    // Initialize summary stats from historical data on page load (for min/max ranges)
    initializeSummaryStatsFromHistory();
    
    // Auto-connect to MQTT first (real-time data preferred)
    setTimeout(() => {
        console.log('⏰ Auto-connecting to MQTT...');
        console.log('📋 Using credentials from Arduino config:');
        console.log('   Broker: ws://broker.emqx.io:8083/mqtt');
        console.log('   Username: myuser');
        console.log('   Password: [configured]');
        if (typeof connectMQTT === 'function') {
            connectMQTT();
        }
    }, 500);
    
    // Load latest values from Firebase ONLY if MQTT fails to connect
    setTimeout(() => {
        // Check if MQTT connected successfully
        const mqttConnected = mqttClient && mqttClient.connected && isConnected;
        if (!mqttConnected) {
            console.log('⚠️ MQTT not connected yet, loading initial values from Firebase...');
            loadLatestValuesFromFirebase();
        } else {
            console.log('✅ MQTT connected - using real-time data, skipping Firebase initial load');
        }
    }, 3000); // Wait 3 seconds to see if MQTT connects
    
    // Set up periodic connection monitoring and fallback data loading
    // Detect mobile device for optimized intervals
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const checkInterval = isMobile ? 60000 : 30000; // 60s on mobile, 30s on desktop
    
    setInterval(() => {
        // Check if MQTT is connected
        const isMQTTConnected = mqttClient && mqttClient.connected && isConnected;
        
        if (!isMQTTConnected) {
            console.log('🔄 Periodic check: MQTT disconnected, attempting reconnection...');
            reconnectMQTT();
            // If MQTT not connected after reconnection attempt, load from Firebase
            setTimeout(() => {
                const stillDisconnected = !mqttClient || !mqttClient.connected || !isConnected;
                if (stillDisconnected) {
                    console.log('📊 MQTT still disconnected, loading latest from Firebase (fallback)...');
                    loadLatestValuesFromFirebase();
                } else {
                    console.log('✅ MQTT reconnected - using real-time data');
                }
            }, 2000);
        } else {
            // MQTT is connected - don't load from Firebase
            console.log('✅ Periodic check: MQTT connected - real-time data active');
        }
    }, checkInterval); // Check every 30s on desktop, 60s on mobile
});
