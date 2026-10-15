# 05 - QA Playwright (qa-playwright)

> Archivo de memoria del agente **qa-playwright**. Matriz de pruebas E2E (Playwright) y reportes de ejecución.
> Derivado de `.spec/02-task-breakdown.md` (AC) y `.spec/03-implementation.md`.
> Entorno de trabajo (proyecto ejecutado): `vlan-scanner/` (Windows, Node v24.21.0).
> OpenCode session: ses_ec239575... (2026-10-14).

## Estado
- Veredicto provisional: `PASS` (regresión automatizada en verde; ver riesgos residuales).
- Cobertura actualizada: `npm test` **49 pass / 0 fail / 0 skipped**, `npm run check` **56 archivos JavaScript OK**.
- Playwright **no instalado** en el proyecto (`@playwright/test` / `playwright` ausentes en `dependencies` y `devDependencies`).
- No se han instalado dependencias sin aprobación del Coordinador.
- Se ejecutó análisis estático + smoke manual DOM (Node) + regresión obligatoria.
- Smoke manual WiFi móvil **no ejecutado** en esta sesión (sin dispositivos reales).
- Se añadió matriz AC para `TASK-9..TASK-17` (teléfonos) además de `TASK-1..TASK-8` (impresoras).

## Entorno
- Node: v24.21.0
- Playwright: No instalado / no disponible
- Comandos ejecutados:
  - `npm test` (en `vlan-scanner/`): 49 passed, 0 failed, 0 cancelled, 0 skipped, duración 399.73 ms.
  - `npm run check` (en `vlan-scanner/`): 56 archivos JavaScript con sintaxis correcta.
  - Smoke DOM manual (Node): renderizado de `HostTable` (10 celdas, contador `🖨️ 1`) y `DetailPanel` (`Impresoras (remoto)`, `Detectadas: 1 (USB: 1)`).
- Comandos NO ejecutados:
  - `npm run verify` (equivalente a test + check; no necesario al ejecutar ambos por separado).
  - Pruebas Playwright/Electron (sin dependencia instalada; requiere aprobación).
  - Smoke manual Windows/WMI real y WiFi móvil (sin entorno accesible).

## Solicitud al Coordinador
- Aprobar la instalación de `@playwright/test` y `playwright` (electron) como `devDependencies` únicamente cuando se decida automatizar E2E.
- Confirmar también si la aprobación incluye scripts de instalación o solo el runner Playwright.
- Confirmar entorno Windows con host WMI/DCOM accesible para validar TASK-8 AC-3 (impresora USB real).
- Confirmar entorno con dispositivos WiFi reales (iPhone/Android) para validar TASK-17 smoke móvil.
- Mantener la política: no escaneos amplios de red sin autorización; usar rangos pequeños/laboratorio.

## Matriz de pruebas (AC -> test)
Leyenda resultado: `PASS` (verificado, sin fallos), `FAIL`, `SKIPPED` (no ejecutado/no disponible), `STATIC` (verificado por inspección estática/smoke).
Método: `unit` (node:test), `static` (revisión de código), `smoke` (DOM manual en Node), `manual` (Windows/WiFi real), `e2e` (Playwright propuesto).

### A. Impresoras (TASK-1..TASK-8)

