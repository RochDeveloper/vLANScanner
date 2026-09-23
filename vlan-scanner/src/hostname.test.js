'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const {
  cleanHostname,
  parsePingHostname,
  parseNslookupHostname,
  parseNbtstatHostname,
  parseDnsServers,
  getHostname
} = require('./hostname');

test('cleanHostname rejects IPs and localhost', () => {
  assert.equal(cleanHostname('192.168.1.10', '192.168.1.10'), '');
  assert.equal(cleanHostname('localhost', '10.0.0.1'), '');
  assert.equal(cleanHostname('PC-CONTABILIDAD.', '10.0.0.1'), 'PC-CONTABILIDAD');
});

test('parsePingHostname understands English and Spanish', () => {
  assert.equal(
    parsePingHostname('Pinging DESKTOP-ABC [10.0.0.5] with 32 bytes of data:', '10.0.0.5'),
    'DESKTOP-ABC'
  );
  assert.equal(
    parsePingHostname('Haciendo ping a PC-OFICINA [10.0.0.8] con 32 bytes de datos:', '10.0.0.8'),
    'PC-OFICINA'
  );
  assert.equal(
    parsePingHostname('Haciendo ping a 10.0.0.8 con 32 bytes de datos:', '10.0.0.8'),
    ''
  );
});

test('parseNslookupHostname understands Name and Nombre', () => {
  assert.equal(parseNslookupHostname('Name:    host.dominio.local\r\nAddress: 10.0.0.2', '10.0.0.2'), 'host.dominio.local');
  assert.equal(parseNslookupHostname('Nombre:  caja01.tienda.local', '10.0.0.3'), 'caja01.tienda.local');
});

test('parseNbtstatHostname reads UNIQUE and Spanish UNICO', () => {
  const english = `
       Name               Type         Status
    ---------------------------------------------
    CONTADOR       <00>  UNIQUE      Registered
    WORKGROUP      <00>  GROUP       Registered
    CONTADOR       <20>  UNIQUE      Registered
`;
  assert.equal(parseNbtstatHostname(english, '10.1.1.1'), 'CONTADOR');

  const spanish = `
Nombre             Tipo         Estado
---------------------------------------------
CAJA01         <00>  ÚNICO      Registrado
WORKGROUP      <00>  GRUPO      Registrado
`;
  assert.equal(parseNbtstatHostname(spanish, '10.1.1.2'), 'CAJA01');
});

test('parseDnsServers reads Spanish ipconfig blocks', () => {
  const sample = `
   Puerta de enlace predeterminada. . . : 192.168.1.1
   Servidores DNS. . . . . . . . . . . . : 192.168.1.1
                                       8.8.8.8
`;
  assert.deepEqual(parseDnsServers(sample), ['192.168.1.1', '8.8.8.8']);
});

test('getHostname returns the computer name for its own IPv4 address', {
  skip: !Object.values(os.networkInterfaces()).flat().some((iface) =>
    (iface.family === 'IPv4' || iface.family === 4) && !iface.internal
  )
}, async () => {
  const localIp = Object.values(os.networkInterfaces()).flat()
    .find((iface) => (iface.family === 'IPv4' || iface.family === 4) && !iface.internal).address;

  assert.equal(await getHostname(localIp), os.hostname());
});
