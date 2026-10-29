/**
 * NeoGuard — Web Serial API Connection
 * Connects to the Aries v3 RISC-V board over USB serial.
 * Expected line format: HR,SPO2,TEMP,MOTION\n
 * Missing values: empty field or -1
 *
 * This module is optional. If Web Serial is unavailable (e.g. Firefox, Safari),
 * the app falls back to the simulator and the serial option is simply disabled.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  /**
   * @constructor
   * @param {function} onData    — Called with a parsed data point object
   * @param {function} onStatus  — Called with status string updates
   */
  NeoGuard.SerialConnection = function (onData, onStatus) {
    this._port = null;
    this._reader = null;
    this._onData = onData;
    this._onStatus = onStatus;
    this._connected = false;
    this._buffer = '';
    this._closing = false;
  };

  /** Check if Web Serial API is available in this browser. */
  NeoGuard.SerialConnection.prototype.isSupported = function () {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  };

  /** Check if currently connected. */
  NeoGuard.SerialConnection.prototype.isConnected = function () {
    return this._connected;
  };

  /** Open a serial connection (prompts user to select a port). */
  NeoGuard.SerialConnection.prototype.connect = async function () {
    if (!this.isSupported()) {
      this._onStatus('Web Serial API not supported — use Chrome or Edge');
      return false;
    }

    try {
      this._port = await navigator.serial.requestPort();
      await this._port.open({ baudRate: NeoGuard.config.serial.baudRate });
      this._connected = true;
      this._closing = false;
      this._onStatus('Connected to Aries v3');
      this._readLoop();
      return true;
    } catch (err) {
      this._connected = false;
      if (err.name === 'NotFoundError') {
        this._onStatus('No port selected');
      } else {
        this._onStatus('Connection failed: ' + err.message);
      }
      return false;
    }
  };

  /** Disconnect from the serial port. */
  NeoGuard.SerialConnection.prototype.disconnect = async function () {
    this._closing = true;
    try {
      if (this._reader) {
        await this._reader.cancel();
        this._reader = null;
      }
      if (this._port) {
        await this._port.close();
        this._port = null;
      }
    } catch (err) {
      // Ignore errors during disconnect
    }
    this._connected = false;
    this._onStatus('Disconnected');
  };

  /* ── Internal ──────────────────────────────────────────────── */

  NeoGuard.SerialConnection.prototype._readLoop = async function () {
    var self = this;

    try {
      var decoder = new TextDecoderStream();
      var readableStreamClosed = this._port.readable.pipeTo(decoder.writable);
      this._reader = decoder.readable.getReader();

      while (true) {
        var result = await this._reader.read();
        if (result.done) break;

        self._buffer += result.value;
        var lines = self._buffer.split('\n');
        self._buffer = lines.pop(); // Keep incomplete last line

        for (var i = 0; i < lines.length; i++) {
          var parsed = self._parseLine(lines[i].trim());
          if (parsed) self._onData(parsed);
        }
      }
    } catch (err) {
      if (!self._closing) {
        self._onStatus('Read error: ' + err.message);
      }
    } finally {
      self._connected = false;
      if (!self._closing) {
        self._onStatus('Disconnected (port closed)');
      }
    }
  };

  /**
   * Parse a CSV line: "HR,SPO2,TEMP,MOTION"
   * e.g. "142,96,36.8,15"  or  "142,96,,15"  or  "142,96,-1,15"
   */
  NeoGuard.SerialConnection.prototype._parseLine = function (line) {
    if (!line) return null;
    var parts = line.split(',');
    if (parts.length < 2) return null;

    var missing = NeoGuard.config.serial.missingValue;

    function parseVal(str) {
      if (str === undefined || str === null) return null;
      str = str.trim();
      if (str === '') return null;
      var v = parseFloat(str);
      if (isNaN(v)) return null;
      if (v === missing) return null;
      return v;
    }

    var hr     = parseVal(parts[0]);
    var spo2   = parseVal(parts[1]);
    var temp   = parts.length > 2 ? parseVal(parts[2]) : null;
    var motion = parts.length > 3 ? parseVal(parts[3]) : null;

    // Determine quality
    var hrQ     = hr     === null ? 'no-sensor' : 'valid';
    var spo2Q   = spo2   === null ? 'no-sensor' : 'valid';
    var tempQ   = temp   === null ? 'no-sensor' : 'valid';
    var motionQ = motion === null ? 'no-sensor' : 'valid';

    // Motion-based quality override
    var threshold = NeoGuard.config.vitals.motion.unreliableThreshold;
    if (motion !== null && motion > threshold) {
      if (hrQ   === 'valid') hrQ   = 'unreliable';
      if (spo2Q === 'valid') spo2Q = 'unreliable';
    }

    return {
      timestamp:     Date.now(),
      hr: hr, spo2: spo2, temp: temp, motion: motion,
      hrQuality: hrQ, spo2Quality: spo2Q,
      tempQuality: tempQ, motionQuality: motionQ,
      simulated: false
    };
  };
})();
