// Page Navigation
let currentPage = 'homepage';
function sanitizeApiBase(url) {
    if (!url) return '';
    let sanitized = url.trim();
    if (!sanitized) return '';
    sanitized = sanitized.replace(/\s/g, '');
    sanitized = sanitized.replace(/\/+$/, '');
    return sanitized;
}

function getApiBase() {
    const stored = localStorage.getItem('apiBaseUrl');
    const sanitized = sanitizeApiBase(stored);
    return sanitized || 'https://maseed.onrender.com/api';
}

window.getApiBase = getApiBase;
window.sanitizeApiBase = sanitizeApiBase;

function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Add active class to clicked nav link (if present in navigation)
    const navLink = document.querySelector(`[data-page="${pageId}"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    currentPage = pageId;
    
    // Initialize page-specific features
    if (pageId === 'history') {
        initializeHistoryPage();
    } else if (pageId === 'settings') {
        loadSettings();
    }
}

// Navigation event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            switchPage(pageId);
            if (typeof closeNavDrawer === 'function') {
                closeNavDrawer();
            }
        });
    });
});


// History Page Functions (DB-backed)
let historyCharts = {
    temperature: null,
    humidity: null,
    light: null,
    ph: null,
    soil_humidity: null,
    soil_temperature: null,
    nitrogen: null,
    phosphorus: null,
    potassium: null
};

// Sensor configuration for charts
const sensorConfig = {
    temperature: { 
        label: 'Temperature (°C)', 
        color: '#e74c3c', 
        bgColor: 'rgba(231,76,60,0.08)',
        icon: '🌡️'
    },
    humidity: { 
        label: 'Humidity (%)', 
        color: '#3498db', 
        bgColor: 'rgba(52,152,219,0.08)',
        icon: '💧'
    },
    light: { 
        label: 'Light Intensity (lux)', 
        color: '#f39c12', 
        bgColor: 'rgba(243,156,18,0.08)',
        icon: '💡'
    },
    ph: { 
        label: 'pH Level', 
        color: '#9b59b6', 
        bgColor: 'rgba(155,89,182,0.08)',
        icon: '🧪'
    },
    soil_humidity: { 
        label: 'Soil Humidity (%)', 
        color: '#2ecc71', 
        bgColor: 'rgba(46,204,113,0.08)',
        icon: '🌱'
    },
    soil_temperature: { 
        label: 'Soil Temperature (°C)', 
        color: '#e67e22', 
        bgColor: 'rgba(230,126,34,0.08)',
        icon: '🌡️'
    },
    nitrogen: { 
        label: 'Nitrogen (mg/kg)', 
        color: '#27ae60', 
        bgColor: 'rgba(39,174,96,0.08)',
        icon: '🌿'
    },
    phosphorus: { 
        label: 'Phosphorus (mg/kg)', 
        color: '#2980b9', 
        bgColor: 'rgba(41,128,185,0.08)',
        icon: '🌿'
    },
    potassium: { 
        label: 'Potassium (mg/kg)', 
        color: '#8e44ad', 
        bgColor: 'rgba(142,68,173,0.08)',
        icon: '🌿'
    }
};

// Store current time range for auto-refresh
let currentHistoryRange = '1h';
let historyRefreshInterval = null;
let previousDataCounts = {}; // Track previous data point counts to detect new data

function initializeHistoryPage() {
    // Initialize time range buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentHistoryRange = this.getAttribute('data-range');
            
            // Sync mobile dropdown
            const mobileSelect = document.getElementById('timeRangeSelect');
            if (mobileSelect) {
                mobileSelect.value = currentHistoryRange;
            }
            
            updateHistoryCharts(currentHistoryRange);
        });
    });

    // Initialize mobile dropdown
    const mobileSelect = document.getElementById('timeRangeSelect');
    if (mobileSelect) {
        // Prevent any parent click handlers from interfering
        mobileSelect.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        
        mobileSelect.addEventListener('touchstart', function(e) {
            e.stopPropagation();
        });
        
        mobileSelect.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        mobileSelect.addEventListener('change', function(e) {
            e.stopPropagation();
            const selectedRange = this.value;
            currentHistoryRange = selectedRange;
            
            // Sync buttons
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-range') === selectedRange) {
                    btn.classList.add('active');
                }
            });
            
            updateHistoryCharts(currentHistoryRange);
        });
    }

    // Initialize history charts and load initial range
    initializeHistoryCharts();
    currentHistoryRange = document.querySelector('.time-btn.active')?.getAttribute('data-range') || '1h';
    
    // Sync mobile dropdown with initial value
    if (mobileSelect) {
        mobileSelect.value = currentHistoryRange;
    }
    
    updateHistoryCharts(currentHistoryRange);
    
    // Auto-refresh history charts - longer interval on mobile for better performance
    if (historyRefreshInterval) {
        clearInterval(historyRefreshInterval);
    }
    
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const refreshInterval = isMobile ? 60000 : 30000; // 60s on mobile, 30s on desktop
    
    historyRefreshInterval = setInterval(() => {
        // Only refresh if we're on the history page (check for 'active' class, not display style)
        const historySection = document.getElementById('history');
        const isHistoryPageActive = historySection && historySection.classList.contains('active');
        if (isHistoryPageActive) {
            console.log(`🔄 Auto-refreshing history charts (range: ${currentHistoryRange})`);
            updateHistoryCharts(currentHistoryRange);
        }
    }, refreshInterval);
    
    console.log(`✅ History page initialized with auto-refresh (${refreshInterval/1000}s interval${isMobile ? ' - mobile optimized' : ''})`);
}

function initializeHistoryCharts() {
    if (historyCharts.temperature) {
        console.log('✅ History charts already initialized');
        return;
    }

    console.log('🔧 Initializing history charts for all sensors...');

    // Map sensor names to canvas IDs
    const sensorToCanvasId = {
        temperature: 'historyTemperatureChart',
        humidity: 'historyHumidityChart',
        light: 'historyLightChart',
        ph: 'historyPhChart',
        soil_humidity: 'historySoilHumidityChart',
        soil_temperature: 'historySoilTemperatureChart',
        nitrogen: 'historyNitrogenChart',
        phosphorus: 'historyPhosphorusChart',
        potassium: 'historyPotassiumChart'
    };

    // Initialize chart for each sensor
    Object.keys(sensorConfig).forEach(sensor => {
        const canvasId = sensorToCanvasId[sensor];
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error(`❌ Canvas ${canvasId} not found for sensor ${sensor}!`);
            return;
        }

        const config = sensorConfig[sensor];
        const ctx = canvas.getContext('2d');
        
        historyCharts[sensor] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: config.label,
                    data: [],
                    borderColor: config.color,
                    backgroundColor: config.bgColor,
                    tension: 0.35,
                    pointRadius: 0,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: config.label
                        }
                    }
                }
            }
        });
        
        console.log(`✅ Initialized chart for ${sensor} (${canvasId})`);
    });

    console.log('✅ All history charts initialized successfully');
}

function msForRange(range) {
    const now = Date.now();
    if (range === '1h')  return now - 1  * 60 * 60 * 1000;
    if (range === '24h') return now - 24 * 60 * 60 * 1000;
    if (range === '7d')  return now - 7  * 24 * 60 * 60 * 1000;
    if (range === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    return now - 24 * 60 * 60 * 1000;
}

async function fetchHistory(sensor, fromMs) {
    const apiBase = getApiBase();
    const url = `${apiBase}/history?sensor=${encodeURIComponent(sensor)}&fromMs=${fromMs}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`❌ Failed to fetch ${sensor} history: ${res.status} ${res.statusText}`);
            console.error(`Error response:`, errorText);
            return []; // Return empty array on error
        }
        const data = await res.json();
        return Array.isArray(data) ? data : []; // Ensure it's an array
    } catch (error) {
        console.error(`❌ Error fetching ${sensor} history:`, error);
        console.error(`URL was: ${url}`);
        return []; // Return empty array on error
    }
}

