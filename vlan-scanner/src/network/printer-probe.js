'use strict';

const { isIpv4 } = require('../domain/ip-address');

const MANUFACTURER_TOKENS = ['hp', 'epson', 'brother', 'canon', 'xerox', 'ricoh', 'kyocera', 'lexmark', 'zebra', 'konica', 'godex', 'pantum', 'oki', 'sharp'];

function sanitizeError(error) {
  const raw = (error && (error.stderr || error.message || error.code))
    ? String(error.stderr || error.message || error.code)
    : String(error || 'Error');
  return raw.trim().replace(/\s+/g, ' ').slice(0, 240);
}

function classifyPrinterConnection({ portName, local, network }) {
  const port = String(portName || '').toLowerCase().trim();
  if (network === true) return 'Network';
  if (!port) return (local === false) ? 'Network' : 'Local';
  if (port.includes('usb')) return 'USB';
  if (port.startsWith('ip_') || port.startsWith('wsd') || port.startsWith('\\\\') || port.includes('\\')) return 'Network';
  if (port.startsWith('lpt') || port.startsWith('com') || port === 'file:' || port === 'nul:' || port === 'portprompt:' || port.startsWith('shrfax')) return 'Local';
  return 'Other';
}

// Acepta el codigo numerico de Win32_Printer y las cadenas de Get-Printer
// ("Normal", "Error, PendingDeletion", "Paused", "Offline"...).
function mapPrinterStatus(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text === 'true' || text === 'false') return null;
  const lower = text.toLowerCase();
  if (lower === 'unknown') return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    switch (numeric) {
      case 1: return 'other';
      case 2: return null;
      case 3: return 'idle';
      case 4: return 'printing';
      case 5: return 'other';
      case 6: return 'printing';
      case 7: return 'offline';
      default: return 'other';
    }
  }
  if (lower.includes('printing')) return 'printing';
  if (lower.includes('error') || lower.includes('paper jam') || lower.includes('paperout') || lower.includes('no paper')) return 'error';
  if (lower.includes('paused') || lower.includes('offline')) return 'offline';
  if (lower.includes('normal') || lower.includes('idle')) return 'idle';
  if (['idle', 'printing', 'offline', 'error', 'other'].includes(lower)) return lower;
  return 'other';
}

function deriveManufacturer(name, driverName) {
  const haystack = `${name || ''} ${driverName || ''}`.toLowerCase();
  return MANUFACTURER_TOKENS.find((token) => haystack.includes(token)) || null;
}

function normalizeField(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toUpperCase();
  if (text === 'TRUE' || text === '1' || text === 'YES') return true;
  if (text === 'FALSE' || text === '0' || text === 'NO') return false;
  return null;
}

function buildPrinterInfo(raw, source) {
  const name = typeof raw.Name === 'string'
    ? raw.Name.trim()
    : (raw.Name === null || raw.Name === undefined ? '' : String(raw.Name).trim());
  if (!name) return null;
  const port = normalizeField(raw.PortName);
  const local = parseBool(raw.Local);
  const network = parseBool(raw.Network);
  return {
    name,
    connectionType: classifyPrinterConnection({ portName: port, local, network: network === true }),
    port,
    model: normalizeField(raw.DriverName),
    manufacturer: deriveManufacturer(name, raw.DriverName),
    status: mapPrinterStatus(raw.PrinterStatus),
    shared: parseBool(raw.Shared),
    shareName: normalizeField(raw.ShareName),
    published: parseBool(raw.Published),
    source
  };
}

