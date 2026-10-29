/**
 * NeoGuard — ML Risk Card
 * Logistic-regression risk probability estimator.
 *
 * - If model.json loads: uses real coefficients, shows "Trained on PreMo" tag
 * - If model.json is absent: uses demo coefficients, shows "SIMULATED" tag
 * - NEVER influences the Composite Severity Index
 *
 * model.json format:
 * {
 *   "weights": [w1, w2],
 *   "means": [mean_hr, mean_spo2],
 *   "scales": [std_hr, std_spo2],
 *   "bias": b,
 *   "threshold": 0.5,
 *   "features": ["hr_mean", "spo2_mean"]
 * }
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  NeoGuard.MLRisk = function () {
    this.model = null;
    this.isLoaded = false;
    this.isSimulated = true;
    this.modelStatus = 'ML model: training in progress (demo values only)';
  };

  /** Try to load model.json; fall back to demo coefficients. */
  NeoGuard.MLRisk.prototype.init = async function () {
    try {
      var response = await fetch(NeoGuard.config.ml.modelPath);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      this.model = await response.json();
      // Validate required fields
      if (!this.model.weights || !this.model.means || !this.model.scales || this.model.bias === undefined) {
        throw new Error('Invalid model format');
      }
      this.isLoaded = true;
      this.isSimulated = false;
      this.modelStatus = 'Trained on PreMo (very-low-birth-weight NICU data) — not validated on MAX30102 signals';
    } catch (err) {
      // Model not available — demo mode
      this.model = NeoGuard.config.ml.demoCoefficients;
      this.isLoaded = false;
      this.isSimulated = true;
      this.modelStatus = 'ML model: training in progress (demo values only)';
    }
  };

  /**
   * Compute risk probability from recent HR and SpO2 windows.
   * @param {number[]} hrValues  — Array of recent valid HR values
   * @param {number[]} spo2Values — Array of recent valid SpO2 values
   * @returns {Object} { probability, isSimulated, modelStatus, tag, isHigh }
   */
  NeoGuard.MLRisk.prototype.compute = function (hrValues, spo2Values) {
    var result = {
      probability: null,
      isSimulated: this.isSimulated,
      modelStatus: this.modelStatus,
      tag: this.isSimulated ? 'SIMULATED' : 'Trained on PreMo — not validated on MAX30102',
      isHigh: false
    };

    // Need model and valid data
    if (!this.model || !hrValues || !spo2Values || hrValues.length === 0 || spo2Values.length === 0) {
      return result;
    }

    // Compute mean features
    var hrMean = mean(hrValues);
    var spo2Mean = mean(spo2Values);
    var features = [hrMean, spo2Mean];
    var m = this.model;

    // Standardize: z = (x - mean) / scale
    var z = [];
    for (var i = 0; i < features.length; i++) {
      z.push((features[i] - m.means[i]) / m.scales[i]);
    }

    // Logistic regression: p = sigmoid(w·z + bias)
    var logit = m.bias;
    for (var i = 0; i < z.length; i++) {
      logit += m.weights[i] * z[i];
    }
    var probability = sigmoid(logit);
    probability = Math.round(probability * 1000) / 1000;

    result.probability = probability;
    result.isHigh = probability >= (m.threshold || 0.5);
    return result;
  };

  /* ── Helpers ─────────────────────────────────────────────── */

  function mean(arr) {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }

  function sigmoid(x) {
    if (x >= 0) {
      return 1 / (1 + Math.exp(-x));
    } else {
      var ex = Math.exp(x);
      return ex / (1 + ex);
    }
  }
})();
