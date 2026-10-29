# NeoGuard Prototype

**Neonatal Multi-Parameter Vital Sign Monitor — Student Engineering Project**

> ⚠ **PROTOTYPE — SIMULATED DATA — NOT A MEDICAL DEVICE — NOT FOR CLINICAL USE**
>
> All thresholds and weights are placeholder demo values. This system has not been clinically validated
> and must not be used for patient care or clinical decision-making.

---

## Quick Start

### Option 1: Just open it (simplest)

1. Double-click `index.html` in this folder — it opens in your browser.
2. The dashboard starts immediately with **simulated data**.
3. No internet, no server, no install needed.

> **Note:** When opened via `file://`, the ML risk card will show "training in progress" because
> `model.json` cannot be loaded via `fetch()` from the file system. This is expected and the app
> works perfectly without it.

### Option 2: Use a local server (enables model.json loading)

```bash
# Python
cd NeoGuard-Demo
python -m http.server 8000
# Then open http://localhost:8000

# Or Node.js
npx -y serve .
```

With a server, `model.json` loads and the ML card shows computed risk probabilities.

---

## Project Structure

```
NeoGuard-Demo/
├── index.html          # Single-page app — all 4 screens
├── model.json          # Optional ML model coefficients (demo)
├── README.md           # This file
│
├── css/
│   └── styles.css      # Full stylesheet with light/dark themes
│
└── js/
    ├── config.js       # ⚠ ALL thresholds — DEMO ONLY
    ├── severity.js     # Composite Severity Index calculator
    ├── simulator.js    # Noisy vital sign data generator
    ├── serial.js       # Web Serial API for Aries v3
    ├── ml-risk.js      # ML risk probability estimator
    ├── charts.js       # Canvas chart library (zero deps)
    ├── alerts.js       # Alert log manager
    ├── export.js       # CSV session exporter
    ├── ui.js           # DOM updates and rendering
    ├── app.js          # Main orchestrator
    └── tests.js        # Self-check tests (runs on load)
```

---

## How to Edit config.js

Open `js/config.js` in any text editor. All values are in one clearly labelled object:

```js
NeoGuard.config = {
  vitals: {
    hr: {
      low: 120,           // Lower bound of normal range (bpm)
      high: 160,          // Upper bound
      criticalDist: 40,   // Distance to reach max severity
      weight: 30,         // Relative weight in severity index
      alarmLow: 100,      // Alert threshold
      alarmHigh: 180,
    },
    spo2: { ... },
    temp: { ... },
    motion: { unreliableThreshold: 70, weight: 10 },
  },
  severity: {
    categories: [
      { max: 30, label: 'Stable' },
      { max: 60, label: 'Watch' },
      { max: 100, label: 'Alert' },
    ]
  }
};
```

**All values are placeholder demo numbers.** Replace them with clinically validated thresholds
before any real-world use.

---

## How to Load model.json

The ML risk card supports loading a logistic regression model from `model.json` in the project root:

```json
{
  "weights": [0.5, -0.3],
  "means": [140, 95],
  "scales": [20, 5],
  "bias": -1.0,
  "threshold": 0.5,
  "features": ["hr_mean", "spo2_mean"]
}
```

| Field       | Description                                      |
|------------|--------------------------------------------------|
| `weights`  | Logistic regression coefficients                  |
| `means`    | Feature means for standardisation                 |
| `scales`   | Feature standard deviations for standardisation   |
| `bias`     | Intercept / bias term                             |
| `threshold`| Probability threshold for "high risk" label       |
| `features` | Feature names (for documentation)                 |

The model computes: `p = sigmoid(Σ(w_i × (x_i - mean_i) / scale_i) + bias)`

**To remove the model:** Delete `model.json` and refresh. The card will show "training in progress".

---

## How to Connect the Aries v3 Over Serial

### Dashboard Setup

1. In the **Demo Controls** panel, change **Data Source** to "Serial (Aries v3)"
2. Click **Connect to Aries**
3. Select the serial port for your Aries v3 board
4. The dashboard switches to live data from the board

### Required: Web Serial API (Chrome or Edge only)

Web Serial is not available in Firefox or Safari. The app gracefully disables the serial option
in unsupported browsers.

### Arduino/RISC-V Sketch Format

Your Aries sketch should print CSV lines at **115200 baud**:

```
HR,SPO2,TEMP,MOTION\n
```

**Examples:**
```
142,96,36.8,15
155,94,,25          ← empty field = temperature not available
138,97,-1,10        ← -1 = sensor not connected
```

| Field    | Type   | Range        | Missing Value |
|----------|--------|-------------|---------------|
| HR       | int    | 40–250 bpm  | empty or -1   |
| SPO2     | float  | 50–100 %    | empty or -1   |
| TEMP     | float  | 34–42 °C    | empty or -1   |
| MOTION   | int    | 0–100       | empty or -1   |

**Minimal Arduino sketch:**
```cpp
void setup() {
  Serial.begin(115200);
}

void loop() {
  int hr = readHR();       // From MAX30102
  int spo2 = readSpO2();   // From MAX30102
  float temp = -1;         // MLX90614 not yet connected
  int motion = readAccel(); // From accelerometer

  Serial.print(hr);    Serial.print(",");
  Serial.print(spo2);  Serial.print(",");
  Serial.print(temp);  Serial.print(",");
  Serial.println(motion);

  delay(1000);
}
```

---

## Composite Severity Index

```
score = Σ(weight_i × deviation_i) / Σ(used_weight_i) × 100
```

- **deviation** = normalised distance from reference range, clamped to [0, 1]
- Only **Valid** inputs contribute — unreliable and missing inputs are excluded
- The denominator adjusts so the score remains meaningful with fewer inputs
- The UI shows exactly which inputs were used and each contribution

**This is NOT a diagnosis.** A score above the Watch threshold "indicates a potentially concerning
pattern; clinical review required."

---

## Self-Check Tests

Tests run automatically on page load (results in browser console: F12 → Console).

To re-run manually:
```js
NeoGuard.runTests()
```

Tests cover:
- Normal vitals → low score
- All sensors missing → null score (not NaN)
- High HR / Low SpO2 → higher score
- Unreliable inputs excluded from calculation
- Missing temperature → score still computes with 3 inputs
- Single valid input → score still computes
- Monotonic increase with deviation
- Score clamped to 0–100
- Category assignment
- ML card independence from severity index

---

## Features

- **Offline-first**: No internet, no backend, no CDN. Everything runs locally.
- **4 vital cards**: HR, SpO2, Temperature, Motion — each with sparkline and quality status
- **Live scrolling charts**: 5-minute HR and SpO2 trends with unreliable segments marked
- **Composite Severity Index**: Transparent weighted formula with "Why this score" breakdown
- **ML Risk Card**: Separate placeholder, never affects severity index
- **Alert Log**: Timestamped events with auto-dedup
- **7 demo scenarios**: Normal, High HR, Low SpO2, Fever, Motion, Disconnect, Temp Missing
- **CSV Export**: Full session data with timestamps and quality flags
- **Dark/Light mode**: System-aware with manual toggle
- **Responsive**: Works on laptop, tablet, and phone screens
- **Projector-friendly**: Large monospace numbers, high contrast
- **Accessibility**: Status conveyed by icon + text + pattern, never colour alone

---

## License

Student engineering project. Not licensed for clinical use.