function dedupePrinters(printers) {
  const seen = new Set();
  const result = [];
  for (const printer of printers) {
    const key = `${printer.name}|${printer.port || ''}|${printer.connectionType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(printer);
  }
  return result;
}

// Extrae un array de objetos del stdout de PowerShell (JSON puro o JSON envuelto
// en texto de advertencia).
function parseJsonPayload(stdout) {
  let text = String(stdout || '').replace(/^\uFEFF/, '').trim();
  if (!text || text === '[]') return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!match) return [];
    try { parsed = JSON.parse(match[1]); } catch (__) { return []; }
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

function parsePowerShellPrinters(stdout) {
  const printers = [];
  for (const item of parseJsonPayload(stdout)) {
    const printer = buildPrinterInfo({
      Name: item.Name,
      PortName: item.PortName,
      DriverName: item.DriverName,
      Local: item.Local,
      Network: item.Network,
      Shared: item.Shared,
      ShareName: item.ShareName,
      Published: item.Published,
      PrinterStatus: item.PrinterStatus
    }, 'win32_printer');
    if (printer) printers.push(printer);
  }
  return dedupePrinters(printers);
}

// Get-Printer expone Type ('Local' | 'Connect') en lugar de Local/Network.
function parseGetPrinterPrinters(stdout) {
  const printers = [];
  for (const item of parseJsonPayload(stdout)) {
    const type = normalizeField(item.Type);
    const isConnect = String(type || '').toLowerCase() === 'connect';
    const printer = buildPrinterInfo({
      Name: item.Name,
      PortName: item.PortName,
      DriverName: item.DriverName,
      Local: type ? (isConnect ? 'FALSE' : 'TRUE') : undefined,
      Network: type ? (isConnect ? 'TRUE' : 'FALSE') : undefined,
      Shared: item.Shared,
      ShareName: item.ShareName,
      Published: item.Published,
      PrinterStatus: item.PrinterStatus
    }, 'get_printer');
    if (printer) printers.push(printer);
  }
  return dedupePrinters(printers);
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function parseWmicCsv(stdout) {
  const text = String(stdout || '').replace(/^\uFEFF/, '').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headerLine = lines.shift();
  const headers = splitCsvLine(headerLine).map((value) => value.toLowerCase());
  const indexOf = (name) => headers.findIndex((header) => header === name.toLowerCase());
  const nameIndex = indexOf('Name');
  const portIndex = indexOf('PortName');
  const driverIndex = indexOf('DriverName');
  const localIndex = indexOf('Local');
  const networkIndex = indexOf('Network');
  const sharedIndex = indexOf('Shared');
  const shareNameIndex = indexOf('ShareName');
  const statusIndex = indexOf('PrinterStatus');

  const printers = [];
  for (const line of lines) {
    const fields = splitCsvLine(line);
    const raw = {
      Name: nameIndex >= 0 ? fields[nameIndex] : '',
      PortName: portIndex >= 0 ? fields[portIndex] : '',
      DriverName: driverIndex >= 0 ? fields[driverIndex] : '',
      Local: localIndex >= 0 ? fields[localIndex] : '',
      Network: networkIndex >= 0 ? fields[networkIndex] : '',
      Shared: sharedIndex >= 0 ? fields[sharedIndex] : '',
      ShareName: shareNameIndex >= 0 ? fields[shareNameIndex] : '',
      PrinterStatus: statusIndex >= 0 ? fields[statusIndex] : ''
    };
    const printer = buildPrinterInfo(raw, 'wmic_csv');
    if (printer) printers.push(printer);
  }
  return dedupePrinters(printers);
}

class PrinterProbe {
  constructor({
    commandRunner = null,
    timeout = 8000,
    maxPrinters = 50,
    maxStdoutBytes = 262144,
    powershellPath = process.platform === 'win32' ? 'powershell.exe' : 'powershell',
    enableWmicFallback = true,
    wmicPath = 'wmic'
  } = {}) {
    if (!commandRunner) {
      const { CommandRunner } = require('../platform/command-runner');
      commandRunner = new CommandRunner();
    }
    this.commandRunner = commandRunner;
    this.timeout = Math.min(Math.max(Number(timeout) || 8000, 1), 15000);
    this.maxPrinters = Math.max(1, Number(maxPrinters) || 50);
    this.maxStdoutBytes = Math.max(1024, Number(maxStdoutBytes) || 262144);
    this.powershellPath = powershellPath;
    this.enableWmicFallback = !!enableWmicFallback;
    this.wmicPath = wmicPath;
  }

  _buildGetPrinterScript(ip) {
    return [
      "$ErrorActionPreference='Stop';",
      `$items = @(Get-Printer -ComputerName '${ip}' -ErrorAction Stop | ForEach-Object {`,
      '  [PSCustomObject]@{',
      '    Name = $_.Name;',
      '    PortName = $_.PortName;',
      '    DriverName = $_.DriverName;',
      '    Shared = [bool]$_.Shared;',
      '    ShareName = $_.ShareName;',
      '    Published = [bool]$_.Published;',
      '    PrinterStatus = [string]$_.PrinterStatus;',
      '    Type = [string]$_.Type',
      '  }',
      '});',
      "if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Compress -Depth 2 }"
    ].join(' ');
  }

  _buildPrimaryScript(ip) {
    return [
      "$ErrorActionPreference='Stop';",
      `$items = @(Get-CimInstance -ComputerName '${ip}' -ClassName Win32_Printer -ErrorAction Stop |`,
      '  Select-Object Name, PortName, DriverName, Local, Network, Shared, ShareName, PrinterStatus, Location);',
      "if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Compress -Depth 2 }"
    ].join(' ');
  }

  // Get-Printer habla con el spooler por RPC y funciona en redes sin WinRM
  // configurado; Win32_Printer (CIM) requiere TrustedHosts y wmic ya no existe
  // en Windows 11 24H2+, asi que se prueban en orden hasta que una responda.
  _strategies(ip) {
    const runOptions = { timeout: this.timeout, windowsHide: true };
    const strategies = [
      {
        name: 'get_printer',
        parse: parseGetPrinterPrinters,
        run: (signal) => this.commandRunner.run(this.powershellPath, [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', this._buildGetPrinterScript(ip)
        ], { ...runOptions, signal })
      },
      {
        name: 'win32_printer',
        parse: parsePowerShellPrinters,
        run: (signal) => this.commandRunner.run(this.powershellPath, [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', this._buildPrimaryScript(ip)
        ], { ...runOptions, signal })
      }
    ];
    if (this.enableWmicFallback) {
      strategies.push({
        name: 'wmic_csv',
        parse: parseWmicCsv,
        run: (signal) => this.commandRunner.run(this.wmicPath, [
          `/node:"${ip}"`,
          'printer',
          'get',
          'Name,PortName,DriverName,Local,Network,Shared,ShareName,PrinterStatus',
          '/format:csv'
        ], { ...runOptions, signal })
      });
    }
    return strategies;
  }

  _isTimeout(error, elapsedMs) {
    return !!(error && (error.killed === true || error.signal === 'SIGTERM')) || elapsedMs >= this.timeout;
  }

  _isCancelled(error) {
    return !!error && (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.message === 'Operación cancelada');
  }

  _isUnavailable(error) {
    const text = String((error && (error.code || error.message)) || '');
    return error?.code === 'ENOENT' || /not recognized|not found|no se reconoce|enoent/i.test(text);
  }

  async probe(ip, { signal, osHint } = {}) {
    const startedAt = Date.now();
    if (signal?.aborted) {
      return { status: 'cancelled', printers: [], elapsedMs: 0, error: { code: 'CANCELLED', message: 'Operación cancelada' } };
    }
    if (!isIpv4(ip)) {
      return { status: 'unsupported', printers: [], elapsedMs: 0, error: { code: 'INVALID_IP', message: 'IP inválida' } };
    }
    if (osHint && !/windows/i.test(String(osHint))) {
      return { status: 'unsupported', printers: [], elapsedMs: 0, error: null };
    }

    const elapsed = () => Math.max(0, Date.now() - startedAt);
    const failures = [];
    let emptyResult = false;

    for (const strategy of this._strategies(ip)) {
      try {
        const runResult = await strategy.run(signal);
        const rawStdout = (runResult && runResult.stdout) ? runResult.stdout : '';
        const stdout = rawStdout.length > this.maxStdoutBytes ? rawStdout.slice(0, this.maxStdoutBytes) : rawStdout;
        const printers = strategy.parse(stdout).slice(0, this.maxPrinters);
        if (printers.length > 0) {
          return { status: 'success', printers, elapsedMs: elapsed(), error: null };
        }
        // Respuesta vacia es inconcluyente: el spooler pudo estar bloqueado.
        emptyResult = true;
        failures.push({ strategy: strategy.name, message: 'sin impresoras reportadas' });
      } catch (error) {
        if (this._isCancelled(error) || signal?.aborted) {
          return { status: 'cancelled', printers: [], elapsedMs: elapsed(), error: { code: 'CANCELLED', message: 'Operación cancelada' } };
        }
        if (this._isTimeout(error, elapsed())) {
          return { status: 'timeout', printers: [], elapsedMs: elapsed(), error: { code: 'TIMEOUT', message: sanitizeError(error) } };
        }
        failures.push({ strategy: strategy.name, message: sanitizeError(error) });
      }
    }

    if (emptyResult) {
      return { status: 'success', printers: [], elapsedMs: elapsed(), error: null };
    }

    const unavailable = failures.length > 0 && failures.every((failure) => this._isUnavailable({ message: failure.message }));
    return {
      status: 'failed',
      printers: [],
      elapsedMs: elapsed(),
      error: {
        code: unavailable ? 'PRINTER_QUERY_UNAVAILABLE' : 'PRINTER_QUERY_FAILED',
        message: failures.map((failure) => `${failure.strategy}: ${failure.message}`).join(' | ').slice(0, 400)
      }
    };
  }
}

module.exports = {
  PrinterProbe,
  classifyPrinterConnection,
  mapPrinterStatus,
  deriveManufacturer,
  parsePowerShellPrinters,
  parseGetPrinterPrinters,
  parseWmicCsv
};