async function fetchActuatorHistory(actuator, fromMs) {
    const apiBase = getApiBase();
    const url = `${apiBase}/actuators/history?actuator=${encodeURIComponent(actuator)}&fromMs=${fromMs}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`❌ Failed to fetch actuator ${actuator} history: ${res.status} ${res.statusText}`);
            console.error(`Error response:`, errorText);
            return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(`❌ Error fetching actuator ${actuator} history:`, error);
        console.error(`URL was: ${url}`);
        return [];
    }
}

function fmtTs(ts) { return new Date(ts).toLocaleString(); }
function average(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
function stdDev(arr) {
    if (arr.length < 2) return 0;
    const m = average(arr); const v = average(arr.map(x => (x - m) * (x - m))); return Math.sqrt(v);
}

function renderHistoryTable(labels, tempArr, humArr, lightArr) {
    const body = document.getElementById('historyTableBody');
    if (!body) return;
    const n = Math.min(labels.length, tempArr.length, humArr.length, lightArr.length);
    const start = Math.max(0, n - 20);
    let html = '';
    for (let i = start; i < n; i++) {
        html += `<tr>
            <td style="padding:6px;border-bottom:1px solid #333">${labels[i]}</td>
            <td style="padding:6px;text-align:right;border-bottom:1px solid #333">${tempArr[i] ?? ''}</td>
            <td style="padding:6px;text-align:right;border-bottom:1px solid #333">${humArr[i] ?? ''}</td>
            <td style="padding:6px;text-align:right;border-bottom:1px solid #333">${lightArr[i] ?? ''}</td>
        </tr>`;
    }
    body.innerHTML = html || '<tr><td colspan="4" style="padding:6px;color:#888">No data</td></tr>';
}

async function updateHistoryCharts(range) {
    console.log(`📊 updateHistoryCharts called with range: ${range}`);
    
    // Ensure charts are initialized first
    if (!historyCharts.temperature) {
        console.log('⚠️ Charts not initialized, initializing now...');
        initializeHistoryCharts();
        // Wait a bit for charts to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const fromMs = msForRange(range);
    console.log(`📊 Loading history data for range: ${range} (from ${new Date(fromMs).toLocaleString()})`);
    const apiBase = getApiBase();
    console.log(`📡 API Base: ${apiBase}`);
    
    try {
        // Fetch data for all sensors
        const sensorData = await Promise.all([
            fetchHistory('temperature', fromMs),
            fetchHistory('humidity', fromMs),
            fetchHistory('light', fromMs),
            fetchHistory('ph', fromMs),
            fetchHistory('soil_humidity', fromMs),
            fetchHistory('soil_temperature', fromMs),
            fetchHistory('nitrogen', fromMs),
            fetchHistory('phosphorus', fromMs),
            fetchHistory('potassium', fromMs)
        ]);

        const sensors = ['temperature', 'humidity', 'light', 'ph', 'soil_humidity', 'soil_temperature', 'nitrogen', 'phosphorus', 'potassium'];
        
        // Detect mobile device and limit data points for better performance
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const maxDataPoints = isMobile ? 100 : Infinity; // Limit to 100 points on mobile
        
        // Limit data points on mobile to improve performance
        if (isMobile) {
            sensorData.forEach((data, index) => {
                if (data.length > maxDataPoints) {
                    // Keep only the most recent data points
                    sensorData[index] = data.slice(-maxDataPoints);
                    console.log(`📱 Mobile: Limited ${sensors[index]} to ${maxDataPoints} most recent points`);
                }
            });
        }
        
        console.log('✅ Loaded data:');
        sensors.forEach((sensor, index) => {
            console.log(`   ${sensor}: ${sensorData[index].length} records`);
        });

        // Update each chart individually
        sensors.forEach((sensor, index) => {
            const data = sensorData[index];
            const chart = historyCharts[sensor];
            
            // Detect if new data was added
            const previousCount = previousDataCounts[sensor] || 0;
            const newCount = data.length;
            const newDataPoints = newCount - previousCount;
            
            if (chart && data.length > 0) {
                const labels = data.map(p => fmtTs(p.ts));
                const values = data.map(p => p.value);
                
                chart.data.labels = labels;
                chart.data.datasets[0].data = values;
                chart.update('none');
                
                if (newDataPoints > 0) {
                    console.log(`🆕 NEW DATA: ${sensor} chart updated with ${newDataPoints} new data points (total: ${data.length})`);
                } else {
                    console.log(`✅ Updated ${sensor} chart with ${data.length} data points`);
                }
                
                previousDataCounts[sensor] = newCount;
            } else if (chart) {
                // Clear chart if no data
                chart.data.labels = [];
                chart.data.datasets[0].data = [];
                chart.update('none');
                console.log(`⚠️ No data for ${sensor}`);
                previousDataCounts[sensor] = 0;
            } else {
                console.error(`❌ Chart not initialized for ${sensor}`);
            }
        });

        // Update statistics (using temperature and humidity)
        const temp = sensorData[0];
        const hum = sensorData[1];
        const light = sensorData[2];
        const ph = sensorData[3];

        const avgT = temp.length ? average(temp.map(p => p.value)) : null;
        const avgH = hum.length ? average(hum.map(p => p.value)) : null;
        const peakL = light.length ? light.reduce((m,p)=>Math.max(m,p.value), Number.NEGATIVE_INFINITY) : null;
        const phStab = ph.length ? stdDev(ph.map(p => p.value)) : null;

        if (document.getElementById('avgTemp')) {
            document.getElementById('avgTemp').textContent = avgT != null ? `${avgT.toFixed(1)}°C` : '--°C';
        }
        if (document.getElementById('avgHumidity')) {
            document.getElementById('avgHumidity').textContent = avgH != null ? `${avgH.toFixed(1)}%` : '--%';
        }
        if (document.getElementById('peakLight')) {
            document.getElementById('peakLight').textContent = Number.isFinite(peakL) ? `${Math.round(peakL)} lux` : '-- lux';
        }
        if (document.getElementById('phStability')) {
            document.getElementById('phStability').textContent = ph.length ? `σ=${phStab.toFixed(2)}` : '--';
        }

        // Table fallback for quick visibility
        const labelsTH = temp.length ? temp.map(p => fmtTs(p.ts)) : [];
        renderHistoryTable(
            labelsTH,
            temp.map(p => p.value),
            hum.map(p => p.value),
            light.map(p => p.value)
        );
        
        // Show message if no data
        const totalDataPoints = sensorData.reduce((sum, data) => sum + data.length, 0);
        if (totalDataPoints === 0) {
            console.warn(`⚠️ No data found for the selected time range: ${range}`);
            console.warn(`   Time range: ${new Date(fromMs).toLocaleString()} to ${new Date(Date.now()).toLocaleString()}`);
            
            // Fetch latest data timestamps to show when data was last received
            try {
        const apiBase = getApiBase();
        const latestResponse = await fetch(`${apiBase}/latest`);
                if (latestResponse.ok) {
                    const latestData = await latestResponse.json();
                    
                    // Find the most recent data point across all sensors
                    let mostRecent = null;
                    Object.keys(latestData).forEach(sensor => {
                        if (latestData[sensor] && latestData[sensor].timestamp) {
                            if (!mostRecent || latestData[sensor].timestamp > mostRecent.timestamp) {
                                mostRecent = {
                                    sensor: sensor,
                                    timestamp: latestData[sensor].timestamp,
                                    value: latestData[sensor].value,
                                    humanReadable: latestData[sensor].humanReadable,
                                    timeAgo: latestData[sensor].timeAgo
                                };
                            }
                        }
                    });
                    
                    let message = `No data found for the selected time range (${range}).\n\n`;
                    message += `Time range queried: ${new Date(fromMs).toLocaleString()} to ${new Date(Date.now()).toLocaleString()}\n\n`;
                    
                    if (mostRecent) {
                        const hoursAgo = Math.floor(mostRecent.timeAgo / (60 * 60 * 1000));
                        const minutesAgo = Math.floor((mostRecent.timeAgo % (60 * 60 * 1000)) / 60000);
                        
                        message += `📊 Latest data in database:\n`;
                        message += `   Sensor: ${mostRecent.sensor}\n`;
                        message += `   Value: ${mostRecent.value}\n`;
                        message += `   Time: ${mostRecent.humanReadable}\n`;
                        message += `   Time ago: ${hoursAgo}h ${minutesAgo}m\n\n`;
                        
                        if (mostRecent.timestamp < fromMs) {
                            message += `⚠️ The latest data is older than the selected time range.\n\n`;
                        }
                    } else {
                        message += `⚠️ No data found in Firebase at all.\n\n`;
                    }
                    
                    message += `💡 Suggestions:\n`;
                    message += `• Try "Last 24 Hours" or "Last 30 Days" to see older data\n`;
                    if (mostRecent && mostRecent.timestamp < fromMs) {
                        message += `• Your sensors need to send data more recently\n`;
                    }
                    message += `• Check if MQTT is connected and sensors are sending data\n`;
                    message += `• Check server logs for "✅ Saved" messages\n`;
                    
                    alert(message);
                } else {
                    throw new Error('Failed to fetch latest data');
                }
            } catch (error) {
                console.error('Error fetching latest data:', error);
                let message = `No data found for the selected time range (${range}).\n\n`;
                message += `Time range: ${new Date(fromMs).toLocaleString()} to ${new Date(Date.now()).toLocaleString()}\n\n`;
                message += `💡 Try "Last 24 Hours" or "Last 30 Days" to see if older data exists.\n`;
                message += `Check server logs and Firebase Console to verify data is being saved.`;
                alert(message);
            }
        } else {
            console.log(`✅ History charts updated successfully! Total data points: ${totalDataPoints}`);
        }
    } catch (error) {
        console.error('❌ Error updating history charts:', error);
        alert('Error loading history data: ' + error.message + '\n\nCheck browser console for details.');
    }
}

// Export Modal Functions
function showExportModal() {
    const modal = document.getElementById('exportModal');
    modal.style.display = 'block';
    
    // Set default dates (last 7 days)
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    document.getElementById('exportStartDate').value = lastWeek.toISOString().split('T')[0];
    document.getElementById('exportEndDate').value = today.toISOString().split('T')[0];
}

function hideExportModal() {
    const modal = document.getElementById('exportModal');
    modal.style.display = 'none';
}

// Data Export Functions
async function exportData() {
    const format = document.getElementById('exportFormat').value;
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    const exportDataset = await buildExportDataset(startDate, endDate);
    if (!exportDataset) return;
    
    if (format === 'csv') {
        exportToCSV(exportDataset);
    } else if (format === 'pdf') {
        exportToPDF(exportDataset);
    }
    
    // Hide modal after export
    hideExportModal();
}

async function buildExportDataset(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
        alert('Invalid date range selected. Please choose valid start and end dates.');
        return null;
    }

    if (start > end) {
        alert('Start date must be before or equal to the end date.');
        return null;
    }

    // Normalize boundaries to cover the full days
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const startMs = start.getTime();
    const endMs = end.getTime();

    const sensors = [
        { key: 'temperature', label: 'temperature' },
        { key: 'humidity', label: 'humidity' },
        { key: 'light', label: 'light' },
        { key: 'ph', label: 'ph' },
        { key: 'soilHumidity', label: 'soil_humidity' },
        { key: 'soilTemperature', label: 'soil_temperature' },
        { key: 'nitrogen', label: 'nitrogen' },
        { key: 'phosphorus', label: 'phosphorus' },
        { key: 'potassium', label: 'potassium' },
    ];

    try {
        const historyResults = await Promise.all(
            sensors.map(sensor => fetchHistory(sensor.label, startMs))
        );

        const bucketSizeMs = 5 * 60 * 1000; // 5-minute buckets
        const bucketMap = new Map();
        const ensureBucketEntry = (bucket) => {
            let entry = bucketMap.get(bucket);
            if (!entry) {
                entry = { ts: bucket, readings: {}, actuators: {} };
                bucketMap.set(bucket, entry);
            }
            return entry;
        };

        historyResults.forEach((dataPoints, idx) => {
            const sensorKey = sensors[idx].key;
            dataPoints
                .filter(point => point.ts >= startMs && point.ts <= endMs)
                .forEach(point => {
                    const bucket = Math.floor(point.ts / bucketSizeMs) * bucketSizeMs;
                    const bucketEntry = ensureBucketEntry(bucket);
                    bucketEntry.readings[sensorKey] = {
                        value: point.value,
                        ts: point.ts
                    };
                });
        });

        const actuatorConfigs = [
            { key: 'fanStatus', name: 'fan' },
            { key: 'humidifierStatus', name: 'humidifier' },
            { key: 'sprinklerStatus', name: 'sprinkler' },
        ];

        const actuatorResults = await Promise.all(
            actuatorConfigs.map(cfg => fetchActuatorHistory(cfg.name, startMs))
        );

        const runtimeHistory = window.actuatorHistory || {};
        const actuatorEventsByKey = {};
        const actuatorPointers = {};

        actuatorConfigs.forEach(({ key, name }, idx) => {
            const remoteEvents = Array.isArray(actuatorResults[idx]) ? actuatorResults[idx] : [];
            const runtimeEvents = Array.isArray(runtimeHistory[name]) ? runtimeHistory[name] : [];
            const merged = [
                ...remoteEvents.map(event => ({
                    ts: event.ts,
                    status: (event.status || '').toString().trim().toUpperCase()
                })),
                ...runtimeEvents
                    .filter(event => typeof event.ts === 'number')
                    .map(event => ({
                        ts: event.ts,
                        status: (event.status || '').toString().trim().toUpperCase()
                    }))
            ].filter(event => event.ts >= startMs && event.ts <= endMs)
             .map(event => ({
                 ts: event.ts,
                 status: ['ON', 'OFF'].includes(event.status) ? event.status : (event.status === '1' ? 'ON' : 'OFF')
             }))
             .sort((a, b) => a.ts - b.ts);

            actuatorEventsByKey[key] = merged;
            actuatorPointers[key] = 0;

            merged.forEach(event => {
                const bucket = Math.floor(event.ts / bucketSizeMs) * bucketSizeMs;
                const bucketEntry = ensureBucketEntry(bucket);
                bucketEntry.actuators[key] = event.status;
            });
        });

        if (bucketMap.size === 0) {
            alert('No data found for the selected date range. Please try a different range.');
            return null;
        }

        const bucketKeys = Array.from(bucketMap.keys()).sort((a, b) => a - b);
        const lastKnown = {};
        const lastActuatorStatuses = {
            fanStatus: 'OFF',
            humidifierStatus: 'OFF',
            sprinklerStatus: 'OFF',
        };
        const rows = bucketKeys.map(bucket => {
            const bucketEntry = bucketMap.get(bucket);
            const row = { ts: bucket };

            sensors.forEach(({ key }) => {
                if (bucketEntry.readings[key]) {
                    lastKnown[key] = bucketEntry.readings[key].value;
                }
                row[key] = lastKnown[key] ?? null;
            });

            const bucketEnd = bucket + bucketSizeMs - 1;
            actuatorConfigs.forEach(({ key }) => {
                const events = actuatorEventsByKey[key] || [];
                let pointer = actuatorPointers[key] || 0;
                while (pointer < events.length && events[pointer].ts <= bucketEnd) {
                    lastActuatorStatuses[key] = events[pointer].status;
                    pointer++;
                }
                actuatorPointers[key] = pointer;
                row[key] = lastActuatorStatuses[key];
            });

            return row;
        });

        return {
            metadata: {
                startLabel: formatDateTime(start),
                endLabel: formatDateTime(end),
                startMs,
                endMs,
                count: rows.length,
            },
            rows
        };
    } catch (error) {
        console.error('❌ Error building export dataset:', error);
        alert('Failed to load historical data for export. Please try again.');
        return null;
    }
}

function exportToCSV(data) {
    const { metadata, rows } = data;
    let csv = `Date Range:,${metadata.startLabel} to ${metadata.endLabel}\n`;
    csv += `Total Records:,${metadata.count}\n`;
    csv += '\nTimestamp,Temperature,Humidity,Light,pH,Soil Humidity,Soil Temperature,Nitrogen,Phosphorus,Potassium,Fan Status,Humidifier Status,Sprinkler Status\n';

    const formatCell = (value) => (value === undefined || value === null ? '' : value);

    rows.forEach(row => {
        const dateStr = formatDateTime(new Date(row.ts));
        csv += [
            dateStr,
            formatCell(row.temperature),
            formatCell(row.humidity),
            formatCell(row.light),
            formatCell(row.ph),
            formatCell(row.soilHumidity),
            formatCell(row.soilTemperature),
            formatCell(row.nitrogen),
            formatCell(row.phosphorus),
            formatCell(row.potassium),
            formatCell(row.fanStatus),
            formatCell(row.humidifierStatus),
            formatCell(row.sprinklerStatus)
        ].join(',') + '\n';
    });
    
    downloadFile(csv, 'greenhouse-data.csv', 'text/csv');
}

function exportToJSON(data) {
    const formatted = {
        metadata: {
            count: data.metadata.count,
            start: data.metadata.startLabel,
            end: data.metadata.endLabel,
            rangeMs: { start: data.metadata.startMs, end: data.metadata.endMs }
        },
        rows: data.rows.map(row => ({
            timestamp: formatDateTime(new Date(row.ts)),
            isoTimestamp: new Date(row.ts).toISOString(),
            temperature: row.temperature ?? null,
            humidity: row.humidity ?? null,
            light: row.light ?? null,
            ph: row.ph ?? null,
            soilHumidity: row.soilHumidity ?? null,
            soilTemperature: row.soilTemperature ?? null,
            nitrogen: row.nitrogen ?? null,
            phosphorus: row.phosphorus ?? null,
            potassium: row.potassium ?? null,
            fanStatus: row.fanStatus ?? 'OFF',
            humidifierStatus: row.humidifierStatus ?? 'OFF',
            sprinklerStatus: row.sprinklerStatus ?? 'OFF',
        }))
    };
    const json = JSON.stringify(formatted, null, 2);
    downloadFile(json, 'greenhouse-data.json', 'application/json');
}

function exportToPDF(data) {
    const { metadata, rows } = data;
    
    // Initialize jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4'); // Landscape for wider tables
    
    // Colors
    const primaryColor = [46, 125, 50]; // Green
    const headerColor = [33, 150, 243]; // Blue
    const textColor = [33, 33, 33];
    const lightGray = [245, 245, 245];
    
    let yPos = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // ========== HEADER ==========
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    // Remove emoji to avoid encoding issues - use text only
    doc.text('Smart Greenhouse Report', margin, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 20, { align: 'right' });
    
    yPos = 40;
    
    // ========== METADATA SECTION ==========
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Information', margin, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const metadataInfo = [
        ['Date Range', `${metadata.startLabel} to ${metadata.endLabel}`],
        ['Total Records', `${metadata.count.toLocaleString()} data points`],
        ['Duration', calculateDuration(metadata.startMs, metadata.endMs)]
    ];
    
    metadataInfo.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, margin + 40, yPos);
        yPos += 6;
    });
    
    yPos += 5;
    
    // ========== SUMMARY STATISTICS ==========
    const stats = calculateStatistics(rows);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', margin, yPos);
    yPos += 8;
    
    // Create summary table
    const summaryData = [
        ['Sensor', 'Average', 'Min', 'Max', 'Unit'],
        ['Temperature', 
         formatPDFValue(stats.avg.temperature), 
         formatPDFValue(stats.min.temperature), 
         formatPDFValue(stats.max.temperature), 
         '°C'],
        ['Humidity', 
         formatPDFValue(stats.avg.humidity), 
         formatPDFValue(stats.min.humidity), 
         formatPDFValue(stats.max.humidity), 
         '%'],
        ['Light Intensity', 
         formatPDFValue(stats.avg.light), 
         formatPDFValue(stats.min.light), 
         formatPDFValue(stats.max.light), 
         'lux'],
        ['pH Level', 
         formatPDFValue(stats.avg.ph), 
         formatPDFValue(stats.min.ph), 
         formatPDFValue(stats.max.ph), 
         ''],
        ['Soil Humidity', 
         formatPDFValue(stats.avg.soilHumidity), 
         formatPDFValue(stats.min.soilHumidity), 
         formatPDFValue(stats.max.soilHumidity), 
         '%'],
        ['Soil Temperature', 
         formatPDFValue(stats.avg.soilTemperature), 
         formatPDFValue(stats.min.soilTemperature), 
         formatPDFValue(stats.max.soilTemperature), 
         '°C'],
        ['Nitrogen', 
         formatPDFValue(stats.avg.nitrogen), 
         formatPDFValue(stats.min.nitrogen), 
         formatPDFValue(stats.max.nitrogen), 
         'mg/kg'],
        ['Phosphorus', 
         formatPDFValue(stats.avg.phosphorus), 
         formatPDFValue(stats.min.phosphorus), 
         formatPDFValue(stats.max.phosphorus), 
         'mg/kg'],
        ['Potassium', 
         formatPDFValue(stats.avg.potassium), 
         formatPDFValue(stats.min.potassium), 
         formatPDFValue(stats.max.potassium), 
         'mg/kg']
    ];
    
    doc.autoTable({
        startY: yPos,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: 'striped',
        headStyles: {
            fillColor: headerColor,
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: lightGray
        },
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 9,
            cellPadding: 3
        }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // ========== ACTUATOR SUMMARY ==========
    const actuatorStats = calculateActuatorStats(rows);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Actuator Activity Summary', margin, yPos);
    yPos += 8;
    
    const actuatorData = [
        ['Actuator', 'Total ON Time', 'Total OFF Time', 'Status'],
        ['Fan', actuatorStats.fan.onTime, actuatorStats.fan.offTime, actuatorStats.fan.lastStatus],
        ['Humidifier', actuatorStats.humidifier.onTime, actuatorStats.humidifier.offTime, actuatorStats.humidifier.lastStatus],
        ['Sprinkler', actuatorStats.sprinkler.onTime, actuatorStats.sprinkler.offTime, actuatorStats.sprinkler.lastStatus]
    ];
    
    // Actuator Summary table - EXPLICITLY NO colors, plain text only
    doc.autoTable({
        startY: yPos,
        head: [actuatorData[0]],
        body: actuatorData.slice(1),
        theme: 'striped',
        headStyles: {
            fillColor: headerColor,
            textColor: 255,
            fontStyle: 'bold'
        },
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 9,
            cellPadding: 3
        },
        // Make OFF text red in Status column, no background colors
        didParseCell: function(data) {
            // Status column (index 3) - make OFF text red
            if (data.section === 'body' && data.column.index === 3) {
                const cellValue = String(data.row.raw[data.column.index] || '').trim().toUpperCase();
                if (cellValue === 'OFF') {
                    data.cell.styles.fillColor = null; // No background color
                    data.cell.styles.textColor = [220, 53, 69]; // Red text
                    data.cell.styles.fontStyle = 'bold';
                } else if (cellValue === 'ON') {
                    data.cell.styles.fillColor = null; // No background color
                    data.cell.styles.textColor = [40, 167, 69]; // Green text
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.fillColor = null; // Use default background
                    data.cell.styles.textColor = textColor; // Default text color
                    data.cell.styles.fontStyle = 'normal';
                }
            }
        }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // ========== DATA TABLE ==========
    // Check if we need a new page
    if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 15;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Data', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    // Prepare table data (limit to prevent huge PDFs)
    const maxRows = 500; // Limit rows for performance (increased from 100)
    const tableRows = rows.slice(0, maxRows).map(row => {
        const fanStatus = row.fanStatus || 'OFF';
        const humidifierStatus = row.humidifierStatus || 'OFF';
        const sprinklerStatus = row.sprinklerStatus || 'OFF';
        
        return [
            formatDateTime(new Date(row.ts)),
            formatPDFValue(row.temperature),
            formatPDFValue(row.humidity),
            formatPDFValue(row.light),
            formatPDFValue(row.ph),
            formatPDFValue(row.soilHumidity),
            formatPDFValue(row.soilTemperature),
            formatPDFValue(row.nitrogen),
            formatPDFValue(row.phosphorus),
            formatPDFValue(row.potassium),
            fanStatus,
            humidifierStatus,
            sprinklerStatus
        ];
    });
    
    // Calculate table width for centering
    // Updated: Full column names with proper widths - v2
    const totalTableWidth = 38 + 22 + 22 + 20 + 12 + 24 + 26 + 20 + 22 + 22 + 16 + 22 + 20; // Sum of all column widths
    const tableMargin = (pageWidth - totalTableWidth) / 2;
    
    doc.autoTable({
        startY: yPos,
        head: [['Timestamp', 'Temperature', 'Humidity', 'Light', 'pH', 'Soil Humidity', 'Soil Temperature', 'Nitrogen', 'Phosphorus', 'Potassium', 'Fan', 'Humidifier', 'Sprinkler']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
            fillColor: headerColor,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            textWrap: true
        },
        bodyStyles: {
            fontSize: 7,
            cellPadding: 2,
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: lightGray
        },
        margin: { left: tableMargin, right: tableMargin },
        styles: {
            overflow: 'linebreak',
            cellWidth: 'wrap',
            halign: 'center',
            textWrap: true
        },
        columnStyles: {
            0: { cellWidth: 38, halign: 'center' }, // Timestamp
            1: { cellWidth: 22, halign: 'center' }, // Temperature
            2: { cellWidth: 22, halign: 'center' }, // Humidity
            3: { cellWidth: 20, halign: 'center' }, // Light
            4: { cellWidth: 12, halign: 'center' }, // pH
            5: { cellWidth: 24, halign: 'center' }, // Soil Humidity
            6: { cellWidth: 26, halign: 'center' }, // Soil Temperature
            7: { cellWidth: 20, halign: 'center' }, // Nitrogen
            8: { cellWidth: 22, halign: 'center' }, // Phosphorus
            9: { cellWidth: 22, halign: 'center' }, // Potassium
            10: { cellWidth: 16, halign: 'center' }, // Fan
            11: { cellWidth: 22, halign: 'center' }, // Humidifier
            12: { cellWidth: 20, halign: 'center' }  // Sprinkler
        },
        // Color ON/OFF cells in Fan, Humidifier, Sprinkler columns (indices 10, 11, 12) - DETAILED DATA TABLE ONLY
        didParseCell: function(data) {
            // CRITICAL: Only apply to body cells in Detailed Data table, columns 10, 11, 12
            if (data.section === 'body' && data.column.index >= 10 && data.column.index <= 12) {
                // Get the cell value - try multiple methods
                let cellValue = '';
                
                // Method 1: Try raw row data
                if (data.row.raw && Array.isArray(data.row.raw) && data.row.raw[data.column.index] !== undefined) {
                    cellValue = String(data.row.raw[data.column.index]).trim().toUpperCase();
                }
                // Method 2: Try cell text
                else if (data.cell && data.cell.text) {
                    if (Array.isArray(data.cell.text)) {
                        cellValue = String(data.cell.text[0] || '').trim().toUpperCase();
                    } else {
                        cellValue = String(data.cell.text || '').trim().toUpperCase();
                    }
                }
                // Method 3: Try cell raw
                else if (data.cell && data.cell.raw !== undefined) {
                    cellValue = String(data.cell.raw).trim().toUpperCase();
                }
                
                // Apply colors - OFF must be RED in all tables
                if (cellValue === 'ON') {
                    data.cell.styles.fillColor = [232, 245, 233]; // Very light green background
                    data.cell.styles.textColor = [46, 125, 50]; // Dark green text
                    data.cell.styles.fontStyle = 'bold';
                } else if (cellValue === 'OFF') {
                    data.cell.styles.fillColor = [255, 235, 238]; // Very light red/pink background
                    data.cell.styles.textColor = [220, 53, 69]; // RED text - must be red in all tables
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        // Also use willDrawCell as backup to ensure OFF is red
        willDrawCell: function(data) {
            // Ensure OFF text is red in Detailed Data table actuator columns
            if (data.section === 'body' && data.column.index >= 10 && data.column.index <= 12) {
                const cellText = data.cell.text || '';
                const cellValue = String(Array.isArray(cellText) ? cellText[0] : cellText).trim().toUpperCase();
                
                if (cellValue === 'OFF') {
                    data.cell.styles.textColor = [220, 53, 69]; // Force red text
                }
            }
        }
    });
    
    // Add note if rows were limited
    if (rows.length > maxRows) {
        yPos = doc.lastAutoTable.finalY + 5;
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.setFont('helvetica', 'italic');
        doc.text(`Note: Showing first ${maxRows} of ${rows.length} records. Use CSV export for complete data.`, 
                 margin, yPos);
    }
    
    // ========== FOOTER ==========
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Page ${i} of ${totalPages} | Smart Greenhouse Dashboard`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }
    
    // ========== SAVE PDF ==========
    const filename = `greenhouse-report-${metadata.startLabel.replace(/\//g, '-').replace(/:/g, '-')}-to-${metadata.endLabel.replace(/\//g, '-').replace(/:/g, '-')}.pdf`;
    doc.save(filename);
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatDateTime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ========== PDF EXPORT HELPER FUNCTIONS ==========

