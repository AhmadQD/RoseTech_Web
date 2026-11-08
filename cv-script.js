// SAMPLE CASES DATASET
const CASES = {
  healthy: {
    name: 'Healthy Taif Rose Leaf',
    rawClass: 'healthy',
    probs: { healthy: 0.982, mildew: 0.011, spot: 0.007 },
    latency: '34 ms',
    lesionsSvg: '',
    boxes: [],
    guidance: 'No visible foliar disease symptoms. Maintain standard irrigation schedule and monitor canopy humidity.',
    sensor: '<b>Temp:</b> 24.2°C · <b>Humidity:</b> 56% · <b>Soil:</b> 44%<br><span style="color:#10b981;">✓ Microclimate within optimal Taif Rose bounds.</span>'
  },
  mildew: {
    name: 'Powdery Mildew (Podosphaera pannosa)',
    rawClass: 'powdery_mildew',
    probs: { healthy: 0.024, mildew: 0.941, spot: 0.035 },
    latency: '41 ms',
    lesionsSvg: `
      <circle cx="98" cy="92" r="18" fill="#f8fafc" opacity="0.82"/>
      <circle cx="112" cy="102" r="14" fill="#e2e8f0" opacity="0.88"/>
      <circle cx="142" cy="128" r="20" fill="#f8fafc" opacity="0.80"/>
      <circle cx="105" cy="150" r="15" fill="#f1f5f9" opacity="0.85"/>
    `,
    boxes: [
      { top: '24%', left: '34%', width: '36%', height: '30%', label: 'powdery_mildew 0.94' },
      { top: '46%', left: '38%', width: '32%', height: '26%', label: 'powdery_mildew 0.89' }
    ],
    guidance: 'Fungal mycelial patches detected. Prune heavily infected shoots, reduce overhead wetting, and apply sulfur-based fungicide early morning.',
    sensor: '<b>Temp:</b> 21.8°C · <b>Humidity:</b> 84% (HIGH) · <b>Soil:</b> 49%<br><span style="color:#ef4444;">⚠️ High relative humidity (>80%) accelerated mildew outbreak.</span>'
  },
  blackspot: {
    name: 'Black Spot (Diplocarpon rosae)',
    rawClass: 'black_spot',
    probs: { healthy: 0.031, mildew: 0.054, spot: 0.915 },
    latency: '39 ms',
    lesionsSvg: `
      <circle cx="96" cy="105" r="13" fill="#111827" stroke="#eab308" stroke-width="3.5"/>
      <circle cx="144" cy="118" r="15" fill="#111827" stroke="#eab308" stroke-width="4"/>
      <circle cx="116" cy="156" r="12" fill="#111827" stroke="#eab308" stroke-width="3"/>
    `,
    boxes: [
      { top: '32%', left: '32%', width: '42%', height: '44%', label: 'black_spot 0.92' }
    ],
    guidance: 'Circular necrotic spots with chlorotic yellow halos detected. Remove fallen leaves around the root zone and improve airflow between bushes.',
    sensor: '<b>Temp:</b> 23.5°C · <b>Humidity:</b> 79% · <b>Soil:</b> 62%<br><span style="color:#f59e0b;">⚠️ Prolonged leaf wetness detected by field node.</span>'
  },
  uncertain: {
    name: 'Ambiguous Leaf Symptom',
    rawClass: 'powdery_mildew',
    probs: { healthy: 0.310, mildew: 0.540, spot: 0.150 },
    latency: '44 ms',
    lesionsSvg: `
      <ellipse cx="132" cy="115" rx="18" ry="12" fill="#cbd5e1" opacity="0.45"/>
      <circle cx="102" cy="145" r="9" fill="#78350f" opacity="0.55"/>
    `,
    boxes: [
      { top: '34%', left: '36%', width: '34%', height: '34%', label: 'uncertain 0.54' }
    ],
    guidance: 'Prediction confidence is below the validation threshold. Do not apply chemical treatment yet; capture a clearer macro photo or consult an agricultural specialist.',
    sensor: '<b>Temp:</b> 26.1°C · <b>Humidity:</b> 61% · <b>Soil:</b> 38%<br><span style="color:#38bdf8;">ℹ️ Escalated to specialist review queue in PostgreSQL.</span>'
  }
};

