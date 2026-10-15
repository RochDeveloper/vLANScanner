# 02 - Task Breakdown (Planificador)

> Desglose técnico derivado de `.spec/01-master-spec.md`.
> Rol: Planificador. Solo contrato/plan, sin implementación.

## Estado
- Derivado de: `.spec/01-master-spec.md`
- Versión: 1.0
- Aprobado por Coordinador: Sí (2026-10-14)
- Estado de implementación: Listo para `Implementador`.

## 1. Arquitectura y stack

### 1.1 Stack actual (sin nuevas dependencias)
- Aplicación Electron (`main.js`), Node.js CommonJS, front-end Vanilla JS IIFE.
- Pruebas: `node --test` + `node scripts/check-syntax.js`.
- Ejecución de procesos: `src/platform/command-runner.js` (`child_process.execFile`, sin shell).
- Enriquecimiento: `HostEnricher` + `NetworkScanner` (lotes de 24 probes por ronda; enriquecimiento secuencial por host vivo).
- IPC existente: canales `scan-network`, `scan-progress`, `scan-host-found`, `scan-state`, `export-results`. **No se requieren canales nuevos**: los datos de impresoras viajan dentro del objeto host ya emitido.

### 1.2 Decisión de arquitectura
- **Nuevo módulo** `vlan-scanner/src/network/printer-probe.js` (`PrinterProbe`), en capa `network`, inyectado en `HostEnricher` de la misma forma que `smbProbe`.
- **Responsabilidad única**: ejecutar comandos Windows de solo lectura contra un host remoto (WMI/CIM) con timeout, parsear y normalizar las impresoras, clasificar la conexión (USB/Red/Local/Otro), reportar estado y nunca lanzar excepciones hacia el flujo de escaneo.
- **No se bloquea el escaneo**: toda falla se convierte en `printerProbe.status !== 'success'` y `printers: []`. `HostEnricher.enrich()` envuelve la llamada en `try/catch` defensivo y continúa con OS/clasificación.
- **Privacidad/seguridad**: entrada validada como IPv4, `execFile` (sin shell), argumentos fijos, `windowsHide: true`, timeout duro (`CommandRunner` + límite interno), sin credenciales en claro, sin persistencia automática (solo export explícito del usuario).
- **Compatibilidad**: solo hosts Windows alcanzables y que permitan WMI/DCOM (ver Limitaciones). Hosts no Windows quedan en estado `unsupported` sin intento remoto.

### 1.3 Decisiones técnicas puntuales
| Decisión | Elección | Motivo |
|---|---|---|
| Comando primario | `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command Get-CimInstance -ComputerName <ip> Win32_Printer` + `Select-Object` + `ConvertTo-Json` | Salida estructurada y parseable |
| Fallback (opcional, robustez) | `wmic /node:"<ip>" printer get Name,PortName,DriverName,Local,Network,Shared,PrinterStatus /format:csv` | Cubre hosts donde CIM falla pero WMI/DCOM responde |
| Timeout por host | `8000 ms` por defecto (configurable `printerProbeTimeoutMs`), máx. `15000 ms` | Master: timeouts cortos, no bloquear scan |
| Intento condicionado | Solo si `probePrinters !== false` y host parece Windows (`os` contiene "Windows" o puertos `135/139/445/5985` abiertos) | Evita timeouts hacia Linux/macOS |
| Concurrency | Sin cambios; enriquecimiento sigue serial por host vivo dentro del lote | No degradar rendimiento actual |
| Distinguir red vs USB | `connectionType === 'Network'` no suma a contador USB; no duplicar contra host ya tipificado como impresora de red | Evita duplicados engañosos |

### 1.4 Riesgo de rendimiento (medible)
- Presupuesto adicional por host vivo: `<= 8000 ms` en el peor caso.
- Si `N` hosts vivos y todos fallan por timeout, overhead total `<= N * 8000 ms` (enriquecimiento serial). Se registra métrica `printerProbe.elapsedMs` por host para auditar.

## 2. Tareas

<|end|> ID | Épica/REQ | Título | Alcance / Archivos | Dependencias |
|---|---|---|---|---|
| TASK-1 | EPIC-1 / REQ-1,REQ-2,REQ-3,REQ-4,REQ-7 | Crear módulo `PrinterProbe` (comandos Windows solo lectura, timeout, parsing, clasificación USB/Red/Local/Otro, manejo de errores) | Nuevo: `vlan-scanner/src/network/printer-probe.js`, `vlan-scanner/src/network/printer-probe.test.js` | `CommandRunner`, `cancellation` |
| TASK-2 | EPIC-1 / REQ-1,REQ-4 | Integrar `PrinterProbe` en `HostEnricher`, `NetworkScanner` y composición de servicios | Modificar: `host-enricher.js`, `host-enricher.test.js`, `network-scanner.js`, `scan-request.js`, `main.js` | TASK-1 |
| TASK-3 | EPIC-1 / REQ-2,REQ-5 | Contrato de datos host + helpers de conteo/estado de impresoras | Modificar: `host-enricher.js` (salida), `renderer/core/selectors.js` (búsqueda) | TASK-2 |
| TASK-4 | EPIC-2 / REQ-5 | Indicador/contador de impresoras USB en tabla de hosts | Modificar: `renderer/views/host-table.js`, `index.html` (nueva columna) | TASK-3 |
| TASK-5 | EPIC-2 / REQ-2,REQ-5 | Sección de impresoras detectadas en panel de detalle | Modificar: `renderer/views/detail-panel.js` | TASK-3 |
| TASK-6 | EPIC-2 / REQ-3,REQ-5 | Incluir impresoras en filtros/búsqueda y topología (etiqueta/tooltip) | Modificar: `renderer/core/selectors.js`, `renderer/views/topology-view.js` (opcional) | TASK-3, TASK-4 |
| TASK-7 | EPIC-2 / REQ-6 | Exportación CSV/JSON de impresoras por host | Modificar: `export/result-exporter.js`, `export/result-exporter.test.js` | TASK-3 |
| TASK-8 | All / REQ-1..REQ-7 | Pruebas, regresión y aceptación (impresoras) | Modificar/crear tests existentes; smoke manual UI | TASK-1..TASK-7 |
| TASK-9 | EPIC-3 / REQ-8,REQ-11 | Extender OUI y `VENDOR_GROUPS` con fabricantes móviles | Modificar: `oui-data.js`; tests OUI/vendor | — |
| TASK-10 | EPIC-3,EPIC-4 / REQ-8,REQ-9,REQ-10,REQ-11 | Crear `MobilePhoneClassifier` (heurísticas pasivas, `phoneOS`, `phoneHint`, confianza, evidencia, exclusiones) | Nuevo: `src/identification/mobile-phone-classifier.js`, `.test.js` | TASK-9 |
| TASK-11 | EPIC-3 / REQ-8,REQ-9,REQ-10 | Integrar smartphone en `DeviceClassifier` y pistas móviles en `OsFingerprintService` | Modificar: `device-classifier.js`, `os-detector.js`, `identification.test.js` | TASK-10 |
| TASK-12 | EPIC-3,EPIC-4 / REQ-8,REQ-9,REQ-11,REQ-13 | Integrar análisis móvil en `HostEnricher` y contrato host (`phone*`) | Modificar: `host-enricher.js`, `host-enricher.test.js` | TASK-11 |
| TASK-13 | EPIC-4 / REQ-12 | Icono/badge smartphone en tabla (`DEVICE_ICONS.smartphone`, tooltip) | Modificar: `catalogs.js`, `host-table.js` | TASK-12 |
| TASK-14 | EPIC-4 / REQ-9,REQ-12 | Sección "Teléfono móvil" en detalle | Modificar: `detail-panel.js` | TASK-12 |
| TASK-15 | EPIC-3,EPIC-4 / REQ-8,REQ-10,REQ-12 | Búsqueda inclusiva, filtro por tipo y badge topológico para smartphone | Modificar: `selectors.js`, `topology-view.js` (opcional) | TASK-12,TASK-13 |
| TASK-16 | EPIC-4 / REQ-12 | Exportación CSV/JSON de atributos móviles | Modificar: `result-exporter.js`, `result-exporter.test.js` | TASK-12 |
| TASK-17 | All / REQ-8..REQ-14 | Pruebas, regresión y aceptación de teléfonos | Tests nuevos/actualizados; smoke manual WiFi | TASK-9..TASK-16 |

