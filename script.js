// =========================================
// ORIGINAL FLOW LOGIC
// =========================================
const C = {
  plant: { t: 'Taif rose plant', d: 'The Taif rose being monitored.', r: 'Nothing. It is what the sensors measure.', s: 'Nothing.' },
  dht22: { t: 'DHT22', d: 'Measures air temperature and humidity.', r: 'The air around the plant.', s: 'Temperature and humidity to the ESP32 node (digital, 1 data pin).' },
  soil: { t: 'Capacitive soil moisture sensor', d: 'Measures soil moisture and reports it as an analog signal.', r: 'The soil around the roots.', s: 'An analog signal to the ESP32 node (ADC input).' },
  node: { t: 'ESP32 node', d: 'Reads both sensors, converts the soil reading to a percentage and builds one JSON message.', r: 'Digital data from the DHT22 and an analog signal from the soil sensor.', s: 'One JSON message to the gateway over ESP-NOW.' },
  gateway: { t: 'ESP32 gateway', d: 'Receives the node’s message over ESP-NOW and forwards it over Wi‑Fi to the backend.', r: 'JSON message over ESP-NOW.', s: 'The same message over Wi‑Fi as an HTTP POST (JSON).' },
  cam: { t: 'ESP32-CAM', d: 'A small ESP32 board with a camera. It takes photos of the plant so the backend can check them for disease.', r: 'What the camera sees: the plant.', s: 'Plant photos to the backend over Wi‑Fi (HTTP POST).', b: 'Planned: part of disease detection' },
  backend: { t: 'Backend (FastAPI + PostgreSQL)', d: 'Validates each reading and stores the history.', r: 'HTTP POST (JSON) from the gateway, and photos from the ESP32-CAM (planned).', s: 'Stored readings through a REST API (JSON).', b: 'Planned: disease detection with computer vision (healthy / powdery mildew / black spot)' },
  dashboard: { t: 'Dashboard', d: 'An Arabic (RTL) web page served by the backend (FastAPI). It shows temperature, humidity, soil moisture and plant status.', r: 'Readings through the REST API (JSON).', s: 'Nothing. It only displays.', b: 'Illustrative layout, not live data' },
  app: { t: 'Flutter mobile app', d: 'A mobile app that shows the same readings and plant status as the web dashboard, using the same REST API.', r: 'Readings through the REST API (JSON).', s: 'Nothing. It only displays.', b: 'Planned: the web dashboard comes first, Flutter comes back later' }
};

const S = [
  { t: 'Sense', d: 'The Taif rose is monitored by two sensors: a DHT22 for air temperature and humidity, and a capacitive sensor for soil moisture.', ids: ['plant', 'dht22', 'soil'], cs: [] },
  { t: 'Read', d: 'The ESP32 node reads the DHT22 (digital, 1 data pin) and the soil sensor (analog, ADC input), converts the soil reading to a percentage and builds one JSON message.', ids: ['dht22', 'soil', 'node'], cs: ['c1a', 'c1b'] },
  { t: 'Relay', d: 'The node sends that JSON message wirelessly over ESP-NOW to the ESP32 gateway.', ids: ['node', 'gateway'], cs: ['c2'] },
  { t: 'Store', d: 'The gateway forwards the message over Wi‑Fi as an HTTP POST. The backend validates each reading and stores the history.', ids: ['gateway', 'backend'], cs: ['c3a'] },
  { t: 'Capture (planned)', d: 'The ESP32-CAM takes photos of the plant and uploads them to the backend over Wi‑Fi. Disease detection with computer vision is planned.', ids: ['cam', 'backend'], cs: ['c3b'] },
  { t: 'Show', d: 'The web dashboard reads the stored data through a REST API (JSON) and shows temperature, humidity, soil moisture and plant status.', ids: ['backend', 'dashboard'], cs: ['c4a'] },
  { t: 'Mobile app (planned)', d: 'A Flutter mobile app uses the same REST API to show the same readings and plant status on a phone.', ids: ['backend', 'app'], cs: ['c4b'] }
];

const $ = (id) => document.getElementById(id);
const all = (selector) => [...document.querySelectorAll(selector)];
let step = -1;

