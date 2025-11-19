#!/bin/bash
# Test MQTT connection and send sample data
# Requires mosquitto_pub and mosquitto_sub to be installed

echo "========================================"
echo "Smart Greenhouse MQTT Test Utility"
echo "========================================"
echo ""

BROKER="192.168.1.29"
PORT="1883"
USER="myuser"
PASS="*smart2025!"

echo "Testing MQTT connection to $BROKER:$PORT"
echo ""

echo "Sending test data..."
echo ""

echo "[1/6] Temperature: 25.5 °C"
mosquitto_pub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/temperature" -m "25.5"

echo "[2/6] Humidity: 65.0 %"
mosquitto_pub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/humidity" -m "65.0"

echo "[3/6] Light: 1200 lux"
mosquitto_pub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/light" -m "1200"

echo "[4/6] Nitrogen: 45 mg/kg"
mosquitto_pub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/nitrogen" -m "45"

echo "[5/6] Phosphorus: 38 mg/kg"
mosquitto_pub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/phosphorus" -m "38"

echo "[6/6] Potassium: 52 mg/kg"
mosquitto_pub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/potassium" -m "52"

echo ""
echo "Test data sent! Check your dashboard for updates."
echo ""

echo "Starting continuous monitoring (Ctrl+C to stop)..."
mosquitto_sub -h $BROKER -p $PORT -u $USER -P "$PASS" -t "greenhouse/#" -v

