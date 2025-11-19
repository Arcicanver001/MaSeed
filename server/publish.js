const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.emqx.io:1883');

client.on('connect', () => {
  client.publish('greenhouse/cedrick1/temperature', '26.2', {}, () => {
    console.log('published test temperature to greenhouse/cedrick1/temperature');
    client.end();
  });
});

client.on('error', (e) => {
  console.error('publish error:', e.message);
});


