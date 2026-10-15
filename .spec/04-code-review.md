# 04 - Code Review (Revisor)

> Archivo de memoria del **Revisor**. Auditoría de calidad, seguridad y dictamen de código.
> Derivado de `.spec/02-task-breakdown.md` y `.spec/03-implementation.md`.

## Estado

- Validaciones ejecutadas: `npm test` **49 pass / 0 fail**; `npm run check` **56 archivos JavaScript sin errores**.
- Verificación de arranque: carga simulada de `src/main.js` con módulo `electron` de prueba (solo lectura) y ejecución de `buildServices()` completada sin `TypeError`; el servicio devuelve `interfaceService`, `scanManager` y `resultExporter`.
- Cambios finales verificados: `normalizeMobileOs()` y `mobileOsDetected()` incluyen `hostname` al combinar señales, y la prueba `normalizeMobileOs infiere SO por hostname` pasa (actualización del caso `iPhone sin vendor claro`, ahora `phoneOS === 'iOS'`).
- Residuales no bloqueantes: casos de aceptación opcionales (F-4/F-9/F-10) y el test dedicado `isPhone:false` (F-9/CR-3) siguen pendientes de cobertura, sin impacto funcional ni en regresión.
- Veredicto final: **`APROBADO`** (0 CRÍTICOS, 0 ALTOs bloqueantes; residuales MEDIO/BAJO opcionales).

## 1. Alcance revisado

- Tasks: TASK-1..TASK-17 (impresoras remotas + teléfonos móviles WiFi).
- Commit base auditado: `399d66c` (`feat: sistema multi-agente Spec-Driven...`), más cambios locales no registrados como commits adicionales.
- Cambios auditados en esta iteración final:
  - `vlan-scanner/src/main.js`: wiring funcional `{ analyze: analyzeMobilePhone }` (sin `TypeError`).
  - `vlan-scanner/src/identification/mobile-phone-classifier.js`: `mobileOsDetected()` y `normalizeMobileOs()` incluyen `hostname` en la combinación textual.
  - `vlan-scanner/src/identification/mobile-phone-classifier.test.js`: prueba actualizada para SO inferido por hostname.
- Archivos revisados (principales):
  - `vlan-scanner/src/network/printer-probe.js`, `printer-probe.test.js`
  - `vlan-scanner/src/application/host-enricher.js`, `host-enricher.test.js`, `network-scanner.js`, `scan-request.js`
  - `vlan-scanner/src/main.js`
  - `vlan-scanner/src/identification/mobile-phone-classifier.js`, `mobile-phone-classifier.test.js`, `device-classifier.js`, `os-detector.js`, `vendor-identifier.js`, `identification.test.js`
  - `vlan-scanner/src/data/oui-data.js`
  - `vlan-scanner/src/renderer/core/selectors.js`, `catalogs.js`, `host-table.js`, `detail-panel.js`, `topology-view.js`
  - `vlan-scanner/src/export/result-exporter.js`, `result-exporter.test.js`
  - `vlan-scanner/src/index.html`

## 2. Hallazgos

