// Chart variables - will be initialized when DOM is ready
let tempHumidityChart = null;
let lightChart = null;
let phChart = null;
let soilTempChart = null;
let soilHumidityChart = null;
let npkChart = null;

// Initialize charts when DOM is ready
function initializeCharts() {
    // Check if charts already initialized
    if (tempHumidityChart !== null) {
        console.log('✅ Charts already initialized');
        return;
    }

    // Check if chartData exists
    if (typeof chartData === 'undefined') {
        console.warn('⚠️ chartData not defined yet, waiting...');
        setTimeout(initializeCharts, 100);
        return;
    }

    // Check if canvas elements exist
    const tempHumidityCanvas = document.getElementById('tempHumidityChart');
    if (!tempHumidityCanvas) {
        console.warn('⚠️ Chart canvas elements not found yet, waiting...');
        setTimeout(initializeCharts, 100);
        return;
    }

    console.log('🔧 Initializing charts...');

    // Detect mobile device for performance optimizations
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
        tempHumidityChart = new Chart(tempHumidityCanvas, {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Temperature (°C)',
            data: chartData.temperature,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            yAxisID: 'y',
            tension: 0.4
        }, {
            label: 'Humidity (%)',
            data: chartData.humidity,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            yAxisID: 'y1',
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: !isMobile, // Disable animations on mobile for better performance
        interaction: {
            mode: 'index',
            intersect: false,
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                ticks: { color: '#a0a0a0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                ticks: { color: '#a0a0a0' },
                grid: { drawOnChartArea: false }
            },
            x: {
                ticks: { 
                    color: '#a0a0a0',
                    callback: value => formatTimestampLabel(value)
                },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#ffffff' }
            },
            tooltip: {
                callbacks: {
                    title: (items) => items.length ? formatTimestampTooltip(items[0].label) : ''
                }
            }
        }
    }
});

        lightChart = new Chart(document.getElementById('lightChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Light Intensity (lux)',
            data: chartData.light,
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            tension: 0.4,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: !isMobile, // Disable animations on mobile for better performance
        scales: {
            y: {
                ticks: { color: '#a0a0a0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { 
                    color: '#a0a0a0',
                    callback: value => formatTimestampLabel(value)
                },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#ffffff' }
            },
            tooltip: {
                callbacks: {
                    title: (items) => items.length ? formatTimestampTooltip(items[0].label) : ''
                }
            }
        }
    }
});

        phChart = new Chart(document.getElementById('phChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Soil pH',
            data: chartData.ph,
            borderColor: '#9b59b6',
            backgroundColor: 'rgba(155, 89, 182, 0.1)',
            tension: 0.4,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: !isMobile, // Disable animations on mobile for better performance
        scales: {
            y: {
                title: {
                    display: true,
                    text: 'pH Level',
                    color: '#9b59b6'
                },
                ticks: { color: '#a0a0a0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { 
                    color: '#a0a0a0',
                    callback: value => formatTimestampLabel(value)
                },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#ffffff' }
            },
            tooltip: {
                callbacks: {
                    title: (items) => items.length ? formatTimestampTooltip(items[0].label) : ''
                }
            }
        }
    }
});

        soilTempChart = new Chart(document.getElementById('soilTempChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Soil Temperature (°C)',
            data: chartData.soilTemperature,
            borderColor: '#e67e22',
            backgroundColor: 'rgba(230, 126, 34, 0.1)',
            tension: 0.4,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: !isMobile, // Disable animations on mobile for better performance
        scales: {
            y: {
                title: {
                    display: true,
                    text: 'Temperature (°C)',
                    color: '#e67e22'
                },
                ticks: { color: '#a0a0a0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { 
                    color: '#a0a0a0',
                    callback: value => formatTimestampLabel(value)
                },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#ffffff' }
            },
            tooltip: {
                callbacks: {
                    title: (items) => items.length ? formatTimestampTooltip(items[0].label) : ''
                }
            }
        }
    }
});

        soilHumidityChart = new Chart(document.getElementById('soilHumidityChart'), {
    type: 'line',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Soil Humidity (%)',
            data: chartData.soilHumidity,
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.4,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: !isMobile, // Disable animations on mobile for better performance
        scales: {
            y: {
                title: {
                    display: true,
                    text: 'Humidity (%)',
                    color: '#2ecc71'
                },
                ticks: { color: '#a0a0a0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { 
                    color: '#a0a0a0',
                    callback: value => formatTimestampLabel(value)
                },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#ffffff' }
            },
            tooltip: {
                callbacks: {
                    title: (items) => items.length ? formatTimestampTooltip(items[0].label) : ''
                }
            }
        }
    }
});

        npkChart = new Chart(document.getElementById('npkChart'), {
    type: 'bar',
    data: {
        labels: chartData.labels,
        datasets: [{
            label: 'Nitrogen (mg/kg)',
            data: chartData.nitrogen,
            backgroundColor: 'rgba(46, 204, 113, 0.6)',
            borderColor: '#2ecc71',
            borderWidth: 1
        }, {
            label: 'Phosphorus (mg/kg)',
            data: chartData.phosphorus,
            backgroundColor: 'rgba(52, 152, 219, 0.6)',
            borderColor: '#3498db',
            borderWidth: 1
        }, {
            label: 'Potassium (mg/kg)',
            data: chartData.potassium,
            backgroundColor: 'rgba(155, 89, 182, 0.6)',
            borderColor: '#9b59b6',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: !isMobile, // Disable animations on mobile for better performance
        scales: {
            y: {
                ticks: { color: '#a0a0a0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { 
                    color: '#a0a0a0',
                    callback: value => formatTimestampLabel(value)
                },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#ffffff' }
            },
            tooltip: {
                callbacks: {
                    title: (items) => items.length ? formatTimestampTooltip(items[0].label) : ''
                }
            }
        }
    }
});

        console.log('✅ All charts initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing charts:', error);
    }
}

