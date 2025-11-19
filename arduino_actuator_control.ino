#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <BH1750.h>
#include <ModbusMaster.h>

// ----------- WiFi & MQTT Config -----------
const char* ssid        = "CantubaWiFi";
const char* password    = "hawikitkatgalgaia";
const char* mqtt_server = "broker.emqx.io";
const int   mqtt_port   = 1883;
const char* mqtt_user   = "myuser";
const char* mqtt_pass   = "*smart2025!";

WiFiClient espClient;
PubSubClient client(espClient);

// ----------- DHT22 Config -----------
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ----------- BH1750 Config -----------
BH1750 lightMeter;

// ----------- Modbus RS485 Config -----------
ModbusMaster nodeNPK;
ModbusMaster nodeSoil;

// --- NPK Sensor (Serial2)
#define TX_NPK 17
#define RX_NPK 16
#define DE_NPK 5
#define RE_NPK 13

// --- Soil Sensor (Serial1)
#define TX_SOIL 22
#define RX_SOIL 21
#define DE_SOIL 33
#define RE_SOIL 32

// --- Control lines
void preTransmissionNPK() {
  digitalWrite(DE_NPK, HIGH);
  digitalWrite(RE_NPK, HIGH);
}

void postTransmissionNPK() {
  digitalWrite(DE_NPK, LOW);
  digitalWrite(RE_NPK, LOW);
}

void preTransmissionSoil() {
  digitalWrite(DE_SOIL, HIGH);
  digitalWrite(RE_SOIL, HIGH);
}

void postTransmissionSoil() {
  digitalWrite(DE_SOIL, LOW);
  digitalWrite(RE_SOIL, LOW);
}

// ----------- Fan Actuator Control -----------
#define FAN_RELAY_PIN 18
bool fanRelayState = false;
bool autoMode = true;
float tempThreshold = 33.0;
unsigned long fanStartTime = 0;
const unsigned long MIN_RUNTIME = 30000;
const unsigned long MAX_RUNTIME = 3600000;
unsigned long lastFanCheck = 0;
const unsigned long FAN_CHECK_INTERVAL = 1000;

bool manualOverride = false;
unsigned long lastManualControl = 0;
const unsigned long MANUAL_OVERRIDE_TIMEOUT = 300000;

// ----------- Humidifier & Sprinkler Actuator Control -----------
#define HUMIDIFIER_RELAY_PIN 19
#define SPRINKLER_RELAY_PIN 23

bool humidifierRelayState = false;
bool sprinklerRelayState  = false;

// Humidifier automation (based on air humidity)
float humidityThreshold = 55.0; // turn ON if humidity < threshold
unsigned long humidifierStartTime = 0;
unsigned long lastHumidifierCheck = 0;
const unsigned long HUMIDIFIER_CHECK_INTERVAL = 1000;
bool humidifierManualOverride = false;
unsigned long humidifierLastManual = 0;

// Sprinkler automation (based on soil moisture)
float soilMoistureThreshold = 35.0; // turn ON if soil moisture < threshold (percent)
unsigned long sprinklerStartTime = 0;
unsigned long lastSprinklerCheck = 0;
const unsigned long SPRINKLER_CHECK_INTERVAL = 1000;
bool sprinklerManualOverride = false;
unsigned long sprinklerLastManual = 0;

// ----------- Timing Variables -----------
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 5000;

// ----------- Global variables -----------
float currentTemp = 0.0;
float currentHumidity = 0.0;
float currentSoilMoisture = 0.0;

// ----------- Sensor Health Monitoring -----------
unsigned long lastHealthCheck = 0;
int dht22Failures = 0;
const unsigned long HEALTH_CHECK_INTERVAL = 30000;

