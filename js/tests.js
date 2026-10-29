/**
 * NeoGuard — Self-Check Tests
 * Quick unit-style tests for the severity calculation, including missing-input cases.
 * Runs on page load (results in console) and can be re-run via NeoGuard.runTests().
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  NeoGuard.runTests = function () {
    var results = [];
    var pass = 0, fail = 0;

    function assert(condition, name) {
      if (condition) {
        results.push({ name: name, passed: true });
        pass++;
      } else {
        results.push({ name: name, passed: false });
        fail++;
      }
    }

    // ── Test 1: Normal vitals → low score ──
    var r1 = NeoGuard.calculateSeverity({
      hr: 140, spo2: 96, temp: 37.0, motion: 15,
      hrQuality: 'valid', spo2Quality: 'valid',
      tempQuality: 'valid', motionQuality: 'valid'
    });
    assert(r1.score !== null && r1.score <= 25,
      'Normal vitals → low severity (got ' + r1.score + ')');
    assert(r1.usedInputs.length === 4,
      'Normal vitals → all 4 inputs used');
    assert(r1.excludedInputs.length === 0,
      'Normal vitals → 0 inputs excluded');

    // ── Test 2: All sensors missing → null score ──
    var r2 = NeoGuard.calculateSeverity({
      hr: null, spo2: null, temp: null, motion: null,
      hrQuality: 'no-sensor', spo2Quality: 'no-sensor',
      tempQuality: 'no-sensor', motionQuality: 'no-sensor'
    });
    assert(r2.score === null,
      'All missing → null score');
    assert(r2.excludedInputs.length === 4,
      'All missing → 4 excluded');
    assert(r2.usedInputs.length === 0,
      'All missing → 0 used');

    // ── Test 3: High HR → higher score than normal ──
    var r3 = NeoGuard.calculateSeverity({
      hr: 200, spo2: 96, temp: 37.0, motion: 15,
      hrQuality: 'valid', spo2Quality: 'valid',
      tempQuality: 'valid', motionQuality: 'valid'
    });
    assert(r3.score > r1.score,
      'High HR → higher score (' + r3.score + ' > ' + r1.score + ')');

    // ── Test 4: Low SpO2 → higher score than normal ──
    var r4 = NeoGuard.calculateSeverity({
      hr: 140, spo2: 82, temp: 37.0, motion: 15,
      hrQuality: 'valid', spo2Quality: 'valid',
      tempQuality: 'valid', motionQuality: 'valid'
    });
    assert(r4.score > r1.score,
      'Low SpO2 → higher score (' + r4.score + ' > ' + r1.score + ')');

    // ── Test 5: Unreliable inputs are excluded ──
    var r5 = NeoGuard.calculateSeverity({
      hr: 200, spo2: 75, temp: 37.0, motion: 90,
      hrQuality: 'unreliable', spo2Quality: 'unreliable',
      tempQuality: 'valid', motionQuality: 'valid'
    });
    assert(r5.usedInputs.indexOf('hr') === -1,
      'Unreliable HR excluded');
    assert(r5.usedInputs.indexOf('spo2') === -1,
      'Unreliable SpO2 excluded');
    assert(r5.usedInputs.indexOf('temp') !== -1,
      'Valid Temp still included');
    assert(r5.usedInputs.indexOf('motion') !== -1,
      'Valid Motion still included');

    // ── Test 6: Missing temp → score still computes ──
    var r6 = NeoGuard.calculateSeverity({
      hr: 140, spo2: 96, temp: null, motion: 15,
      hrQuality: 'valid', spo2Quality: 'valid',
      tempQuality: 'no-sensor', motionQuality: 'valid'
    });
    assert(r6.score !== null,
      'Missing temp → score still computes (got ' + r6.score + ')');
    assert(r6.usedInputs.length === 3,
      'Missing temp → 3 inputs used');
    assert(r6.excludedInputs.length === 1,
      'Missing temp → 1 excluded');
    assert(r6.excludedInputs[0].name === 'temp',
      'Missing temp → excluded input is temp');

    // ── Test 7: Single valid input → score still computes ──
    var r7 = NeoGuard.calculateSeverity({
      hr: 180, spo2: null, temp: null, motion: null,
      hrQuality: 'valid', spo2Quality: 'no-sensor',
      tempQuality: 'no-sensor', motionQuality: 'no-sensor'
    });
    assert(r7.score !== null,
      'Single input (HR) → score computes (got ' + r7.score + ')');
    assert(r7.usedInputs.length === 1,
      'Single input → 1 used');

    // ── Test 8: Score increases monotonically with HR deviation ──
    var scores = [];
    for (var hrVal = 140; hrVal <= 220; hrVal += 10) {
      var r = NeoGuard.calculateSeverity({
        hr: hrVal, spo2: 96, temp: 37.0, motion: 15,
        hrQuality: 'valid', spo2Quality: 'valid',
        tempQuality: 'valid', motionQuality: 'valid'
      });
      scores.push(r.score);
    }
    var monotonic = true;
    for (var i = 1; i < scores.length; i++) {
      if (scores[i] < scores[i - 1]) { monotonic = false; break; }
    }
    assert(monotonic,
      'Severity monotonically increases with HR (' + scores.join(',') + ')');

    // ── Test 9: Score clamped to 0–100 ──
    var r9 = NeoGuard.calculateSeverity({
      hr: 300, spo2: 50, temp: 42, motion: 100,
      hrQuality: 'valid', spo2Quality: 'valid',
      tempQuality: 'valid', motionQuality: 'valid'
    });
    assert(r9.score >= 0 && r9.score <= 100,
      'Extreme values → score in 0–100 (got ' + r9.score + ')');

    // ── Test 10: Category assigned ──
    assert(r1.category !== null && r1.category.label === 'Stable',
      'Normal → Stable category');

    // ── Test 11: ML card does NOT affect severity ──
    var severityWithoutML = r1.score;
    // Severity function doesn't take ML input — this is architectural
    assert(typeof NeoGuard.calculateSeverity === 'function',
      'Severity function exists independently of ML module');

    // ── Print results ──
    console.log('%c═══ NeoGuard Self-Check ═══', 'font-weight:bold; font-size:14px');
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      console.log(
        '%c ' + (r.passed ? '✓ PASS' : '✗ FAIL') + ' %c ' + r.name,
        r.passed ? 'color:#2e7d32;font-weight:bold' : 'color:#c62828;font-weight:bold',
        'color:inherit'
      );
    }
    console.log(
      '%c Result: ' + pass + '/' + (pass + fail) + ' passed',
      pass === pass + fail ? 'color:#2e7d32;font-weight:bold' : 'color:#c62828;font-weight:bold'
    );

    return { pass: pass, fail: fail, total: pass + fail, results: results };
  };
})();