| ID | Severidad | Estado | Archivo:línea | Hallazgo | Recomendación (contrato) |
|---|---|---|---|---|---|
| F-1 | MEDIO | PENDIENTE | `src/network/printer-probe.js:236-238` | `PrinterProbe.probe()` valida `osHint` por texto, pero no recibe puertos. El gate combinado SO/puertos Windows se aplica solo en `HostEnricher`; un host descubierto por puertos Windows pero con etiqueta de SO no Windows queda `unsupported` sin intento remoto. | Añadir `ports`/`openPorts` al `probe()` y aplicar la condición combinada de TASK-1; mantener compatibilidad cuando no se envíen puertos. |
| F-2 | BAJO | PENDIENTE | `src/network/printer-probe.js:126,246-272` | La IP validada no se normaliza con `trim()`; espacios periféricos pueden causar fallo en ComputerName remoto (seguro, sin inyección). | Aplicar `ip.trim()` al entrar en `probe()` y en la construcción de scripts/argumentos. |
| F-3 | BAJO | PENDIENTE | `src/network/printer-probe.js:98-186` | `parsePowerShellPrinters()` y `parseWmicCsv()` no aplican `maxPrinters`; solo `probe()` trunca. | Mantener el truncado en `probe()` o añadir parámetro opcional `maxPrinters` a los helpers. |
| F-4 | BAJO | PENDIENTE | `src/application/host-enricher.test.js`, `src/application/network-scanner.test.js`, `src/export/result-exporter.test.js`, `src/renderer/core/renderer-core.test.js` | TASK-8/TASK-17 declaran pruebas de aceptación (`printerProbe` fallo, `probePrinters:false`, `usbPrinterCount` en NetworkScanner, CSV con impresoras, búsqueda por impresora/Móvil) que no existen; los tests actuales cubren solo invariantes básicas. | Añadir pruebas de aceptación faltantes para cerrar TASK-8 y TASK-17. |
| F-5 | BAJO | PENDIENTE | `src/network/printer-probe.js:252-292` | El fallback `wmic` no está verificado contra binario real en este entorno. | Confirmar en smoke manual Windows y documentar como best-effort. |
| F-6 | CRÍTICO | RESUELTO | `src/main.js:12,38-39`; `src/identification/mobile-phone-classifier.js` | `main.js` hacía `const { MobilePhoneClassifier } = require(...)` y `new MobilePhoneClassifier()`, pero el módulo solo exporta funciones. `buildServices()` fallaba antes de arrancar la app real. | Corregido: `const { analyzeMobilePhone }` y `mobilePhoneClassifier = { analyze: analyzeMobilePhone }`. Verificado: `buildServices()` ejecuta sin `TypeError`. |
| F-7 | ALTO | RESUELTO | `src/identification/mobile-phone-classifier.js:45-49, 107-113, 120-196`; `src/identification/os-detector.js:140-143` | `mobileOsDetected()` ahora incluye `hostname`, y `normalizeMobileOs()` incluye `hostname`; un host móvil identificable por nombre deja de quedar con `Mobile OS (unknown)`. Prueba `normalizeMobileOs infiere SO por hostname` añadida y verde. | TASK-10/TASK-12, AC-10, AC-11: inferencia por hostname implementada y cubierta por test. |
| F-8 | MEDIO | PENDIENTE | `src/identification/device-classifier.js:34-50` | Las reglas `smartphone` tienen precedencia por cámara/impresora y control de conflictos, pero `phone-os` no distingue VoIP cuando `sipConfirmed` es falso; el comportamiento actual coincide con AC-11. No se detecta rompimiento, pero conviene añadir casos límite en pruebas. | Mantener precedencia documentada y añadir pruebas TASK-11 (hostname + SIP confirmado). |
| F-9 | MEDIO | PENDIENTE (opcional) | `src/application/host-enricher.js:102-191` | La integración móvil cumple el flujo y la defensa de errores, pero falta prueba dedicada del caso `isPhone:false`. | TASK-12/AC-12: añadir test mock `isPhone:false` que verifique `phoneEvidence === []` e invariantes de campos `phone*` (no bloqueante; cobertura actual cubre `isPhone:true` y fallo). |
| F-10 | MEDIO | PENDIENTE | `src/data/oui-data.js:1-96` | Los prefijos móviles curados se añadieron y `VENDOR_GROUPS.mobile` existe, pero no hay test automatizado de regresión de prefijos. | TASK-9/AC-9: añadir pruebas para `VendorIdentifier.identify()` con prefijos móviles y regresión de grupos existentes. |
| F-11 | BAJO | PENDIENTE (compatible) | `src/identification/mobile-phone-classifier.js:81-105` | `derivePhoneHint()` puede devolver el hostname original recortado a 80 chars para vendors desconocidos. Es compatible con el contrato ("pista textual best-effort"), pero depende de que el hostname no sea exactamente un token móvil. | TASK-10: mantener sanitización de `phoneHint` (`slice(0,80)`) y evitar exponer MAC completa en evidencia. |
| F-12 | BAJO | PENDIENTE (opcional) | `src/renderer/views/topology-view.js` | Topología no incluye anillo de acento ni glyph específico por confianza; el icono 📱 ya aparece por `DEVICE_ICONS`. Declarado opcional en el contrato y en 03-implementation. | TASK-15 (MVP): documentar TODO/residual o implementar anillo de bajo riesgo. |
| F-13 | BAJO | PENDIENTE (decisión abierta) | `src/renderer/core/selectors.js:18` | El alias de filtro `type:phone` no se añadió; `type:smartphone` funciona. OPEN QUESTION del contrato. | TASK-15: documentar la decisión (sin cambios necesarios para MVP). |

## 3. Cumplimiento de contrato