let state = {
  currentCase: 'healthy',
  arch: 'yolov8',
  threshold: 0.75,
  codeTab: 'json'
};

const $ = id => document.getElementById(id);

function triggerLaser() {
  const laser = $('laser');
  laser.classList.remove('scanning');
  void laser.offsetWidth;
  laser.classList.add('scanning');
}

function renderSandbox(animate = false) {
  if (animate) triggerLaser();

  const c = CASES[state.currentCase];
  const topConf = Math.max(c.probs.healthy, c.probs.mildew, c.probs.spot);
  const isUncertain = topConf < state.threshold;

  $('hudModel').textContent = state.arch === 'yolov8' ? 'MODEL: YOLOv8s-det' : 'MODEL: MobileNetV3-cls';
  $('hudLatency').textContent = `INFERENCE: ${state.arch === 'yolov8' ? c.latency : '19 ms'}`;
  $('pipeArchText').textContent = state.arch === 'yolov8' ? 'YOLOv8s-det (Bounding Box)' : 'MobileNetV3 (Image-Level)';
  $('pipeGateText').textContent = isUncertain
    ? `Conf ${topConf.toFixed(2)} < ${state.threshold.toFixed(2)} → Flagged`
    : `Conf ${topConf.toFixed(2)} ≥ ${state.threshold.toFixed(2)} → Validated`;

  $('lesionLayer').innerHTML = c.lesionsSvg;

  const boxWrap = $('bboxContainer');
  boxWrap.innerHTML = '';
  if (state.arch === 'yolov8' && c.boxes.length > 0) {
    c.boxes.forEach(b => {
      const div = document.createElement('div');
      div.className = 'bbox';
      div.style.top = b.top;
      div.style.left = b.left;
      div.style.width = b.width;
      div.style.height = b.height;
      const borderCol = isUncertain ? '#f59e0b' : '#ef4444';
      div.style.borderColor = borderCol;
      div.innerHTML = `<span class="bbox-label" style="background:${borderCol}">${isUncertain ? 'uncertain_roi ' + topConf.toFixed(2) : b.label}</span>`;
      boxWrap.appendChild(div);
    });
  }

  const pill = $('predBadge');
  if (isUncertain) {
    $('predTitle').textContent = `Uncertain Assessment (${c.name})`;
    pill.textContent = `FLAGGED FOR SPECIALIST · ${(topConf * 100).toFixed(1)}%`;
    pill.style.background = 'rgba(245, 158, 11, 0.18)';
    pill.style.color = '#fbbf24';
    $('guideEn').textContent = 'Confidence score fell below the selected validation threshold (' + Math.round(state.threshold * 100) + '%). Flagged for manual agricultural inspection before fungicide application.';
  } else {
    $('predTitle').textContent = c.name;
    pill.textContent = `VALIDATED · ${(topConf * 100).toFixed(1)}%`;
    const isHealthy = c.rawClass === 'healthy';
    pill.style.background = isHealthy ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)';
    pill.style.color = isHealthy ? '#34d399' : '#f87171';
    $('guideEn').textContent = c.guidance;
  }

  $('sensorContext').innerHTML = c.sensor;

  $('barHealthy').style.width = (c.probs.healthy * 100).toFixed(1) + '%';
  $('valHealthy').textContent = (c.probs.healthy * 100).toFixed(1) + '%';
  $('barMildew').style.width = (c.probs.mildew * 100).toFixed(1) + '%';
  $('valMildew').textContent = (c.probs.mildew * 100).toFixed(1) + '%';
  $('barSpot').style.width = (c.probs.spot * 100).toFixed(1) + '%';
  $('valSpot').textContent = (c.probs.spot * 100).toFixed(1) + '%';

  updateCodeBlock(c, topConf, isUncertain);
}