function mark(ids, cs, play) {
  all('[data-id]').forEach((element) => {
    const on = ids.includes(element.dataset.id);
    element.classList.toggle('on', on);
    element.classList.toggle('dim', play && !on);
  });
  all('[data-c]').forEach((element) => {
    const on = cs.includes(element.dataset.c);
    element.classList.toggle('on', play && on);
    element.classList.toggle('dim', play && !on);
  });
}

function fill(title, description, receives, sends, badge, stepText) {
  $('pt').textContent = title;
  $('pd').textContent = description;
  $('pstep').textContent = stepText || '';
  $('rs').hidden = receives == null;
  if (receives != null) { $('pr').textContent = receives; $('ps').textContent = sends; }
  $('badge').hidden = !badge;
  $('badge').textContent = badge || '';
  $('panel').hidden = false;
  document.body.classList.add('has-panel');
}

function pick(id) {
  step = -1; $('nav').hidden = true;
  const component = C[id];
  mark([id], [], false);
  fill(component.t, component.d, component.r, component.s, component.b);
}

function show(index) {
  step = index;
  const stage = S[index];
  mark(stage.ids, stage.cs, true);
  fill(stage.t, stage.d, null, null, null, 'Step ' + (index + 1) + ' of ' + S.length);
  $('nav').hidden = false;
  $('back').disabled = index === 0;
  $('next').textContent = index === S.length - 1 ? 'Restart' : 'Next';
}

function close() {
  step = -1;
  mark([], [], false);
  $('panel').hidden = true;
  $('nav').hidden = true;
  document.body.classList.remove('has-panel');
}

all('[data-id]').forEach((element) => {
  element.addEventListener('click', () => pick(element.dataset.id));
});

$('play').onclick = () => show(0);
$('close').onclick = close;
$('stop').onclick = close;
$('back').onclick = () => show(Math.max(0, step - 1));
$('next').onclick = () => show(step === S.length - 1 ? 0 : step + 1);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') close();
  if (step >= 0 && event.key === 'ArrowRight') $('next').click();
  if (step > 0 && event.key === 'ArrowLeft') $('back').click();
});

// =========================================
// BACKEND SIMULATION LOGIC
// =========================================
const btnSensor = document.getElementById('btn-sensor');
const btnCamera = document.getElementById('btn-camera');
const logWindow = document.getElementById('log-window');
const dbTableBody = document.querySelector('#db-table tbody');
const arrows = document.querySelectorAll('.arrow');
let isSimulating = false;

function resetVisuals() {
  arrows.forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.comp').forEach(c => c.classList.remove('active'));
  isSimulating = false;
  btnSensor.disabled = false;
  btnCamera.disabled = false;
}

function addLog(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logWindow.appendChild(line);
  logWindow.scrollTop = logWindow.scrollHeight;
}

function addToDatabase(temp, hum, soil, status) {
  const tr = document.createElement('tr');
  let color = "var(--green)";
  if (status === "Warning" || status === "High Temp" || status === "Dry Soil" || status === "Heat & Drought" || status === "Heat & High Humidity") {
    color = "#ef4444";
  } else if (status === "Cold Stress") {
    color = "#3b82f6";
  }
  tr.innerHTML = `
    <td>${new Date().toLocaleTimeString()}</td>
    <td>${temp}°C</td>
    <td>${hum}%</td>
    <td>${soil}%</td>
    <td style="color: ${color}; font-weight: bold;">${status}</td>
  `;
  dbTableBody.prepend(tr);
}

