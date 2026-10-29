/**
 * NeoGuard — CSV Export
 * Exports the session data buffer as a downloadable CSV file.
 */
(function () {
  'use strict';
  window.NeoGuard = window.NeoGuard || {};

  /**
   * Export the data buffer as a CSV file download.
   * @param {Array} dataBuffer — Array of data point objects
   * @param {string} [filename] — Optional filename override
   */
  NeoGuard.exportCSV = function (dataBuffer, filename) {
    if (!dataBuffer || dataBuffer.length === 0) {
      alert('No data to export. Run the simulation for a while first.');
      return;
    }

    filename = filename ||
      'neoguard-session-' +
      new Date().toISOString().slice(0, 19).replace(/:/g, '-') +
      '.csv';

    var headers = [
      'Timestamp',
      'HR (bpm)', 'HR Quality',
      'SpO2 (%)', 'SpO2 Quality',
      'Temp (°C)', 'Temp Quality',
      'Motion', 'Motion Quality',
      'Severity Score', 'Severity Category',
      'Data Source'
    ];

    var rows = [];
    for (var i = 0; i < dataBuffer.length; i++) {
      var d = dataBuffer[i];
      rows.push([
        d.timestamp ? new Date(d.timestamp).toISOString() : '',
        d.hr != null ? d.hr : '',
        d.hrQuality || '',
        d.spo2 != null ? d.spo2 : '',
        d.spo2Quality || '',
        d.temp != null ? d.temp : '',
        d.tempQuality || '',
        d.motion != null ? d.motion : '',
        d.motionQuality || '',
        d.severityScore != null ? d.severityScore : '',
        d.severityCategory || '',
        d.simulated ? 'Simulated' : 'Serial'
      ].join(','));
    }

    var csv = headers.join(',') + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
})();