## 3. Contratos técnicos

### TASK-1 — `PrinterProbe`

**Archivo**: `vlan-scanner/src/network/printer-probe.js`

**Tipos (JSDoc)**:
```ts
type PrinterConnectionType = 'USB' | 'Network' | 'Local' | 'Other' | 'Unknown';

interface PrinterInfo {
  name: string;                    // Name de Win32_Printer
  connectionType: PrinterConnectionType;
  port: string | null;             // PortName (USB001, IP_10.0.0.5, WSD-..., LPT1,...)
  model: string | null;            // DriverName
  manufacturer: string | null;     // heurística por nombre o null
  status: string | null;           // 'idle'|'printing'|'offline'|'error'|'other'|null
  shared: boolean | null;
  source: 'win32_printer' | 'wmic_csv';
}

interface PrinterProbeResult {
  status: 'success' | 'failed' | 'timeout' | 'cancelled' | 'skipped' | 'unsupported';
  printers: PrinterInfo[];
  elapsedMs: number;
  error?: { code: string; message: string } | null;
}
```

**Constructor**:
```js
class PrinterProbe {
  constructor({
    commandRunner = new CommandRunner(),
    timeout = 8000,                 // ms, duro
    maxPrinters = 50,
    maxStdoutBytes = 262144,        // protección contra salida gigante
    powershellPath = process.platform === 'win32' ? 'powershell.exe' : 'powershell',
    enableWmicFallback = true
  } = {})
}
```

**Firma principal**:
```js
async probe(ip, { signal, osHint } = {}) -> Promise<PrinterProbeResult>
```
- `ip` debe validar `isIpv4` (regex `\b(?:\d{1,3}\.){3}\d{1,3}\b` con octetos 0–255).
- Si `ip` inválido: `{ status: 'unsupported', printers: [], elapsedMs: 0, error: { code: 'INVALID_IP', message: 'IP inválida' } }`.
- Si `osHint` existe y no indica Windows y no hay puertos Windows (`135/139/445/5985`): retornar `status: 'unsupported'` sin comando.
- En todos los casos **no lanza**; captura y clasifica.