btnSensor.addEventListener('click', async () => {
  if (isSimulating) return;
  isSimulating = true;
  btnSensor.disabled = true;
  btnCamera.disabled = true;

  document.querySelector('[data-id="dht22"]').classList.add('active');
  document.querySelector('[data-id="soil"]').classList.add('active');
  addLog("Sensors: Reading temperature, humidity, and soil moisture...", "info");
  await new Promise(r => setTimeout(r, 800));

  const temp = (25 + Math.random() * 10).toFixed(1);
  const hum = (50 + Math.random() * 20).toFixed(0);
  const soil = (20 + Math.random() * 30).toFixed(0);

  document.querySelector('.arrow[data-c="c1a"]').classList.add('active');
  document.querySelector('.arrow[data-c="c1b"]').classList.add('active');
  document.querySelector('[data-id="node"]').classList.add('active');
  addLog("ESP32: Processing sensor data into JSON...", "info");
  await new Promise(r => setTimeout(r, 800));

  document.querySelector('.arrow[data-c="c2"]').classList.add('active');
  document.querySelector('[data-id="gateway"]').classList.add('active');
  addLog("Gateway: Forwarding packet via Wi-Fi...", "info");
  await new Promise(r => setTimeout(r, 800));

  document.querySelector('.arrow[data-c="c3a"]').classList.add('active');
  document.querySelector('[data-id="backend"]').classList.add('active');
  addLog("FastAPI: Receiving HTTP POST /api/data", "info");
  await new Promise(r => setTimeout(r, 600));
  addLog("FastAPI: Validating schema... OK", "success");
  await new Promise(r => setTimeout(r, 600));

  let sensorStatus = "Healthy";
  const tNum = Number(temp);
  const sNum = Number(soil);
  const hNum = Number(hum);

  if (tNum > 30 && sNum < 30) {
    sensorStatus = "Heat & Drought";
    addLog("CRITICAL: Combined heat stress and drought detected!", "error");
  } else if (tNum > 30 && hNum > 80) {
    sensorStatus = "Heat & High Humidity";
    addLog("CRITICAL: High heat and humidity (Fungal Risk)!", "error");
  } else if (tNum > 30) {
    sensorStatus = "High Temp";
    addLog("Warning: High temperature detected!", "warn");
  } else if (tNum < 15) {
    sensorStatus = "Cold Stress";
    addLog("Warning: Temperature is too low.", "warn");
  } else if (sNum < 30) {
    sensorStatus = "Dry Soil";
    addLog("Warning: Soil moisture is too low!", "warn");
  } else {
    addLog("Status: Environmental conditions are optimal.", "success");
  }

  addLog("PostgreSQL: Inserting record into 'sensor_readings'", "success");
  addToDatabase(temp, hum, soil, sensorStatus);
  updateDashboard(temp, hum, soil, sensorStatus);
  addToHistory(temp, hum, soil, sensorStatus);
  await new Promise(r => setTimeout(r, 800));

  document.querySelector('[data-id="dashboard"]').classList.add('active');
  document.querySelector('[data-id="app"]').classList.add('active');
  addLog("Dashboard: UI updated with new data.", "success");

  setTimeout(() => resetVisuals(), 1500);
});

btnCamera.addEventListener('click', async () => {
  if (isSimulating) return;
  isSimulating = true;
  btnSensor.disabled = true;
  btnCamera.disabled = true;

  document.querySelector('[data-id="cam"]').classList.add('active');
  addLog("ESP32-CAM: Capturing photo...", "info");
  await new Promise(r => setTimeout(r, 1000));

  document.querySelector('.arrow[data-c="c3b"]').classList.add('active');
  document.querySelector('[data-id="backend"]').classList.add('active');
  addLog("FastAPI: Receiving image for AI analysis...", "info");
  await new Promise(r => setTimeout(r, 1200));

  addLog("YOLOv8 Model: Analyzing leaf image...", "warn");
  await new Promise(r => setTimeout(r, 1500));

  const diseases = ["Healthy", "Powdery Mildew", "Black Spot"];
  const result = diseases[Math.floor(Math.random() * diseases.length)];

  if (result === "Healthy") {
    addLog("AI Result: Healthy leaf detected.", "success");
  } else {
    addLog(`AI Result: ${result} detected!`, "error");
    addLog("Alert sent to farmer.", "warn");
  }

  document.querySelector('[data-id="dashboard"]').classList.add('active');
  document.querySelector('[data-id="app"]').classList.add('active');
  addLog("Dashboard: Diagnosis result displayed.", "success");

  setTimeout(() => resetVisuals(), 2000);
});

// =========================================
// LIVE DASHBOARD LOGIC
// =========================================
let chartData = { temp: [], hum: [] };
const maxDataPoints = 10;

