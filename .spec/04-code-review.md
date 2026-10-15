# 04 - Code Review (Revisor)

> Archivo de memoria del **Revisor**. Auditoría de calidad, seguridad y dictamen de código.

## Estado
- Derivado de: `.spec/02-task-breakdown.md` y `.spec/03-implementation.md`
- Validaciones ejecutadas: `npm test` (36 pass / 0 fail), `npm run check` (54 archivos OK)
- Veredicto: `APROBADO`

## 1. Alcance revisado
- Tareas: TASK-1 a TASK-8 (PrinterProbe, integración, contrato host, tabla, detalle, filtros/búsqueda, exportación, regresión).
- Archivos principales:
  - `vlan-scanner/src/network/printer-probe.js`
  - `vlan-scanner/src/network/printer-probe.test.js`
  - `vlan-scanner/src/application/host-enricher.js`
  - `vlan-scanner/src/application/network-scanner.js`
  - `vlan-scanner/src/application/scan-request.js`
  - `vlan-scanner/src/main.js`
  - `vlan-scanner/src/renderer/core/selectors.js`
  - `vlan-scanner/src/renderer/views/host-table.js`
  - `vlan-scanner/src/index.html`
  - `vlan-scanner/src/renderer/views/detail-panel.js`
  - `vlan-scanner/src/export/result-exporter.js`
- Cambios: copia de trabajo local (modificaciones + archivos nuevos sin commits adicionales).

## 2. Hallazgos

| ID | Severidad | Archivo:línea | Descripción | Recomendación |
|---|---|---|---|---|
| F-1 | MEDIO | `vlan-scanner/src/network/printer-probe.js:236` | `PrinterProbe.probe()` solo recibe `osHint`, pero el contrato combina la condición de SO no Windows con la ausencia de puertos Windows (`135/139/445/5985`). Como `HostEnricher` sí evalúa puertos (`probeWindowsLikeHost`), los hosts descubiertos solo por puertos con etiqueta de SO distinta de "Windows" pasan el gate y luego quedan `unsupported` sin intento remoto. | Permitir pasar `openPorts`/`ports` a `probe({ ..., ports })` y aplicar la condición combinada documentada; mantener el comportamiento actual cuando no se reciban puertos. |
| F-2 | BAJO | `vlan-scanner/src/network/printer-probe.js:126`, `246-272` | La IP se interpola en el script PowerShell y argumento `wmic` después de `isIpv4`, pero no se normaliza con `trim()`. Un valor con espacios circundantes valida y puede producir un ComputerName inválido (fallo seguro, sin inyección). | Aplicar `ip.trim()` al entrar en `probe()` y en la construcción de scripts/argumentos. |
| F-3 | BAJO | `vlan-scanner/src/network/printer-probe.js:88-160` | `parsePowerShellPrinters()` y `parseWmicCsv()` no aplican `maxPrinters`; el truncado solo ocurre en `probe()`. Los tests actuales cubren el truncado en `probe()`, pero un consumo directo de helpers podría superar el límite. | Mantener el límite en `probe()` (comportamiento actual verificado) o añadir parámetro opcional `maxPrinters` a los helpers. |
| F-4 | BAJO | `vlan-scanner/src/application/host-enricher.test.js`, `vlan-scanner/src/export/result-exporter.test.js`, `vlan-scanner/src/application/scan-request.test.js`, `vlan-scanner/src/renderer/core/renderer-core.test.js` | TASK-8 propone pruebas de integración con `printerProbe` mock, exportación con impresoras, `probePrinters` y búsqueda por nombre de impresora. No están implementadas; las pruebas existentes siguen pasando. | Añadir las pruebas de aceptación faltantes para cubrir regresión de TASK-2, TASK-3, TASK-7 y TASK-6. |
| F-5 | BAJO | `vlan-scanner/src/network/printer-probe.js:252-265` | El fallback `wmic` se ejecuta con argumentos separados (`execFile` sin shell), lo que es seguro, pero no se verificó contra un binario `wmic` real ni su comportamiento de salida en este entorno. | Confirmar en smoke manual sobre Windows con WMI disponible; documentar como best-effort. |

No se detectaron hallazgos CRITICO ni ALTO.

## 3. Cumplimiento de contrato

| TASK | Estado | Notas |
|---|---|---|
| TASK-1 | OK (desviación menor) | `PrinterProbe` implementa comandos de solo lectura, validación IPv4, timeouts, parseo JSON/CSV, clasificación, sanitización. Comando principal y fallback coinciden con el contrato; F-1 afecta la condición combinada de puertos. |
| TASK-2 | OK | Inyección en `HostEnricher`, `NetworkScanner`, `scan-request`, `main.js`; `try/catch` defensivo y campos nuevos en la salida. |
| TASK-3 | OK | `printers`, `printerProbe` y `usbPrinterCount` siempre presentes en `enrich()`; `selectors.js` incluye nombres/modelos/puertos y texto `usb impresora`. |
| TASK-4 | OK | Columna `Impresoras USB`, celda con contador, tooltip, guion para 0; encabezado HTML sincronizado con las celdas. |
| TASK-5 | OK | Sección `Impresoras (remoto)`, estados `success/unsupported/failed/timeout/skipped`, listado y `Sin impresoras reportadas`. |
| TASK-6 | OK (alcance parcial esperado) | Búsqueda actualizada. Topología y filtro `type:has-usb-printer` declarados como opcionales/OPEN QUESTION, sin modificación. |
| TASK-7 | OK | Columnas `USB Printers`, `Printer Probe`, `Printers`; serialización legible; no aparece `[object Object]`. |
| TASK-8 | OK (cobertura parcial) | Comandos obligatorios en verde (36 tests, 54 archivos). Faltan pruebas de aceptación específicas propuestas por el contrato. |

## 4. Seguridad y calidad
- Inyección de comandos: mitigada por validación IPv4 y `execFile` sin shell. No se observa interpolación de entrada libre en comandos.
- PowerShell: script fijo con IP validada; `windowsHide: true`, timeout duro y abort signal.
- Sanitización de errores: recorte a 240 caracteres y sin stack trace en los caminos principales. El fallback conserva el mismo filtro.
- Manejo de errores: `PrinterProbe.probe()` no propaga; `HostEnricher.enrich()` envuelve la llamada en `try/catch` y continúa con OS/clasificación.
- Estabilidad: `printers`, `usbPrinterCount` y `printerProbe.status` mantienen invariantes; hosts no Windows quedan `unsupported`.
- Calidad: `npm test` y `npm run check` sin fallos. La capa renderer conserva el orden de columnas y los eventos DOM existentes.

## 5. Veredicto final
`APROBADO`

### Condiciones y riesgos residuales
1. Añadir las pruebas de aceptación faltantes de TASK-8 (F-4) antes de cerrar la iteración.
2. Revisar/corregir la condición combinada SO/puertos en `PrinterProbe` para hosts descubiertos por puertos Windows con etiqueta de SO no Windows (F-1).
3. Normalizar la IP con `trim()` en `PrinterProbe` (F-2).
4. La enumeración sigue siendo best-effort y depende de WMI/DCOM; puede marcarse `failed`/`timeout` si la red, firewall o permisos lo impiden, sin abortar el escaneo.
5. La topología y el filtro `type:has-usb-printer` quedan pendientes por diseño MVP.