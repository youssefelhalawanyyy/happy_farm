#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* INGEST_URL = "https://us-central1-booking-page-hertsu.cloudfunctions.net/ingestEnvironmentReading";
const char* API_KEY = "YOUR_ESP32_API_KEY";

float readTemperature() {
  return 29.3; // Replace with sensor reading
}

float readHumidity() {
  return 61.8; // Replace with sensor reading
}

float readAmmonia() {
  return 14.2; // Replace with sensor reading
}

bool readFanStatus() {
  return true;
}

bool readHeaterStatus() {
  return false;
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(INGEST_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", API_KEY);

    StaticJsonDocument<256> doc;
    doc["houseId"] = "House-A";
    doc["deviceId"] = "ESP32-A1";
    doc["temperatureC"] = readTemperature();
    doc["humidity"] = readHumidity();
    doc["ammoniaPpm"] = readAmmonia();
    doc["fanStatus"] = readFanStatus();
    doc["heaterStatus"] = readHeaterStatus();

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    String response = http.getString();

    Serial.print("HTTP Code: ");
    Serial.println(code);
    Serial.println(response);

    http.end();
  }

  delay(10000); // send every 10 seconds
}