function updateDashboard(temp, hum, soil, status) {
  document.getElementById('dash-temp').textContent = `${temp}°C`;
  document.getElementById('dash-hum').textContent = `${hum}%`;
  document.getElementById('dash-soil').textContent = `${soil}%`;

  const tempEl = document.getElementById('dash-temp');
  const soilEl = document.getElementById('dash-soil');

  if (status === "High Temp" || status === "Dry Soil" || status === "Heat & Drought" || status === "Heat & High Humidity") {
     tempEl.style.color = "#ef4444";
     soilEl.style.color = "#ef4444";
  } else {
     tempEl.style.color = "var(--ink)";
     soilEl.style.color = "var(--ink)";
  } 

  chartData.temp.push(parseFloat(temp));
  chartData.hum.push(parseFloat(hum));
  if (chartData.temp.length > maxDataPoints) {
    chartData.temp.shift();
    chartData.hum.shift();
  }

  renderChart();

  const alertBox = document.getElementById('dash-alerts');
  const alertDiv = document.createElement('div');
  if (status !== "Healthy") {
    alertDiv.style.cssText = "padding: 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 8px; color: #ef4444; font-size: 12px; margin-bottom: 8px;";
    alertDiv.innerHTML = `<b>Warning: ${status}</b><br>Sensor reading outside optimal range.`;
  } else {
    alertDiv.style.cssText = "padding: 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--green); border-radius: 8px; color: var(--green); font-size: 12px; margin-bottom: 8px;";
    alertDiv.innerHTML = `<b>Status: Optimal</b><br>All environmental parameters are normal.`;
  }
  alertBox.prepend(alertDiv);
  if (alertBox.children.length > 5) alertBox.lastChild.remove();




  // Update Phone Mockup Data
  const phoneTemp = document.getElementById('phone-temp');
  const phoneHum = document.getElementById('phone-hum');
  const phoneSoil = document.getElementById('phone-soil');
  const phoneStatus = document.getElementById('phone-status');

  if (phoneTemp) phoneTemp.textContent = `${temp}°`;
  if (phoneHum) phoneHum.textContent = `${hum}%`;
  if (phoneSoil) phoneSoil.textContent = `${soil}%`;

   if (phoneStatus) {
    // إزالة أي تنبيه قديم (إذا كان هناك أكثر من واحد)
    const parent = phoneStatus.parentNode;
    const oldAlerts = parent.querySelectorAll('.phone-alert');
    oldAlerts.forEach(alert => {
      if (alert !== phoneStatus) alert.remove();
    });

    // تحديث التنبيه الحالي
    if (status === "Healthy") {
      phoneStatus.style.background = "rgba(16, 185, 129, 0.15)";
      phoneStatus.style.borderColor = "#10b981";
      phoneStatus.style.color = "#10b981";
      phoneStatus.textContent = "✅ Optimal Conditions";
    } else {
      phoneStatus.style.background = "rgba(239, 68, 68, 0.15)";
      phoneStatus.style.borderColor = "#ef4444";
      phoneStatus.style.color = "#ef4444";
      phoneStatus.textContent = `⚠️ ${status}`;
    }
  }

    // Add to phone history
  if (typeof addToPhoneHistory === 'function') {
    addToPhoneHistory(temp, hum, soil, status);
  }





}

