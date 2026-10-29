/**
 * NeoGuard — Main Application Orchestrator
 * Connects simulator/serial → data processing → UI updates → alerts.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  NeoGuard.App = function () {
    this.ui = new NeoGuard.UI();
    this.simulator = new NeoGuard.Simulator();
    this.serial = null;
    this.mlRisk = new NeoGuard.MLRisk();
    this.alertLog = new NeoGuard.AlertLog(NeoGuard.config.simulation.maxAlerts);
    this.dataSource = 'simulator';

    // Data buffers
    this.dataBuffer = [];     // Full session (for CSV export)
    this.hrHistory = [];      // Time chart data
    this.spo2History = [];
    this.hrSparkline = [];    // Sparkline data
    this.spo2Sparkline = [];
    this.tempSparkline = [];
    this.motionSparkline = [];

    // Alert dedup
    this._lastAlerts = {};

    // Limits
    this._chartLen = NeoGuard.config.simulation.chartLength;
    this._sparkLen = NeoGuard.config.simulation.sparklineLength;
  };

  NeoGuard.App.prototype.init = async function () {
    var self = this;

    // Init UI
    this.ui.init();

    // Init ML risk (tries to load model.json)
    await this.mlRisk.init();
    this.ui.updateMLCard(this.mlRisk.compute([], []));

    // Setup serial (if supported)
    this.serial = new NeoGuard.SerialConnection(
      function (data) { self._processData(data); },
      function (status) { self.ui.setConnectionStatus('serial', status); }
    );

    // Setup event handlers
    this._setupScenarioButtons();
    this._setupSpeedSlider();
    this._setupPauseButton();
    this._setupDataSource();
    this._setupSerialConnect();
    this._setupExport();
    this._setupClearAlerts();

    // Set initial connection status
    this.ui.setConnectionStatus('simulator', 'Simulator');

    // Start simulator
    this.simulator.start(function (data) { self._processData(data); });

    // Run self-checks
    var testResults = NeoGuard.runTests();
    if (testResults.fail > 0) {
      this.alertLog.add('Self-check: ' + testResults.fail + ' test(s) failed — see console', 'warning');
    } else {
      console.log('NeoGuard: All ' + testResults.total + ' self-checks passed.');
    }

    // Initial render
    this.ui.renderAlerts(this.alertLog.getAll());
  };

  /* ── Data Processing ──────────────────────────────────────── */

  NeoGuard.App.prototype._processData = function (data) {
    // Buffer for export
    this.dataBuffer.push(data);
    if (this.dataBuffer.length > 50000) {
      this.dataBuffer = this.dataBuffer.slice(-50000);
    }

    // Update sparkline buffers
    this._pushSparkline(this.hrSparkline, data.hr, data.hrQuality);
    this._pushSparkline(this.spo2Sparkline, data.spo2, data.spo2Quality);
    this._pushSparkline(this.tempSparkline, data.temp, data.tempQuality);
    this._pushSparkline(this.motionSparkline, data.motion, data.motionQuality);

    // Update history chart buffers
    this._pushHistory(this.hrHistory, data.hr, data.hrQuality, data.timestamp);
    this._pushHistory(this.spo2History, data.spo2, data.spo2Quality, data.timestamp);

    // Calculate severity
    var severity = NeoGuard.calculateSeverity(data);
    data.severityScore = severity.score;
    data.severityCategory = severity.category ? severity.category.label : 'N/A';

    // Calculate ML risk (independent of severity)
    var validHR = this._getValidValues(this.hrHistory, NeoGuard.config.ml.windowSize);
    var validSpO2 = this._getValidValues(this.spo2History, NeoGuard.config.ml.windowSize);
    var mlResult = this.mlRisk.compute(validHR, validSpO2);

    // Check alert conditions
    this._checkAlerts(data, severity);

    // Update UI (only if dashboard is visible, but always keep data updated)
    this.ui.updateVitalCard('hr', data.hr, data.hrQuality, this.hrSparkline,
      { lineColor: '#ef5350', fillColor: 'rgba(239,83,80,0.08)', yMin: 80, yMax: 220 }, data.simulated);
    this.ui.updateVitalCard('spo2', data.spo2, data.spo2Quality, this.spo2Sparkline,
      { lineColor: '#42a5f5', fillColor: 'rgba(66,165,245,0.08)', yMin: 70, yMax: 100 }, data.simulated);
    this.ui.updateVitalCard('temp', data.temp, data.tempQuality, this.tempSparkline,
      { lineColor: '#ffa726', fillColor: 'rgba(255,167,38,0.08)', yMin: 34, yMax: 42 }, data.simulated);
    this.ui.updateVitalCard('motion', data.motion, data.motionQuality, this.motionSparkline,
      { lineColor: '#ab47bc', fillColor: 'rgba(171,71,188,0.08)', yMin: 0, yMax: 100 }, data.simulated);

    this.ui.updateTimeChart('chart-hr-canvas', this.hrHistory,
      { lineColor: '#ef5350', unit: 'bpm', yMin: 80, yMax: 220 });
    this.ui.updateTimeChart('chart-spo2-canvas', this.spo2History,
      { lineColor: '#42a5f5', unit: '%', yMin: 70, yMax: 100 });

    this.ui.updateSeverity(severity);
    this.ui.updateMLCard(mlResult);
  };

  NeoGuard.App.prototype._pushSparkline = function (arr, value, quality) {
    arr.push({ value: value, quality: quality });
    if (arr.length > this._sparkLen) arr.shift();
  };

  NeoGuard.App.prototype._pushHistory = function (arr, value, quality, timestamp) {
    arr.push({ value: value, quality: quality, timestamp: timestamp });
    if (arr.length > this._chartLen) arr.shift();
  };

  NeoGuard.App.prototype._getValidValues = function (history, windowSize) {
    var result = [];
    var start = Math.max(0, history.length - windowSize);
    for (var i = start; i < history.length; i++) {
      if (history[i].quality === 'valid' && history[i].value !== null) {
        result.push(history[i].value);
      }
    }
    return result;
  };

  /* ── Alert Checking ───────────────────────────────────────── */

  NeoGuard.App.prototype._checkAlerts = function (data, severity) {
    var cfg = NeoGuard.config.vitals;
    var now = Date.now();

    // Rate-limit: don't repeat the same alert within 10 seconds
    var self = this;
    function addOnce(key, message, type) {
      if (!self._lastAlerts[key] || now - self._lastAlerts[key] > 10000) {
        self.alertLog.add(message, type);
        self._lastAlerts[key] = now;
        self.ui.renderAlerts(self.alertLog.getAll());
      }
    }

    // HR alerts
    if (data.hrQuality === 'no-sensor') {
      addOnce('hr-disconnect', 'HR sensor disconnected', 'critical');
    } else if (data.hrQuality === 'unreliable') {
      addOnce('hr-unreliable', 'Motion artifact — HR reading ignored', 'warning');
    } else if (data.hr !== null) {
      if (cfg.hr.alarmLow && data.hr < cfg.hr.alarmLow) {
        addOnce('hr-low', 'HR below configured limit (' + data.hr + ' < ' + cfg.hr.alarmLow + ' bpm)', 'critical');
      }
      if (cfg.hr.alarmHigh && data.hr > cfg.hr.alarmHigh) {
        addOnce('hr-high', 'HR above configured limit (' + data.hr + ' > ' + cfg.hr.alarmHigh + ' bpm)', 'critical');
      }
    }

    // SpO2 alerts
    if (data.spo2Quality === 'no-sensor') {
      addOnce('spo2-disconnect', 'SpO2 sensor disconnected', 'critical');
    } else if (data.spo2Quality === 'unreliable') {
      addOnce('spo2-unreliable', 'Motion artifact — SpO2 reading ignored', 'warning');
    } else if (data.spo2 !== null) {
      if (cfg.spo2.alarmLow && data.spo2 < cfg.spo2.alarmLow) {
        addOnce('spo2-low', 'SpO2 below configured limit (' + data.spo2 + ' < ' + cfg.spo2.alarmLow + '%)', 'critical');
      }
    }

    // Temp alerts
    if (data.tempQuality === 'no-sensor') {
      addOnce('temp-disconnect', 'Temperature sensor not connected (MLX90614 pending)', 'info');
    } else if (data.temp !== null && data.tempQuality === 'valid') {
      if (cfg.temp.alarmHigh && data.temp > cfg.temp.alarmHigh) {
        addOnce('temp-high', 'Temperature above configured limit (' + data.temp + ' > ' + cfg.temp.alarmHigh + '°C)', 'critical');
      }
      if (cfg.temp.alarmLow && data.temp < cfg.temp.alarmLow) {
        addOnce('temp-low', 'Temperature below configured limit (' + data.temp + ' < ' + cfg.temp.alarmLow + '°C)', 'warning');
      }
    }

    // Severity alerts
    if (severity.score !== null && severity.score > 60) {
      addOnce('severity-alert', 'Composite Severity Index in Alert range (' + severity.score +
        ') — indicates a potentially concerning pattern; clinical review required', 'critical');
    } else if (severity.score !== null && severity.score > 30) {
      addOnce('severity-watch', 'Composite Severity Index in Watch range (' + severity.score + ')', 'warning');
    }
  };

  /* ── Event Handlers ───────────────────────────────────────── */

  NeoGuard.App.prototype._setupScenarioButtons = function () {
    var self = this;
    var btns = document.querySelectorAll('.scenario-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var scenario = btn.getAttribute('data-scenario');
          self.simulator.setScenario(scenario);

          // Clear alert dedup so new scenario alerts show immediately
          self._lastAlerts = {};

          // Highlight active button
          var allBtns = document.querySelectorAll('.scenario-btn');
          for (var j = 0; j < allBtns.length; j++) {
            allBtns[j].classList.remove('scenario-btn--active');
          }
          btn.classList.add('scenario-btn--active');
        });
      })(btns[i]);
    }
  };

  NeoGuard.App.prototype._setupSpeedSlider = function () {
    var self = this;
    var slider = document.getElementById('speed-slider');
    var label = document.getElementById('speed-label');
    if (slider) {
      slider.addEventListener('input', function () {
        var speed = parseFloat(slider.value);
        self.simulator.setSpeed(speed);
        if (label) label.textContent = speed + '×';
      });
    }
  };

  NeoGuard.App.prototype._setupPauseButton = function () {
    var self = this;
    var btn = document.getElementById('pause-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        if (self.simulator.paused) {
          self.simulator.resume();
          btn.textContent = '⏸ Pause';
          btn.classList.remove('btn--paused');
        } else {
          self.simulator.pause();
          btn.textContent = '▶ Resume';
          btn.classList.add('btn--paused');
        }
      });
    }
  };

  NeoGuard.App.prototype._setupDataSource = function () {
    var self = this;
    var select = document.getElementById('data-source-select');
    var serialBtn = document.getElementById('serial-connect-btn');
    if (select) {
      select.addEventListener('change', function () {
        self.dataSource = select.value;
        if (select.value === 'serial') {
          if (serialBtn) serialBtn.disabled = !self.serial.isSupported();
          self.simulator.pause();
          self.ui.setConnectionStatus('serial', 'Ready to connect');
        } else {
          self.simulator.resume();
          if (self.serial && self.serial.isConnected()) {
            self.serial.disconnect();
          }
          self.ui.setConnectionStatus('simulator', 'Simulator');
          if (serialBtn) serialBtn.disabled = true;
        }
      });
    }
  };

  NeoGuard.App.prototype._setupSerialConnect = function () {
    var self = this;
    var btn = document.getElementById('serial-connect-btn');
    if (btn) {
      btn.disabled = true; // Disabled until serial source selected
      btn.addEventListener('click', async function () {
        if (self.serial.isConnected()) {
          await self.serial.disconnect();
          btn.textContent = '🔌 Connect to Aries';
          self.simulator.resume();
          self.ui.setConnectionStatus('simulator', 'Simulator');
        } else {
          self.simulator.pause();
          var ok = await self.serial.connect();
          if (ok) {
            btn.textContent = '⏏ Disconnect';
            self.alertLog.add('Serial: Connected to Aries v3', 'info');
          } else {
            self.simulator.resume();
            self.ui.setConnectionStatus('simulator', 'Simulator (serial failed)');
            self.alertLog.add('Serial: Connection failed — falling back to simulator', 'warning');
          }
          self.ui.renderAlerts(self.alertLog.getAll());
        }
      });
    }
  };

  NeoGuard.App.prototype._setupExport = function () {
    var self = this;
    var btn = document.getElementById('export-csv-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        NeoGuard.exportCSV(self.dataBuffer);
      });
    }
  };

  NeoGuard.App.prototype._setupClearAlerts = function () {
    var self = this;
    var btn = document.getElementById('clear-alerts-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        self.alertLog.clear();
        self._lastAlerts = {};
        self.ui.renderAlerts(self.alertLog.getAll());
      });
    }
  };

  /* ── Bootstrap ────────────────────────────────────────────── */

  // Auto-start when DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var app = new NeoGuard.App();
    app.init();
    window._neoguardApp = app; // Expose for debugging
  });
})();
