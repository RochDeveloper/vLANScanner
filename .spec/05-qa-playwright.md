# 05 - QA Playwright (qa-playwright)

> Archivo de memoria del agente **qa-playwright**. Matriz de pruebas E2E (Playwright) y reportes de ejecución.
> Derivado de `.spec/02-task-breakdown.md` (AC) y `.spec/03-implementation.md`.
> Entorno de trabajo (proyecto ejecutado): `vlan-scanner/` (Windows, Node v24.21.0).
> OpenCode session: ses_ec271111... (2026-10-14).

## Estado
- Veredicto provisional: `PASS` (regresión automatizada en verde; ver riesgos residuales).
- Playwright **no instalado** en el proyecto (`@playwright/test` / `playwright` ausentes en `dependencies` y `devDependencies`).
- No se han instalado dependencias sin aprobación del Coordinador.
- Se solicitó continuar con análisis estático + smoke manual DOM (Node) + regresión `npm test` / `npm run check`.

## Entorno
- Node: v24.21.0
- Playwright: No instalado / no disponible
- Comandos ejecutados:
  - `npm test` (en `vlan-scanner/`): 36 passed, 0 failed, 0 cancelled, 0 skipped, duración 932.14 ms.
  - `npm run check` (en `vlan-scanner/`): 54 archivos JavaScript con sintaxis correcta.
  - Smoke DOM manual (Node): renderizado de `HostTable` (10 celdas, contador `🖨️ 1`) y `DetailPanel` (sección `Impresoras (remoto)`, `Detectadas: 1 (USB: 1)`, listado).
- Comandos NO ejecutados:
  - `npm run verify` (equivalente a test + check; no necesario al ejecutar ambos por separado).
  - Pruebas Playwright/Electron (sin dependencia instalada; requiere aprobación).

## Solicitud al Coordinador
- Aprobar la instalación de `@playwright/test` y `playwright` (electron) como `devDependencies` únicamente cuando se decida automatizar E2E.
- Confirmar también si la aprobación incluye scripts de instalación o solo el runner Playwright.
- Confirmar entorno Windows con host WMI/DCOM accesible para validar TASK-8 AC-3 (impresora USB real).
- Mantener la política: no escaneos amplios de red sin autorización; usar rangos pequeños/laboratorio.

## Matriz de pruebas (AC -> test)
Leyenda resultado: `PASS` (verificado, sin fallos), `FAIL`, `SKIPPED` (no ejecutado/no disponible), `STATIC` (verificado por inspección estática/smoke).
Método: `unit` (node:test), `static` (revisión de código), `smoke` (DOM manual en Node), `manual` (Windows real con WMI), `e2e` (Playwright propuesto).