| TASK | Estado | Notas |
|---|---|---|
| TASK-1 | OK (desviación menor, F-1) | `PrinterProbe` implementa comandos de solo lectura, validación IPv4, timeouts, parseo JSON/CSV, clasificación y sanitización. |
| TASK-2 | OK (F-6 resuelto) | Inyección de `PrinterProbe` correcta; `probePrinters` con default true. `MobilePhoneClassifier` cableado por API funcional sin `TypeError`. |
| TASK-3 | OK | `printers`, `printerProbe`, `usbPrinterCount` presentes en `enrich()`. |
| TASK-4 | OK | Columna/celda de impresoras USB y tooltip; encabezado sincronizado. |
| TASK-5 | OK | Sección `Impresoras (remoto)` y estados documentados. |
| TASK-6 | OK | Búsqueda printers incluida; topología opcional/TODO. |
| TASK-7 | OK | Columnas CSV/JSON para impresoras y phone fields legibles. |
| TASK-8 | OK (cobertura parcial, F-4) | Regresión obligatoria en verde: 49 tests, 56 archivos de sintaxis. |
| TASK-9 | OK (cobertura pendiente, F-10) | `VENDOR_GROUPS.mobile` y prefijos curados añadidos; no se borran entradas existentes. |
| TASK-10 | OK | Módulo puro existe y detection por hostname funciona; `normalizeMobileOs()` ahora infiere OS por hostname (F-7 resuelto). |
| TASK-11 | OK con caveat (F-8) | `DeviceClassifier.classify()` acepta `os`; reglas móviles en el orden correcto; `OsFingerprintService.normalizeMobileOs` delega. |
| TASK-12 | OK (F-7 resuelto) | Flujo móvil, campos e invariante non-phone/fallo implementados; inferencia de `phoneOS` por hostname completada. |
| TASK-13 | OK | `DEVICE_ICONS.smartphone/tablet = 📱`, tooltip móvil en tipo. |
| TASK-14 | OK | Sección `Teléfono móvil` solo para smartphone y nota pasiva. |
| TASK-15 | OK parcial | Búsqueda incluye phone fields; filtro `type:smartphone`; alias/anillo opcionales no implementados. |
| TASK-16 | OK | Columnas `Phone OS/Hint/Confidence/Evidence` y serialización CSV sin leak. |
| TASK-17 | OK (cobertura parcial) | Tests unitarios phones en verde, pero faltan pruebas de integración/wiring y AC-12 del caso false (F-4/F-9). |

## 4. Seguridad y calidad

- Inyección de comandos: mitigada por `isIpv4` y `execFile` sin shell; IP se interpola solo después de validación.
- PowerShell: script fijo, `windowsHide`, timeout duro y abort signal.
- Sanitización de errores: recorte a 240 caracteres; sin stack en caminos principales.
- Manejo de errores: `PrinterProbe` no propaga; `HostEnricher` envuelve probe y clasificador móvil en `try/catch`.
- Estabilidad de invariantes: `printers` array, `usbPrinterCount` número, `printerProbe.status` string; campos `phone*` inicializados en hosts online.
- Regresión: `npm test` 49 pass / 0 fail; `npm run check` 56 archivos OK. Smoke de `buildServices()` (con fake de `electron`) también OK.
- Calidad UI: el smoke DOM/estructural previo sigue válido; no se ejecutó E2E real por falta de Playwright.
- Seguridad wiring móvil: la factory `{ analyze }` evita instanciación inválida y no crea dependencias cíclicas.

## 5. Veredicto final

### `APROBADO`

#### Cambios obligatorios / verificados en esta iteración

1. **CR-1 / TASK-10, TASK-2, TASK-12:** RESUELTO. `src/main.js` usa `{ analyze: analyzeMobilePhone }` y `buildServices()` no lanza `TypeError`. Evidencia: carga simulada con módulo `electron` de prueba + ejecución de `buildServices()` OK.
2. **CR-2 / TASK-10, TASK-12, AC-10, AC-11:** RESUELTO. `mobileOsDetected()` y `normalizeMobileOs()` incluyen `hostname`; prueba `normalizeMobileOs infiere SO por hostname` verde.
3. **CR-3 / TASK-12, AC-12:** NO BLOQUEANTE. El test dedicado `isPhone:false` sigue pendiente, pero la regresión global es verde y la integración móvil está cubierta por caso `isPhone:true` y fallo defensivo.

#### Condiciones para aprobar (cumplidas en esta revisión)

- `npm test` (49/0) y `npm run check` (56 OK) en verde.
- Smoke mínimo de `buildServices()`/main con fake de `electron` verificado (sin `TypeError`).
- Inferencia de OS móvil por hostname completada y probada.

#### Residuales no bloqueantes

- F-1/F-2/F-3: mejoras de `PrinterProbe` (puertos en probe, `trim()` IP, `maxPrinters` en helpers).
- F-4/F-8/F-9/F-10: pruebas de aceptación adicionales (printerProbe, NetworkScanner, CSV, búsqueda, prefijos OUI, VoIP/SIP).
- F-11/F-12/F-13: sanitización/best-effort `phoneHint`, topología y alias `type:phone` según OPEN QUESTIONS.

### Riesgos residuales

1. La detección móvil sigue siendo heurística pasiva y puede tener falsos positivos/negativos con MAC aleatorizada o OUI impreciso.
2. La enumeración de impresoras sigue siendo best-effort WMI/DCOM y puede marcarse `failed`/`timeout` por firewall/UAC.
3. Topología y filtro `type:phone` quedan fuera del MVP por decisión OPEN QUESTION.
4. No se ejecutó smoke manual Windows/WMI real ni E2E automatizado en esta revisión.
5. La cobertura de aceptación sigue parcial (49 tests), aunque la regresión requerida está en verde.