// ----------- WiFi Connection -----------
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.printf("Connecting to WiFi: %s\n", ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

// ----------- MQTT Reconnect -----------
void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT broker...");

    // ✅ CRITICAL FIX: Use unique ClientID based on MAC address
    // This prevents connection conflicts when multiple clients use the same ID
    String clientId = String("ESP32ClientGreenhouse_") + String((uint32_t)ESP.getEfuseMac(), HEX);
    
    Serial.printf("\n🆔 Attempting connection with ClientID: %s\n", clientId.c_str());
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("✅ Connected to MQTT with authentication!");
      Serial.printf("📍 Broker: %s:%d\n", mqtt_server, mqtt_port);
      Serial.printf("👤 User: %s\n", mqtt_user);
      Serial.printf("🆔 ClientID: %s\n", clientId.c_str());

      // Subscribe to actuator control topics with logging
      auto subscribeWithLog = [&](const char* topic) {
        bool success = client.subscribe(topic);
        Serial.printf("%s %s\n", success ? "✅ Subscribed to" : "❌ Subscribe FAILED:", topic);
        return success;
      };

      Serial.println("\n📋 Subscribing to actuator topics:");
      subscribeWithLog("greenhouse/actuators/fan");
      subscribeWithLog("greenhouse/actuators/humidifier");
      subscribeWithLog("greenhouse/actuators/sprinkler");
      subscribeWithLog("greenhouse/actuators/auto_mode");
      subscribeWithLog("greenhouse/actuators/temp_threshold");
      subscribeWithLog("greenhouse/actuators/humidity_threshold");
      subscribeWithLog("greenhouse/actuators/soil_moisture_threshold");
      subscribeWithLog("greenhouse/actuators/#"); // Wildcard for debugging

      // Publish initial statuses
      Serial.println("\n📤 Publishing initial actuator statuses:");
      client.publish("greenhouse/actuators/fan_status", fanRelayState ? "ON" : "OFF");
      client.publish("greenhouse/actuators/humidifier_status", humidifierRelayState ? "ON" : "OFF");
      client.publish("greenhouse/actuators/sprinkler_status", sprinklerRelayState ? "ON" : "OFF");
      client.publish("greenhouse/actuators/auto_mode_status", autoMode ? "ON" : "OFF");
      client.publish("greenhouse/actuators/temp_threshold_status", String(tempThreshold, 1).c_str());
      client.publish("greenhouse/actuators/humidity_threshold_status", String(humidityThreshold, 1).c_str());
      client.publish("greenhouse/actuators/soil_moisture_threshold_status", String(soilMoistureThreshold, 1).c_str());
      
      Serial.println("✅ MQTT setup complete - ready to receive commands!");
    } else {
      Serial.printf("❌ Connection failed, rc=%d. Retrying in 5s...\n", client.state());
      delay(5000);
    }
  }
}

// ----------- MQTT Message Callback -----------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < (int)length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.printf("\n📨 Received MQTT message:\n");
  Serial.printf("   Topic: %s\n", topic);
  Serial.printf("   Message: %s\n", message.c_str());
  Serial.printf("   Length: %d bytes\n", length);

  String topicStr = String(topic);

  if (topicStr == "greenhouse/actuators/fan") {
    manualOverride = true;
    lastManualControl = millis();

    if (message == "ON") {
      setFanRelay(true);
      Serial.println("🌀 Fan manually turned ON from dashboard");
    } else if (message == "OFF") {
      setFanRelay(false);
      Serial.println("🌀 Fan manually turned OFF from dashboard");
    } else {
      Serial.printf("⚠️ Unknown fan command: %s\n", message.c_str());
    }
  }
  else if (topicStr == "greenhouse/actuators/humidifier") {
    humidifierManualOverride = true;
    humidifierLastManual = millis();

    if (message == "ON") {
      setHumidifierRelay(true);
      Serial.println("💨 Humidifier manually turned ON from dashboard");
    } else if (message == "OFF") {
      setHumidifierRelay(false);
      Serial.println("💨 Humidifier manually turned OFF from dashboard");
    } else {
      Serial.printf("⚠️ Unknown humidifier command: %s\n", message.c_str());
    }
  }
  else if (topicStr == "greenhouse/actuators/sprinkler") {
    sprinklerManualOverride = true;
    sprinklerLastManual = millis();

    if (message == "ON") {
      setSprinklerRelay(true);
      Serial.println("💧 Sprinkler manually turned ON from dashboard");
    } else if (message == "OFF") {
      setSprinklerRelay(false);
      Serial.println("💧 Sprinkler manually turned OFF from dashboard");
    } else {
      Serial.printf("⚠️ Unknown sprinkler command: %s\n", message.c_str());
    }
  }
  else if (topicStr == "greenhouse/actuators/auto_mode") {
    autoMode = (message == "true" || message == "1" || message == "ON" || message == "on");
    Serial.printf("🤖 Auto mode: %s\n", autoMode ? "ON" : "OFF");
    client.publish("greenhouse/actuators/auto_mode_status", autoMode ? "ON" : "OFF");

    if (autoMode) {
      manualOverride = false;
      humidifierManualOverride = false;
      sprinklerManualOverride = false;
    }
  }
  else if (topicStr == "greenhouse/actuators/temp_threshold") {
    tempThreshold = message.toFloat();
    Serial.printf("🌡️ Temperature threshold set to: %.1f°C\n", tempThreshold);
    client.publish("greenhouse/actuators/temp_threshold_status", message.c_str());
  }
  else if (topicStr == "greenhouse/actuators/humidity_threshold") {
    humidityThreshold = message.toFloat();
    Serial.printf("💧 Humidity threshold set to: %.1f%%\n", humidityThreshold);
    client.publish("greenhouse/actuators/humidity_threshold_status", message.c_str());
  }
  else if (topicStr == "greenhouse/actuators/soil_moisture_threshold") {
    soilMoistureThreshold = message.toFloat();
    Serial.printf("🌱 Soil moisture threshold set to: %.1f%%\n", soilMoistureThreshold);
    client.publish("greenhouse/actuators/soil_moisture_threshold_status", message.c_str());
  }
  else {
    Serial.printf("❓ Unknown topic received: %s\n", topic);
  }
}

