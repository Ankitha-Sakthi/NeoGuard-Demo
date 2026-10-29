/**
 * NeoGuard — Composite Severity Index
 *
 * Formula:  score = Σ(weight_i × deviation_i) / Σ(used_weight_i) × 100
 *
 * - deviation_i = normalised distance from reference range, clamped [0, 1]
 * - Only VALID inputs contribute; unreliable / missing inputs are excluded
 * - The denominator adjusts so the score remains meaningful with fewer inputs
 * - All weights and ranges come from config.js
 *
 * ⚠ Uses PLACEHOLDER thresholds — not clinically validated.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  /**
   * Calculate normalised deviation of a value from a reference range.
   * Returns 0 if within range, up to 1.0 at criticalDist beyond bounds.
   */
  function calcDeviation(value, low, high, criticalDist) {
    if (value === null || value === undefined) return null;
    if (value >= low && value <= high) return 0;
    var distance = value < low ? (low - value) : (value - high);
    return Math.min(distance / criticalDist, 1);
  }

  /**
   * Calculate the Composite Severity Index from current vitals.
   *
   * @param {Object} vitals — { hr, spo2, temp, motion, hrQuality, spo2Quality, tempQuality, motionQuality }
   *   quality = 'valid' | 'unreliable' | 'no-sensor'
   *
   * @returns {Object} {
   *   score:          Number|null (0–100 or null if no valid inputs),
   *   category:       Object|null ({ max, label, color, icon } from config),
   *   breakdown:      Array of per-input details,
   *   usedInputs:     Array of input names that contributed,
   *   excludedInputs: Array of { name, reason } for inputs not used,
   *   totalWeight:    Sum of weights of used inputs
   * }
   */
  NeoGuard.calculateSeverity = function (vitals) {
    var cfg = NeoGuard.config.vitals;
    var breakdown = [];
    var weightedSum = 0;
    var totalWeight = 0;
    var usedInputs = [];
    var excludedInputs = [];

    // ── Process a standard vital (HR, SpO2, Temp) ──
    function processVital(name, value, quality, vitalCfg) {
      if (quality !== 'valid' || value === null || value === undefined) {
        excludedInputs.push({ name: name, reason: quality || 'missing' });
        breakdown.push({
          name: name, label: vitalCfg.label,
          deviation: null, weight: vitalCfg.weight,
          contribution: 0, excluded: true,
          reason: quality || 'missing'
        });
        return;
      }
      var deviation = calcDeviation(value, vitalCfg.low, vitalCfg.high, vitalCfg.criticalDist);
      var contribution = deviation * vitalCfg.weight;
      weightedSum += contribution;
      totalWeight += vitalCfg.weight;
      usedInputs.push(name);
      breakdown.push({
        name: name, label: vitalCfg.label,
        deviation: deviation, weight: vitalCfg.weight,
        contribution: contribution, excluded: false,
        value: value
      });
    }

    // ── Process motion (contributes as normalised level 0–1) ──
    function processMotion(value, quality, motionCfg) {
      if (quality === 'no-sensor' || value === null || value === undefined) {
        excludedInputs.push({ name: 'motion', reason: quality || 'missing' });
        breakdown.push({
          name: 'motion', label: motionCfg.label,
          deviation: null, weight: motionCfg.weight,
          contribution: 0, excluded: true,
          reason: quality || 'missing'
        });
        return;
      }
      var deviation = Math.min(value / 100, 1);
      var contribution = deviation * motionCfg.weight;
      weightedSum += contribution;
      totalWeight += motionCfg.weight;
      usedInputs.push('motion');
      breakdown.push({
        name: 'motion', label: motionCfg.label,
        deviation: deviation, weight: motionCfg.weight,
        contribution: contribution, excluded: false,
        value: value
      });
    }

    processVital('hr',   vitals.hr,   vitals.hrQuality,   cfg.hr);
    processVital('spo2', vitals.spo2, vitals.spo2Quality, cfg.spo2);
    processVital('temp', vitals.temp, vitals.tempQuality,  cfg.temp);
    processMotion(vitals.motion, vitals.motionQuality, cfg.motion);

    // ── Compute final score ──
    var score = null;
    var category = null;

    if (totalWeight > 0) {
      score = Math.round((weightedSum / totalWeight) * 100);
      score = Math.max(0, Math.min(100, score));

      var cats = NeoGuard.config.severity.categories;
      for (var i = 0; i < cats.length; i++) {
        if (score <= cats[i].max) {
          category = cats[i];
          break;
        }
      }
    }

    return {
      score: score,
      category: category,
      breakdown: breakdown,
      usedInputs: usedInputs,
      excludedInputs: excludedInputs,
      totalWeight: totalWeight
    };
  };
})();