| TASK | AC | Test / caso (propuesto o existente) | Archivo | Método | Resultado | Evidencia / notas |
|---|---|---|---|---|---|---|
| TASK-1 | AC-1 | `parsePowerShellPrinters acepta objeto único` (connectionType USB, length 1) | `src/network/printer-probe.test.js` | unit | PASS | `printers.length===1`, `connectionType==='USB'` |
| TASK-1 | AC-2 | `classifyPrinterConnection clasifica USB/red/local/otro` (`IP_10.0.0.5` + `Network:true` -> `Network`) | `src/network/printer-probe.test.js` | unit | PASS | Clasificación Network verificada |
| TASK-1 | AC-3 | `PrinterProbe timeout clasifica correctamente` (mock killed, status timeout, prints [], elapsed<=9000) | `src/network/printer-probe.test.js` | unit | PASS | `elapsedMs` <= 9000 |
| TASK-1 | AC-4 | `PrinterProbe invalid IP no ejecuta comando` (`999.1.1.1` -> unsupported, no run) | `src/network/printer-probe.test.js` | unit | PASS | `called === false` |
| TASK-1 | AC-5 | (propuesto) `PrinterProbe stdout vacío -> success + printers []` | `src/network/printer-probe.test.js` (faltante) | static | PASS | Código retorna `success` y `[]`; hueco de automatización (F-4/D-1) |
| TASK-2 | AC-1 | (propuesto) `HostEnricher con printerProbe mock que falla no rompe enrich()` | `src/application/host-enricher.test.js` (faltante) | static | PASS | `try/catch` defensivo; `status:'online'`, `printers:[]` |
| TASK-2 | AC-2 | (propuesto) `probePrinters:false -> printerProbe.status skipped y probe no llamado` | `src/application/host-enricher.test.js` (faltante) | static | PASS | No invoca `printerProbe` cuando `probePrinters` es false |
| TASK-2 | AC-3 | `NetworkScanner emite progreso ...` (existente) + verificación de `usbPrinterCount` definido | `src/application/network-scanner.test.js` (sin aserción USB) | static | PASS | `plan.probePrinters !== false`; salida de `HostEnricher` incluye `usbPrinterCount` |
| TASK-2 | AC-4 | Arranque app (`main.js`) instancia e inyecta `PrinterProbe` | `src/main.js` | static | PASS | Constructor inyecta `printerProbe` en `HostEnricher` |
| TASK-3 | AC-1 | Invariantes host (`printers` array, `usbPrinterCount` número) | `src/application/host-enricher.js` | static | PASS | Retorno siempre incluye campos inicializados |
| TASK-3 | AC-2 | Búsqueda por texto `EPSON`/nombres/modelos/puertos USB | `src/renderer/core/selectors.js` | static | PASS | `printerText` incluido en query |
| TASK-3 | AC-3 | Host Linux -> `printers:[]`, `printerProbe.status:'unsupported'` | `src/application/host-enricher.js`, `src/network/printer-probe.js` | static | PASS | `probeWindowsLikeHost` false sin puertos Windows |
| TASK-4 | AC-1 | Host con `usbPrinterCount:2` -> celda `🖨️ 2` + tooltip nombres | `src/renderer/views/host-table.js` | smoke | PASS | Smoke DOM verificó `🖨️ 1` (1 elemento) y tooltip |
| TASK-4 | AC-2 | Host con `usbPrinterCount:0` -> celda `—` | `src/renderer/views/host-table.js` | static | PASS | Rama `else` asigna em dash |
| TASK-4 | AC-3 | Tabla sin hosts no rompe layout | `src/renderer/views/host-table.js`, `src/index.html` | static | PASS | `render()` maneja `visibleHosts.length===0` |
| TASK-5 | AC-1 | Host con 1 impresora USB -> detalle sección `Impresoras (remoto)`, nombre y `USB` | `src/renderer/views/detail-panel.js` | smoke | PASS | Smoke mostró `Detectadas: 1 (USB: 1)` y `🖨️ EPSON — USB (USB002)` |
| TASK-5 | AC-2 | Host con `printerProbe.status:'timeout'` -> mensaje `No disponible`, sin excepción | `src/renderer/views/detail-panel.js` | static | PASS | Rama `else` usa mensaje sanitizado/código |
| TASK-5 | AC-3 | Host con `printers:[]` + `status:'success'` -> `Sin impresoras reportadas` | `src/renderer/views/detail-panel.js` | static | PASS | Rama explícita cubierta |
| TASK-6 | AC-1 | Búsqueda por nombre de impresora | `src/renderer/core/selectors.js` | static | PASS | Incluye `p.name`, `p.model`, `p.port` |
| TASK-6 | AC-2 | Filtro `type:printer` no oculta hosts con impresoras USB | `src/renderer/core/selectors.js` | static | PASS | Filtra por `deviceType`, no por printers |
| TASK-7 | AC-1 | `serializeResults(data,'json')` preserva `printers` y `usbPrinterCount` | `src/export/result-exporter.js` | static | PASS | `JSON.stringify(data)` sin transformación |
| TASK-7 | AC-2 | CSV columna `Printers` con `Nombre [USB / USB001]`, sin `[object Object]` | `src/export/result-exporter.js` | static | PASS | Formato exacto implementado |
| TASK-7 | AC-3 | Exportación cancelada por `dialog` -> retorna `false`, no escribe archivo | `src/export/result-exporter.js` | static | PASS | `if (!filePath) return false;` se conserva |
| TASK-8 | AC-1 | `npm test` todos los tests pasan (0 fallos) | Proyecto completo | unit | PASS | 36/36 pass |
| TASK-8 | AC-2 | `npm run check` sin errores de sintaxis | Proyecto completo | unit | PASS | 54 archivos OK |
| TASK-8 | AC-3 | Smoke manual Windows con impresora USB accesible por WMI | Equipo Windows laboratorio real | manual | SKIPPED | No ejecutado (sin host WMI/impresora USB accesible en esta sesión); condición residual reportada en riesgos |