// ----------- Enhanced DHT22 Reading with Retry Logic -----------
bool readDHT22WithRetry(float &temperature, float &humidity) {
  int maxRetries = 5;
  int retryDelay = 100; // Start with 100ms delay

  for (int i = 0; i < maxRetries; i++) {
    if (fanRelayState) {
      delay(200); // Extra delay when fan is running
    }

    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    if (!isnan(temperature) && !isnan(humidity) &&
        temperature > -40 && temperature < 80 &&
        humidity >= 0 && humidity <= 100) {
      return true;
    }

    Serial.printf("⚠️ DHT22 read attempt %d failed, retrying...\n", i + 1);
    delay(retryDelay);
    retryDelay *= 2; // Exponential backoff
  }

  Serial.println("❌ DHT22 read failed after all retries");
  return false;
}

// ----------- Read NPK Sensor -----------
void readNPK() {
  uint8_t result = nodeNPK.readInputRegisters(0x0000, 3);
  if (result == nodeNPK.ku8MBSuccess) {
    float N = nodeNPK.getResponseBuffer(0) / 10.0;
    float P = nodeNPK.getResponseBuffer(1) / 10.0;
    float K = nodeNPK.getResponseBuffer(2) / 10.0;

    Serial.printf("🌿 NPK Sensor - N: %.1f mg/kg, P: %.1f mg/kg, K: %.1f mg/kg\n", N, P, K);

    client.publish("greenhouse/nitrogen", String(N).c_str());
    client.publish("greenhouse/phosphorus", String(P).c_str());
    client.publish("greenhouse/potassium", String(K).c_str());
  } else {
    Serial.printf("⚠️ NPK Sensor read error: %d\n", result);
  }
}

// ----------- Read Soil Sensor -----------
void readSoil() {
  uint8_t result = nodeSoil.readInputRegisters(0x0000, 4);
  if (result == nodeSoil.ku8MBSuccess) {
    float moisture = nodeSoil.getResponseBuffer(0) / 10.0;
    float temp = nodeSoil.getResponseBuffer(1) / 10.0;
    float ec = nodeSoil.getResponseBuffer(2);
    float ph = nodeSoil.getResponseBuffer(3) / 10.0;

    Serial.printf("🌱 Soil Sensor - Moisture: %.1f%%, Temp: %.1f°C, EC: %.0f µS/cm, pH: %.1f\n",
                  moisture, temp, ec, ph);

    client.publish("greenhouse/soil_moisture", String(moisture).c_str());
    client.publish("greenhouse/soil_temperature", String(temp).c_str());
    client.publish("greenhouse/soil_ec", String(ec).c_str());
    client.publish("greenhouse/soil_ph", String(ph).c_str());

    // Cache for automation
    currentSoilMoisture = moisture;
  } else {
    Serial.printf("⚠️ Soil Sensor read error: %d\n", result);
  }
}

