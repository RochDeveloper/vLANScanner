'use strict';

const fs = require('fs');

const CSV_COLUMNS = [
  ['ip', 'IP'],
  ['hostname', 'Hostname'],
  ['mac', 'MAC'],
  ['vendor', 'Vendor'],
  ['deviceType', 'Device Type'],
  ['os', 'OS'],
  ['httpInfo', 'HTTP Info'],
  ['openPorts', 'Open Ports'],
  ['latencyMs', 'Ping'],
  ['usbPrinterCount', 'USB Printers'],
  ['sharedPrinterCount', 'Shared Printers'],
  ['printerProbeStatus', 'Printer Probe'],
  ['printers', 'Printers'],
  ['phoneOS', 'Phone OS'],
  ['phoneHint', 'Phone Hint'],
  ['phoneConfidence', 'Phone Confidence'],
  ['phoneEvidence', 'Phone Evidence']
];

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function serializeResults(data, format) {
  if (!Array.isArray(data)) throw new TypeError('Los resultados deben ser un array');
  if (format === 'json') return JSON.stringify(data, null, 2);
  if (format !== 'csv') throw new Error('Formato de exportación no soportado');

  const header = CSV_COLUMNS.map(([, label]) => label).join(',');
  const rows = data.map((host) => CSV_COLUMNS.map(([key]) => {
    if (key === 'openPorts') return csvCell((host.openPorts || []).join(','));
    if (key === 'printers') {
      const text = (host.printers || [])
        .map((printer) => {
          const details = `${printer.name || 'Desconocida'} [${printer.connectionType}${printer.port ? ` / ${printer.port}` : ''}]`;
          if (printer.shared !== true) return details;
          return `${details} COMPARTIDA${printer.shareName ? ` (${printer.shareName})` : ''}`;
        })
        .join('; ');
      return csvCell(text);
    }
    if (key === 'printerProbeStatus') return csvCell(host.printerProbe?.status || '');
    if (key === 'phoneEvidence') return csvCell((host.phoneEvidence || []).join('; '));
    return csvCell(host[key]);
  }).join(','));
  return [header, ...rows].join('\n');
}

class ResultExporter {
  constructor({ dialog, shell, writeFile = fs.promises.writeFile } = {}) {
    this.dialog = dialog;
    this.shell = shell;
    this.writeFile = writeFile;
  }

  async export(data, format) {
    const content = serializeResults(data, format);
    const { filePath } = await this.dialog.showSaveDialog({
      title: 'Exportar resultados',
      defaultPath: `network-scan-${Date.now()}`,
      filters: format === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!filePath) return false;
    await this.writeFile(filePath, content, 'utf8');
    this.shell.showItemInFileManager(filePath);
    return true;
  }
}

module.exports = { ResultExporter, serializeResults, csvCell };
