#include "esp_camera.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <WebServer.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const int HTTP_PORT = 81;

const String FACILITY_ID = "quickwash_main";
const String DEVICE_ID = "esp32_cam_1";

WebServer camServer(HTTP_PORT);

// CAMERA_MODEL_AI_THINKER Pins
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WiFiClient espClient;
PubSubClient client(espClient);
long lastMsgTime = 0;

void handleMjpegStream() {
  WiFiClient client = camServer.client();
  client.setTimeout(10);

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println("Cache-Control: no-cache");
  client.println();
  client.flush();

  unsigned long lastFrame = 0;
  while (client.connected()) {
    // ~10 fps pacing (run inside its own task so MQTT never starves)
    if (millis() - lastFrame < 100) {
      delay(2);
      continue;
    }
    lastFrame = millis();

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      delay(10);
      continue;
    }

    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n");
    client.print("Content-Length: ");
    client.print(fb->len);
    client.print("\r\n\r\n");
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);
  }
  client.stop();
}

// The MJPEG stream handler blocks while a browser is connected, so it runs on
// core 0. loop() stays on core 1 and keeps MQTT heartbeats + reconnects alive.
void cameraServerTask(void* param) {
  for (;;) {
    camServer.handleClient();
    delay(2);
  }
}

void startCameraServer() {
  camServer.on("/", []() {
    camServer.send(200, "text/html",
      "<html><body><img src='/stream' style='width:100%%'/><script>location.reload()</script></body></html>");
  });
  camServer.on("/stream", handleMjpegStream);
  camServer.onNotFound([]() {
    camServer.send(404, "text/plain", "Not Found");
  });
  camServer.begin();
  xTaskCreatePinnedToCore(cameraServerTask, "cam_server", 8192, NULL, 1, NULL, 0);
  Serial.println("Camera stream server started (core 0)");
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
  Serial.print("Camera Stream URL: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":81/stream");
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
  
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // init with high specs to pre-allocate larger buffers
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  setup_wifi();
  
  startCameraServer();
  
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Heartbeat every 10 seconds to let hub know the camera is alive
  long now = millis();
  if (now - lastMsgTime > 10000) {
    lastMsgTime = now;
    String statusTopic = "quickwash/" + FACILITY_ID + "/status/" + DEVICE_ID;
    String ipAddress = WiFi.localIP().toString();
    String payload = "{\"status\":\"online\", \"stream_url\":\"http://" + ipAddress + ":81/stream\"}";
    client.publish(statusTopic.c_str(), payload.c_str());
  }
}