// ----------- Enhanced Sensor Reading Function -----------
void readAllSensors() {
  float temperature, humidity;

  // Read DHT22 with retry logic
  if (readDHT22WithRetry(temperature, humidity)) {
    currentTemp = temperature;
    currentHumidity = humidity;

    client.publish("greenhouse/temperature", String(currentTemp).c_str());
    client.publish("greenhouse/humidity", String(currentHumidity).c_str());
    Serial.printf("🌡️ Temp: %.2f °C, 💧 Humidity: %.2f %%\n", currentTemp, currentHumidity);

    checkFanControl(currentTemp);
    checkHumidifierControl(currentHumidity);

    dht22Failures = 0;
  } else {
    Serial.println("❌ DHT22 sensor failed - using last known values");
    dht22Failures++;

    if (dht22Failures >= 3) {
      Serial.println("🚨 DHT22 sensor appears to be malfunctioning!");
      client.publish("greenhouse/sensor_status", "DHT22_CRITICAL");
    }
  }

  // Read light sensor
  float lux = lightMeter.readLightLevel();
  if (lux >= 0) {
    client.publish("greenhouse/light", String(lux).c_str());
    Serial.printf("🔆 Light Intensity: %.2f lx\n", lux);
  } else {
    Serial.println("⚠️ Failed to read BH1750");
  }

  // Read NPK sensor
  readNPK();

  // Read Soil sensor
  readSoil();
  checkSprinklerControl(currentSoilMoisture);
}

// ----------- Sensor Health Monitoring -----------
void checkSensorHealth() {
  if (millis() - lastHealthCheck >= HEALTH_CHECK_INTERVAL) {
    lastHealthCheck = millis();

    float temp, humidity;
    if (!readDHT22WithRetry(temp, humidity)) {
      Serial.printf("⚠️ DHT22 health check failed. Failure count: %d\n", dht22Failures);
    } else {
      Serial.println("✅ DHT22 health check passed");
    }
  }
}

// ----------- Fan Control Function -----------
void setFanRelay(bool state) {
  if (fanRelayState != state) {
    fanRelayState = state;
    // ⚠️ IMPORTANT: Relay modules can be LOW-trigger or HIGH-trigger
    // If your relay doesn't activate, try swapping LOW/HIGH
    digitalWrite(FAN_RELAY_PIN, fanRelayState ? LOW : HIGH);
    client.publish("greenhouse/actuators/fan_status", fanRelayState ? "ON" : "OFF");

    if (fanRelayState) {
      fanStartTime = millis();
      Serial.printf("🌀 Industrial Fan (250W) STARTED at %lu\n", fanStartTime);
      Serial.printf("   Relay pin %d set to %s\n", FAN_RELAY_PIN, fanRelayState ? "LOW" : "HIGH");
    } else {
      unsigned long runtime = millis() - fanStartTime;
      Serial.printf("🌀 Industrial Fan STOPPED after %lu seconds\n", runtime / 1000);
      Serial.printf("   Relay pin %d set to %s\n", FAN_RELAY_PIN, fanRelayState ? "LOW" : "HIGH");
    }
  }
}

bool canTurnOffFan() {
  if (!fanRelayState) return true;

  unsigned long runtime = millis() - fanStartTime;

  if (runtime < MIN_RUNTIME) {
    Serial.printf("⚠️ Fan must run for minimum %lu seconds (currently %lu)\n",
                  MIN_RUNTIME / 1000, runtime / 1000);
    return false;
  }

  if (runtime > MAX_RUNTIME) {
    Serial.println("🚨 SAFETY: Fan maximum runtime exceeded - forcing OFF");
    return true;
  }

  return true;
}