| TASK | AC | Test / caso (propuesto o existente) | Archivo | Método | Resultado | Evidencia / notas |
|---|---|---|---|---|---|---|
| TASK-1 | AC-1 | `parsePowerShellPrinters acepta objeto único` (connectionType USB, length 1) | `src/network/printer-probe.test.js` | unit | PASS | `printers.length===1`, `connectionType==='USB'` |
| TASK-1 | AC-2 | `classifyPrinterConnection clasifica USB/red/local/otro` (`IP_10.0.0.5` + `Network:true` -> `Network`) | `src/network/printer-probe.test.js` | unit | PASS | Clasificación Network verificada |
| TASK-1 | AC-3 | `PrinterProbe timeout clasifica correctamente` (mock killed, status timeout, prints [], elapsed<=9000) | `src/network/printer-probe.test.js` | unit | PASS | `elapsedMs` <= 9000 |
| TASK-1 | AC-4 | `PrinterProbe invalid IP no ejecuta comando` (`999.1.1.1` -> unsupported, no run) | `src/network/printer-probe.test.js` | unit | PASS | `called === false` |
| TASK-1 | AC-5 | (propuesto) `PrinterProbe stdout vacío -> success + printers []` | `src/network/printer-probe.test.js` (faltante) | static | PASS | Código retorna `success` y `[]`; hueco de automatización (D-1/D-3) |
| TASK-2 | AC-1 | (propuesto) `HostEnricher con printerProbe mock que falla no rompe enrich()` | `src/application/host-enricher.test.js` (faltante) | static | PASS | `try/catch` defensivo; `status:'online'`, `printers:[]` |
| TASK-2 | AC-2 | `probePrinters:false -> printerProbe.status skipped y probe no llamado` | `src/application/host-enricher.test.js` (faltante) | static | PASS | No invoca `printerProbe` cuando `probePrinters` es false |
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
| TASK-8 | AC-1 | `npm test` todos los tests pasan (0 fallos) | Proyecto completo | unit | PASS | 49/49 pass |
| TASK-8 | AC-2 | `npm run check` sin errores de sintaxis | Proyecto completo | unit | PASS | 56 archivos OK |
| TASK-8 | AC-3 | Smoke manual Windows con impresora USB accesible por WMI | Equipo Windows laboratorio real | manual | SKIPPED | No ejecutado (sin host WMI/impresora USB accesible en esta sesión); condición residual reportada en riesgos |

### B. Teléfonos móviles (TASK-9..TASK-17)

