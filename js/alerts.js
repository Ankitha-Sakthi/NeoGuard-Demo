/**
 * NeoGuard — Alert Log
 * Timestamped event log with auto-pruning and listener callbacks.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  /**
   * @constructor
   * @param {number} [maxEntries] — Maximum log size (defaults to config value)
   */
  NeoGuard.AlertLog = function (maxEntries) {
    this.entries = [];
    this.maxEntries = maxEntries || 100;
    this._listeners = [];
  };

  /** Add a new alert entry. */
  NeoGuard.AlertLog.prototype.add = function (message, type) {
    var entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date(),
      message: message,
      type: type || 'info'   // 'info' | 'warning' | 'critical'
    };
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
    for (var i = 0; i < this._listeners.length; i++) {
      this._listeners[i](entry, this.entries);
    }
    return entry;
  };

  /** Clear all entries. */
  NeoGuard.AlertLog.prototype.clear = function () {
    this.entries = [];
    for (var i = 0; i < this._listeners.length; i++) {
      this._listeners[i](null, this.entries);
    }
  };

  /** Get a copy of all entries. */
  NeoGuard.AlertLog.prototype.getAll = function () {
    return this.entries.slice();
  };

  /** Register a listener: fn(newEntry|null, allEntries). */
  NeoGuard.AlertLog.prototype.onUpdate = function (fn) {
    this._listeners.push(fn);
  };
})();
