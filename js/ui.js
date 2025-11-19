// Scroll to specific chart
function scrollToChart(chartId) {
    const chartElement = document.getElementById(chartId);
    if (chartElement) {
        chartElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        // Add a subtle highlight effect
        chartElement.style.border = '2px solid var(--primary-color)';
        chartElement.style.borderRadius = '15px';
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
            chartElement.style.border = 'none';
        }, 2000);
    }
}

// Scroll to top function
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Show/hide scroll to top button based on scroll position
function toggleScrollToTop() {
    const scrollButton = document.getElementById('scrollToTop');
    if (window.scrollY > 300) {
        scrollButton.classList.add('visible');
    } else {
        scrollButton.classList.remove('visible');
    }
}

// Show info modal with sensor-specific information
function showInfoModal(sensorType) {
    const modal = document.getElementById('infoModal');
    const title = document.getElementById('infoModalTitle');
    const body = document.getElementById('infoModalBody');
    
    const sensorInfo = getSensorInfo(sensorType);
    title.textContent = sensorInfo.title;
    body.innerHTML = sensorInfo.content;
    
    modal.classList.add('visible');
}

// Hide info modal
function hideInfoModal() {
    const modal = document.getElementById('infoModal');
    modal.classList.remove('visible');
}

// Get sensor-specific information
function getSensorInfo(sensorType) {
    const info = {
        temperature: {
            title: '🌡️ Air Temperature Sensor',
            content: `
                <p>The air temperature sensor monitors the ambient temperature inside your greenhouse, which is crucial for Brassicaceae cultivation.</p>
                
                <h4>Why It Matters for Brassicaceae:</h4>
                <ul>
                    <li><strong>Optimal Growth:</strong> Brassicaceae (cabbage family) thrive in cooler temperatures</li>
                    <li><strong>Bolting Prevention:</strong> High temperatures can cause premature flowering</li>
                    <li><strong>Quality Control:</strong> Proper temperature ensures better leaf development</li>
                </ul>
                
                <h4>Optimal Ranges for Brassicaceae:</h4>
                <ul>
                    <li><strong>Good:</strong> 18-25°C (64-77°F)</li>
                    <li><strong>Warning:</strong> 15-30°C (59-86°F)</li>
                    <li><strong>Critical:</strong> Below 10°C or above 35°C</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Use ventilation systems during hot periods</li>
                    <li>Consider shade cloths in tropical climates</li>
                    <li>Monitor for temperature fluctuations</li>
                </ul>
            `
        },
        humidity: {
            title: '💧 Air Humidity Sensor',
            content: `
                <p>The air humidity sensor measures the moisture content in the air, which affects plant transpiration and disease susceptibility.</p>
                
                <h4>Why It Matters for Brassicaceae:</h4>
                <ul>
                    <li><strong>Disease Prevention:</strong> High humidity can lead to fungal diseases</li>
                    <li><strong>Water Management:</strong> Affects plant water uptake and transpiration</li>
                    <li><strong>Leaf Health:</strong> Proper humidity prevents leaf edge burn</li>
                </ul>
                
                <h4>Optimal Ranges for Brassicaceae:</h4>
                <ul>
                    <li><strong>Good:</strong> 60-80% relative humidity</li>
                    <li><strong>Warning:</strong> 50-85% relative humidity</li>
                    <li><strong>Critical:</strong> Below 40% or above 90%</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Use dehumidifiers during high humidity periods</li>
                    <li>Ensure proper air circulation</li>
                    <li>Avoid overhead watering in humid conditions</li>
                </ul>
            `
        },
        light: {
            title: '🔆 Light Intensity Sensor',
            content: `
                <p>The light sensor measures the intensity of light reaching your plants, which is essential for photosynthesis and growth.</p>
                
                <h4>Why It Matters for Brassicaceae:</h4>
                <ul>
                    <li><strong>Photosynthesis:</strong> Light drives energy production for growth</li>
                    <li><strong>Leaf Development:</strong> Proper light ensures healthy leaf formation</li>
                    <li><strong>Nutrient Production:</strong> Light affects vitamin and nutrient content</li>
                </ul>
                
                <h4>Optimal Ranges for Brassicaceae:</h4>
                <ul>
                    <li><strong>Good:</strong> 15,000-25,000 lux</li>
                    <li><strong>Warning:</strong> 10,000-35,000 lux</li>
                    <li><strong>Critical:</strong> Below 5,000 or above 50,000 lux</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Use shade cloths during intense tropical sun</li>
                    <li>Supplement with LED grow lights if needed</li>
                    <li>Monitor light duration (12-16 hours optimal)</li>
                </ul>
            `
        },
        soilTemperature: {
            title: '🌡️ Soil Temperature Sensor',
            content: `
                <p>The soil temperature sensor monitors the temperature of the root zone, which affects nutrient uptake and root development.</p>
                
                <h4>Why It Matters for Brassicaceae:</h4>
                <ul>
                    <li><strong>Root Growth:</strong> Optimal soil temperature promotes healthy root development</li>
                    <li><strong>Nutrient Uptake:</strong> Temperature affects nutrient absorption efficiency</li>
                    <li><strong>Microbial Activity:</strong> Soil temperature influences beneficial soil organisms</li>
                </ul>
                
                <h4>Optimal Ranges for Brassicaceae:</h4>
                <ul>
                    <li><strong>Good:</strong> 20-28°C (68-82°F)</li>
                    <li><strong>Warning:</strong> 18-30°C (64-86°F)</li>
                    <li><strong>Critical:</strong> Below 15°C or above 35°C</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Use mulch to regulate soil temperature</li>
                    <li>Consider raised beds for better temperature control</li>
                    <li>Monitor temperature fluctuations throughout the day</li>
                </ul>
            `
        },
        soilHumidity: {
            title: '🌱 Soil Humidity Sensor',
            content: `
                <p>The soil humidity sensor measures the moisture content in the soil, which is critical for plant water uptake and root health.</p>
                
                <h4>Why It Matters for Brassicaceae:</h4>
                <ul>
                    <li><strong>Water Uptake:</strong> Proper soil moisture ensures adequate water supply</li>
                    <li><strong>Root Health:</strong> Prevents both drought stress and root rot</li>
                    <li><strong>Nutrient Transport:</strong> Water carries nutrients to plant roots</li>
                </ul>
                
                <h4>Optimal Ranges for Brassicaceae:</h4>
                <ul>
                    <li><strong>Good:</strong> 60-80% field capacity</li>
                    <li><strong>Warning:</strong> 50-85% field capacity</li>
                    <li><strong>Critical:</strong> Below 40% or above 90%</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Implement drip irrigation for consistent moisture</li>
                    <li>Use well-draining soil to prevent waterlogging</li>
                    <li>Monitor soil moisture before watering</li>
                </ul>
            `
        },
        ph: {
            title: '🧪 Soil pH Sensor',
            content: `
                <p>The soil pH sensor measures the acidity or alkalinity of your soil, which affects nutrient availability and plant health.</p>
                
                <h4>Why It Matters for Brassicaceae:</h4>
                <ul>
                    <li><strong>Nutrient Availability:</strong> pH affects how well plants can absorb nutrients</li>
                    <li><strong>Root Health:</strong> Extreme pH can damage root systems</li>
                    <li><strong>Disease Resistance:</strong> Proper pH helps prevent soil-borne diseases</li>
                </ul>
                
                <h4>Optimal Ranges for Brassicaceae:</h4>
                <ul>
                    <li><strong>Good:</strong> 6.0-7.0 (slightly acidic to neutral)</li>
                    <li><strong>Warning:</strong> 5.5-7.5</li>
                    <li><strong>Critical:</strong> Below 5.0 or above 8.0</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Add lime to raise pH if too acidic</li>
                    <li>Add sulfur to lower pH if too alkaline</li>
                    <li>Test soil pH regularly, especially in tropical climates</li>
                </ul>
            `
        },
        npk: {
            title: '🌿 Soil Nutrients (NPK) Sensor',
            content: `
                <p>The NPK sensor measures the levels of essential macronutrients: Nitrogen (N), Phosphorus (P), and Potassium (K) in your soil.</p>
                
                <h4>Why Each Nutrient Matters for Brassicaceae:</h4>
                
                <h4>Nitrogen (N):</h4>
                <ul>
                    <li><strong>Leaf Growth:</strong> Essential for healthy leaf development</li>
                    <li><strong>Chlorophyll Production:</strong> Needed for photosynthesis</li>
                    <li><strong>Optimal Range:</strong> Above 100 mg/kg</li>
                </ul>
                
                <h4>Phosphorus (P):</h4>
                <ul>
                    <li><strong>Root Development:</strong> Promotes strong root systems</li>
                    <li><strong>Energy Transfer:</strong> Essential for energy storage and transfer</li>
                    <li><strong>Optimal Range:</strong> Above 50 mg/kg</li>
                </ul>
                
                <h4>Potassium (K):</h4>
                <ul>
                    <li><strong>Disease Resistance:</strong> Improves plant immunity</li>
                    <li><strong>Water Regulation:</strong> Helps with water uptake and retention</li>
                    <li><strong>Optimal Range:</strong> Above 150 mg/kg</li>
                </ul>
                
                <h4>Management Tips:</h4>
                <ul>
                    <li>Use balanced fertilizers for Brassicaceae</li>
                    <li>Monitor nutrient levels throughout growing season</li>
                    <li>Consider organic amendments for long-term soil health</li>
                </ul>
            `
        }
    };
    
    return info[sensorType] || {
        title: 'Sensor Information',
        content: '<p>Information not available for this sensor.</p>'
    };
}

// Add scroll event listener for scroll-to-top button
window.addEventListener('scroll', toggleScrollToTop);