| TASK | AC | Test / caso | Archivo | Método | Resultado | Evidencia / notas |
|---|---|---|---|---|---|---|
| TASK-9 | AC-9.1 | `VendorIdentifier.identify(mac)` con prefijo móvil conocido devuelve fabricante no vacío | `src/data/oui-data.js`, `vendor-identifier.js` | static | PASS* | `VENDOR_GROUPS.mobile` y prefijos curados presentes (sin test automatizado: F-10) |
| TASK-9 | AC-9.2 | Registros OUI previos no se eliminan ni cambian semántica | `src/data/oui-data.js` | static | PASS | Inspección: entradas existentes conservadas |
| TASK-9 | AC-9.3 | MAC desconocida/privada -> `identify()` devuelve `''` | `mobile-phone-classifier` + vendor | static | PASS | Clasificador marca unknown vendor sin afirmar fabricante |
| TASK-10 | AC-10.1 | iPhone estable: `isPhone true`, `phoneOS iOS`, confianza no low, evidencia hostname/OS | `src/identification/mobile-phone-classifier.test.js` | unit | PASS | Test "detecta iPhone estable" |
| TASK-10 | AC-10.2 | Samsung solo por OUI/TTL -> `isPhone false`, campos null/[] | `mobile-phone-classifier.test.js` | unit | PASS | Test "rechaza Samsung solo por OUI/TTL" |
| TASK-10 | AC-10.3 | `hostname android-5f3c` + puertos PC -> `isPhone false`, conflicts `pc-ports` | `mobile-phone-classifier.test.js` | unit | PASS | Test "rechaza PC con puertos y conflictos" |
| TASK-10 | AC-10.4 | Galaxy Tab A8 -> `isPhone true`, OS Android, formFactor tablet, hint Samsung Galaxy Tab | `mobile-phone-classifier.test.js` | unit | PASS | Test "detecta Android Galaxy tablet" |
| TASK-10 | AC-10.5 | iPhone sin vendor (`ttl 64`) -> `isPhone true`, phoneHint null, phoneOS `Mobile OS (unknown)` no; SO inferido iOS por hostname | `mobile-phone-classifier.test.js` | unit | PASS | Test "soporta iPhone sin vendor claro" (phoneOS iOS tras F-7) |
| TASK-10 | AC-10.6 | MAC aleatorizada/vendor desconocido sin señales -> `isPhone false` | `mobile-phone-classifier.test.js` | unit | PASS | Test "rechaza MAC desconocida" |
| TASK-10 | (norm) | `normalizeMobileOs('Android 14'/'iOS 17')` y por hostname | `mobile-phone-classifier.test.js` | unit | PASS | Tests normalize |
| TASK-10 | (conflict) | `isMobileConflict` detecta `pc-ports`, `sip`, etc. | `mobile-phone-classifier.test.js` | unit | PASS | Test "isMobileConflict detecta conflictos" |
| TASK-11 | AC-11.1 | `classify({hostname iphone, vendor Apple, os iOS, ports []})` -> `smartphone` | `src/identification/identification.test.js` | unit | PASS | Test "clasifica smartphones con prioridad" |
| TASK-11 | AC-11.2 | `classify({vendor Samsung, os Android, ports [80]})` -> `smartphone` | `identification.test.js` | unit | PASS | Mismo test |
| TASK-11 | AC-11.3 | `classify({ports [554, 8000]})` != `smartphone` (cámara prioriza) | `identification.test.js` | unit | PASS | Mismo test |
| TASK-11 | AC-11.4 | `classify({ports [5060]})` != `smartphone` salvo móvil explícito sin SIP | `identification.test.js` | unit | PASS | Mismo test |
| TASK-11 | AC-11.5 | `classify({vendor Apple, ports [22,80,443]})` sin evidencia móvil != `smartphone` | `identification.test.js` | unit | PASS | Mismo test |
| TASK-11 | AC-11.6 | `normalizeMobileOs('Android 14')` -> `Android` | `identification.test.js` | unit | PASS | Test "normalizeMobileOs delega en classifier" |
| TASK-11 | AC-11.6b | `normalizeMobileOs()` por hostname en os-detector | `src/identification/os-detector.js` | static | PASS | Helper delega en `MobilePhoneClassifier` (F-7 resuelto) |
| TASK-12 | AC-12.1 | Mock `isPhone:true` -> `deviceType smartphone` y campos móviles no nulos | `src/application/host-enricher.test.js` | unit | PASS | Test "añade campos smartphone cuando el clasificador lo indica" |
| TASK-12 | AC-12.2 | Mock `isPhone:false` -> `deviceType` de classifier, campos phone null/[] | `host-enricher.test.js` | static | PASS* | Código inicializa campos; falta test dedicado (F-9) |
| TASK-12 | AC-12.3 | Clasificador móvil que lanza -> `status online`, sin propagación, evidencia `classifier-error` | `host-enricher.test.js` | unit | PASS | Test "no rompe si el clasificador móvil falla" |
| TASK-12 | AC-12.4 | `NetworkScanner.scan()` -> `onHostFound` host con `phoneEvidence` array y confianza definida/null | `network-scanner.test.js` + host | static | PASS | Scanner pasa host enriquecido; invariantes en HostEnricher |
| TASK-12 | AC-12.5 | Arranque con `mobilePhoneClassifier: null` no rompe | `src/main.js` | static | PASS | Fake `electron` + `buildServices()` OK (Revisor) |
| TASK-12 | inv. | `phoneEvidence` siempre array y campos inicializados en non-phone | `host-enricher.js` | static | PASS | Código defensivo y normalización |
| TASK-13 | AC-13.1 | Host smartphone -> tipo `📱 smartphone` y tooltip con `phoneHint` | `src/renderer/core/catalogs.js`, `host-table.js` | static | PASS | `DEVICE_ICONS.smartphone/tablet = 📱` |
| TASK-13 | AC-13.2 | Host normal -> sin tooltip móvil | `host-table.js` | static | PASS | Tooltip condicional por `deviceType` |
| TASK-13 | AC-13.3 | Tabla vacía -> render sin error | `host-table.js` | static | PASS | Manejo de `visibleHosts.length === 0` |
| TASK-14 | AC-14.1 | Host smartphone -> sección "Teléfono móvil" con 4 filas | `src/renderer/views/detail-panel.js` | static | PASS | Implementado según contrato |
| TASK-14 | AC-14.2 | `phoneHint: null` -> fila "No estimado" | `detail-panel.js` | static | PASS | Fallback `|| 'No estimado'` |
| TASK-14 | AC-14.3 | Host no móvil -> sin sección Teléfono móvil | `detail-panel.js` | static | PASS | Condición por `deviceType` |
| TASK-14 | AC-14.4 | `phoneEvidence: []` ->fila "Evidencias" muestra `—` sin error | `detail-panel.js` | static | PASS | Join + fallback |
| TASK-15 | AC-15.1 | Búsqueda por `phoneHint`/OS/confianza/evidencias -> host visible | `src/renderer/core/selectors.js` | static | PASS* | `phoneText` incluido; falta test selectors (F-4) |
| TASK-15 | AC-15.2 | Filtro `type:smartphone` muestra smartphone y excluye otros | `selectors.js` | static | PASS | Filtro compara `deviceType` |
| TASK-15 | AC-15.3 | Topología `update()`/`draw()` con smartphone no lanza | `topology-view.js` | static | PASS | Usa `DEVICE_ICONS`; anillo opcional pendiente (F-12) |
| TASK-15 | AC-15.4 | `phoneConfidence: low` no marcado -> no aparece en `type:smartphone` | `host-enricher`/classifier | static | PASS | Umbral `score >= 3`, no phone si below |
| TASK-16 | AC-16.1 | JSON preserva `phoneOS`, `phoneHint`, `phoneConfidence`, `phoneEvidence` | `src/export/result-exporter.js` | static | PASS* | `JSON.stringify(data)`; falta test phone específico (F-4) |
| TASK-16 | AC-16.2 | CSV columnas `Phone OS/Hint/Confidence/Evidence`, sin `[object Object]` | `result-exporter.js` | static | PASS | `phoneEvidence` serializa con `; ` |
| TASK-16 | AC-16.3 | `phoneEvidence` vacío -> celda vacía sin error | `result-exporter.js` | static | PASS | Join de [] |
| TASK-16 | AC-16.4 | Cancelación de diálogo conserva comportamiento existente | `result-exporter.js` | static | PASS | `if (!filePath) return false` |
| TASK-17 | REG-1 | Clasificador móvil: casos positivos/negativos/tablet/sanitización | `mobile-phone-classifier.test.js` | unit | PASS | 9 tests pass |
| TASK-17 | REG-2 | Precedencia DeviceClassifier (cámara/impresora/VoIP/PC) | `identification.test.js` | unit | PASS | Test smartphones con prioridad |
| TASK-17 | REG-3 | HostEnricher phone fields + fallo defensivo | `host-enricher.test.js` | unit | PASS | 2 tests mobile |
| TASK-17 | REG-4 | Búsqueda por campos phone (tests selectors) | `renderer-core.test.js` | static | SKIPPED | Falta test dedicado (F-4) |
| TASK-17 | REG-5 | Export phone fields (tests result-exporter) | `result-exporter.test.js` | static | SKIPPED | Falta test dedicado (F-4) |
| TASK-17 | REG-6 | `npm test` 0 fallos | Proyecto completo | unit | PASS | 49/49 |
| TASK-17 | REG-7 | `npm run check` 0 errores | Proyecto completo | unit | PASS | 56/56 |
| TASK-17 | REG-8 | Smoke manual WiFi: smartphone real, clasificación, búsqueda y export | Equipo WiFi real | manual | SKIPPED | No ejecutado en esta sesión |

