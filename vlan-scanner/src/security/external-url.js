'use strict';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'ms-rd:']);

function validateExternalUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new Error('URL externa inválida');
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Protocolo externo no permitido');
  }
  if (parsed.username || parsed.password) {
    throw new Error('La URL no puede contener credenciales');
  }
  return parsed.toString();
}

module.exports = { validateExternalUrl, ALLOWED_PROTOCOLS };