bool isManualOverrideActive() {
  if (!manualOverride) return false;

  unsigned long timeSinceManual = millis() - lastManualControl;
  if (timeSinceManual > MANUAL_OVERRIDE_TIMEOUT) {
    manualOverride = false;
    Serial.println("🔄 Manual override timeout - returning to auto mode");
    return false;
  }

  return true;
}

// ----------- Automatic Fan Control -----------
void checkFanControl(float temperature) {
  if (!autoMode || isManualOverrideActive()) {
    return;
  }

  unsigned long currentTime = millis();

  if (fanRelayState && (currentTime - lastFanCheck >= FAN_CHECK_INTERVAL)) {
    lastFanCheck = currentTime;

    if (!canTurnOffFan()) {
      return;
    }
  }

  if (temperature > tempThreshold && !fanRelayState) {
    setFanRelay(true);
    Serial.printf("🌀 Fan AUTO-activated: Temperature %.1f°C > %.1f°C\n", temperature, tempThreshold);
  } else if (temperature <= tempThreshold && fanRelayState && canTurnOffFan()) {
    setFanRelay(false);
    Serial.printf("🌀 Fan AUTO-deactivated: Temperature %.1f°C <= %.1f°C\n", temperature, tempThreshold);
  }
}

// ----------- Humidifier Control Function -----------
void setHumidifierRelay(bool state) {
  if (humidifierRelayState != state) {
    humidifierRelayState = state;
    digitalWrite(HUMIDIFIER_RELAY_PIN, humidifierRelayState ? LOW : HIGH);
    client.publish("greenhouse/actuators/humidifier_status", humidifierRelayState ? "ON" : "OFF");
    if (humidifierRelayState) {
      humidifierStartTime = millis();
      Serial.printf("💨 Humidifier (150W) STARTED at %lu\n", humidifierStartTime);
      Serial.printf("   Relay pin %d set to %s\n", HUMIDIFIER_RELAY_PIN, humidifierRelayState ? "LOW" : "HIGH");
    } else {
      unsigned long runtime = millis() - humidifierStartTime;
      Serial.printf("💨 Humidifier STOPPED after %lu seconds\n", runtime / 1000);
      Serial.printf("   Relay pin %d set to %s\n", HUMIDIFIER_RELAY_PIN, humidifierRelayState ? "LOW" : "HIGH");
    }
  }
}

bool canTurnOffHumidifier() {
  if (!humidifierRelayState) return true;
  unsigned long runtime = millis() - humidifierStartTime;
  if (runtime < MIN_RUNTIME) {
    Serial.printf("⚠️ Humidifier must run for minimum %lu seconds (currently %lu)\n",
                  MIN_RUNTIME / 1000, runtime / 1000);
    return false;
  }
  if (runtime > MAX_RUNTIME) {
    Serial.println("🚨 SAFETY: Humidifier maximum runtime exceeded - forcing OFF");
    return true;
  }
  return true;
}

bool isHumidifierManualOverrideActive() {
  if (!humidifierManualOverride) return false;
  unsigned long dt = millis() - humidifierLastManual;
  if (dt > MANUAL_OVERRIDE_TIMEOUT) {
    humidifierManualOverride = false;
    Serial.println("🔄 Humidifier manual override timeout - returning to auto mode");
    return false;
  }
  return true;
}

void checkHumidifierControl(float humidity) {
  if (!autoMode || isHumidifierManualOverrideActive()) return;
  unsigned long now = millis();
  if (humidifierRelayState && (now - lastHumidifierCheck >= HUMIDIFIER_CHECK_INTERVAL)) {
    lastHumidifierCheck = now;
    if (!canTurnOffHumidifier()) return;
  }
  if (humidity < humidityThreshold && !humidifierRelayState) {
    setHumidifierRelay(true);
    Serial.printf("💨 Humidifier AUTO-activated: Humidity %.1f%% < %.1f%%\n", humidity, humidityThreshold);
  } else if (humidity >= humidityThreshold && humidifierRelayState && canTurnOffHumidifier()) {
    setHumidifierRelay(false);
    Serial.printf("💨 Humidifier AUTO-deactivated: Humidity %.1f%% ≥ %.1f%%\n", humidity, humidityThreshold);
  }
}

