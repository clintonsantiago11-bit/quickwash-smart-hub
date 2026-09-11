#include <WiFi.h>
#include <PubSubClient.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

const String FACILITY_ID = "quickwash_main";
const String DEVICE_ID = "esp32_bay_1";

// --- Pin Definitions ---
const int WATER_LEVEL_TRIG = 5;
const int WATER_LEVEL_ECHO = 18;
const int SOAP_LEVEL_TRIG = 19;
const int SOAP_LEVEL_ECHO = 21;
const int RELAY_WATER_PUMP = 22;
const int RELAY_SOAP_PUMP = 23;
const int JAM_SENSOR_PIN = 34; // Analog or Digital read depending on sensor

// --- Globals ---
WiFiClient espClient;
PubSubClient client(espClient);

long lastMsgTime = 0;
int waterLevel = 100;
int soapLevel = 100;
String currentStatus = "available";

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
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  String messageTemp;
  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    messageTemp += (char)message[i];
  }
  Serial.println();

  // Handle incoming commands
  if (String(topic) == "quickwash/" + FACILITY_ID + "/command/" + DEVICE_ID) {
    if (messageTemp.indexOf("reset_jam") >= 0) {
      Serial.println("Command received: Reset Jam");
      currentStatus = "available";
    } else if (messageTemp.indexOf("trigger_wash") >= 0) {
      Serial.println("Command received: Trigger Wash Cycle");
      currentStatus = "active";
      // Simulate relays turning on
      digitalWrite(RELAY_WATER_PUMP, HIGH);
      digitalWrite(RELAY_SOAP_PUMP, HIGH);
    } else if (messageTemp.indexOf("emergency_stop") >= 0) {
      Serial.println("Command received: Emergency Stop");
      currentStatus = "error";
      // Simulate relays turning off immediately
      digitalWrite(RELAY_WATER_PUMP, LOW);
      digitalWrite(RELAY_SOAP_PUMP, LOW);
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(DEVICE_ID.c_str())) {
      Serial.println("connected");
      // Subscribe to command topic
      String commandTopic = "quickwash/" + FACILITY_ID + "/command/" + DEVICE_ID;
      client.subscribe(commandTopic.c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// Function to read ultrasonic distance and map to percentage
int readLevel(int trigPin, int echoPin, int emptyDistance, int fullDistance) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
  if (duration == 0) return 0;
  
  float distance = duration * 0.034 / 2;
  // Map distance to percentage (lower distance = higher percentage)
  int percentage = map(distance, fullDistance, emptyDistance, 100, 0);
  percentage = constrain(percentage, 0, 100);
  return percentage;
}

void setup() {
  Serial.begin(115200);
  
  pinMode(WATER_LEVEL_TRIG, OUTPUT);
  pinMode(WATER_LEVEL_ECHO, INPUT);
  pinMode(SOAP_LEVEL_TRIG, OUTPUT);
  pinMode(SOAP_LEVEL_ECHO, INPUT);
  pinMode(RELAY_WATER_PUMP, OUTPUT);
  pinMode(RELAY_SOAP_PUMP, OUTPUT);
  pinMode(JAM_SENSOR_PIN, INPUT_PULLUP);
  
  digitalWrite(RELAY_WATER_PUMP, LOW);
  digitalWrite(RELAY_SOAP_PUMP, LOW);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  long now = millis();
  if (now - lastMsgTime > 5000) { // Publish every 5 seconds
    lastMsgTime = now;
    
    // Simulate or read actual sensors
    // waterLevel = readLevel(WATER_LEVEL_TRIG, WATER_LEVEL_ECHO, 100, 10);
    // soapLevel = readLevel(SOAP_LEVEL_TRIG, SOAP_LEVEL_ECHO, 50, 5);
    
    // Check for jams
    if (digitalRead(JAM_SENSOR_PIN) == LOW && currentStatus == "active") {
      currentStatus = "error";
      digitalWrite(RELAY_WATER_PUMP, LOW);
      digitalWrite(RELAY_SOAP_PUMP, LOW);
    }
    
    String statusTopic = "quickwash/" + FACILITY_ID + "/status/" + DEVICE_ID;
    String statusPayload = "{\"status\":\"" + currentStatus + "\"}";
    
    // Sensor readings (ultrasonic tank levels + simulated flow/temp)
    // Contract expected by the IoT Bridge: sensor/<device>/levels with
    // water/soap_a/soap_b/wax and sensor/<device>/flow_temp with flow_lpm/temp_c.
    String levelsTopic = "quickwash/" + FACILITY_ID + "/sensor/" + DEVICE_ID + "/levels";
    String levelsPayload = "{\"water\":" + String(waterLevel) + ", \"soap_a\":" + String(soapLevel) + ", \"soap_b\":" + String(soapLevel) + ", \"wax\":" + String(soapLevel) + "}";

    String flowTempTopic = "quickwash/" + FACILITY_ID + "/sensor/" + DEVICE_ID + "/flow_temp";
    String flowTempPayload = "{\"flow_lpm\":" + String(currentStatus == "active" ? 12.5 : 0.0) + ", \"temp_c\":" + String(28.5) + "}";
    
    Serial.print("Publishing status: ");
    Serial.println(statusPayload);
    client.publish(statusTopic.c_str(), statusPayload.c_str());
    client.publish(levelsTopic.c_str(), levelsPayload.c_str());
    client.publish(flowTempTopic.c_str(), flowTempPayload.c_str());
  }
}
