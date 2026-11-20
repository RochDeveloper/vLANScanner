'use strict';

const { randomUUID } = require('crypto');
const { compareIPv4, ipv4ToNumber, isIpv4 } = require('../domain/ip-address');
const { normalizeScanCategory, getScanCategory } = require('../shared/scan-categories');

const MAX_SCAN_ADDRESSES = 65535;

function normalizeRunId(value) {
  const runId = typeof value === 'string' && value.trim() ? value.trim() : randomUUID();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(runId)) throw new Error('Identificador de escaneo inválido');
  return runId;
}

function createScanPlan(request = {}, { maxAddresses = MAX_SCAN_ADDRESSES } = {}) {
  if (!request || typeof request !== 'object') throw new TypeError('Solicitud de escaneo inválida');
  const fromIp = String(request.fromIp || '').trim();
  const toIp = String(request.toIp || '').trim();
  if (!isIpv4(fromIp) || !isIpv4(toIp)) throw new Error('Rango IPv4 inválido');
  if (compareIPv4(fromIp, toIp) > 0) throw new Error('El inicio del rango debe ser anterior al final');

  const fromNumber = ipv4ToNumber(fromIp);
  const toNumber = ipv4ToNumber(toIp);
  const total = toNumber - fromNumber + 1;
  if (total > maxAddresses) throw new Error(`El rango supera el máximo de ${maxAddresses.toLocaleString('es-ES')} direcciones`);

  const category = normalizeScanCategory(request.category);
  const categoryInfo = getScanCategory(category);

  return {
    runId: normalizeRunId(request.runId),
    fromIp,
    toIp,
    fromNumber,
    toNumber,
    total,
    category,
    categoryLabel: categoryInfo.shortLabel,
    // Identificar una categoría concreta exige escanear puertos; sin ellos la
    // clasificación cae en el valor por defecto y el filtro no tendría sentido.
    scanPorts: category === 'all' ? request.scanPorts !== false : true,
    resolveHostnames: request.resolveHostnames !== false,
    // El sondeo remoto de impresoras aporta datos en los escaneos que pueden
    // incluir equipos Windows que comparten sus impresoras: workstations (la
    // columna «Impresora compartida»), impresoras y el escaneo completo.
    probePrinters: request.probePrinters !== false
      && (category === 'all' || category === 'printer' || category === 'workstation')
  };
}

module.exports = { createScanPlan, normalizeRunId, MAX_SCAN_ADDRESSES };