// ----------- Sprinkler Control Function -----------
void setSprinklerRelay(bool state) {
  if (sprinklerRelayState != state) {
    sprinklerRelayState = state;
    digitalWrite(SPRINKLER_RELAY_PIN, sprinklerRelayState ? LOW : HIGH);
    client.publish("greenhouse/actuators/sprinkler_status", sprinklerRelayState ? "ON" : "OFF");
    if (sprinklerRelayState) {
      sprinklerStartTime = millis();
      Serial.printf("💧 Sprinkler (100W) STARTED at %lu\n", sprinklerStartTime);
      Serial.printf("   Relay pin %d set to %s\n", SPRINKLER_RELAY_PIN, sprinklerRelayState ? "LOW" : "HIGH");
    } else {
      unsigned long runtime = millis() - sprinklerStartTime;
      Serial.printf("💧 Sprinkler STOPPED after %lu seconds\n", runtime / 1000);
      Serial.printf("   Relay pin %d set to %s\n", SPRINKLER_RELAY_PIN, sprinklerRelayState ? "LOW" : "HIGH");
    }
  }
}

bool canTurnOffSprinkler() {
  if (!sprinklerRelayState) return true;
  unsigned long runtime = millis() - sprinklerStartTime;
  if (runtime < MIN_RUNTIME) {
    Serial.printf("⚠️ Sprinkler must run for minimum %lu seconds (currently %lu)\n",
                  MIN_RUNTIME / 1000, runtime / 1000);
    return false;
  }
  if (runtime > MAX_RUNTIME) {
    Serial.println("🚨 SAFETY: Sprinkler maximum runtime exceeded - forcing OFF");
    return true;
  }
  return true;
}

bool isSprinklerManualOverrideActive() {
  if (!sprinklerManualOverride) return false;
  unsigned long dt = millis() - sprinklerLastManual;
  if (dt > MANUAL_OVERRIDE_TIMEOUT) {
    sprinklerManualOverride = false;
    Serial.println("🔄 Sprinkler manual override timeout - returning to auto mode");
    return false;
  }
  return true;
}

void checkSprinklerControl(float soilMoisturePercent) {
  if (!autoMode || isSprinklerManualOverrideActive()) return;
  unsigned long now = millis();
  if (sprinklerRelayState && (now - lastSprinklerCheck >= SPRINKLER_CHECK_INTERVAL)) {
    lastSprinklerCheck = now;
    if (!canTurnOffSprinkler()) return;
  }
  if (soilMoisturePercent < soilMoistureThreshold && !sprinklerRelayState) {
    setSprinklerRelay(true);
    Serial.printf("💧 Sprinkler AUTO-activated: Soil moisture %.1f%% < %.1f%%\n",
                  soilMoisturePercent, soilMoistureThreshold);
  } else if (soilMoisturePercent >= soilMoistureThreshold && sprinklerRelayState && canTurnOffSprinkler()) {
    setSprinklerRelay(false);
    Serial.printf("💧 Sprinkler AUTO-deactivated: Soil moisture %.1f%% ≥ %.1f%%\n",
                  soilMoisturePercent, soilMoistureThreshold);
  }
}

