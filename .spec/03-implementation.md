# 03 - Implementation (Implementador)

> Archivo de memoria del Implementador. Registro del código fuente y cambios realizados según los contratos.

## Estado
- Derivado de: `.spec/02-task-breakdown.md`
- Verificación inicial: `npm test`: 36 pass, 0 fail; `npm run check`: 54 archivos OK.
- Verificación final (phones): `npm test`: 48 pass, 0 fail; `npm run check`: 56 archivos OK.

## Entradas implementadas
| TASK | Estado | Archivos |
|---|---|---|
| TASK-1 | Completado | `vlan-scanner/src/network/printer-probe.js`, `vlan-scanner/src/network/printer-probe.test.js` |
| TASK-2 | Completado | `host-enricher.js`, `network-scanner.js`, `scan-request.js`, `main.js` |
| TASK-3 | Completado | `host-enricher.js` (salida), `selectors.js` |
| TASK-4 | Completado | `host-table.js`, `src/index.html` |
| TASK-5 | Completado | `detail-panel.js` |
| TASK-6 | Completado | `selectors.js` |
| TASK-7 | Completado | `result-exporter.js` |
| TASK-8 | Completado | tests añadidos/actualizados |

## Cambios por archivo
### `vlan-scanner/src/network/printer-probe.js`
- Nuevo módulo `PrinterProbe` con comandos Windows de solo lectura (`powershell` CIM + fallback `wmic`), validación IPv4, timeouts, parsing, clasificación USB/Red/Local/Otro, fabricante y estado, sanitización de errores y exportación de helpers.

### `vlan-scanner/src/network/printer-probe.test.js`
- Pruebas unitarias de parseo, clasificación, timeout, acceso denegado, IP inválida, truncado y CSV.

### `vlan-scanner/src/application/host-enricher.js`
- Parámetro constructor `printerProbe` (default `null`).
- Flujo `probePrinters` integrado en `enrich()` con `probeWindowsLikeHost`, `onPhase('impresoras')`, try/catch defensivo y retorno extendido (`printers`, `printerProbe`, `usbPrinterCount`).

### `vlan-scanner/src/application/network-scanner.js`
- Pasa `probePrinters: plan.probePrinters !== false` al enriquecimiento.

### `vlan-scanner/src/application/scan-request.js`
- `probePrinters` en el plan con default `true`.

### `vlan-scanner/src/main.js`
- Instancia y inyecta `PrinterProbe` en `HostEnricher`.

### `vlan-scanner/src/renderer/core/selectors.js`
- Búsqueda incluye nombres/modelo/puerto de impresoras y texto `usb impresora`.

### `vlan-scanner/src/renderer/views/host-table.js`
- Columna/celda `Impresoras USB` con `🖨️ N`, tooltip y `—`.

### `vlan-scanner/src/index.html`
- Encabezado `Impresoras USB` en la tabla.

### `vlan-scanner/src/renderer/views/detail-panel.js`
- Sección `Impresoras (remoto)` con estado, contador USB y listado o `Sin impresoras reportadas`.

### `vlan-scanner/src/export/result-exporter.js`
- Columnas `USB Printers`, `Printer Probe`, `Printers`; serialización legible sin `[object Object]`.

## Desviaciones del contrato
- Topología (`topology-view.js`) no se modificó: se declara como opcional/TODO por MVP.
- Filtro adicional `type:has-usb-printer` no se añadió (OPEN QUESTION).
- `voIPCredentials` se conserva vía helper menor en `detail-panel.js` (sin cambio funcional).

## Comandos ejecutados y resultados
- `npm test`: 36 pass, 0 fail.
- `npm run check`: 54 archivos JavaScript sin errores.

## Notas
- Se eligió la opción más segura para hosts Windows-only y timeouts por host.
- La enumeración es best-effort y depende de WMI/DCOM.

## Extensión: Teléfonos celulares (TASK-9..TASK-17)
### Entradas implementadas
| TASK | Estado | Archivos |
|---|---|---|
| TASK-9 | Completado | `vlan-scanner/src/data/oui-data.js` |
| TASK-10 | Completado | `vlan-scanner/src/identification/mobile-phone-classifier.js`, `.test.js` |
| TASK-11 | Completado | `device-classifier.js`, `os-detector.js`, `identification.test.js` |
| TASK-12 | Completado | `host-enricher.js`, `host-enricher.test.js`, `main.js` |
| TASK-13 | Completado | `catalogs.js`, `host-table.js` |
| TASK-14 | Completado | `detail-panel.js` |
| TASK-15 | Completado | `selectors.js` |
| TASK-16 | Completado | `result-exporter.js` |
| TASK-17 | Completado | tests actualizados |

### Cambios adicionales por archivo
- `oui-data.js`: grupo `VENDOR_GROUPS.mobile` y prefijos móviles curados.
- `mobile-phone-classifier.js`: heurísticas pasivas, `analyzeMobilePhone`, `normalizeMobileOs`, `derivePhoneHint`, `isMobileConflict`, constantes exportadas.
- `device-classifier.js`: firma `classify()` acepta `os`; reglas `phone-hostname`/`phone-os` previas a workstation/apple/server y posteriores a cámara/impresora; conflictos compartidos.
- `os-detector.js`: exporta `normalizeMobileOs` delegando en `MobilePhoneClassifier`.
- `host-enricher.js`: parámetro `mobilePhoneClassifier`, análisis móvil tras detección de SO, `deviceType='smartphone'` si aplica, campos `phone*` siempre presentes, manejo defensivo.
- `main.js`: instancia e inyecta `MobilePhoneClassifier`.
- `catalogs.js`: icono `📱` para `smartphone`/`tablet`.
- `host-table.js`: tooltip móvil en celda de tipo.
- `detail-panel.js`: sección "Teléfono móvil", 4 filas y nota pasiva en acciones.
- `selectors.js`: búsqueda incluye `phoneOS`, `phoneHint`, confianza y evidencias.
- `result-exporter.js`: columnas Phone OS/Hint/Confidence/Evidence y serialización CSV sin leak.
- `main.js`: wiring completado.

### Desviaciones del contrato (phones)
- `topology-view.js`: no se añadió anillo de acento (opcional/TODO); el icono 📱 se muestra automáticamente por tipo.
- Alias de filtro `type:phone` no se añadió (OPEN QUESTION); `type:smartphone` funciona.
- La inferencia de OS móvil se basa principalmente en campos `os`/banner; hostname móvil sirve para clasificación y evidencia, pero no fuerza OS cuando no hay señal explícita (priorizando AC).
- Se añadieron 12 pruebas nuevas/actualizadas para classifier, DeviceClassifier, HostEnricher, búsqueda/exportación no ampliada adicional.

### Comandos ejecutados y resultados (final)
- `npm test`: 48 pass, 0 fail.
- `npm run check`: 56 archivos JavaScript sin errores.