function addToHistory(temp, hum, soil, status) {
  const historyBox = document.getElementById('dash-history');

  if (historyBox.children.length === 1 && historyBox.children[0].textContent.includes('No readings yet')) {
    historyBox.innerHTML = '';
  }

  let borderColor = "var(--green)";
  let statusText = "Optimal Conditions";
  let icon = "✅";
  let actionText = "No action required. Keep monitoring.";

  if (status === "High Temp") {
    borderColor = "#ef4444";
    statusText = "High Temperature Alert";
    icon = "🔥";
    actionText = "Increase shade or irrigate during early morning.";
  } else if (status === "Dry Soil") {
    borderColor = "#f59e0b";
    statusText = "Low Soil Moisture";
    icon = "💧";
    actionText = "Irrigation recommended immediately.";
  } else if (status === "Cold Stress") {
    borderColor = "#3b82f6";
    statusText = "Cold Stress Detected";
    icon = "❄️";
    actionText = "Cover plants at night to prevent frost damage.";
  } else if (status === "Heat & Drought") {
    borderColor = "#dc2626";
    statusText = "Critical: Heat & Drought";
    icon = "🚨";
    actionText = "Emergency irrigation required! Provide shade immediately.";
  } else if (status === "Heat & High Humidity") {
    borderColor = "#ea580c";
    statusText = "High Fungal Risk";
    icon = "🍄";
    actionText = "Improve airflow and apply preventive fungicide.";
  }

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

  const item = document.createElement('div');
  item.style.cssText = `
    display: grid;
    grid-template-columns: 60px 1fr auto;
    align-items: center;
    gap: 15px;
    background: var(--bg);
    border-left: 4px solid ${borderColor};
    border-radius: 8px;
    padding: 10px 15px;
    font-size: 13px;
    animation: fadeIn 0.3s ease;
    margin-bottom: 8px;
  `;

  item.innerHTML = `
    <div style="text-align: center; color: var(--muted); font-size: 11px;">
      <b style="display: block; color: var(--ink); font-size: 14px;">${time}</b>
      ${date}
    </div>
    <div>
      <div style="font-weight: bold; margin-bottom: 2px;">${icon} ${statusText}</div>
      <div style="color: var(--muted); font-size: 12px;">${actionText}</div>
    </div>
    <div style="display: flex; gap: 8px; font-family: monospace; font-size: 12px;">
      <span style="background: rgba(225,29,116,0.1); color: var(--accent); padding: 2px 6px; border-radius: 4px;">${temp}°C</span>
      <span style="background: rgba(56,189,248,0.1); color: #3b82f6; padding: 2px 6px; border-radius: 4px;">${hum}%</span>
      <span style="background: rgba(16,185,129,0.1); color: var(--green); padding: 2px 6px; border-radius: 4px;">${soil}%</span>
    </div>
  `;

  historyBox.prepend(item);

  if (historyBox.children.length > 5) {
    historyBox.lastChild.remove();
  }
}

function renderChart() {
  const tempLine = document.getElementById('temp-line');
  const humLine = document.getElementById('hum-line');
  const tempArea = document.getElementById('temp-area');

  const width = 400;
  const height = 150;
  const stepX = width / (maxDataPoints - 1);

  let tempPoints = [];
  let humPoints = [];

  chartData.temp.forEach((val, i) => {
    const yTemp = height - ((val - 15) / (40 - 15)) * height;
    tempPoints.push(`${i * stepX},${yTemp}`);

    const yHum = height - ((chartData.hum[i]) / 100) * height;
    humPoints.push(`${i * stepX},${yHum}`);
  });

  tempLine.setAttribute('points', tempPoints.join(' '));
  humLine.setAttribute('points', humPoints.join(' '));

  if (tempPoints.length > 0) {
    tempArea.setAttribute('points', `0,${height} ` + tempPoints.join(' ') + ` ${(chartData.temp.length - 1) * stepX},${height}`);
  }
}