**Comando primario (PowerShell)**:
```js
const script = [
  "$ErrorActionPreference='Stop';",
  `$items = @(Get-CimInstance -ComputerName '${ip}' -ClassName Win32_Printer -ErrorAction Stop |`,
  "  Select-Object Name, PortName, DriverName, Local, Network, Shared, PrinterStatus, Location);",
  "if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Compress -Depth 2 }"
].join(' ');

this.commandRunner.run(powershellPath, [
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
], { timeout: this.timeout, signal, windowsHide: true })
```

**Script de fallback (solo si primario falla)**:
```js
wmic /node:"${ip}" printer get Name,PortName,DriverName,Local,Network,Shared,PrinterStatus /format:csv
```
Nota: `wmic` está deprecado en Windows modernos; es best-effort. Si no existe, marcar `source`/`error.code='PRIMARY_AND_FALLBACK_UNAVAILABLE'`.

**Parsing**:
```js
function parsePowerShellPrinters(stdout) -> PrinterInfo[]
```
- Limpia BOM y trim; si vacío → `[]`.
- `JSON.parse`; si objeto único → `[obj]`; si array → array.
- Valida `Name` string no vacío.
- Deduplica por clave `name|port|connectionType`.
- Trunca a `maxPrinters`.

**Helpers exportados**:
```js
classifyPrinterConnection({ portName, local, network }) -> PrinterConnectionType
mapPrinterStatus(value) -> string | null
deriveManufacturer(name, driverName) -> string | null
parseWmicCsv(stdout) -> PrinterInfo[]
```

**Heurística de conexión**:
```js
function classifyPrinterConnection({ portName, local, network }) {
  const port = String(portName || '').toLowerCase().trim();
  if (network === true) return 'Network';
  if (!port) return (local === false) ? 'Network' : 'Local';
  if (port.includes('usb')) return 'USB';
  if (port.startsWith('ip_') || port.startsWith('wsd') || port.startsWith('\\\\') || port.includes('\\')) return 'Network';
  if (port.startsWith('lpt') || port.startsWith('com') || port === 'file:' || port === 'nul:' || port === 'portprompt:') return 'Local';
  return 'Other';
}
```

**Heurística de fabricante** (opcional, solo firma):
- Busca tokens `[hp, epson, brother, canon, xerox, ricoh, kyocera, lexmark, zebra, konica]` en `name` o `driverName`.
- Si no coincide → `null`.

**Estados de resultado**:
- `success`: al menos ejecución completada (aunque `printers.length === 0`).
- `failed`: error no timeout (acceso denegado, firewall, DCOM, cmdlet no disponible).
- `timeout`: `err.killed === true`, `err.signal === 'SIGTERM'` o tiempo transcurrido `>= timeout`.
- `cancelled`: `AbortError` / `signal.aborted`.
- `skipped`: `probePrinters === false` (se marca en `HostEnricher`, no en `PrinterProbe`).
- `unsupported`: IP no válida o SO no Windows y sin puertos Windows.
- `error.message` **sanitizado**: recortado a 240 caracteres, sin stack trace ni rutas de usuario.

**Ejemplo de salida real**:
```json
{
  "status": "success",
  "elapsedMs": 3120,
  "printers": [
    {
      "name": "HP LaserJet Pro M404",
      "connectionType": "USB",
      "port": "USB001",
      "model": "HP LaserJet Pro M404-M405 PCL 6",
      "manufacturer": "hp",
      "status": "idle",
      "shared": false,
      "source": "win32_printer"
    },
    {
      "name": "Microsoft Print to PDF",
      "connectionType": "Local",
      "port": "PORTPROMPT:",
      "model": "Microsoft Print To PDF",
      "manufacturer": null,
      "status": "idle",
      "shared": false,
      "source": "win32_printer"
    }
  ]
}
```

### TASK-2 — Integración

**`HostEnricher`**:
- Nuevo parámetro constructor `printerProbe` (default `null`).
- Nuevo campo de instancia.
- Firma `enrich(pingResult, { resolveHostnames, scanPorts, probePrinters = true, signal, onPhase })`.
- Flujo propuesto:
  1. hostname/MAC (sin cambios).
  2. puertos (sin cambios).
  3. banners/SMB/SIP (sin cambios).
  4. OS.
  5. Clasificación de dispositivo (sin cambios).
  6. **Nuevo**: `onPhase('impresoras')` y llamada:
     ```js
     let printers = [];
     let printerProbeStatus = probePrinters ? 'skipped' : 'skipped';
     let printerProbeElapsedMs = 0;
     let printerProbeError = null;
     if (probePrinters && this.printerProbe) {
       const windowsLike = probeWindowsLikeHost({ os, openPorts });
       if (!windowsLike) {
         printerProbeStatus = 'unsupported';
       } else {
         const result = await this.printerProbe.probe(ip, { signal, osHint: os });
         printers = Array.isArray(result.printers) ? result.printers : [];
         printerProbeStatus = result.status;
         printerProbeElapsedMs = result.elapsedMs;
         printerProbeError = result.error || null;
       }
     }
     ```
  7. `throwIfAborted(signal)` **después** de la llamada (pero el probe ya respeta abort).
  8. Retorno extendido:
```js
return {
  ip, hostname, mac, vendor, openPorts, deviceType, os, latencyMs, status,
  printers,
  printerProbe: {
    status: printerProbeStatus,
    elapsedMs: printerProbeElapsedMs,
    error: printerProbeError
  },
  usbPrinterCount: printers.filter((p) => p.connectionType === 'USB').length
};
```
- **Nunca propagar** error de PrinterProbe: envolver en `try/catch` externo que registra `status: 'failed'` y `error: { code: 'UNHANDLED', message }`.

**Compatibilidad con tests existentes**: `host-enricher.test.js` debe inyectar:
```js
printerProbe: { probe: async () => ({ status: 'skipped', printers: [], elapsedMs: 0, error: null }) }
```
o `null`. Se añadirán tests:
- mock con impresoras USB devuelve host con `usbPrinterCount`.
- mock con fallo no rompe `enrich()`.
- `probePrinters: false` no llama probe.

**`NetworkScanner`**:
```js
const host = await this.hostEnricher.enrich(pingResult, {
  resolveHostnames: plan.resolveHostnames,
  scanPorts: plan.scanPorts,
  probePrinters: plan.probePrinters !== false,
  signal,
  onPhase: ...
});
```

**`scan-request.js`**:
- Añadir a plan:
```js
probePrinters: request.probePrinters !== false
```
- Default true para no romper clientes existentes.

**`main.js`**:
```js
const { PrinterProbe } = require('./network/printer-probe');
...
const printerProbe = new PrinterProbe({ timeout: 8000 });
const hostEnricher = new HostEnricher({ ..., printerProbe });
```
- Inyectar `printerProbe` en `ScanManager`? No necesario. `ScanManager` sólo expone plan; puede pasar `probePrinters` ya en request.

**Chivos IPC**: sin cambios. Opcional: `probePrinters` en request del renderer. No obligatorio para MVP; default true.

### TASK-3 — Contrato de datos y helpers

**Actualización del resultado host** (campos nuevos, siempre presentes):
```js
{
  "ip": "10.0.0.15",
  "hostname": "PC-CONTABILIDAD",
  "mac": "00:11:22:33:44:55",
  "vendor": "Dell Inc.",
  "openPorts": [135, 139, 445, 3389],
  "deviceType": "workstation",
  "os": "Windows 10",
  "latencyMs": 2,
  "status": "online",
  "printers": [
    { "name": "EPSON L3250", "connectionType": "USB", "port": "USB002", "model": "EPSON L3250 Series", "manufacturer": "epson", "status": "idle", "shared": false, "source": "win32_printer" }
  ],
  "printerProbe": { "status": "success", "elapsedMs": 2870, "error": null },
  "usbPrinterCount": 1
}
```

**Invariantes**:
- `printers` siempre array (posiblemente `[]`).
- `usbPrinterCount` número no negativo.
- `printerProbe.status` siempre string no vacío.
- Hosts no Windows: `printers: []`, `printerProbe.status: 'unsupported'`.

**`selectors.js`** (`selectVisibleHosts`):
- Búsqueda debe incluir:
```js
[host.ip, host.hostname, host.mac, host.vendor, host.deviceType, host.os,
 (host.printers || []).map((p) => `${p.name} ${p.model} ${p.port}`).join(' '),
 host.usbPrinterCount ? 'usb impresora' : ''].join(' ')
```

### TASK-4 — Tabla de hosts

**Archivo**: `vlan-scanner/src/renderer/views/host-table.js` + `vlan-scanner/src/index.html`.

- Añadir columna `Impresoras USB` (no ordenable en MVP) o reutilizar encabezado existente si se desea.
- `renderRow`: tras `osCell`, añadir:
```js
const printerCell = document.createElement('td');
if (host.usbPrinterCount > 0) {
  printerCell.textContent = `🖨️ ${host.usbPrinterCount}`;
  printerCell.style.color = 'var(--green)';
  printerCell.title = (host.printers || []).filter(...).map((p) => p.name).join(', ');
} else {
  const badge = host.printerProbe?.status === 'failed' || host.printerProbe?.status === 'timeout'
    ? '—' : '—';
  printerCell.textContent = '—';
  printerCell.style.color = 'var(--text3)';
}
row.append(..., printerCell, latencyCell);
```
- Mantener `append` order sincronizado con HTML headings.

### TASK-5 — Panel de detalle

**Archivo**: `renderer/views/detail-panel.js`.

- Después de sección "Puertos abiertos", añadir sección "Impresoras (remoto)":
```js
this.content.append(createElement('div', 'detail-section', 'Impresoras (remoto)'));
```
- Mostrar estado:
  - `success`: `Detectadas: N (USB: M)`.
  - `unsupported`: `No aplicable (SO no Windows o host no Windows)`.
  - `failed`/`timeout`/`cancelled`: `No disponible: <mensaje sanitizado o código>`.
  - `skipped`: `Omitido`.
- Lista de impresoras:
```js
for (const printer of host.printers || []) {
  const line = createElement('div', '', `🖨️ ${printer.name} — ${printer.connectionType}${printer.port ? ` (${printer.port})` : ''}`);
  ...
  this.content.append(line);
}
```
- Si `success` y `printers.length === 0`: "Sin impresoras reportadas".
- Añadir contador USB en el icono/nombre solo si > 0 (opcional).

### TASK-6 — Filtros/búsqueda/topología

- `selectors.js`: incluir nombres de impresoras en búsqueda (TASK-3).
- Topología: opcional añadir glyph pequeño `🖨️` en nodo si `usbPrinterCount > 0` (no bloquear MVP; declarar TODO si no se implementa).
- Filtro por tipo impresora ya existe (`type:printer`). Considerar filtro `type:has-usb-printer` como OPEN QUESTION; por defecto no añadir en MVP.

### TASK-7 — Exportación

**Archivo**: `export/result-exporter.js`.

- `CSV_COLUMNS` añadir (en este orden, al final o antes de `latencyMs`):
```js
['usbPrinterCount', 'USB Printers'],
['printerProbeStatus', 'Printer Probe'],
['printers', 'Printers']
```
  Donde `printerProbeStatus` se obtiene de `host.printerProbe?.status`.
- `serializeResults`:
  - Para key `printers`: transformar array a texto:
```js
const text = (host.printers || [])
  .map((printer) => `${printer.name || 'Desconocida'} [${printer.connectionType}${printer.port ? ` / ${printer.port}` : ''}]`)
  .join('; ');
return csvCell(text);
```
  - Para key `printerProbeStatus`: usar `host.printerProbe?.status || ''`.
  - Evitar `[object Object]`.
- JSON: sin cambios (array completo). Asegurar que `usbPrinterCount` y `printerProbe` se serializan.
- Test nuevo: CSV incluye columna `USB Printers` y `Printers` con texto legible.

**Ejemplo CSV**:
```csv
"IP","Hostname",...,"USB Printers","Printer Probe","Printers"
"10.0.0.15","PC-CONTABILIDAD",...,1,"success","EPSON L3250 [USB / USB002]"
```

### TASK-8 — Pruebas y aceptación

**Unitarias (existentes + nuevas)**:
- `printer-probe.test.js`:
  - parseo de JSON (objeto único y array).
  - `classifyPrinterConnection` USB/Network/Local/Other (tabla de casos).
  - `skipped/unsupported` sin comando.
  - timeout simulado (CommandRunner mock rechaza con `killed:true`) → `status:'timeout'`.
  - acceso denegado → `status:'failed'`.
  - `maxPrinters` truncation.
- `host-enricher.test.js`:
  - inyecta `printerProbe` mock y valida campos host.
  - `probePrinters: false` no llama probe y `printerProbe.status:'skipped'`.
  - fallo de probe no afecta `status:'online'` ni clasificación.
- `result-exporter.test.js`:
  - JSON preserva printers.
  - CSV no arroja `[object Object]`.
- `scan-request.test.js`: `probePrinters` default true y respeta false.

**E2E / manual**:
- No existe Playwright en `package.json`; plan declared: smoke manual con Electron (`npm start`) en red local Windows:
  1. Equipo con impresora USB encendida y compartida vía WMI.
  2. Escanear rango pequeño.
  3. Verificar contador `🖨️ 1` y detalle.
  4. Exportar CSV y abrir en hoja de cálculo.
- Si el Coordinador decide automatizar, agregar Playwright como devDep en tarea separada (OPEN QUESTION).

**Comandos de regresión obligatorios**:
```
npm test
npm run check
```
Criterio: 0 fallos.

## 4. Criterios de Aceptación (AC)

### TASK-1
- AC-1: Dado un stdout JSON de `Win32_Printer` con una impresora en puerto `USB001`, cuando `PrinterProbe.probe()` parsea, entonces `printers[0].connectionType === 'USB'` y `printers.length === 1`.
- AC-2: Dado stdout JSON con impresora en puerto `IP_10.0.0.5` y `Network: true`, cuando parsea, entonces `connectionType === 'Network'`.
- AC-3: Dado un mock de CommandRunner que rechaza con `{ killed: true }` después de 8 s, cuando se invoca `probe()`, entonces `status === 'timeout'`, `printers` es `[]` y `elapsedMs <= 9000`.
- AC-4: Dado IP inválida `"999.1.1.1"`, cuando se invoca `probe()`, entonces `status === 'unsupported'` y no se ejecuta ningún comando.
- AC-5: Dado stdout vacío, cuando parsea, entonces `printers === []` y `status === 'success'`.

### TASK-2
- AC-1: Dado host vivo con `printerProbe` mock que falla, cuando `HostEnricher.enrich()` termina, entonces el host tiene `status: 'online'`, `printers: []` y `printerProbe.status !== 'success'`; no se lanza excepción.
- AC-2: Dado `probePrinters: false`, cuando `enrich()` termina, entonces `printerProbe.status === 'skipped'` y el mock no fue llamado.
- AC-3: Dado `NetworkScanner.scan()` con plan de 2 IPs vivas, cuando ambos hosts se enriquecen, entonces `onHostFound` recibe hosts con `usbPrinterCount` definido.
- AC-4: Dado arranque de la app (`main.js`), cuando se construyen servicios, entonces `HostEnricher` recibe instancia de `PrinterProbe`.

### TASK-3
- AC-1: Dado cualquier host resultado, cuando se inspecciona, entonces `printers` es array y `usbPrinterCount` es número.
- AC-2: Dado búsqueda con texto `EPSON`, cuando exista impresora con ese nombre, entonces `selectVisibleHosts` incluye el host.
- AC-3: Dado host con `os: 'Linux'`, `connectionType` no aplica y `printerProbe.status === 'unsupported'`.

### TASK-4
- AC-1: Dado host con `usbPrinterCount: 2`, cuando la tabla renderiza, entonces la celda de impresoras muestra `🖨️ 2` y tooltip con los nombres.
- AC-2: Dado host con `usbPrinterCount: 0`, cuando renderiza, entonces celda muestra `—`.
- AC-3: Dado tabla sin hosts, cuando renderiza, entonces no se rompe el layout (regresión visual manual).

### TASK-5
- AC-1: Dado host con 1 impresora USB, cuando se selecciona, entonces el detalle muestra sección "Impresoras" con el nombre y `USB`.
- AC-2: Dado host con `printerProbe.status: 'timeout'`, cuando se selecciona, entonces el detalle muestra mensaje de no disponible y no lanza error.
- AC-3: Dado host con `printers: []` y `status: 'success'`, cuando se selecciona, entonces muestra "Sin impresoras reportadas".

### TASK-6
- AC-1: Dado texto de búsqueda por nombre de impresora, cuando coincide, entonces el host visible.
- AC-2: Dado filtro por tipo `printer`, cuando host tiene impresoras USB, entonces no se oculta (ya era printer por OUI/puerto).

### TASK-7
- AC-1: Dado array de hosts con impresoras, cuando `serializeResults(data, 'json')`, entonces `JSON.parse` preserva `printers` y `usbPrinterCount`.
- AC-2: Dado mismo array, cuando `serializeResults(data, 'csv')`, entonces la fila contiene columna `Printers` con texto `Nombre [USB / USB001]`, no `[object Object]`.
- AC-3: Dado `dialog` cancelado, cuando exporta, entonces retorna `false` y no escribe archivo (comportamiento existente conservado).

### TASK-8
- AC-1: Dado `npm test`, entonces todos los tests pasan (0 fallos).
- AC-2: Dado `npm run check`, entonces sin errores de sintaxis.
- AC-3: Dado smoke manual en equipo Windows con impresora USB accesible por WMI, entonces el escaneo reporta al menos 1 impresora USB sin abortar.

## 5. Estrategia de pruebas

| Área | Qué se valida | Con qué |
|---|---|---|
| `PrinterProbe` parsing/clasificación | JSON único/array, puertos USB/red/local, fallback CSV, sanitización | `node:test` unitarias en `printer-probe.test.js` |
| Timeout/acceso denegado | Clasificación `timeout`/`failed`, sin propagación | Mock `CommandRunner` |
| Integración enriquecimiento | Campos host, skip, fallo no rompe scan | `host-enricher.test.js` actualizado |
| Plan de escaneo | `probePrinters` default true y explícito false | `scan-request.test.js` |
| Exportación | JSON estable, CSV legible, escape | `result-exporter.test.js` |
| Búsqueda UI | Inclusión de nombres de impresoras | `renderer-core.test.js` (si aplica) o unit test de selectors |
| Regresión global | 0 fallos | `npm test && npm run check` |
| E2E | Flujo completo en Windows real | Manual (Playwright no instalado; ver Open Questions) |

## 6. Riesgos y dependencias

| Riesgo | Impacto | Mitigación |
|---|---|---|
| WMI/DCOM bloqueado o acceso denegado en hosts remotos | Alta cobertura no alcanzada | Estado `failed`/`timeout`, no afecta scan; documentar limitación |
| Hosts no Windows (Linux/macOS) | Falsos negativos | Marcar `unsupported`, no intentar comando |
| Aumento de duración por enriquecimiento serial | Rendimiento | Timeout 8 s, intento condicionado a SO/puertos Windows, métrica elapsedMs |
| Falsos positivos entre impresoras de red y USB | Duplicados | Clasificación por `PortName`/`Network`, contador solo USB |
| `wmic` ausente en Windows recientes | Fallback inútil | Primario CIM; fallback best-effort |
| Cambios en columnas HTML/tabla | Desalineación visual | Tarea TASK-4 incluye HTML + JS en mismo cambio |
| Playwright no disponible | Sin E2E automatizado | Smoke manual; tarea futura si se aprueba |

## 7. Limitaciones documentadas (implementador debe reflejar en README/help)
- Solo se detectan impresoras en hosts Windows que permitan WMI/DCOM remoto (típicamente puertos `135/TCP` y `445/TCP` abiertos) y con los permisos del token actual del proceso.
- En redes de trabajo (workgroup) suele requerirse mismo usuario/contraseña o deshabilitación de UAC remoto; la app no almacena credenciales (REQ-7).
- Firewalls o AV pueden bloquear WMI: el host se marca como `failed`, no se aborta el escaneo.
- Impresoras USB no compartidas o virtuales pueden no aparecer si el spooler/usuario remoto no las expone.
- Impresoras físicas de red ya visibles por OUI/puerto `9100` no se duplican en el contador USB.
- La enumeración es best-effort y no garantiza modelo/fabricante (depende del driver).

## 8. Open Questions
1. **Mecanismo remoto preferido** (OQ-1 del master): actualmente se asume WMI/DCOM sin credenciales. Si se prefiere WinRM/PSCredential, requiere UX y gestión de secretos (fuera de REQ-7).
2. **Timeout** (OQ-2): valor propuesto `8000 ms`; confirmar con usuario, rango sugerido `5000–12000 ms`.
3. **Granularidad UI** (OQ-3): propuesta columna `🖨️ N` + detalle. ¿Se requiere filtro `type:has-usb-printer`?
4. **Playwright** (OQ-4): instalar `@playwright/test` como devDep para automatizar E2E o dejar smoke manual.
5. **Confirmación de alcance printers** (OQ-5): ¿documentar impresoras compartidas en red como "Network" aunque no sean el host escaneado? La propuesta las lista pero no las cuenta como USB.
6. **Plataformas** (OQ-6): Linux/macOS siguen marcados `unsupported`; ¿se planifica soporte CUPS más adelante?

---
> Implementador puede proceder con TASK-1 (PrinterProbe), seguido de TASK-2..TASK-8; para teléfonos, TASK-9 (OUI móviles) → TASK-10..TASK-17. La convivencia con impresoras es aditiva y no rompe TASK-1..TASK-8.

## 9. Requerimiento adicional: teléfonos celulares (EPIC-3/EPIC-4, TASK-9..TASK-17)

### 9.1 Arquitectura y heurísticas (sin dependencias nuevas)
- Detección **pasiva y best-effort** durante el enriquecimiento existente; no captura tráfico, no solicita credenciales, no accede a datos personales del teléfono.
- Se reutilizan señales ya recogidas: `VendorIdentifier` (OUI), hostname, banner HTTP/SMB, SO estimado, puertos abiertos, TTL, SIP. No se añaden sondas remotas opcionales salvo aprobación futura de mDNS.
- Nuevo analizador puro `MobilePhoneClassifier` en `src/identification/` (sin I/O, fácil de probar con `node --test`), inyectado o llamado por `HostEnricher`.
- `DeviceClassifier` incorpora reglas `smartphone` ordenadas **después** de firewall, cámara, impresora, VoIP/SIP y **antes** de `workstation`, `apple`, `server`.
- `OsFingerprintService` mantiene sus reglas y expone helpers de normalización móvil en `MobilePhoneClassifier`; el valor canónico de OS móvil es independiente del `host.os` genérico.
- Rendimiento: cálculo O(1) por host, sin `await`, timeouts ni degradación; no altera lotes de 24 probes.

**Decisión de confianza y precedencia**:
| Señal / condición | Peso | Efecto |
|---|---:|---|
| Hostname con token móvil (`iphone`, `ipad`, `android`, `galaxy`, `pixel`, `redmi`, `oneplus`, `vivo`, `huawei`, `honor`, `moto`, `nokia`, ...) | +2 | Identifica intención móvil directa |
| SO estimado móvil (`iOS/iPadOS/iPhone OS/Android`) | +2 | Refuerza clasificación |
| Vendor móvil bien conocido (Samsung, Xiaomi, Google, Huawei, Motorola, Oppo, Vivo, OnePlus, Nokia, HTC, Sony, ZTE, Honor, Nothing, Realme) | +1 | Refuerzo OUI; `Apple` solo +0 salvo evidencia iOS/host móvil (evita Macs) |
| Sin puertos de PC (`135,139,445,3389,5985,22,5900`) | +1 | Descarta estaciones típicas |
| TTL en rango móvil habitual (60–70) sin servicios de servidor | +1 | Refuerzo débil |
| Servicio mDNS móvil (si se habilita en el futuro) | +2 | Evidencia de alto peso |
| Conflicto: puertos de PC/cámara/impresora/SIP | bloqueante | `isPhone = false` aunque haya otros indicios |

Umbral: `score >= 3` y `conflicts.length === 0`.
Confianza:
- `high`: `score >= 5` o (hostname móvil + OS móvil sin conflictos).
- `medium`: `score` 3 o 4.
- `low`: no se marca smartphone; se conservan indicios sólo como evidencia candidate si se implementa OQ (por defecto no).

**Limitaciones OUI**: OUI móvil es ambiguo y cambiar. La app no debe afirmar fabricante para MAC aleatorizada (`vendor` vacío/private/desconocido).

### 9.2 TASK-9 — OUI móviles
**Archivos**: `src/data/oui-data.js` (principal), opcional tests OUI. No crear archivo nuevo.

**Cambios**:
- Añadir prefijos OUI conocidos de fabricantes móviles bajo el mismo registro, sin borrar entradas existentes.
- Añadir grupo móvil al vocabulario existente sin romper índices:
```js
VENDOR_GROUPS.mobile = Object.freeze(['apple', 'samsung', 'xiaomi', 'huawei', 'google', 'oneplus', 'oppo', 'vivo', 'motorola', 'nokia', 'htc', 'sony', 'zte', 'honor', 'nothing', 'realme', 'lg', 'asus']);
```
- No convertir vendor `apple` automáticamente en móvil; `MobilePhoneClassifier` decide por confianza.
- Los nombres canónicos deben ser minúsculas internamente para comparar tokens.

**AC-9**:
- Dado OUI ampliado, cuando `VendorIdentifier.identify(mac)` con prefijo móvil conocido, entonces devuelve fabricante no vacío.
- Dado OUI existente de impresoras/VoIP/cámaras, cuando se cargan datos, entonces ningún registro previo se elimina ni cambia semántica.
- Dado MAC desconocida/privada, entonces `identify()` sigue devolviendo `''`.

### 9.3 TASK-10 — `MobilePhoneClassifier`
**Archivo**: `src/identification/mobile-phone-classifier.js`; tests `src/identification/mobile-phone-classifier.test.js`.

**Tipos**:
```ts
type MobileOs = 'iOS' | 'Android' | 'Mobile OS (unknown)';
type PhoneConfidence = 'high' | 'medium' | 'low';

interface MobilePhoneSignals {
  hostname?: string;
  vendor?: string;
  os?: string;
  openPorts?: number[];
  banner?: string;
  ttl?: number | null;
  sipConfirmed?: boolean;
  mdnsServices?: string[];
  mac?: string;
}

interface MobilePhoneAnalysis {
  isPhone: boolean;
  deviceType: 'smartphone' | null;
  phoneOS: MobileOs | null;
  phoneHint: string | null;
  phoneConfidence: PhoneConfidence | null;
  phoneEvidence: string[];
  phoneFormFactor: 'handset' | 'tablet' | 'unknown' | null;
  conflicts?: string[];
}
```

**Firmas**:
```js
function analyzeMobilePhone(signals = {}) -> MobilePhoneAnalysis
function normalizeMobileOs(os, signals = {}) -> MobileOs | null
function derivePhoneHint(analysisInput) -> string | null
function isMobileConflict({ openPorts = [], sipConfirmed = false } = {}) -> string[]
```

**Constantes exportadas**:
```js
MOBILE_HOSTNAME_TOKENS
MOBILE_VENDOR_TOKENS
PC_PORTS
CAMERA_PORTS
PRINTER_PORT
SIGNATURE_MOBILE_OS
```

**Reglas de detección**:
- `conflicts` incluye `pc-ports`, `camera-ports`, `printer-port`, `sip` si corresponde.
- `openPorts` por defecto `[]`.
- `mobileEvidence` usa claves estables: `hostname:<token>`, `os:<ios|android>`, `vendor:<token>`, `ports:no-pc-services`, `ttl:64`, `mdns:<service>`.
- `phoneOS`:
  - si `os` o hostname/banner contiene `android` → `Android`;
  - si contiene `ios`, `iphone`, `ipados`, `ipad` → `iOS`;
  - si `isPhone` y no puede definirse → `Mobile OS (unknown)`;
  - si no es teléfono → `null`.
- `phoneFormFactor`:
  - `tablet` si hostname/banner contiene `ipad`, `tablet`, `tab`, `mediapad`, `galaxy tab`;
  - en caso contrario `handset` si `isPhone`;
  - `null` si no es teléfono.
- `phoneHint` best-effort, nunca modelo exacto:
  - Apple: `Apple iPhone (estimado)` o `Apple iPad (estimado)`.
  - Samsung: `Samsung Galaxy (estimado)`; si hay `tab`, `Samsung Galaxy Tab (estimado)`.
  - Google: `Google Pixel (estimado)`.
  - Xiaomi/Redmi: `Xiaomi Redmi/MI (estimado)`.
  - Huawei/Honor: `Huawei/Honor (estimado)`.
  - resto: `${Vendor title case} (modelo desconocido)` si vendor conocido.
  - si solo hay hostname genérico, puede usarse como pista textual recortada a 80 chars; si no hay nada → `null`.
- No loguear ni devolver MAC completa en evidencia; usar hash/prefijo si se necesita traza.

**Ejemplo de salida**:
```json
{
  "isPhone": true,
  "deviceType": "smartphone",
  "phoneOS": "iOS",
  "phoneHint": "Apple iPhone (estimado)",
  "phoneConfidence": "high",
  "phoneEvidence": ["hostname:iphone", "os:ios", "vendor:apple", "ports:no-pc-services"],
  "phoneFormFactor": "handset",
  "conflicts": []
}
```

**AC-10**:
- Dado `{ hostname: 'iPhone de Ana', vendor: 'Apple', os: 'iOS', openPorts: [] }`, entonces `isPhone === true`, `phoneOS === 'iOS'`, `phoneConfidence !== 'low'` y `phoneEvidence` incluye hostname y OS.
- Dado `{ vendor: 'Samsung', openPorts: [], ttl: 64 }` sin hostname/OS móvil, entonces `isPhone === false` y todos los campos móviles son `null`/`[]`.
- Dado `{ hostname: 'android-5f3c', openPorts: [135, 445] }`, entonces `isPhone === false` y `conflicts` incluye `pc-ports`.
- Dado `{ hostname: 'Galaxy-Tab-A8', vendor: 'Samsung', os: 'Android' }`, entonces `isPhone === true`, `phoneOS === 'Android'`, `phoneFormFactor === 'tablet'`.
- Dado `{ hostname: 'iphone', vendor: '', ttl: 64 }`, entonces `isPhone === true` sólo si `score >= 3` por hostname + puertos; `phoneHint` puede ser `null`; `phoneOS === 'Mobile OS (unknown)'`.
- Dado MAC aleatorizada y vendor desconocido sin otras señales, entonces `isPhone === false`.

### 9.4 TASK-11 — `DeviceClassifier` + OsDetector
**Archivos**: `src/identification/device-classifier.js`, `src/identification/os-detector.js` y tests de identificación.

**Cambios**:
- `DeviceClassifier.classify()` acepta campo opcional `os` además de los existentes; no romper llamadas actuales.
- Añadir `conflicts` helper compartido desde `mobile-phone-classifier.js` para evitar duplicación.
- Reglas móviles (ejemplo), ordenadas antes de `workstation`/`apple`/`server` y después de cámara/impresora/VoIP:
```js
{ name: 'phone-hostname', when: ({ hostname, ports, os }) => mobileHostnameToken(hostname) && !mobileConflict(ports) && !sipConfirmed, type: 'smartphone' },
{ name: 'phone-os', when: ({ os, ports }) => mobileOs(os) && !mobileConflict(ports), type: 'smartphone' }
```
- No reemplazar clasificación `voip` cuando hay SIP/puertos de telefonía tradicional (5060/5061/5080) sin OS móvil claro.
- `OsFingerprintService.detect()` se mantiene; añadir helper exportado:
```js
function normalizeMobileOs(os) // delega en MobilePhoneClassifier o duplica sin dependencia circular
```
- En `os-detector.js` se pueden añadir pistas para `id`/`android` ya existentes; no cambiar valores esperados por tests actuales.
- Evitar que un iPhone con puertos HTTP/HTTPS de gestión sea clasificado como `server` solo por puertos web: la regla `smartphone` debe tener prioridad si `os`/hostname móvil existe.

**AC-11**:
- Dado `classify({ hostname: 'iphone', vendor: 'Apple', os: 'iOS', ports: [] })`, entonces resultado `'smartphone'`.
- Dado `classify({ vendor: 'Samsung', os: 'Android', ports: [80] })`, entonces `'smartphone'`.
- Dado `classify({ ports: [554, 8000] })`, entonces no devuelve `'smartphone'` (cámara prioriza).
- Dado `classify({ ports: [5060] })`, entonces no devuelve `'smartphone'` salvo hostname/OS móvil explícito y no SIP.
- Dado `classify({ vendor: 'Apple', ports: [22, 80, 443] })` sin evidencia móvil, entonces no devuelve `'smartphone'`.
- Dado `normalizeMobileOs('Android 14')`, entonces `'Android'`.

### 9.5 TASK-12 — Integración en `HostEnricher` y contrato host
**Archivos**: `src/application/host-enricher.js`, `src/application/host-enricher.test.js`.

**Constructor**:
```js
class HostEnricher {
  constructor({
    ...
    mobilePhoneClassifier = null // nuevo, default null
  })
}
```

**Flujo** (después de detectar `os`, antes de impresoras):
```js
const phoneAnalysis = this.mobilePhoneClassifier
  ? this.mobilePhoneClassifier.analyze({
      hostname,
      vendor,
      os,
      openPorts,
      banner,
      ttl,
      sipConfirmed: sipResult.isSip,
      mdnsServices: []
    })
  : {
      isPhone: false,
      deviceType: null,
      phoneOS: null,
      phoneHint: null,
      phoneConfidence: null,
      phoneEvidence: [],
      phoneFormFactor: null
    };

const deviceType = phoneAnalysis.isPhone ? 'smartphone' : this.deviceClassifier.classify({
  ports: openPorts, hostname, vendor, banner, sipConfirmed: sipResult.isSip, os
});
```
- Envolver `analyze()` en `try/catch` defensivo; si lanza, `isPhone=false`, `phoneEvidence=['classifier-error']` sanitizado y no romper escaneo.
- `printerProbe` y móvil son independientes; el orden propuesto evita abortar si uno falla.

**Retorno extendido (campos siempre presentes)**:
```js
return {
  ...base host,
  deviceType,
  phoneOS: phoneAnalysis.phoneOS ?? null,
  phoneHint: phoneAnalysis.phoneHint ?? null,
  phoneConfidence: phoneAnalysis.phoneConfidence ?? null,
  phoneEvidence: Array.isArray(phoneAnalysis.phoneEvidence) ? phoneAnalysis.phoneEvidence : [],
  phoneFormFactor: phoneAnalysis.phoneFormFactor ?? null
};
```

**Invariantes**:
- `phoneEvidence` siempre array.
- Si `deviceType !== 'smartphone'`, `phoneOS`, `phoneHint`, `phoneConfidence`, `phoneFormFactor` son `null` y `phoneEvidence` `[]`.
- Los hosts offline/error (`status !== 'online'`) también deben inicializar campos `null`/`[]` en las capas que construyan respuestas host (si aplica), para no romper UI/export.

**AC-12**:
- Dado `mobilePhoneClassifier` mock con `isPhone:true`, cuando `enrich()` termina, entonces host tiene `deviceType:'smartphone'` y campos móviles no nulos.
- Dado mock con `isPhone:false`, entonces `deviceType` proviene de `deviceClassifier` y campos móviles son `null`/`[]`.
- Dado clasificador que lanza error, entonces `enrich()` termina `status:'online'`, no propaga excepción y registra evidencia sanitizada.
- Dado `NetworkScanner.scan()`, entonces `onHostFound` recibe host con `phoneEvidence` array y `phoneConfidence` definido o null.
- Dado app arranque, `HostEnricher` puede construirse con `mobilePhoneClassifier: null` sin romper (compatibilidad).

### 9.6 TASK-13 — Tabla de hosts
**Archivos**: `src/renderer/core/catalogs.js`, `src/renderer/views/host-table.js`.

**Cambios**:
```js
DEVICE_ICONS.smartphone = '📱';
DEVICE_ICONS.tablet = '📱'; // opcional
```
`renderRow` no necesita columna nueva. En celda de tipo, si `host.deviceType === 'smartphone'`:
- tooltip:
```js
typeCell.title = [host.phoneHint, host.phoneOS, host.phoneConfidence ? `confianza ${host.phoneConfidence}` : null]
  .filter(Boolean).join(' — ');
```
- si `phoneEvidence.length`, color o badge pequeño opcional.
- no desalinear columnas existentes.

**AC-13**:
- Dado host `deviceType:'smartphone'`, cuando la tabla renderiza, entonces tipo muestra `📱 smartphone` y tooltip incluye `phoneHint` si existe.
- Dado host normal, entonces no aparece tooltip móvil.
- Dado tabla vacía, entonces no se rompe render.

### 9.7 TASK-14 — Detalle del host
**Archivo**: `src/renderer/views/detail-panel.js`.

**Cambios**:
Después de puertos abiertos (o sección Red), sólo si `host.deviceType === 'smartphone'`:
```js
this.content.append(createElement('div', 'detail-section', 'Teléfono móvil'));
this.appendRow('SO móvil', host.phoneOS || 'Mobile OS (unknown)');
this.appendRow('Fabricante/modelo (estimado)', host.phoneHint || 'No estimado');
this.appendRow('Confianza', host.phoneConfidence || '—');
this.appendRow('Evidencias', (host.phoneEvidence || []).join(', ') || '—');
```
- No mostrar sección para otros dispositivos.
- En `appendActions`, si `smartphone`, añadir nota informativa:
  - "Identificación pasiva: modelo estimado, no garantizado. MAC aleatorizada puede reducir precisión."

**AC-14**:
- Dado host smartphone con evidencias, cuando se selecciona, entonces detalle muestra sección y las 4 filas.
- Dado `phoneHint: null`, entonces fila muestra `No estimado`.
- Dado host no móvil, entonces no aparece sección "Teléfono móvil".
- Dado `phoneEvidence: []`, entonces fila `Evidencias` muestra `—` sin error.

### 9.8 TASK-15 — Búsqueda, filtro y topología
**Archivos**: `src/renderer/core/selectors.js`, `src/renderer/views/topology-view.js`. `filter-panel.js` no requiere cambio estructural.

**Búsqueda**:
```js
const phoneText = host.deviceType === 'smartphone'
  ? [host.phoneOS, host.phoneHint, host.phoneConfidence, (host.phoneEvidence || []).join(' ')].join(' ')
  : '';
```
Incluir `phoneText` en el array de búsqueda.

**Filtro**:
- El filtro estándar `type:smartphone` funciona automáticamente porque compara `host.deviceType`.
- OPEN QUESTION: alias `type:phone`; por defecto no se añade, documentar.

**Topología**:
- Al usar `DEVICE_ICONS.smartphone`, el nodo ya muestra 📱.
- Opcional: anillo de acento para `phoneConfidence === 'high'`; implementación de bajo riesgo. Si no se implementa en MVP, declarar TODO.

**AC-15**:
- Dado texto de búsqueda por `phoneHint`, cuando coincide, entonces host visible.
- Dado filtro `type:smartphone`, entonces los hosts smartphone se muestran y otros no.
- Dado topología con smartphone, entonces `update()` y `draw()` no lanzan error.
- Dado host con `phoneConfidence:'low'` (no marcado phone), entonces no aparece en `type:smartphone`.

### 9.9 TASK-16 — Exportación
**Archivo**: `src/export/result-exporter.js`.

**Cambios en `CSV_COLUMNS`** (al final, sin reordenar existentes):
```js
['phoneOS', 'Phone OS'],
['phoneHint', 'Phone Hint'],
['phoneConfidence', 'Phone Confidence'],
['phoneEvidence', 'Phone Evidence']
```
- `serializeResults`:
```js
if (key === 'phoneEvidence') return csvCell((host.phoneEvidence || []).join('; '));
```
- para demás claves phone: `csvCell(host[key])`.
- JSON no requiere cambios; los campos móviles ya viajan con el host si están presentes.

**AC-16**:
- Dado hosts smartphone, cuando `serializeResults(data,'json')`, entonces `JSON.parse` preserva `phoneOS`, `phoneHint`, `phoneConfidence`, `phoneEvidence`.
- Dado mismo array, cuando CSV, entonces columnas `Phone OS`, `Phone Hint`, `Phone Confidence`, `Phone Evidence` existen y no contienen `[object Object]`.
- Dado `phoneEvidence` vacío, entonces celda CSV vacía o `''` sin error.
- Cancelación de diálogo conserva comportamiento existente.

### 9.10 TASK-17 — Pruebas y aceptación (teléfonos)
**Unitarias**:
- `mobile-phone-classifier.test.js`:
  - casos positivos iPhone/Android/Galaxy/Pixel/Xiaomi.
  - casos negativos Mac genérico, cámara, impresora, VoIP, PC con puertos, TTL aislado.
  - tablet.
  - sanitización (`phoneHint` recorte, sin stack/paths).
  - `normalizeMobileOs`.
- `identification.test.js`:
  - reglas móviles y precedencia.
- `host-enricher.test.js`:
  - mock analizador true/false, fallo, campos invariantes.
- `selectors` test (si existe) o nuevo test de selectors:
  - búsqueda por `phoneHint`, `phoneOS`, `phoneConfidence`, evidencias.
- `result-exporter.test.js`:
  - JSON/CSV phone fields.
- `renderer-core.test.js`:
  - smoke de carga de módulos con nuevo icono.

**Regresión obligatoria**:
```
npm test
npm run check
```
0 fallos.

**Smoke manual WiFi**:
1. iPhone/Android real en la red.
2. Escanear rango pequeño.
3. Verificar host clasificado `smartphone`, tipo `📱`, OS móvil y confianza.
4. Búsqueda por fabricante/modelo.
5. Exportar CSV/JSON y verificar columnas.

### 9.11 Estrategia de pruebas actualizada
Se amplía la tabla de la sección 5:
| Área phones | Qué se valida | Con qué |
|---|---|---|
| Heurísticas móviles | `isPhone`, OS, hint, confianza, evidencia, conflictos, tablet | `node:test` en `mobile-phone-classifier.test.js` |
| Precedencia | no convertir cámara/impresora/VoIP/PC en smartphone | `identification.test.js` |
| Enriquecimiento | campos `phone*`, invariante non-phone, fallo no rompe scan | `host-enricher.test.js` |
| UI búsqueda | phoneHint/OS/evidencia incluidos | tests selectors o renderer core |
| Exportación | CSV/JSON phone fields, no object leak | `result-exporter.test.js` |
| Regresión | 0 fallos | `npm test && npm run check` |

### 9.12 Riesgos, dependencias y limitaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| MAC aleatorizada en iOS/Android | Fabricante desconocido | no afirmar fabricante; confianza baja/nula; usar hostname/OS |
| OUI desactualizado/incompleto | Falsos negativos | grupo OUI extensible; heuristicas no dependen solo de MAC |
| Apple OUI compartido entre Mac/iPhone/iPad | Falsos positivos | umbral + conflictos + OS/hostname obligatorio para Apple |
| OS móvil no inferible (TTL 64 ambiguo) | Falsos negativos / OS unknown | reportar `Mobile OS (unknown)` y evidencia |
| Dispositivos IoT/tv with mobile-like names | Falsos positivos | exclusión de puertos y reglas por conflicto |
| Tablets vs. smartphones | Ambigüedad de negocio | `phoneFormFactor`; OPEN QUESTION para clasificar como `tablet` separado |
| Rendimiento | Bajo | sin I/O ni timeouts; tests de no degradación |

### 9.13 Open Questions (teléfonos)
1. **Tablets**: ¿clasificar como `smartphone` (actual) o crear `deviceType:'tablet'` separado? (OQ-P1)
2. **mDNS**: ¿activar descubrimiento pasivo/activo de `_hap._tcp`, `_androidtvremote._tcp`, etc., con evidencia alto peso? (OQ-P2)
3. **Alias de filtro**: ¿admitir `type:phone` además de `type:smartphone` en la UI? (OQ-P3)
4. ** Umbral/nivel**: ¿qué tasa de falsos positivos se acepta para bajar umbral de confianza? (OQ-P4)
5. **Topología**: ¿badge visual dedicado `📱` con color por confianza o suficiente icono de tipo? (OQ-P5)
6. **Datos OUI**: ¿se permite añadir prefijos móviles masivos (pueden cambiar la base) o solo una lista curada? (OQ-P6)
7. **Privacidad**: ¿se debe mostrar evidencia textual completa o resumida para evitar fingerprints? Recomendación: resumida. (OQ-P7)
