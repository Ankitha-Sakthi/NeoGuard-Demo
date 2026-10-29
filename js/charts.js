/**
 * NeoGuard — Lightweight Canvas Chart Library
 * Zero external dependencies. Draws sparklines, time-series, and gauge charts.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};
  NeoGuard.charts = {};

  /* ── Helpers ──────────────────────────────────────────────── */

  function setupCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function textColor() { return isDark() ? '#b0b0c0' : '#5a5a7a'; }
  function gridColor() { return isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; }

  /* ════════════════════════════════════════════════════════════
   * SPARKLINE — small inline line chart for vital cards
   * ════════════════════════════════════════════════════════════ */
  NeoGuard.charts.drawSparkline = function (canvas, data, options) {
    if (!canvas) return;
    var s = setupCanvas(canvas);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;

    var opts = {
      lineColor:       '#2196F3',
      lineWidth:       1.5,
      fillColor:       'rgba(33,150,243,0.08)',
      unreliableColor: 'rgba(255,152,0,0.5)',
      yMin: null, yMax: null
    };
    if (options) {
      for (var k in options) { if (options.hasOwnProperty(k)) opts[k] = options[k]; }
    }

    ctx.clearRect(0, 0, w, h);
    if (!data || data.length < 2) return;

    // Extract numeric values for range calc
    var values = [];
    for (var i = 0; i < data.length; i++) {
      var v = data[i] && data[i].value !== undefined ? data[i].value : data[i];
      if (v !== null && v !== undefined && !isNaN(v)) values.push(v);
    }
    if (values.length < 2) return;

    var yMin = opts.yMin !== null ? opts.yMin : Math.min.apply(null, values);
    var yMax = opts.yMax !== null ? opts.yMax : Math.max.apply(null, values);
    if (yMax - yMin < 0.01) { yMin -= 1; yMax += 1; }

    var pad = 2;
    var step = (w - 2 * pad) / (data.length - 1);

    function getY(val) {
      return pad + (1 - (val - yMin) / (yMax - yMin)) * (h - 2 * pad);
    }

    // Draw fill area first
    ctx.beginPath();
    var started = false;
    var firstX = 0, lastX = 0;
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var val = d && d.value !== undefined ? d.value : d;
      if (val === null || val === undefined || isNaN(val)) continue;
      var x = pad + i * step;
      var y = getY(val);
      if (!started) { ctx.moveTo(x, y); firstX = x; started = true; }
      else { ctx.lineTo(x, y); }
      lastX = x;
    }
    if (started) {
      ctx.lineTo(lastX, h - pad);
      ctx.lineTo(firstX, h - pad);
      ctx.closePath();
      ctx.fillStyle = opts.fillColor;
      ctx.fill();
    }

    // Draw line segments coloured by quality
    for (var i = 1; i < data.length; i++) {
      var d0 = data[i - 1], d1 = data[i];
      var v0 = d0 && d0.value !== undefined ? d0.value : d0;
      var v1 = d1 && d1.value !== undefined ? d1.value : d1;
      if (v0 === null || v1 === null || v0 === undefined || v1 === undefined) continue;
      if (isNaN(v0) || isNaN(v1)) continue;

      var q = (d1 && d1.quality) ? d1.quality : 'valid';
      ctx.beginPath();
      ctx.moveTo(pad + (i - 1) * step, getY(v0));
      ctx.lineTo(pad + i * step, getY(v1));
      ctx.strokeStyle = (q === 'unreliable') ? opts.unreliableColor : opts.lineColor;
      ctx.lineWidth = opts.lineWidth;
      if (q === 'unreliable') { ctx.setLineDash([2, 2]); } else { ctx.setLineDash([]); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };


  /* ════════════════════════════════════════════════════════════
   * TIME-SERIES CHART — scrolling line chart with quality segments
   * ════════════════════════════════════════════════════════════ */
  NeoGuard.charts.drawTimeChart = function (canvas, data, options) {
    if (!canvas) return;
    var s = setupCanvas(canvas);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;

    var opts = {
      lineColor:       '#2196F3',
      unreliableColor: 'rgba(255,152,0,0.5)',
      unreliableBg:    'rgba(255,152,0,0.06)',
      lineWidth:       2,
      unit: '', label: '',
      yMin: null, yMax: null
    };
    if (options) {
      for (var k in options) { if (options.hasOwnProperty(k)) opts[k] = options[k]; }
    }

    ctx.clearRect(0, 0, w, h);

    if (!data || data.length < 2) {
      ctx.fillStyle = textColor();
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Waiting for data…', w / 2, h / 2);
      return;
    }

    var padding = { top: 12, right: 12, bottom: 24, left: 50 };
    var plotW = w - padding.left - padding.right;
    var plotH = h - padding.top - padding.bottom;

    // Calculate Y range
    var values = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i].value !== null && data[i].value !== undefined) values.push(data[i].value);
    }
    if (values.length === 0) {
      ctx.fillStyle = textColor();
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No valid data', w / 2, h / 2);
      return;
    }

    var yMin = opts.yMin !== null ? opts.yMin : Math.min.apply(null, values);
    var yMax = opts.yMax !== null ? opts.yMax : Math.max.apply(null, values);
    if (yMax - yMin < 1) { yMin -= 1; yMax += 1; }
    // Add 5% padding
    var yRange = yMax - yMin;
    yMin -= yRange * 0.05;
    yMax += yRange * 0.05;

    var step = plotW / (data.length - 1);

    function getX(idx) { return padding.left + idx * step; }
    function getY(val) { return padding.top + (1 - (val - yMin) / (yMax - yMin)) * plotH; }

    // Grid lines + Y labels
    ctx.strokeStyle = gridColor();
    ctx.lineWidth = 0.5;
    ctx.fillStyle = textColor();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    var ySteps = 4;
    for (var i = 0; i <= ySteps; i++) {
      var yVal = yMax - (i / ySteps) * (yMax - yMin);
      var y = getY(yVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(yVal.toFixed(yVal % 1 ? 1 : 0), padding.left - 6, y);
    }

    // Unreliable background bands
    for (var i = 0; i < data.length; i++) {
      if (data[i].quality === 'unreliable') {
        var x = getX(i);
        ctx.fillStyle = opts.unreliableBg;
        ctx.fillRect(x - step / 2, padding.top, step, plotH);
      }
    }

    // Data line segments
    for (var i = 1; i < data.length; i++) {
      var prev = data[i - 1], curr = data[i];
      if (prev.value === null || curr.value === null ||
          prev.value === undefined || curr.value === undefined) continue;

      ctx.beginPath();
      ctx.moveTo(getX(i - 1), getY(prev.value));
      ctx.lineTo(getX(i), getY(curr.value));

      var isUnreliable = (curr.quality === 'unreliable' || prev.quality === 'unreliable');
      ctx.strokeStyle = isUnreliable ? opts.unreliableColor : opts.lineColor;
      ctx.lineWidth = opts.lineWidth;
      if (isUnreliable) { ctx.setLineDash([5, 4]); } else { ctx.setLineDash([]); }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Unit label
    ctx.fillStyle = textColor();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.unit, w / 2, h - 4);

    // Axes
    ctx.strokeStyle = gridColor();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotH);
    ctx.lineTo(w - padding.right, padding.top + plotH);
    ctx.stroke();
  };


  /* ════════════════════════════════════════════════════════════
   * GAUGE — semi-circular arc for Composite Severity Index
   * ════════════════════════════════════════════════════════════ */
  NeoGuard.charts.drawGauge = function (canvas, score, category, options) {
    if (!canvas) return;
    var s = setupCanvas(canvas);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;

    var opts = {
      bgColor:   isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
      lineWidth: 16
    };
    if (options) {
      for (var k in options) { if (options.hasOwnProperty(k)) opts[k] = options[k]; }
    }

    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var cy = h * 0.7;
    var radius = Math.min(cx, cy) - opts.lineWidth - 8;
    if (radius < 10) return;

    // Background arc (full semicircle)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = opts.bgColor;
    ctx.lineWidth = opts.lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (score !== null && score !== undefined) {
      // Draw coloured segments up to the score
      var cats = NeoGuard.config.severity.categories;
      var prevMax = 0;
      for (var i = 0; i < cats.length; i++) {
        var segStart = Math.PI + (prevMax / 100) * Math.PI;
        var segEnd   = Math.PI + (Math.min(cats[i].max, score) / 100) * Math.PI;
        if (segEnd > segStart) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius, segStart, segEnd);
          ctx.strokeStyle = cats[i].color;
          ctx.lineWidth = opts.lineWidth;
          ctx.lineCap = 'butt';
          ctx.stroke();
        }
        prevMax = cats[i].max;
        if (cats[i].max >= score) break;
      }

      // Needle dot at score position
      var needleAngle = Math.PI + (score / 100) * Math.PI;
      var dotX = cx + Math.cos(needleAngle) * radius;
      var dotY = cy + Math.sin(needleAngle) * radius;
      ctx.beginPath();
      ctx.arc(dotX, dotY, opts.lineWidth / 2 + 2, 0, 2 * Math.PI);
      ctx.fillStyle = category ? category.color : '#666';
      ctx.fill();

      // Score number
      ctx.fillStyle = category ? category.color : textColor();
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(score.toString(), cx, cy - 12);

      // Category label
      if (category) {
        ctx.fillStyle = category.color;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText(category.icon + ' ' + category.label, cx, cy + 16);
      }
    } else {
      // No data state
      ctx.fillStyle = textColor();
      ctx.font = '22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N/A', cx, cy - 8);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Insufficient data', cx, cy + 14);
    }

    // Scale labels
    ctx.fillStyle = textColor();
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0', cx - radius - 4, cy + 14);
    ctx.fillText('100', cx + radius + 6, cy + 14);
  };
})();