// =========================================
// TECH STACK CAROUSEL LOGIC
// =========================================
const hardwareItems = [
  { name: 'ESP32 Node', desc: 'Main microcontroller for sensor reading and wireless transmission.', img: 'images/esp32.jpeg', fallback: 'https://cdn-icons-png.flaticon.com/512/2103/2103391.png' },
  { name: 'DHT22 Sensor', desc: 'Measures air temperature and relative humidity with high accuracy.', img: 'images/dht22.jpeg', fallback: 'https://cdn-icons-png.flaticon.com/512/2933/2933221.png' },
  { name: 'Capacitive Soil Sensor', desc: 'Measures soil moisture levels using capacitive sensing (v1.2).', img: 'images/soil.jpeg', fallback: 'https://cdn-icons-png.flaticon.com/512/3125/3125732.png' },
  { name: 'ESP32 Gateway', desc: 'Receives ESP-NOW packets and forwards them via Wi-Fi to the backend.', img: 'images/gateway.jpeg', fallback: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png' },
  { name: 'ESP32-CAM', desc: 'Captures plant images for AI-based disease detection.', img: 'images/cam.jpeg', fallback: 'https://cdn-icons-png.flaticon.com/512/685/685655.png' },
  { name: 'Taif Rose Plant', desc: 'The monitored plant (Rosa damascena trigintipetala).', img: 'images/plant.png', fallback: 'https://cdn-icons-png.flaticon.com/512/1884/1884894.png' }
];

const softwareItems = [
  { name: 'FastAPI', desc: 'High-performance Python backend framework for REST APIs.', icon: '🐍', bg: '#10b981' },
  { name: 'PostgreSQL', desc: 'Robust relational database for storing sensor history and AI results.', icon: '🐘', bg: '#336791' },
  { name: 'YOLOv8 (PyTorch)', desc: 'State-of-the-art object detection for leaf disease localization.', icon: '👁️', bg: '#e11d74' },
  { name: 'MobileNetV3', desc: 'Lightweight CNN for fast image-level leaf classification.', icon: '🧠', bg: '#f59e0b' },
  { name: 'Flutter', desc: 'Cross-platform mobile app framework for the farmer interface.', icon: '📱', bg: '#02569b' }
];

let hwIndex = 0;
let swIndex = 0;

function updateHardware() {
  const item = hardwareItems[hwIndex];
  document.getElementById('hw-name').textContent = item.name;
  document.getElementById('hw-desc').textContent = item.desc;
  const img = document.getElementById('hw-image');
  img.src = item.img;
  img.onerror = function() { this.src = item.fallback; };
  document.getElementById('hw-counter').textContent = `${hwIndex + 1} / ${hardwareItems.length}`;
}

function updateSoftware() {
  const item = softwareItems[swIndex];
  document.getElementById('sw-name').textContent = item.name;
  document.getElementById('sw-desc').textContent = item.desc;
  const iconDiv = document.getElementById('sw-icon');
  iconDiv.textContent = item.icon;
  iconDiv.style.background = item.bg;
  document.getElementById('sw-counter').textContent = `${swIndex + 1} / ${softwareItems.length}`;
}

document.getElementById('hw-prev').addEventListener('click', () => {
  hwIndex = (hwIndex - 1 + hardwareItems.length) % hardwareItems.length;
  updateHardware();
});
document.getElementById('hw-next').addEventListener('click', () => {
  hwIndex = (hwIndex + 1) % hardwareItems.length;
  updateHardware();
});
document.getElementById('sw-prev').addEventListener('click', () => {
  swIndex = (swIndex - 1 + softwareItems.length) % softwareItems.length;
  updateSoftware();
});
document.getElementById('sw-next').addEventListener('click', () => {
  swIndex = (swIndex + 1) % softwareItems.length;
  updateSoftware();
});

// Initialize
updateHardware();
updateSoftware();   

// Live Clock for Phone Mockup
function updatePhoneTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const phoneTime = document.getElementById('phone-time');
  if (phoneTime) phoneTime.textContent = timeStr;
}
setInterval(updatePhoneTime, 1000);
updatePhoneTime();





// =========================================
// PHONE HISTORY LOG LOGIC
// =========================================
function addToPhoneHistory(temp, hum, soil, status) {
  const list = document.getElementById('phone-history-list');
  if (!list) return;

  // إزالة رسالة "لا توجد قراءات"
  const emptyMsg = list.querySelector('.phone-history-empty');
  if (emptyMsg) emptyMsg.remove();

  let icon = '✅';
  let text = 'Optimal';

  if (status === 'High Temp') { icon = '🔥'; text = 'High Temp'; }
  else if (status === 'Dry Soil') { icon = '💧'; text = 'Dry Soil'; }
  else if (status === 'Cold Stress') { icon = '❄️'; text = 'Cold Stress'; }
  else if (status === 'Heat & Drought') { icon = '🚨'; text = 'Heat & Drought'; }
  else if (status === 'Heat & High Humidity') { icon = '🍄'; text = 'Fungal Risk'; }

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = 'phone-history-item';
  div.innerHTML = `
    <span class="phone-history-icon">${icon}</span>
    <span class="phone-history-text">${text} (${temp}°C)</span>
    <span class="phone-history-time">${time}</span>
  `;

  list.prepend(div);

  // إبقاء آخر 3 قراءات فقط
  if (list.children.length > 3) {
    list.lastChild.remove();
  }
}