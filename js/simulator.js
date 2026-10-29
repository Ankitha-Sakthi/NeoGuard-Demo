/**
 * NeoGuard — Data Simulator
 * Generates realistic-looking noisy vital sign data with scenario injection.
 * All data is SIMULATED and labelled as such.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  NeoGuard.Simulator = function () {
    this.scenario = 'normal';
    this.speed = 1;
    this.paused = false;
    this._callback = null;
    this._timer = null;
    this._tick = 0;

    // Base values for normal scenario (neonatal ranges)
    this._baseHR = 140;
    this._baseSPO2 = 96;
    this._baseTemp = 37.0;
    this._baseMotion = 15;
  };

  /** Start the simulator. Calls callback(dataPoint) each tick. */
  NeoGuard.Simulator.prototype.start = function (callback) {
    this._callback = callback;
    this._schedule();
  };

  /** Stop the simulator entirely. */
  NeoGuard.Simulator.prototype.stop = function () {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  };

  /** Pause data generation (timer keeps running but no data emitted). */
  NeoGuard.Simulator.prototype.pause = function () {
    this.paused = true;
  };

  /** Resume data generation. */
  NeoGuard.Simulator.prototype.resume = function () {
    this.paused = false;
  };

  /** Switch to a named scenario. */
  NeoGuard.Simulator.prototype.setScenario = function (name) {
    this.scenario = name;
  };

  /** Set simulation speed multiplier (0.5–5). */
  NeoGuard.Simulator.prototype.setSpeed = function (multiplier) {
    this.speed = Math.max(0.5, Math.min(5, multiplier));
    // Reschedule with new speed
    if (this._timer) {
      clearTimeout(this._timer);
      this._schedule();
    }
  };

  /* ── Internal ──────────────────────────────────────────────── */

  NeoGuard.Simulator.prototype._schedule = function () {
    var self = this;
    var interval = Math.round(NeoGuard.config.simulation.tickMs / this.speed);
    this._timer = setTimeout(function () {
      if (!self.paused) {
        self._tick++;
        var data = self._generate();
        if (self._callback) self._callback(data);
      }
      self._schedule();
    }, interval);
  };

  NeoGuard.Simulator.prototype._generate = function () {
    var t = this._tick;
    var noise = function (amp) { return (Math.random() - 0.5) * 2 * amp; };
    var sin   = function (period, amp) { return Math.sin((t / period) * 2 * Math.PI) * amp; };

    var hr, spo2, temp, motion;
    var hrQ = 'valid', spo2Q = 'valid', tempQ = 'valid', motionQ = 'valid';

    switch (this.scenario) {

      case 'normal':
        hr     = this._baseHR   + noise(5)    + sin(30, 3);
        spo2   = this._baseSPO2 + noise(1)    + sin(25, 0.5);
        temp   = this._baseTemp + noise(0.1)  + sin(60, 0.05);
        motion = this._baseMotion + noise(5)  + Math.abs(sin(20, 5));
        break;

      case 'high-hr':
        hr     = 185 + noise(8) + sin(15, 5);
        spo2   = 94  + noise(1.5) + sin(25, 0.5);
        temp   = this._baseTemp + noise(0.15);
        motion = 25  + noise(8);
        break;

      case 'low-spo2':
        hr     = 155 + noise(6) + sin(20, 3);
        spo2   = 85  + noise(2) + sin(30, 1);
        temp   = this._baseTemp + noise(0.1);
        motion = 20  + noise(5);
        break;

      case 'fever':
        hr     = 165 + noise(5) + sin(20, 3);
        spo2   = 94  + noise(1);
        temp   = 38.8 + noise(0.2) + sin(40, 0.1);
        motion = 30  + noise(8);
        break;

      case 'motion':
        hr     = this._baseHR   + noise(15) + sin(5, 20);
        spo2   = this._baseSPO2 + noise(5)  + sin(5, 3);
        temp   = this._baseTemp + noise(0.1);
        motion = 85  + noise(10);
        hrQ    = 'unreliable';
        spo2Q  = 'unreliable';
        break;

      case 'disconnect':
        hr = null; spo2 = null; temp = null; motion = null;
        hrQ = 'no-sensor'; spo2Q = 'no-sensor';
        tempQ = 'no-sensor'; motionQ = 'no-sensor';
        break;

      case 'no-temp':
        hr     = this._baseHR   + noise(5)   + sin(30, 3);
        spo2   = this._baseSPO2 + noise(1)   + sin(25, 0.5);
        temp   = null;
        tempQ  = 'no-sensor';
        motion = this._baseMotion + noise(5);
        break;

      default:
        hr     = this._baseHR + noise(5);
        spo2   = this._baseSPO2 + noise(1);
        temp   = this._baseTemp + noise(0.1);
        motion = this._baseMotion + noise(5);
    }

    // Clamp values to physiological limits
    if (hr     !== null) hr     = Math.round(Math.max(40, Math.min(250, hr)));
    if (spo2   !== null) spo2   = Math.round(Math.max(50, Math.min(100, spo2)) * 10) / 10;
    if (temp   !== null) temp   = Math.round(Math.max(34, Math.min(42, temp)) * 10) / 10;
    if (motion !== null) motion = Math.round(Math.max(0, Math.min(100, motion)));

    // Auto-detect unreliable readings from high motion
    var motionThreshold = NeoGuard.config.vitals.motion.unreliableThreshold;
    if (motion !== null && motion > motionThreshold && this.scenario !== 'disconnect') {
      if (hrQ   === 'valid') hrQ   = 'unreliable';
      if (spo2Q === 'valid') spo2Q = 'unreliable';
    }

    return {
      timestamp:    Date.now(),
      hr:           hr,
      spo2:         spo2,
      temp:         temp,
      motion:       motion,
      hrQuality:    hrQ,
      spo2Quality:  spo2Q,
      tempQuality:  tempQ,
      motionQuality: motionQ,
      simulated:    true
    };
  };
})();