// ----------- Serial Commands Handler -----------
void handleSerialCommands() {
  if (Serial.available()) {
    String command = Serial.readString();
    command.trim();
    command.toUpperCase();

    if (command == "FAN_ON") {
      manualOverride = true;
      lastManualControl = millis();
      setFanRelay(true);
      Serial.println("🌀 Fan turned ON via serial command");
    }
    else if (command == "FAN_OFF") {
      manualOverride = true;
      lastManualControl = millis();
      setFanRelay(false);
      Serial.println("🌀 Fan turned OFF via serial command");
    }
    else if (command == "FAN_STATUS") {
      Serial.printf("🌀 Fan Status: %s\n", fanRelayState ? "ON" : "OFF");
      Serial.printf("🌡️ Current Temperature: %.2f°C\n", currentTemp);
      Serial.printf("🎯 Temperature Threshold: %.1f°C\n", tempThreshold);
      Serial.printf("🤖 Auto Mode: %s\n", autoMode ? "ON" : "OFF");
      Serial.printf("👆 Manual Override: %s\n", isManualOverrideActive() ? "ACTIVE" : "INACTIVE");
      Serial.printf("⚠️ DHT22 Failures: %d\n", dht22Failures);
    }
    else if (command == "HUMIDIFIER_ON") {
      humidifierManualOverride = true;
      humidifierLastManual = millis();
      setHumidifierRelay(true);
      Serial.println("💨 Humidifier turned ON via serial command");
    }
    else if (command == "HUMIDIFIER_OFF") {
      humidifierManualOverride = true;
      humidifierLastManual = millis();
      setHumidifierRelay(false);
      Serial.println("💨 Humidifier turned OFF via serial command");
    }
    else if (command == "SPRINKLER_ON") {
      sprinklerManualOverride = true;
      sprinklerLastManual = millis();
      setSprinklerRelay(true);
      Serial.println("💧 Sprinkler turned ON via serial command");
    }
    else if (command == "SPRINKLER_OFF") {
      sprinklerManualOverride = true;
      sprinklerLastManual = millis();
      setSprinklerRelay(false);
      Serial.println("💧 Sprinkler turned OFF via serial command");
    }
    else if (command.startsWith("SET_TEMP:")) {
      float newTemp = command.substring(9).toFloat();
      if (newTemp > 0 && newTemp < 50) {
        tempThreshold = newTemp;
        Serial.printf("🌡️ Temperature threshold set to: %.1f°C\n", tempThreshold);
      } else {
        Serial.println("❌ Invalid temperature. Use: SET_TEMP:30.5");
      }
    }
    else if (command.startsWith("SET_HUMIDITY:")) {
      float newH = command.substring(13).toFloat();
      if (newH >= 10 && newH <= 95) {
        humidityThreshold = newH;
        Serial.printf("💧 Humidity threshold set to: %.1f%%\n", humidityThreshold);
      } else {
        Serial.println("❌ Invalid humidity. Use: SET_HUMIDITY:55");
      }
    }
    else if (command.startsWith("SET_SOIL:")) {
      float newS = command.substring(9).toFloat();
      if (newS >= 5 && newS <= 90) {
        soilMoistureThreshold = newS;
        Serial.printf("🌱 Soil moisture threshold set to: %.1f%%\n", soilMoistureThreshold);
      } else {
        Serial.println("❌ Invalid soil moisture. Use: SET_SOIL:35");
      }
    }
    else if (command == "AUTO_ON") {
      autoMode = true;
      Serial.println("🤖 Auto mode enabled");
    }
    else if (command == "AUTO_OFF") {
      autoMode = false;
      Serial.println("🤖 Auto mode disabled");
    }
    else if (command == "SENSOR_TEST") {
      Serial.println("🧪 Testing DHT22 sensor...");
      float temp, humidity;
      if (readDHT22WithRetry(temp, humidity)) {
        Serial.printf("✅ DHT22 Test PASSED - Temp: %.2f°C, Humidity: %.2f%%\n", temp, humidity);
      } else {
        Serial.println("❌ DHT22 Test FAILED");
      }
    }
    else if (command == "HELP") {
      Serial.println("📋 Available Commands:");
      Serial.println("   FAN_ON / FAN_OFF / FAN_STATUS");
      Serial.println("   HUMIDIFIER_ON / HUMIDIFIER_OFF");
      Serial.println("   SPRINKLER_ON / SPRINKLER_OFF");
      Serial.println("   SET_TEMP:30.5");
      Serial.println("   SET_HUMIDITY:55");
      Serial.println("   SET_SOIL:35");
      Serial.println("   AUTO_ON / AUTO_OFF");
      Serial.println("   SENSOR_TEST");
      Serial.println("   HELP");
    }
    else {
      Serial.println("❌ Unknown command. Type HELP for available commands.");
    }
  }
}