function updateCodeBlock(c, topConf, isUncertain) {
  const finalLabel = isUncertain ? 'uncertain' : c.rawClass;
  const modelTag = state.arch === 'yolov8' ? 'yolov8s-rosetech-v1.pt' : 'mobilenetv3-rosetech-v1.pt';

  if (state.codeTab === 'json') {
    const payload = {
      assessment_id: "a8f92c11-4b7d-4e92-9c1a-7782e5c1049b",
      model_architecture: modelTag,
      input_tensor_shape: [1, 3, 640, 640],
      predicted_class: finalLabel,
      raw_top_class: c.rawClass,
      confidence: Number(topConf.toFixed(3)),
      validation_threshold: state.threshold,
      is_uncertain: isUncertain,
      requires_specialist_review: isUncertain,
      bounding_boxes: state.arch === 'yolov8' ? c.boxes.map(b => b.label) : [],
      timestamp: "2026-11-08T10:15:42Z"
    };
    $('codeDisplay').textContent = JSON.stringify(payload, null, 2);
  } else if (state.codeTab === 'sql') {
    $('codeDisplay').textContent =
`-- PostgreSQL Persistence (FastAPI SQLAlchemy Session)
INSERT INTO leaf_assessments (
    assessment_id,
    image_url,
    predicted_class,
    confidence,
    is_uncertain,
    model_version,
    assessed_at
) VALUES (
    'a8f92c11-4b7d-4e92-9c1a-7782e5c1049b',
    's3://rosetech-taif-leaves/2026-11-08/leaf_capture.jpg',
    '${finalLabel}',
    ${topConf.toFixed(3)},
    ${isUncertain ? 'TRUE' : 'FALSE'},
    '${modelTag}',
    NOW()
) RETURNING assessment_id;`;
  } else {
    $('codeDisplay').textContent =
`# FastAPI Computer Vision Endpoint (PyTorch + OpenCV)
@app.post("/api/v1/vision/predict")
async def assess_rose_leaf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    img_bytes = await file.read()
    tensor = preprocess_opencv(img_bytes, size=(640, 640)) # Resize & Normalize
    
    with torch.no_grad():
        preds = model(tensor) # ${modelTag}
        
    is_uncertain = preds.top_conf < ${state.threshold.toFixed(2)}
    label = "uncertain" if is_uncertain else preds.class_name
    return crud.log_leaf_assessment(db, label, preds.top_conf, is_uncertain)`;
  }
}

// EVENT LISTENERS
document.querySelectorAll('.s-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.s-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('customImg').hidden = true;
    $('leafSvg').style.display = 'block';
    state.currentCase = btn.dataset.case;
    renderSandbox(true);
  });
});

document.querySelectorAll('.m-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.arch = btn.dataset.arch;
    $('archHint').textContent = state.arch === 'yolov8'
      ? 'Localization + Classification'
      : 'Fast Whole-Image Classification';
    renderSandbox(true);
  });
});

$('threshSlider').addEventListener('input', e => {
  state.threshold = parseFloat(e.target.value);
  $('threshVal').textContent = `${state.threshold.toFixed(2)} (${Math.round(state.threshold * 100)}%)`;
  renderSandbox(false);
});

document.querySelectorAll('.c-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.c-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.codeTab = tab.dataset.code;
    renderSandbox(false);
  });
});

$('rescanBtn').addEventListener('click', () => renderSandbox(true));

$('uploadInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    $('leafSvg').style.display = 'none';
    const img = $('customImg');
    img.src = ev.target.result;
    img.hidden = false;
    state.currentCase = 'mildew';
    renderSandbox(true);
  };
  reader.readAsDataURL(file);
});

$('themeToggle').addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
  $('themeToggle').textContent = isLight ? '☀️ Light Mode' : '🌙 Dark Mode';
});

renderSandbox(false);