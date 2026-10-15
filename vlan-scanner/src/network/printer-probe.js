'use strict';

const { isIpv4 } = require('../domain/ip-address');

const MANUFACTURER_TOKENS = ['hp', 'epson', 'brother', 'canon', 'xerox', 'ricoh', 'kyocera', 'lexmark', 'zebra', 'konica'];

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
  if (port.startsWith('lpt') || port.startsWith('com') || port === 'file:' || port === 'nul:' || port === 'portprompt:') return 'Local';
  return 'Other';
}

function mapPrinterStatus(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (text === 'true' || text === 'false') return null;
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
  if (['idle', 'printing', 'offline', 'error', 'other'].includes(text)) return text;
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

function parsePowerShellPrinters(stdout) {
  let text = String(stdout || '').replace(/^\uFEFF/, '').trim();
  if (!text || text === '[]') return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      try { parsed = JSON.parse(match[1]); } catch (__) { return []; }
    } else {
      return [];
    }
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  const printers = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const printer = buildPrinterInfo({
      Name: item.Name,
      PortName: item.PortName,
      DriverName: item.DriverName,
      Local: item.Local,
      Network: item.Network,
      Shared: item.Shared,
      PrinterStatus: item.PrinterStatus
    }, 'win32_printer');
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

  _buildPrimaryScript(ip) {
    return [
      "$ErrorActionPreference='Stop';",
      `$items = @(Get-CimInstance -ComputerName '${ip}' -ClassName Win32_Printer -ErrorAction Stop |`,
      '  Select-Object Name, PortName, DriverName, Local, Network, Shared, PrinterStatus, Location);',
      "if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Compress -Depth 2 }"
    ].join(' ');
  }

  _isTimeout(error, elapsedMs) {
    return !!(error && (error.killed === true || error.signal === 'SIGTERM')) || elapsedMs >= this.timeout;
  }

  _isCancelled(error) {
    return !!error && (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.message === 'Operación cancelada');
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

    try {
      const script = this._buildPrimaryScript(ip);
      const runResult = await this.commandRunner.run(this.powershellPath, [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
      ], { timeout: this.timeout, signal, windowsHide: true });

      const rawStdout = (runResult && runResult.stdout) ? runResult.stdout : '';
      const stdout = rawStdout.length > this.maxStdoutBytes ? rawStdout.slice(0, this.maxStdoutBytes) : rawStdout;
      const printers = parsePowerShellPrinters(stdout).slice(0, this.maxPrinters);
      return { status: 'success', printers, elapsedMs: elapsed(), error: null };
    } catch (primaryError) {
      if (this._isCancelled(primaryError) || signal?.aborted) {
        return { status: 'cancelled', printers: [], elapsedMs: elapsed(), error: { code: 'CANCELLED', message: 'Operación cancelada' } };
      }
      if (this._isTimeout(primaryError, elapsed())) {
        return { status: 'timeout', printers: [], elapsedMs: elapsed(), error: { code: 'TIMEOUT', message: sanitizeError(primaryError) } };
      }

      if (this.enableWmicFallback) {
        try {
          const fallbackRun = await this.commandRunner.run(this.wmicPath, [
            `/node:"${ip}"`,
            'printer',
            'get',
            'Name,PortName,DriverName,Local,Network,Shared,PrinterStatus',
            '/format:csv'
          ], { timeout: this.timeout, signal, windowsHide: true });
          const rawStdout = (fallbackRun && fallbackRun.stdout) ? fallbackRun.stdout : '';
          const stdout = rawStdout.length > this.maxStdoutBytes ? rawStdout.slice(0, this.maxStdoutBytes) : rawStdout;
          const printers = parseWmicCsv(stdout).slice(0, this.maxPrinters);
          return { status: 'success', printers, elapsedMs: elapsed(), error: null };
        } catch (fallbackError) {
          if (this._isCancelled(fallbackError) || signal?.aborted) {
            return { status: 'cancelled', printers: [], elapsedMs: elapsed(), error: { code: 'CANCELLED', message: 'Operación cancelada' } };
          }
          if (this._isTimeout(fallbackError, elapsed())) {
            return { status: 'timeout', printers: [], elapsedMs: elapsed(), error: { code: 'TIMEOUT', message: sanitizeError(fallbackError) } };
          }
          const unavailable = !fallbackError || fallbackError.code === 'ENOENT'
            || /not found|enoent/i.test(String(fallbackError.code || fallbackError.message || ''));
          return {
            status: 'failed',
            printers: [],
            elapsedMs: elapsed(),
            error: {
              code: unavailable ? 'PRIMARY_AND_FALLBACK_UNAVAILABLE' : 'COMMAND_FAILED',
              message: sanitizeError(primaryError)
            }
          };
        }
      }

      return {
        status: 'failed',
        printers: [],
        elapsedMs: elapsed(),
        error: {
          code: (primaryError && primaryError.code) ? String(primaryError.code) : 'COMMAND_FAILED',
          message: sanitizeError(primaryError)
        }
      };
    }
  }
}

module.exports = {
  PrinterProbe,
  classifyPrinterConnection,
  mapPrinterStatus,
  deriveManufacturer,
  parsePowerShellPrinters,
  parseWmicCsv
};