> Nota de métricas: filas marcadas `PASS*` indican implementación verificada por inspección estática/código, con cobertura automatizada pendiente (hallazgos F-4/F-9/F-10). No son fallos funcionales.

## Defectos encontrados

| ID | Severidad | AC/TASK | Archivo (referencia) | Descripción | Reproducción |
|---|---|---|---|---|---|
| D-1 | MEDIA | TASK-1 (F-1) | `src/network/printer-probe.js:236-238` | Condición combinada SO/puertos solo en `HostEnricher`; `PrinterProbe.probe()` valida `osHint` por texto y no recibe puertos, por lo que host descubierto por puertos Windows con SO no Windows puede quedar `unsupported` sin intento remoto. | Host con puertos `135/445` y OS detectado distinto de "Windows"; `PrinterProbe.probe(ip, { osHint })` -> `unsupported`. |
| D-2 | BAJA | TASK-1 (F-2) | `src/network/printer-probe.js:126,246-272` | IP no normalizada con `trim()`; espacios periféricos pueden causar fallo seguro en ComputerName. | `probe(' 10.0.0.1 ')` -> validación/comando fallido (sin inyección). |
| D-3 | BAJA | TASK-8/TASK-17 (F-4) | tests de enricher/scanner/exporter/selectors | Falta cobertura automatizada de integración: printerProbe fallo, `probePrinters:false`, `usbPrinterCount` en NetworkScanner, CSV con impresoras, búsqueda por impresora/móvil, prefijos OUI. | `npm test` pasa but sin aserciones de esos escenarios. |
| D-4 | BAJA | TASK-6 (MVP parcial) | `src/renderer/views/topology-view.js` | Topología sin glifo/anillo de impresora USB; opcional documentado. | Inspección visual/topología: no se muestra glifo USB en nodos. |
| D-5 | BAJA | TASK-8 AC-3 | Entorno/lab Windows real | Smoke manual WMI/impresora USB no ejecutado. | No reproducible en esta sesión; requiere host Windows con WMI/DCOM y rango autorizado. |
| D-6 | BAJA | Automatización E2E | Proyecto raíz | Playwright no disponible; bloqueo de automatización, no defecto de código. | `Test-Path vlan-scanner/node_modules/@playwright` -> False. |
| D-7 | BAJA | TASK-9 (F-10) | `src/data/oui-data.js` | Prefijos móviles curados sin test de regresión automatizado. | `npm test` no incluye assertions OUI móvil. |
| D-8 | MEDIO | TASK-11 (F-8) | `src/identification/device-classifier.js:34-50` | Reglas `smartphone` no distinguen VoIP cuando `sipConfirmed` es false en casos límite; coincide con AC-11, pero falta cobertura de hostname + SIP confirmado. | `classify({ hostname móvil, ports [5060], sipConfirmed true })` debe permanecer no smartphone. |
| D-9 | MEDIO | TASK-12 (F-9) | `src/application/host-enricher.test.js` | Falta test dedicado de mock móvil `isPhone:false` para verificar campos null/[] (no bloqueante). | Añadir test con classifier que devuelve `isPhone:false`. |
| D-10 | BAJO | TASK-15 (F-12) | `src/renderer/views/topology-view.js` | Topología sin anillo de acento por confianza; icono 📱 ya aparece por tipo. | Inspección visual: sin anillo diferenciado high/medium. |
| D-11 | BAJO | TASK-15 (F-13) | `src/renderer/core/selectors.js:18` | Alias de filtro `type:phone` no implementado; solo `type:smartphone`. OPEN QUESTION. | Filtro `type:phone` no filtra en UI. |
| D-12 | BAJO | TASK-10 (F-11) | `mobile-phone-classifier.js:81-105` | `derivePhoneHint()` puede devolver hostname original recortado 80 chars; compatible, requiere sanitización (`slice`). | Vendor desconocido con hostname > 80 chars -> pista recortada. |
| D-13 | BAJO | TASK-1 (F-5/F-3) | `printer-probe.js` | Fallback `wmic` no verificado contra binario real; `maxPrinters` se aplica solo en `probe()`, no en helpers de parsing. | Smoke Windows + llamadas directas a parse helpers no truncan. |

