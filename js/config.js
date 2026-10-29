/**
 * NeoGuard Prototype — Configuration
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ⚠  PLACEHOLDER VALUES FOR DEMO ONLY                       ║
 * ║  To be set with qualified clinical guidance.                ║
 * ║  These values are NOT clinically validated and MUST NOT     ║
 * ║  be used for patient care or clinical decision-making.      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  NeoGuard.config = {

    /* ───────────────────────────────────────────────────────────
     * VITAL SIGN REFERENCE RANGES
     * ⚠ PLACEHOLDER VALUES FOR DEMO ONLY
     * To be set with qualified clinical guidance
     * ─────────────────────────────────────────────────────────── */
    vitals: {
      hr: {
        label: 'Heart Rate',
        unit: 'bpm',
        low: 120,           // Lower bound of "normal" range
        high: 160,          // Upper bound of "normal" range
        criticalDist: 40,   // Distance from bound to reach max deviation (1.0)
        weight: 30,         // Weight in severity index (relative)
        alarmLow: 100,      // Threshold for low-HR alert
        alarmHigh: 180      // Threshold for high-HR alert
      },
      spo2: {
        label: 'SpO2',
        unit: '%',
        low: 90,
        high: 100,
        criticalDist: 10,
        weight: 40,
        alarmLow: 88,
        alarmHigh: null     // No upper alarm for SpO2
      },
      temp: {
        label: 'Temperature',
        unit: '°C',
        low: 36.5,
        high: 37.5,
        criticalDist: 2,
        weight: 20,
        alarmLow: 35.5,
        alarmHigh: 38.5,
        pendingSensor: 'MLX90614'   // Sensor not yet integrated
      },
      motion: {
        label: 'Motion',
        unit: 'level',
        weight: 10,
        unreliableThreshold: 70    // Above this → HR/SpO2 flagged unreliable
      }
    },

    /* ───────────────────────────────────────────────────────────
     * SEVERITY INDEX CATEGORY CUT-OFFS
     * ⚠ PLACEHOLDER VALUES FOR DEMO ONLY
     * ─────────────────────────────────────────────────────────── */
    severity: {
      categories: [
        { max: 30,  label: 'Stable', color: '#2e7d32', icon: '●' },
        { max: 60,  label: 'Watch',  color: '#e6a700', icon: '▲' },
        { max: 100, label: 'Alert',  color: '#c62828', icon: '◆' }
      ]
    },

    /* ───────────────────────────────────────────────────────────
     * SIMULATION DEFAULTS
     * ─────────────────────────────────────────────────────────── */
    simulation: {
      tickMs: 1000,            // Milliseconds between ticks (base rate)
      sparklineLength: 60,     // Data points in sparkline
      chartLength: 300,        // Data points in main chart (~5 min at 1 Hz)
      maxAlerts: 100           // Max alert log entries
    },

    /* ───────────────────────────────────────────────────────────
     * SERIAL PORT (for Aries v3 connection)
     * ─────────────────────────────────────────────────────────── */
    serial: {
      baudRate: 115200,
      lineFormat: 'HR,SPO2,TEMP,MOTION',   // Expected CSV format per line
      missingValue: -1                      // Value meaning "sensor not available"
    },

    /* ───────────────────────────────────────────────────────────
     * ML MODEL PLACEHOLDER
     * ⚠ PLACEHOLDER VALUES FOR DEMO ONLY
     * ─────────────────────────────────────────────────────────── */
    ml: {
      modelPath: 'model.json',
      windowSize: 30,          // Number of recent samples for feature extraction
      demoCoefficients: {
        weights: [0.5, -0.3],
        means: [140, 95],
        scales: [20, 5],
        bias: -1.0,
        threshold: 0.5,
        features: ['hr_mean', 'spo2_mean'],
        _note: 'DEMO ONLY — placeholder coefficients'
      }
    }
  };
})();