function calculateStatistics(rows) {
    const sensors = ['temperature', 'humidity', 'light', 'ph', 'soilHumidity', 'soilTemperature', 'nitrogen', 'phosphorus', 'potassium'];
    const stats = {
        avg: {},
        min: {},
        max: {}
    };
    
    sensors.forEach(sensor => {
        const values = rows
            .map(row => row[sensor])
            .filter(val => val !== null && val !== undefined && !isNaN(val));
        
        if (values.length > 0) {
            stats.avg[sensor] = values.reduce((a, b) => a + b, 0) / values.length;
            stats.min[sensor] = Math.min(...values);
            stats.max[sensor] = Math.max(...values);
        } else {
            stats.avg[sensor] = null;
            stats.min[sensor] = null;
            stats.max[sensor] = null;
        }
    });
    
    return stats;
}

function calculateActuatorStats(rows) {
    const actuators = ['fanStatus', 'humidifierStatus', 'sprinklerStatus'];
    const stats = {};
    
    actuators.forEach(actuator => {
        const name = actuator.replace('Status', '');
        const statuses = rows.map(row => row[actuator] || 'OFF');
        const onCount = statuses.filter(s => s === 'ON').length;
        const offCount = statuses.length - onCount;
        const lastStatus = statuses[statuses.length - 1] || 'OFF';
        
        // Calculate time (assuming 1-minute intervals)
        const totalMinutes = rows.length;
        const onMinutes = onCount;
        const offMinutes = offCount;
        
        stats[name] = {
            onTime: formatDuration(onMinutes),
            offTime: formatDuration(offMinutes),
            lastStatus: lastStatus
        };
    });
    
    return stats;
}

