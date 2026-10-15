'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PrinterProbe,
  classifyPrinterConnection,
  mapPrinterStatus,
  deriveManufacturer,
  parsePowerShellPrinters,
  parseWmicCsv
} = require('./printer-probe');

test('classifyPrinterConnection clasifica USB/red/local/otro', () => {
  assert.equal(classifyPrinterConnection({ portName: 'USB001', local: true, network: false }), 'USB');
  assert.equal(classifyPrinterConnection({ portName: 'IP_10.0.0.5', local: false, network: true }), 'Network');
  assert.equal(classifyPrinterConnection({ portName: 'PORTPROMPT:', local: true, network: false }), 'Local');
  assert.equal(classifyPrinterConnection({ portName: 'XPS:', local: true, network: false }), 'Other');
});

test('parsePowerShellPrinters acepta objeto único', () => {
  const printers = parsePowerShellPrinters(JSON.stringify({
    Name: 'HP LaserJet',
    PortName: 'USB001',
    DriverName: 'HP LaserJet PCL 6',
    Local: true,
    Network: false,
    Shared: false,
    PrinterStatus: 3
  }));
  assert.equal(printers.length, 1);
  assert.equal(printers[0].connectionType, 'USB');
  assert.equal(printers[0].source, 'win32_printer');
});

test('parsePowerShellPrinters acepta array', () => {
  const printers = parsePowerShellPrinters(JSON.stringify([
    { Name: 'EPSON L3250', PortName: 'USB002', DriverName: 'EPSON', PrinterStatus: 3 },
    { Name: 'PDF', PortName: 'PORTPROMPT:', DriverName: 'Microsoft', PrinterStatus: 3 }
  ]));
  assert.equal(printers.length, 2);
});

test('mapPrinterStatus y deriveManufacturer funcionan', () => {
  assert.equal(mapPrinterStatus(3), 'idle');
  assert.equal(mapPrinterStatus(4), 'printing');
  assert.equal(deriveManufacturer('HP LaserJet', 'HP PCL'), 'hp');
  assert.equal(deriveManufacturer('Generic', 'Generic'), null);
});

test('PrinterProbe invalid IP no ejecuta comando', async () => {
  let called = false;
  const runner = { async run() { called = true; return { stdout: '[]' }; } };
  const probe = new PrinterProbe({ commandRunner: runner, osHint: 'Windows' });
  const result = await probe.probe('999.1.1.1', { osHint: 'Windows' });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.printers.length, 0);
  assert.equal(called, false);
});

test('PrinterProbe unsupported para SO no Windows', async () => {
  let called = false;
  const runner = { async run() { called = true; return { stdout: '[]' }; } };
  const probe = new PrinterProbe({ commandRunner: runner });
  const result = await probe.probe('10.0.0.1', { osHint: 'Linux' });
  assert.equal(result.status, 'unsupported');
  assert.equal(called, false);
});

test('PrinterProbe timeout clasifica correctamente', async () => {
  const runner = {
    async run() {
      const err = new Error('timeout');
      err.killed = true;
      throw err;
    }
  };
  const probe = new PrinterProbe({ commandRunner: runner, enableWmicFallback: false, timeout: 8000 });
  const result = await probe.probe('10.0.0.1', { osHint: 'Windows' });
  assert.equal(result.status, 'timeout');
  assert.deepEqual(result.printers, []);
  assert.ok(result.elapsedMs <= 9000);
});

test('PrinterProbe acceso denegado clasifica failed', async () => {
  const runner = {
    async run() {
      const err = new Error('Access denied');
      err.code = 'EACCES';
      throw err;
    }
  };
  const probe = new PrinterProbe({ commandRunner: runner, enableWmicFallback: false });
  const result = await probe.probe('10.0.0.1', { osHint: 'Windows' });
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.printers, []);
});

test('PrinterProbe trunca a maxPrinters', async () => {
  const runner = {
    async run() {
      return { stdout: JSON.stringify([
        { Name: 'A', PortName: 'USB001', DriverName: 'A', PrinterStatus: 3 },
        { Name: 'B', PortName: 'USB002', DriverName: 'B', PrinterStatus: 3 }
      ]) };
    }
  };
  const probe = new PrinterProbe({ commandRunner: runner, maxPrinters: 1, enableWmicFallback: false });
  const result = await probe.probe('10.0.0.1', { osHint: 'Windows' });
  assert.equal(result.status, 'success');
  assert.equal(result.printers.length, 1);
});

test('parseWmicCsv parsea salida CSV', () => {
  const stdout = 'Node,Name,PortName,DriverName,Local,Network,Shared,PrinterStatus\nPC,EPSON L3250,USB002,EPSON L3250 Series,TRUE,FALSE,FALSE,3';
  const printers = parseWmicCsv(stdout);
  assert.equal(printers.length, 1);
  assert.equal(printers[0].connectionType, 'USB');
  assert.equal(printers[0].source, 'wmic_csv');
});
