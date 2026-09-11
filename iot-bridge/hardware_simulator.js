/**
 * QuickWash Smart Hub - Hardware Simulator (Virtual ESP32)
 * 
 * This script pretends to be the physical ESP32 installed in the wash bay.
 * It publishes simulated sensor data (water level, jam status, coin pulses)
 * to the MQTT broker, so we can test the dashboard without physical hardware.
 */

const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const FACILITY_ID = 'quickwash_main';
const DEVICE_ID = 'esp32_bay_1';

console.log(`Connecting Virtual ESP32 to MQTT Broker: ${MQTT_BROKER}...`);
const client = mqtt.connect(MQTT_BROKER);

// State variables for our virtual bay
let isWashing = true;
let cycleProgress = 65;
let waterLevel = 72;
let soapLevel = 18;
let hasJam = false;

client.on('connect', () => {
  console.log('✅ Virtual ESP32 Connected');
  
  // Subscribe to commands from the dashboard (e.g., remote reset)
  client.subscribe(`quickwash/${FACILITY_ID}/command/${DEVICE_ID}`);

  // Start the simulation loop
  simulateHardware();
});

client.on('message', (topic, message) => {
  console.log(`[Hardware Rx] Received command on ${topic}`);
  try {
    const cmd = JSON.parse(message.toString());
    if (cmd.action === 'reset_jam') {
      console.log('🛠️ Executing remote jam reset...');
      hasJam = false;
      isWashing = true;
      publishStatus();
    }
  } catch(e) {}
});

function publish(subTopic, payload) {
  const topic = `quickwash/${FACILITY_ID}/${subTopic}`;
  client.publish(topic, JSON.stringify(payload));
}

function publishStatus() {
  // Wash process stages: Wash (water) -> Soap -> Dry
  const stage = !isWashing || hasJam
    ? 'Standby'
    : cycleProgress < 34 ? 'Wash Cycle'
    : cycleProgress < 67 ? 'Soap Cycle'
    : 'Dry Cycle';

  // Publish overall bay status
  publish(`status/${DEVICE_ID}`, {
    status: hasJam ? 'error' : (isWashing ? 'active' : 'available'),
    progress: isWashing ? cycleProgress : 0,
    currentCycle: stage,
    type: 'Premium'
  });

  // Publish sensor levels (ultrasonic sensors for tanks)
  publish(`sensor/${DEVICE_ID}/levels`, {
    water: waterLevel,
    soap_a: soapLevel,
    soap_b: 85
  });
  
  // Publish flow & temp (flow meter & DHT22)
  publish(`sensor/${DEVICE_ID}/flow_temp`, {
    flow_lpm: parseFloat(isWashing && !hasJam ? (10 + Math.random() * 4).toFixed(1) : 0),
    temp_c: 28 + (Math.random() * 2)
  });
}

function simulateHardware() {
  // Every 3 seconds, update sensors and publish
  setInterval(() => {
    if (isWashing && !hasJam) {
      // Advance progress
      cycleProgress += 2;
      if (cycleProgress > 100) {
        cycleProgress = 0;
        isWashing = false; // wash finished
      }
      
      // Consume water and soap slightly
      waterLevel -= 0.5;
      soapLevel -= 0.1;
      
      if (waterLevel <= 0) waterLevel = 100; // auto-refill simulation
      if (soapLevel <= 0) soapLevel = 100;
    }

    publishStatus();
  }, 3000);

  // Simulate a machine JAM every 45 seconds while a wash is running.
  // The status publish below is enough - the bridge raises/refreshes the
  // JAM_ERROR alert from status:error and auto-resolves it when the bay
  // reports healthy again (after reset_jam).
  setInterval(() => {
    if (isWashing && !hasJam) {
      console.log('🚨 SIMULATING A JAM ERROR!');
      hasJam = true;
      publishStatus();
    }
  }, 45000);

  // Simulate vending machine coin insertion every 20 seconds
  /**
   * EXPLANATION: How Coin Acceptors Work
   * A standard coin acceptor (like the CH-926) has a single output wire connected
   * to a digital pin on the ESP32. When a coin is inserted, it sends rapid 5V pulses.
   * - 5 Peso coin = 5 pulses
   * - 1 Peso coin = 1 pulse
   * 
   * The ESP32 counts these pulses using an "interrupt" routine. If 500ms passes
   * with no new pulses, the ESP32 concludes the coin has finished dropping, totals
   * the value, and sends this MQTT message below to report the income.
   */
  setInterval(() => {
    const coinValue = Math.random() > 0.5 ? 5 : 10; // 5 or 10 peso coin
    console.log(`🪙 SIMULATING COIN INSERTION: ${coinValue} Pesos`);

    // Vending transactions are attributed to the dedicated vending node device
    publish(`sensor/esp32_vending/vending`, {
      event: 'coin_inserted',
      amount: coinValue,
      pulseCount: coinValue // Assuming 1 pulse = 1 peso
    });
  }, 20000);
}