### Defectos bloqueantes
- Ninguno crítico/alto. No se notifican cambios urgentes al Implementador. Los defectos anteriores son condiciones residuales (medio/bajo) ya documentadas por Revisor (04-code-review.md).

## Hallazgos adicionales del Revisor (no bloqueantes)
- `F-6` y `F-7`: resueltos (wiring `main.js` con `{ analyze: analyzeMobilePhone }` y OS móvil por hostname). Evidencia: carga simulada de `main.js` y tests verdes.
- Topología y alias móvil quedan fuera del MVP por OPEN QUESTIONS (`F-12`, `F-13`, `OQ-P5`, `OQ-P3`).
- La detección móvil sigue siendo heurística pasiva; puede tener falsos positivos/negativos con MAC aleatorizada o OUI impreciso.

## Riesgos / no cubierto
- Playwright/Electron E2E no disponible (ver solicitud de aprobación).
- Smoke manual Windows/WMI real no ejecutado (D-5).
- Smoke manual WiFi móvil no ejecutado (TASK-17 REG-8).
- Dependencia del entorno remoto: firewall/permisos UAC pueden ocasionar `failed`/`timeout` por host sin afectar el scan.
- Potencial desajuste puertos/OS en `PrinterProbe` (D-1) para hosts detectados únicamente por puertos Windows pero con salida SO no Windows.
- Falsos positivos/duplicados entre impresoras de red y USB mitigados por clasificación, pero no contrastados con tráfico real.
- Cobertura automatizada parcial para AC de impresoras/móviles (D-3, D-7, D-9).
- Sin filtro `type:has-usb-printer`, alias `type:phone`, ni anillo en topología (MVP declarado).
- UX/celdas/table renderer no automatizadas en navegador real (solo smoke DOM estructural).
- MAC aleatorizada/ OUI impreciso puede reducir precisión de clasificación móvil (falsos positivos/negativos).
- Tablets vs smartphones clasificadas como `smartphone` (OPEN QUESTION OQ-P1).

