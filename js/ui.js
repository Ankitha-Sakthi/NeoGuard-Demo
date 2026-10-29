/**
 * NeoGuard — UI Module
 * All DOM updates, theme management, screen switching, and rendering.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  NeoGuard.UI = function () {
    this.currentScreen = 'dashboard';
    this.darkMode = false;
    this.demoPanelOpen = true;
  };

  NeoGuard.UI.prototype.init = function () {
    this._setupNav();
    this._setupTheme();
    this._setupDemoPanel();
  };

  /* ── Navigation ───────────────────────────────────────────── */

  NeoGuard.UI.prototype._setupNav = function () {
    var self = this;
    var btns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.switchScreen(btn.getAttribute('data-screen'));
        });
      })(btns[i]);
    }
  };

  NeoGuard.UI.prototype.switchScreen = function (name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      var s = screens[i];
      if (s.id === 'screen-' + name) {
        s.classList.add('screen--active');
        s.removeAttribute('hidden');
      } else {
        s.classList.remove('screen--active');
        s.setAttribute('hidden', '');
      }
    }
    var btns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.getAttribute('data-screen') === name) {
        b.classList.add('nav-btn--active');
      } else {
        b.classList.remove('nav-btn--active');
      }
    }
    this.currentScreen = name;
  };

  /* ── Theme ────────────────────────────────────────────────── */

  NeoGuard.UI.prototype._setupTheme = function () {
    var self = this;
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        self.darkMode = !self.darkMode;
        document.documentElement.setAttribute('data-theme', self.darkMode ? 'dark' : 'light');
        toggle.textContent = self.darkMode ? '☀️' : '🌙';
      });
    }
    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.darkMode = true;
      document.documentElement.setAttribute('data-theme', 'dark');
      if (toggle) toggle.textContent = '☀️';
    }
  };

  /* ── Demo Panel ───────────────────────────────────────────── */

  NeoGuard.UI.prototype._setupDemoPanel = function () {
    var self = this;
    var toggle = document.getElementById('demo-panel-toggle');
    var panel = document.getElementById('demo-panel');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        self.demoPanelOpen = !self.demoPanelOpen;
        panel.classList.toggle('demo-panel--open', self.demoPanelOpen);
        toggle.textContent = self.demoPanelOpen ? 'Hide Controls' : 'Demo Controls';
      });
    }
  };

  /* ── Vital Cards ──────────────────────────────────────────── */

  NeoGuard.UI.prototype.updateVitalCard = function (id, value, quality, sparkData, sparkOpts, isSimulated) {
    var card = document.getElementById('card-' + id);
    if (!card) return;

    var cfg = NeoGuard.config.vitals[id];
    var valueEl = card.querySelector('.vital-value');
    var unitEl = card.querySelector('.vital-unit');
    var statusEl = card.querySelector('.vital-status');
    var sparkCanvas = card.querySelector('.sparkline-canvas');
    var simTag = card.querySelector('.sim-tag');

    // Value display
    if (value !== null && value !== undefined) {
      valueEl.textContent = typeof value === 'number' ?
        (value % 1 ? value.toFixed(1) : value.toString()) : value;
    } else if (id === 'temp') {
      valueEl.textContent = '—';
      var pendingEl = card.querySelector('.vital-pending');
      if (pendingEl) pendingEl.style.display = 'block';
    } else {
      valueEl.textContent = '—';
    }

    // Temperature pending sensor message
    if (id === 'temp') {
      var pendingEl = card.querySelector('.vital-pending');
      if (pendingEl) {
        pendingEl.style.display = (quality === 'no-sensor') ? 'block' : 'none';
      }
    }

    // Status chip
    if (statusEl) {
      statusEl.className = 'vital-status status-chip';
      switch (quality) {
        case 'valid':
          statusEl.classList.add('status-valid');
          statusEl.textContent = '● Valid';
          break;
        case 'unreliable':
          statusEl.classList.add('status-unreliable');
          statusEl.textContent = '▲ Unreliable';
          break;
        case 'no-sensor':
          statusEl.classList.add('status-no-sensor');
          statusEl.textContent = '○ No sensor';
          break;
        default:
          statusEl.textContent = '? Unknown';
      }
    }

    // Simulated tag
    if (simTag) {
      simTag.style.display = isSimulated ? 'inline' : 'none';
    }

    // Sparkline
    if (sparkCanvas && sparkData) {
      NeoGuard.charts.drawSparkline(sparkCanvas, sparkData, sparkOpts);
    }
  };

  /* ── Time Charts ──────────────────────────────────────────── */

  NeoGuard.UI.prototype.updateTimeChart = function (canvasId, data, options) {
    var canvas = document.getElementById(canvasId);
    if (canvas) {
      NeoGuard.charts.drawTimeChart(canvas, data, options);
    }
  };

  /* ── Severity Gauge ───────────────────────────────────────── */

  NeoGuard.UI.prototype.updateSeverity = function (result) {
    // Gauge canvas
    var gaugeCanvas = document.getElementById('severity-gauge-canvas');
    if (gaugeCanvas) {
      NeoGuard.charts.drawGauge(gaugeCanvas, result.score, result.category);
    }

    // Category label
    var catEl = document.getElementById('severity-category-label');
    if (catEl) {
      if (result.category) {
        catEl.textContent = result.category.icon + ' ' + result.category.label;
        catEl.style.color = result.category.color;
      } else {
        catEl.textContent = 'Insufficient data';
        catEl.style.color = '';
      }
    }

    // Score note
    var noteEl = document.getElementById('severity-note');
    if (noteEl) {
      if (result.score !== null && result.score > 30) {
        noteEl.textContent = 'Indicates a potentially concerning pattern; clinical review required.';
        noteEl.style.display = 'block';
      } else if (result.score !== null) {
        noteEl.textContent = 'Within expected parameters based on demo thresholds.';
        noteEl.style.display = 'block';
      } else {
        noteEl.textContent = '';
        noteEl.style.display = 'none';
      }
    }

    // Inputs used/excluded
    var usedEl = document.getElementById('severity-inputs-used');
    if (usedEl) {
      if (result.usedInputs.length > 0) {
        usedEl.textContent = 'Inputs used: ' + result.usedInputs.join(', ') +
          (result.excludedInputs.length > 0
            ? ' · Excluded: ' + result.excludedInputs.map(function (e) { return e.name + ' (' + e.reason + ')'; }).join(', ')
            : '');
      } else {
        usedEl.textContent = 'No valid inputs available';
      }
    }

    // Breakdown bars
    var container = document.getElementById('score-breakdown');
    if (container) {
      container.innerHTML = '';
      for (var i = 0; i < result.breakdown.length; i++) {
        var b = result.breakdown[i];
        var row = document.createElement('div');
        row.className = 'breakdown-row' + (b.excluded ? ' breakdown-excluded' : '');

        var label = document.createElement('span');
        label.className = 'breakdown-label';
        label.textContent = b.label;

        var barWrap = document.createElement('div');
        barWrap.className = 'breakdown-bar-wrap';

        var bar = document.createElement('div');
        bar.className = 'breakdown-bar';

        if (b.excluded) {
          bar.style.width = '0%';
          bar.style.opacity = '0.3';
          var exNote = document.createElement('span');
          exNote.className = 'breakdown-note';
          exNote.textContent = b.reason;
          barWrap.appendChild(exNote);
        } else {
          var pct = Math.round((b.deviation || 0) * 100);
          bar.style.width = pct + '%';
          bar.setAttribute('title', 'Deviation: ' + pct + '% × Weight: ' + b.weight);
        }

        var val = document.createElement('span');
        val.className = 'breakdown-value';
        if (b.excluded) {
          val.textContent = '—';
        } else {
          val.textContent = Math.round((b.contribution / (result.totalWeight || 1)) * 100) + '%';
        }

        barWrap.insertBefore(bar, barWrap.firstChild);
        row.appendChild(label);
        row.appendChild(barWrap);
        row.appendChild(val);
        container.appendChild(row);
      }
    }
  };

  /* ── ML Risk Card ─────────────────────────────────────────── */

  NeoGuard.UI.prototype.updateMLCard = function (mlResult) {
    var card = document.getElementById('ml-card');
    if (!card) return;

    var probEl = card.querySelector('.ml-probability');
    var statusEl = card.querySelector('.ml-status-text');
    var tagEl = card.querySelector('.ml-tag');

    if (probEl) {
      if (mlResult.probability !== null) {
        var pct = (mlResult.probability * 100).toFixed(1);
        probEl.textContent = pct + '%';
        probEl.className = 'ml-probability' + (mlResult.isHigh ? ' ml-high' : '');
      } else {
        probEl.textContent = '—';
        probEl.className = 'ml-probability';
      }
    }

    if (statusEl) {
      statusEl.textContent = mlResult.modelStatus;
    }

    if (tagEl) {
      tagEl.textContent = mlResult.tag;
      tagEl.className = 'ml-tag' + (mlResult.isSimulated ? ' ml-tag--simulated' : ' ml-tag--trained');
    }
  };

  /* ── Alert Log ────────────────────────────────────────────── */

  NeoGuard.UI.prototype.renderAlerts = function (alerts) {
    var list = document.getElementById('alert-list');
    if (!list) return;

    list.innerHTML = '';
    if (alerts.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'alert-empty';
      empty.textContent = 'No alerts';
      list.appendChild(empty);
      return;
    }

    for (var i = 0; i < Math.min(alerts.length, 50); i++) {
      var a = alerts[i];
      var entry = document.createElement('div');
      entry.className = 'alert-entry alert-' + a.type;

      var time = document.createElement('span');
      time.className = 'alert-time';
      time.textContent = a.timestamp.toLocaleTimeString();

      var msg = document.createElement('span');
      msg.className = 'alert-message';
      msg.textContent = a.message;

      entry.appendChild(time);
      entry.appendChild(msg);
      list.appendChild(entry);
    }
  };

  /* ── Connection Status ────────────────────────────────────── */

  NeoGuard.UI.prototype.setConnectionStatus = function (source, status) {
    var indicator = document.getElementById('connection-indicator');
    if (indicator) {
      var dot = indicator.querySelector('.connection-dot');
      var text = indicator.querySelector('.connection-text');
      if (source === 'simulator') {
        if (dot) { dot.className = 'connection-dot dot-sim'; }
        if (text) { text.textContent = 'Simulator'; }
      } else if (status === 'Connected to Aries v3') {
        if (dot) { dot.className = 'connection-dot dot-connected'; }
        if (text) { text.textContent = 'Aries v3 connected'; }
      } else {
        if (dot) { dot.className = 'connection-dot dot-disconnected'; }
        if (text) { text.textContent = status || 'Disconnected'; }
      }
    }

    var serialStatus = document.getElementById('serial-status');
    if (serialStatus && source === 'serial') {
      serialStatus.textContent = status;
    }
  };
})();