// ----------- Setup -----------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n🚀 Smart Greenhouse System Starting...");
  Serial.println("═══════════════════════════════════════");

  // Relays
  pinMode(FAN_RELAY_PIN, OUTPUT);
  digitalWrite(FAN_RELAY_PIN, HIGH); // OFF initially

  pinMode(HUMIDIFIER_RELAY_PIN, OUTPUT);
  digitalWrite(HUMIDIFIER_RELAY_PIN, HIGH); // OFF initially

  pinMode(SPRINKLER_RELAY_PIN, OUTPUT);
  digitalWrite(SPRINKLER_RELAY_PIN, HIGH); // OFF initially

  Serial.println("✅ Relay pins initialized (OFF state)");
  Serial.printf("   Fan: GPIO %d\n", FAN_RELAY_PIN);
  Serial.printf("   Humidifier: GPIO %d\n", HUMIDIFIER_RELAY_PIN);
  Serial.printf("   Sprinkler: GPIO %d\n", SPRINKLER_RELAY_PIN);

  // Initialize Modbus RS485 pins
  pinMode(DE_NPK, OUTPUT);   digitalWrite(DE_NPK, LOW);
  pinMode(RE_NPK, OUTPUT);   digitalWrite(RE_NPK, LOW);
  pinMode(DE_SOIL, OUTPUT);  digitalWrite(DE_SOIL, LOW);
  pinMode(RE_SOIL, OUTPUT);  digitalWrite(RE_SOIL, LOW);

  // Initialize UARTs for Modbus
  Serial1.begin(4800, SERIAL_8N1, RX_SOIL, TX_SOIL);  // Soil sensor
  Serial2.begin(4800, SERIAL_8N1, RX_NPK, TX_NPK);    // NPK sensor

  // Initialize Modbus nodes
  nodeNPK.begin(1, Serial2);
  nodeNPK.preTransmission(preTransmissionNPK);
  nodeNPK.postTransmission(postTransmissionNPK);

  nodeSoil.begin(1, Serial1);
  nodeSoil.preTransmission(preTransmissionSoil);
  nodeSoil.postTransmission(postTransmissionSoil);

  // DHT & I2C
  dht.begin();
  Wire.begin(25, 26);

  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire)) {
    Serial.println("💡 BH1750 initialized at 0x23");
  } else if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x5C, &Wire)) {
    Serial.println("💡 BH1750 initialized at 0x5C");
  } else {
    Serial.println("❌ BH1750 not detected! Check wiring.");
  }

  // Network/MQTT
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);

  Serial.println("\n✅ Smart Greenhouse System Ready!");
  Serial.println("═══════════════════════════════════════");
  Serial.println("📋 Type HELP for available commands");
  Serial.printf("🔌 MQTT Broker: %s:%d\n", mqtt_server, mqtt_port);
  Serial.printf("🔐 Authentication: %s / %s\n", mqtt_user, "********");
  Serial.printf("🆔 ClientID will be: ESP32ClientGreenhouse_[MAC]\n");
  Serial.println("═══════════════════════════════════════\n");

  // Initial sensor test
  Serial.println("🧪 Performing initial sensor test...");
  float temp, humidity;
  if (readDHT22WithRetry(temp, humidity)) {
    Serial.printf("✅ Initial DHT22 test PASSED - Temp: %.2f°C, Humidity: %.2f%%\n", temp, humidity);
  } else {
    Serial.println("❌ Initial DHT22 test FAILED - check wiring and power");
  }
  Serial.println();
}

// ----------- Main Loop -----------
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  handleSerialCommands();

  unsigned long currentTime = millis();

  if (currentTime - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = currentTime;
    readAllSensors();
  }

  // Fan runtime monitoring
  if (fanRelayState) {
    if (currentTime - lastFanCheck >= FAN_CHECK_INTERVAL) {
      lastFanCheck = currentTime;
      checkFanControl(currentTemp);
    }
  }

  // Humidifier runtime monitoring
  if (humidifierRelayState) {
    if (currentTime - lastHumidifierCheck >= HUMIDIFIER_CHECK_INTERVAL) {
      lastHumidifierCheck = currentTime;
      checkHumidifierControl(currentHumidity);
    }
  }

  // Sprinkler runtime monitoring
  if (sprinklerRelayState) {
    if (currentTime - lastSprinklerCheck >= SPRINKLER_CHECK_INTERVAL) {
      lastSprinklerCheck = currentTime;
      checkSprinklerControl(currentSoilMoisture);
    }
  }

  // Sensor health monitoring
  checkSensorHealth();
}