function formatPDFValue(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'N/A';
    }
    if (typeof value === 'number') {
        return value.toFixed(2);
    }
    return String(value);
}

function formatDuration(minutes) {
    if (!minutes || isNaN(minutes)) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

function calculateDuration(startMs, endMs) {
    const diffMs = endMs - startMs;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
}

// Settings Page Functions
function loadSettings() {
    // Load saved settings from localStorage
    const settings = JSON.parse(localStorage.getItem('farmSettings') || '{}');
    const apiInput = document.getElementById('apiBaseUrl');
    if (apiInput) {
        apiInput.value = getApiBase();
    }
    
    // Populate form fields
    if (settings.mqttBroker) document.getElementById('settingsMqttBroker').value = settings.mqttBroker;
    if (settings.mqttUser) document.getElementById('settingsMqttUser').value = settings.mqttUser;
    if (settings.mqttPass) document.getElementById('settingsMqttPass').value = settings.mqttPass;
    
    if (settings.tempMin) document.getElementById('tempMin').value = settings.tempMin;
    if (settings.tempMax) document.getElementById('tempMax').value = settings.tempMax;
    if (settings.humidityMin) document.getElementById('humidityMin').value = settings.humidityMin;
    if (settings.humidityMax) document.getElementById('humidityMax').value = settings.humidityMax;
    if (settings.phMin) document.getElementById('phMin').value = settings.phMin;
    if (settings.phMax) document.getElementById('phMax').value = settings.phMax;
    if (settings.soilHumidityMin) document.getElementById('soilHumidityMin').value = settings.soilHumidityMin;
    if (settings.soilHumidityMax) document.getElementById('soilHumidityMax').value = settings.soilHumidityMax;
    
    if (settings.currentCrop) document.getElementById('currentCrop').value = settings.currentCrop;
    if (settings.growthStage) document.getElementById('growthStage').value = settings.growthStage;
    if (settings.plantingDate) document.getElementById('plantingDate').value = settings.plantingDate;
    if (settings.harvestDate) document.getElementById('harvestDate').value = settings.harvestDate;
    
    if (settings.autoWatering) document.getElementById('autoWatering').value = settings.autoWatering;
    if (settings.wateringThreshold) document.getElementById('wateringThreshold').value = settings.wateringThreshold;
    if (settings.lightOn) document.getElementById('lightOn').value = settings.lightOn;
    if (settings.lightOff) document.getElementById('lightOff').value = settings.lightOff;
    if (settings.ventilationTemp) document.getElementById('ventilationTemp').value = settings.ventilationTemp;
    
    if (settings.greenhouseSize) document.getElementById('greenhouseSize').value = settings.greenhouseSize;
    if (settings.farmLocation) document.getElementById('farmLocation').value = settings.farmLocation;
    if (settings.equipmentInventory) document.getElementById('equipmentInventory').value = settings.equipmentInventory;
    if (settings.farmNotes) document.getElementById('farmNotes').value = settings.farmNotes;
}

function testConnection() {
    const broker = document.getElementById('settingsMqttBroker').value;
    const username = document.getElementById('settingsMqttUser').value;
    const password = document.getElementById('settingsMqttPass').value;
    
    // Sync settings page credentials to dashboard panel
    const dashboardBroker = document.getElementById('mqttBroker');
    const dashboardUser = document.getElementById('mqttUser');
    const dashboardPass = document.getElementById('mqttPass');
    
    if (dashboardBroker) dashboardBroker.value = broker;
    if (dashboardUser) dashboardUser.value = username;
    if (dashboardPass) dashboardPass.value = password;
    
    // Save to localStorage
    localStorage.setItem('mqttBroker', broker);
    localStorage.setItem('mqttUser', username);
    localStorage.setItem('mqttPass', password);
    
    // Test MQTT connection using the dashboard's connect function
    console.log('🧪 Testing MQTT connection...');
    console.log('   Broker:', broker);
    console.log('   Username:', username || 'Not set');
    console.log('   Password:', password ? '***' : 'Not set');
    
    if (typeof connectMQTT === 'function') {
        connectMQTT();
        alert('✅ Connection test initiated! Check the browser console for connection status.');
    } else {
        alert('❌ MQTT connection function not available. Please refresh the page.');
    }
}

function saveThresholds() {
    const settings = {
        tempMin: document.getElementById('tempMin').value,
        tempMax: document.getElementById('tempMax').value,
        humidityMin: document.getElementById('humidityMin').value,
        humidityMax: document.getElementById('humidityMax').value,
        phMin: document.getElementById('phMin').value,
        phMax: document.getElementById('phMax').value,
        soilHumidityMin: document.getElementById('soilHumidityMin').value,
        soilHumidityMax: document.getElementById('soilHumidityMax').value
    };
    
    localStorage.setItem('farmSettings', JSON.stringify(settings));
    alert('Thresholds saved successfully!');
}

function saveCropInfo() {
    const settings = JSON.parse(localStorage.getItem('farmSettings') || '{}');
    
    settings.currentCrop = document.getElementById('currentCrop').value;
    settings.growthStage = document.getElementById('growthStage').value;
    settings.plantingDate = document.getElementById('plantingDate').value;
    settings.harvestDate = document.getElementById('harvestDate').value;
    
    localStorage.setItem('farmSettings', JSON.stringify(settings));
    alert('Crop information saved successfully!');
}

function saveAutomation() {
    const settings = JSON.parse(localStorage.getItem('farmSettings') || '{}');
    
    settings.autoWatering = document.getElementById('autoWatering').value;
    settings.wateringThreshold = document.getElementById('wateringThreshold').value;
    settings.lightOn = document.getElementById('lightOn').value;
    settings.lightOff = document.getElementById('lightOff').value;
    settings.ventilationTemp = document.getElementById('ventilationTemp').value;
    
    localStorage.setItem('farmSettings', JSON.stringify(settings));
    alert('Automation settings saved successfully!');
}

function saveFarmInfo() {
    const settings = JSON.parse(localStorage.getItem('farmSettings') || '{}');
    
    settings.greenhouseSize = document.getElementById('greenhouseSize').value;
    settings.farmLocation = document.getElementById('farmLocation').value;
    settings.equipmentInventory = document.getElementById('equipmentInventory').value;
    settings.farmNotes = document.getElementById('farmNotes').value;
    
    localStorage.setItem('farmSettings', JSON.stringify(settings));
    alert('Farm information saved successfully!');
}

// Actuator Control System
let actuatorStates = {
    fan: false
};

let actuatorPowerConsumption = {
    fan: 250        // Watts (matches your Arduino code - Industrial Fan 250W)
};

function toggleActuatorCard(actuatorType) {
    console.log(`🖱️ Click detected on ${actuatorType} card`);
    console.log(`Current state: ${actuatorStates[actuatorType]}`);
    
    const cardElement = document.getElementById(`${actuatorType}Card`);
    const indicatorElement = document.getElementById(`${actuatorType}Indicator`);
    const statusElement = document.getElementById(`${actuatorType}Status`);
    const powerElement = document.getElementById(`${actuatorType}Power`);
    const valueElement = document.getElementById(`${actuatorType}Value`);
    const timeElement = document.getElementById(`${actuatorType}Time`);
    
    // Toggle the actuator state
    actuatorStates[actuatorType] = !actuatorStates[actuatorType];
    const isOn = actuatorStates[actuatorType];
    
    console.log(`New state: ${isOn}`);
    
    // Update visual indicators
    if (isOn) {
        cardElement.classList.add('active');
        indicatorElement.classList.add('active');
        statusElement.textContent = 'ON';
        statusElement.className = 'status-indicator status-good';
        valueElement.textContent = 'ON';
        valueElement.style.color = 'var(--success)';
        valueElement.style.fontWeight = 'bold';
        powerElement.textContent = `${actuatorPowerConsumption[actuatorType]}W`;
        timeElement.textContent = new Date().toLocaleTimeString();
        
        // Show notification
        showActuatorNotification(`${getActuatorName(actuatorType)} activated - Status: ON`, 'success');
    } else {
        cardElement.classList.remove('active');
        indicatorElement.classList.remove('active');
        statusElement.textContent = 'OFF';
        statusElement.className = 'status-indicator';
        valueElement.textContent = 'OFF';
        valueElement.style.color = 'var(--text-muted)';
        valueElement.style.fontWeight = 'normal';
        powerElement.textContent = '0W';
        timeElement.textContent = 'Ready';
        
        // Show notification
        showActuatorNotification(`${getActuatorName(actuatorType)} deactivated - Status: OFF`, 'info');
    }
    
    // Simulate real actuator control (in real implementation, this would send MQTT commands)
    simulateActuatorControl(actuatorType, isOn);
}

function getActuatorName(type) {
    const names = {
        fan: 'Fan'
    };
    return names[type] || type;
}

function simulateActuatorControl(actuatorType, isOn) {
    console.log(`🎛️ Actuator Control:`);
    console.log(`   Type: ${actuatorType}`);
    console.log(`   Action: ${isOn ? 'ACTIVATE' : 'DEACTIVATE'}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    
    // Check MQTT connection status
    console.log('🔍 Checking MQTT connection...');
    console.log('   MQTT Client exists:', !!window.mqttClient);
    console.log('   MQTT Client connected:', window.mqttClient ? window.mqttClient.connected : 'No client');
    console.log('   MQTT Client state:', window.mqttClient ? window.mqttClient.connectionState : 'No client');
    
    // Send MQTT commands to control actual hardware
    if (window.mqttClient && window.mqttClient.connected) {
        if (actuatorType === 'fan') {
            // Send fan command to Arduino
            const command = isOn ? 'ON' : 'OFF';
            const topic = 'greenhouse/actuators/fan';
            
            console.log(`📡 Sending MQTT command:`);
            console.log(`   Topic: ${topic}`);
            console.log(`   Command: ${command}`);
            console.log(`   QoS: 1 (at least once delivery)`);
            
            window.mqttClient.publish(topic, command, { qos: 1 });
            console.log(`✅ Fan ${command} command sent to Arduino via MQTT`);
            
            // Show user feedback
            showActuatorNotification(`Fan ${command} command sent to Arduino`, 'info');
        }
    } else {
        console.log('⚠️ MQTT not connected - actuator control simulated');
        console.log('   Reason: MQTT client not available or not connected');
        showActuatorNotification('MQTT not connected - please check connection', 'warning');
        
        // Try to reconnect
        if (window.mqttClient) {
            console.log('🔄 Attempting to reconnect MQTT...');
            try {
                window.mqttClient.reconnect();
                console.log('🔄 Reconnection attempt initiated');
            } catch (error) {
                console.error('❌ Failed to initiate reconnection:', error);
            }
        } else {
            console.log('❌ No MQTT client available for reconnection');
        }
    }
    
    // Simulate some system response
    if (isOn) {
        setTimeout(() => {
            // Simulate system check after activation
            const indicator = document.getElementById(`${actuatorType}Indicator`);
            if (Math.random() < 0.1) { // 10% chance of warning
                console.log(`⚠️ Simulated warning for ${actuatorType}`);
                indicator.classList.add('warning');
                showActuatorNotification(`${getActuatorName(actuatorType)} - System warning detected`, 'warning');
            } else {
                console.log(`✅ ${actuatorType} operating normally`);
                indicator.classList.add('active');
            }
        }, 2000);
    }
}

// Update actuator status from MQTT messages
function updateActuatorStatusFromMQTT(actuatorType, status) {
    const isOn = (status === 'ON');
    const cardElement = document.getElementById(`${actuatorType}Card`);
    const indicatorElement = document.getElementById(`${actuatorType}Indicator`);
    const statusElement = document.getElementById(`${actuatorType}Status`);
    const powerElement = document.getElementById(`${actuatorType}Power`);
    const valueElement = document.getElementById(`${actuatorType}Value`);
    const timeElement = document.getElementById(`${actuatorType}Time`);
    
    // Update the state
    actuatorStates[actuatorType] = isOn;
    
    // Update visual indicators
    if (isOn) {
        cardElement.classList.add('active');
        indicatorElement.classList.add('active');
        statusElement.textContent = 'ON';
        statusElement.className = 'status-indicator status-good';
        valueElement.textContent = 'ON';
        valueElement.style.color = 'var(--success)';
        valueElement.style.fontWeight = 'bold';
        powerElement.textContent = `${actuatorPowerConsumption[actuatorType]}W`;
        timeElement.textContent = new Date().toLocaleTimeString();
    } else {
        cardElement.classList.remove('active');
        indicatorElement.classList.remove('active');
        statusElement.textContent = 'OFF';
        statusElement.className = 'status-indicator';
        valueElement.textContent = 'OFF';
        valueElement.style.color = 'var(--text-muted)';
        valueElement.style.fontWeight = 'normal';
        powerElement.textContent = '0W';
        timeElement.textContent = 'Ready';
    }
    
    console.log(`📡 MQTT: ${actuatorType} status updated to ${status}`);
}

function emergencyStop() {
    // Turn off all actuators
    Object.keys(actuatorStates).forEach(actuatorType => {
        actuatorStates[actuatorType] = false;
        
        const cardElement = document.getElementById(`${actuatorType}Card`);
        const indicatorElement = document.getElementById(`${actuatorType}Indicator`);
        const statusElement = document.getElementById(`${actuatorType}Status`);
        const powerElement = document.getElementById(`${actuatorType}Power`);
        const valueElement = document.getElementById(`${actuatorType}Value`);
        const timeElement = document.getElementById(`${actuatorType}Time`);
        
        // Update UI
        cardElement.classList.remove('active');
        indicatorElement.classList.remove('active');
        indicatorElement.classList.remove('warning');
        statusElement.textContent = 'OFFLINE';
        statusElement.className = 'status-indicator';
        valueElement.textContent = 'OFF';
        valueElement.style.color = 'var(--text-muted)';
        valueElement.style.fontWeight = 'normal';
        powerElement.textContent = '0W';
        timeElement.textContent = 'Emergency Stop';
    });
    
    // Show emergency notification
    showActuatorNotification('EMERGENCY STOP - All actuators deactivated', 'danger');
    
    // In real implementation, send emergency stop command via MQTT
    console.log('Emergency stop activated - all actuators turned off');
}

function showActuatorNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.innerHTML = `
        <span>🎛️</span>
        <span>${message}</span>
    `;
    
    // Add to alerts container
    const alertsContainer = document.getElementById('alerts');
    if (alertsContainer) {
        alertsContainer.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize actuator system
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all actuators to OFF state
    Object.keys(actuatorStates).forEach(actuatorType => {
        const statusElement = document.getElementById(`${actuatorType}Status`);
        const powerElement = document.getElementById(`${actuatorType}Power`);
        const valueElement = document.getElementById(`${actuatorType}Value`);
        const timeElement = document.getElementById(`${actuatorType}Time`);
        
        if (statusElement) {
            statusElement.textContent = 'OFF';
            statusElement.className = 'status-indicator';
        }
        if (powerElement) powerElement.textContent = '0W';
        if (valueElement) {
            valueElement.textContent = 'OFF';
            valueElement.style.color = 'var(--text-muted)';
            valueElement.style.fontWeight = 'normal';
        }
        if (timeElement) timeElement.textContent = 'Ready';
    });
    
    // Show system ready notification
    setTimeout(() => {
        showActuatorNotification('Actuator Control System Ready', 'info');
    }, 1000);
});

// Simulate periodic system monitoring
setInterval(() => {
    // Check for any actuator issues
    Object.keys(actuatorStates).forEach(actuatorType => {
        if (actuatorStates[actuatorType]) {
            const indicator = document.getElementById(`${actuatorType}Indicator`);
            if (indicator && Math.random() < 0.05) { // 5% chance of issue
                indicator.classList.add('warning');
                showActuatorNotification(`${getActuatorName(actuatorType)} - Performance monitoring alert`, 'warning');
                
                // Clear warning after 10 seconds
                setTimeout(() => {
                    indicator.classList.remove('warning');
                }, 10000);
            }
        }
    });
}, 30000); // Check every 30 seconds

// Debug function to test fan card click
function testFanClick() {
    console.log('🧪 Testing fan card click...');
    
    // Check if elements exist
    const fanCard = document.getElementById('fanCard');
    const fanIndicator = document.getElementById('fanIndicator');
    const fanStatus = document.getElementById('fanStatus');
    const fanPower = document.getElementById('fanPower');
    const fanValue = document.getElementById('fanValue');
    const fanTime = document.getElementById('fanTime');
    
    console.log('📋 Fan card elements check:');
    console.log('   fanCard:', !!fanCard);
    console.log('   fanIndicator:', !!fanIndicator);
    console.log('   fanStatus:', !!fanStatus);
    console.log('   fanPower:', !!fanPower);
    console.log('   fanValue:', !!fanValue);
    console.log('   fanTime:', !!fanTime);
    
    if (fanCard) {
        console.log('✅ Fan card found, simulating click...');
        toggleActuatorCard('fan');
    } else {
        console.log('❌ Fan card not found!');
    }
}

// Make test function globally available
window.testFanClick = testFanClick;