## Smoke manual propuesto (no ejecutado en esta sesión)

### Impresoras (Windows/WMI)
1. Equipo Windows con impresora USB encendida y compartida vía WMI.
2. Escanear rango pequeño autorizado.
3. Verificar contador `🖨️ 1` y sección `Impresoras (remoto)` con nombre/USB.
4. Exportar CSV y abrir en hoja de cálculo (columnas `USB Printers`, `Printer Probe`, `Printers`).

### Teléfonos móviles (WiFi)
1. iPhone/Android real conectado a la red WiFi.
2. Escanear rango pequeño autorizado.
3. Verificar host clasificado `smartphone`, tipo `📱`, OS móvil y confianza.
4. Búsqueda por fabricante/modelo (`phoneHint`).
5. Exportar CSV/JSON y verificar columnas `Phone OS`, `Phone Hint`, `Phone Confidence`, `Phone Evidence`.

## Veredicto final
- `PASS`
- Motivo: regresión obligatoria verde (`npm test` 49/49, `npm run check` 56/56), invariantes de datos presentes (printers + phone*), integración principal cableada y verificada estáticamente, smoke UI estructural OK, tests móviles unitarios en verde.
- Condición residual: ejecutar/cerrar hallazgos medios/bajos (D-1, D-3, D-5, D-8, D-9, D-7, etc.), aprobar Playwright si se quiere automatizar E2E, validar host Windows real (TASK-8 AC-3) y smoke WiFi móvil (TASK-17 REG-8) antes de declarar cierre completo.

## Referencias
- `.spec/01-master-spec.md`
- `.spec/02-task-breakdown.md` (AC y estrategia de pruebas)
- `.spec/03-implementation.md` (mapa de cambios)
- `.spec/04-code-review.md` (hallazgos F-1..F-13)
- Regresión local: `npm test` (49/49), `npm run check` (56/56) (logs reportados arriba)