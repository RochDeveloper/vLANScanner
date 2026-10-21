'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PrinterProbe,
  classifyPrinterConnection,
  mapPrinterStatus,
  deriveManufacturer,
  parsePowerShellPrinters,
  parseGetPrinterPrinters,
  parseWmicCsv
} = require('./printer-probe');

// Muestra real de EB0607 (172.16.11.177) obtenida con Get-Printer -ComputerName.
const EB0607_GET_PRINTER = [
  { Name: 'Microsoft XPS Document Writer', PortName: 'PORTPROMPT:', DriverName: 'Microsoft XPS Document Writer v4', Shared: false, ShareName: '', Published: false, PrinterStatus: 'Normal', Type: 'Local' },
  { Name: 'Godex RT700i#1', PortName: 'USB001', DriverName: 'Godex RT700i', Shared: false, ShareName: '', Published: false, PrinterStatus: 'Error, PendingDeletion', Type: 'Local' },
  { Name: 'Godex RT700i', PortName: 'USB002', DriverName: 'Godex RT700i', Shared: true, ShareName: 'Godex Almacen2', Published: true, PrinterStatus: 'Normal', Type: 'Local' },
  { Name: 'Fax', PortName: 'SHRFAX:', DriverName: 'Microsoft Shared Fax Driver', Shared: false, ShareName: '', Published: false, PrinterStatus: 'Normal', Type: 'Local' }
];

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

test('mapPrinterStatus entiende las cadenas de Get-Printer', () => {
  assert.equal(mapPrinterStatus('Normal'), 'idle');
  assert.equal(mapPrinterStatus('Error, PendingDeletion'), 'error');
  assert.equal(mapPrinterStatus('Paused'), 'offline');
  assert.equal(mapPrinterStatus('Offline'), 'offline');
  assert.equal(mapPrinterStatus('Printing'), 'printing');
  assert.equal(mapPrinterStatus('Unknown'), null);
  assert.equal(mapPrinterStatus(null), null);
});

test('parseGetPrinterPrinters detecta la impresora compartida de EB0607', () => {
  const printers = parseGetPrinterPrinters(JSON.stringify(EB0607_GET_PRINTER));
  assert.equal(printers.length, 4);
  const shared = printers.filter((printer) => printer.shared === true);
  assert.equal(shared.length, 1);
  assert.equal(shared[0].name, 'Godex RT700i');
  assert.equal(shared[0].shareName, 'Godex Almacen2');
  assert.equal(shared[0].published, true);
  assert.equal(shared[0].connectionType, 'USB');
  assert.equal(shared[0].port, 'USB002');
  assert.equal(shared[0].status, 'idle');
  assert.equal(shared[0].source, 'get_printer');
  assert.equal(shared[0].manufacturer, 'godex');
});

test('el driver "Microsoft Shared Fax Driver" no cuenta como impresora compartida', () => {
  const printers = parseGetPrinterPrinters(JSON.stringify(EB0607_GET_PRINTER));
  const fax = printers.find((printer) => printer.name === 'Fax');
  assert.equal(fax.shared, false);
  assert.equal(fax.shareName, null);
  assert.equal(fax.connectionType, 'Local');
});

test('parseGetPrinterPrinters marca la cola en error de EB0607', () => {
  const printers = parseGetPrinterPrinters(JSON.stringify(EB0607_GET_PRINTER));
  const stale = printers.find((printer) => printer.name === 'Godex RT700i#1');
  assert.equal(stale.status, 'error');
  assert.equal(stale.shared, false);
});

test('PrinterProbe usa Get-Printer como estrategia primaria', async () => {
  const calls = [];
  const runner = {
    async run(file, args) {
      calls.push(args.join(' '));
      return { stdout: JSON.stringify(EB0607_GET_PRINTER) };
    }
  };
  const probe = new PrinterProbe({ commandRunner: runner, enableWmicFallback: false });
  const result = await probe.probe('172.16.11.177', { osHint: 'Windows' });
  assert.equal(result.status, 'success');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Get-Printer/);
  assert.equal(result.printers.filter((printer) => printer.shared === true).length, 1);
});

test('PrinterProbe cae a win32_printer cuando Get-Printer no responde', async () => {
  const calls = [];
  const runner = {
    async run(file, args) {
      const command = args.join(' ');
      calls.push(command);
      if (command.includes('Get-Printer')) {
        const err = new Error('The spooler service is not reachable.');
        throw err;
      }
      return {
        stdout: JSON.stringify([{
          Name: 'Godex RT700i',
          PortName: 'USB002',
          DriverName: 'Godex RT700i',
          Shared: true,
          ShareName: 'Godex Almacen2',
          PrinterStatus: 3
        }])
      };
    }
  };
  const probe = new PrinterProbe({ commandRunner: runner, enableWmicFallback: false });
  const result = await probe.probe('172.16.11.177', { osHint: 'Windows' });
  assert.equal(result.status, 'success');
  assert.equal(calls.length, 2);
  assert.equal(result.printers[0].source, 'win32_printer');
  assert.equal(result.printers[0].shared, true);
  assert.equal(result.printers[0].shareName, 'Godex Almacen2');
});

test('PrinterProbe acumula los errores de cada estrategia', async () => {
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
  assert.equal(result.error.code, 'PRINTER_QUERY_FAILED');
  assert.match(result.error.message, /get_printer/);
  assert.match(result.error.message, /win32_printer/);
});

test('PrinterProbe responde success con lista vacia si ninguna estrategia falla', async () => {
  const runner = { async run() { return { stdout: '[]' }; } };
  const probe = new PrinterProbe({ commandRunner: runner, enableWmicFallback: false });
  const result = await probe.probe('10.0.0.1', { osHint: 'Windows' });
  assert.equal(result.status, 'success');
  assert.deepEqual(result.printers, []);
});
