// Test script to verify Firebase API is working
const http = require('http');

const API_BASE = 'http://localhost:8080/api';

function testAPI() {
  console.log('🔍 Testing Firebase API endpoint...\n');
  
  const sensor = 'temperature';
  const fromMs = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
  
  const url = `${API_BASE}/history?sensor=${sensor}&fromMs=${fromMs}`;
  
  console.log(`📡 Calling: ${url}\n`);
  
  http.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`✅ Response Status: ${res.statusCode}`);
      console.log(`📦 Response Length: ${data.length} bytes\n`);
      
      try {
        const json = JSON.parse(data);
        console.log(`📊 Records returned: ${json.length}`);
        
        if (json.length > 0) {
          console.log(`\n📋 First record:`, json[0]);
          console.log(`📋 Last record:`, json[json.length - 1]);
          console.log(`\n✅ API is working! Data is available.`);
        } else {
          console.log(`\n⚠️ API returned empty array. No data found for the time range.`);
          console.log(`💡 Try: node add-test-data.js to add test data`);
        }
      } catch (e) {
        console.error('❌ Error parsing JSON:', e.message);
        console.log('📄 Raw response:', data.substring(0, 200));
      }
    });
  }).on('error', (err) => {
    console.error('❌ Connection Error:', err.message);
    console.log('\n💡 Make sure the server is running:');
    console.log('   cd server');
    console.log('   node server.js');
  });
}

testAPI();