// Update chart data
function updateChartData() {
    // Check if chartData exists
    if (typeof chartData === 'undefined') {
        return; // Chart data not ready yet
    }

    // Keep only last maxDataPoints
    if (chartData.labels.length > maxDataPoints) {
        chartData.labels.shift();
        chartData.temperature.shift();
        chartData.humidity.shift();
        chartData.light.shift();
        chartData.ph.shift();
        chartData.soilHumidity.shift();
        chartData.soilTemperature.shift();
        chartData.nitrogen.shift();
        chartData.phosphorus.shift();
        chartData.potassium.shift();
    }

    // Update all charts - check if they exist and are initialized (using null check)
    try {
        if (tempHumidityChart !== null && tempHumidityChart) {
            tempHumidityChart.update('none');
        }
        if (lightChart !== null && lightChart) {
            lightChart.update('none');
        }
        if (phChart !== null && phChart) {
            phChart.update('none');
        }
        if (soilTempChart !== null && soilTempChart) {
            soilTempChart.update('none');
        }
        if (soilHumidityChart !== null && soilHumidityChart) {
            soilHumidityChart.update('none');
        }
        if (npkChart !== null && npkChart) {
            npkChart.update('none');
        }
    } catch (error) {
        console.warn('⚠️ Chart update error (charts may not be initialized yet):', error.message);
    }
}

// Add timestamp to chart
function formatTimestampLabel(label) {
    const date = new Date(label);
    if (Number.isNaN(date.getTime())) return label;
    return date.toLocaleTimeString();
}

function formatTimestampTooltip(label) {
    const date = new Date(label);
    if (Number.isNaN(date.getTime())) return label;
    return date.toLocaleString();
}

function addTimestamp(date = new Date()) {
    if (typeof chartData !== 'undefined') {
        chartData.labels.push(date.toISOString());
    }
}

// Initialize charts when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    console.log('📊 DOM loaded, initializing charts...');
    initializeCharts();
});

// Also try to initialize after a short delay (in case DOMContentLoaded already fired)
setTimeout(() => {
    if (tempHumidityChart === null) {
        console.log('📊 Attempting to initialize charts after delay...');
        initializeCharts();
    }
}, 500);