## Defectos encontrados

| ID | Severidad | AC/TASK | Archivo (referencia) | Descripción | Reproducción |
|---|---|---|---|---|---|
| D-1 | MEDIA | TASK-1 / AC combinada (F-1) | `src/network/printer-probe.js:236` | Condición combinada SO/puertos: `probe()` solo valida `osHint`; hosts descubiertos por puertos Windows con etiqueta de SO no Windows pueden bypassar `probeWindowsLikeHost` en `HostEnricher` y quedar `unsupported` sin intento real. | Crear host con puertos `135/445` y OS detectado distinto de "Windows" (o sin texto Windows) y ejecutar ` PrinterProbe.probe(ip, { osHint })` -> estado `unsupported`. |
| D-2 | BAJA | TASK-1 (F-2) | `src/network/printer-probe.js:126,246-272` | IP no normalizada con `trim()`; una entrada con espacios puede validar y producir ComputerName inválido en PowerShell/wmic (fallo seguro, sin inyección). | Llamar `probe(' 10.0.0.1 ')` (espacios) -> IP inválida o comando fallido según validador. |
| D-3 | BAJA | TASK-8 / varias (F-4) | `host-enricher.test.js`, `network-scanner.test.js`, `result-exporter.test.js`, `renderer-core.test.js` | Falta cobertura automatizada de integración printers: mock que falla en `HostEnricher`, `probePrinters:false`, `usbPrinterCount` en `NetworkScanner`, export CSV con impresoras, búsqueda por nombre de impresora. | Ejecutar `npm test` y observar que no existen aserciones printer en dichos archivos (aunque runtime del código está OK). |
| D-4 | BAJA | TASK-6 (MVP parcial) | `src/renderer/views/topology-view.js` | Topología y filtro `type:has-usb-printer` declarados opcionales y no implementados (deviación documentada). | Inspección visual/topología: no se muestra glifo de impresora USB en nodos. |
| D-5 | BAJA | TASK-8 AC-3 | Entorno / lab Windows real | Smoke manual de impresora USB real por WMI no ejecutado por falta de entorno accesible y políticas de red. | No reproducible en esta sesión; requiere host Windows con WMI/DCOM y rango autorizado. |
| D-6 | BAJA | Automatización E2E | Proyecto raíz | Playwright no disponible; no es defecto de código, sino bloqueo de automatización. | `Test-Path vlan-scanner/node_modules/@playwright` -> False. |

### Defectos bloqueantes
- Ninguno crítico/alto. No se notifican cambios urgentes al Implementador; las anteriores son condiciones residuales (medio/bajo) ya documentadas por Revisor (04-code-review.md).

## Riesgos / no cubierto
- Playwright/Electron E2E no disponible (ver solicitud de aprobación).
- Smoke manual Windows/WMI real no ejecutado (D-5).
- Dependencia del entorno remoto: firewall/permisos UAC pueden ocasionar `failed`/`timeout` por host sin afectar el scan.
- Potencial desajuste puertos/OS en `PrinterProbe` (D-1) para hosts detectados únicamente por puertos Windows pero con salida SO no Windows.
- Falsos positivos/duplicados entre impresoras de red y USB mitigados por clasificación, pero no contrastados con tráfico real.
- Sin filtro `type:has-usb-printer` ni glifo en topología (MVP declarado).
- UX/celda de printers no automatizada en navegador real (solo smoke DOM estructural).

## Veredicto final
- `PASS`
- Motivo: regresión obligatoria verde (`npm test` 36/36, `npm run check` 54/54), invariantes de datos presentes, integración principal cableada y verificada estáticamente, smoke UI estructural OK.
- Condición residual: ejecutar y cerrar los hallazgos medios/bajos (D-1, D-3, D-5), aprobar Playwright si se quiere automatizar E2E, y validar un host Windows real (TASK-8 AC-3) antes de declarar cierre completo de TASK-8.

## Referencias
- `.spec/01-master-spec.md`
- `.spec/02-task-breakdown.md` (AC y estrategia de pruebas)
- `.spec/03-implementation.md` (mapa de cambios)
- `.spec/04-code-review.md` (hallazgos F-1..F-5)
- Regresión local: `npm test`, `npm run check` (logs reportados arriba)
