#include <WiFi.h>
#include <PubSubClient.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

const String FACILITY_ID = "quickwash_main";
const String DEVICE_ID = "esp32_vending";

// --- Pin Definitions ---
const int COIN_INTERRUPT_PIN = 4; // Use an interrupt-capable pin

// --- Globals ---
WiFiClient espClient;
PubSubClient client(espClient);

volatile int coinPulses = 0;
long lastMsgTime = 0;
long lastDebounceTime = 0;
long debounceDelay = 50; // ms

void IRAM_ATTR coinInserted() {
  long currentTime = millis();
  if ((currentTime - lastDebounceTime) > debounceDelay) {
    coinPulses++;
    lastDebounceTime = currentTime;
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(DEVICE_ID.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(COIN_INTERRUPT_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(COIN_INTERRUPT_PIN), coinInserted, FALLING);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Process accumulated pulses
  if (coinPulses > 0) {
    noInterrupts(); // Pause interrupts while we read/reset
    int pulsesToProcess = coinPulses;
    coinPulses = 0;
    interrupts();
    
    // Assuming 1 pulse = 1 coin (e.g., 5 PHP)
    // Adjust multiplier based on your actual coin acceptor configuration
    int amount = pulsesToProcess * 5; 
    
    // Publish under the sensor category so the IoT Bridge logs the transaction.
    // Expected contract: sensor/<device>/vending with event "coin_inserted".
    String topic = "quickwash/" + FACILITY_ID + "/sensor/" + DEVICE_ID + "/vending";
    String payload = "{\"event\":\"coin_inserted\", \"amount\":" + String(amount) + ", \"pulseCount\":" + String(pulsesToProcess) + "}";
    
    Serial.print("Publishing Coin Drop: ");
    Serial.println(payload);
    client.publish(topic.c_str(), payload.c_str());
  }

  // Heartbeat every 15 seconds so the hub's stale-sweeper never flags us
  long now = millis();
  if (now - lastMsgTime > 15000) {
    lastMsgTime = now;
    String statusTopic = "quickwash/" + FACILITY_ID + "/status/" + DEVICE_ID;
    String payload = "{\"status\":\"online\"}";
    client.publish(statusTopic.c_str(), payload.c_str());
  }
}
