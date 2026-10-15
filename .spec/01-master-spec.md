# 01 - Master Spec (Coordinador)

> Especificación maestra del requerimiento: detectar impresoras conectadas únicamente por USB durante el escaneo de red.
> Versión: 1.0
> Fecha: 2026-10-14
> Estado: Borrador (pendiente de aprobación del usuario)
> Aprobada por usuario: Sí (2026-10-14)

---

## 1. Problema y motivación

Actualmente el escáner de red (`vlan-scanner`) identifica **impresoras de red** (OUI de fabricantes, puerto 9100, banners, hostname). No detecta **impresoras instaladas localmente en un equipo (p. ej. conectadas solo por USB)** aunque ese equipo esté vivo y sea descubierto. El usuario requiere que el escaneo también informe estas impresoras asociadas a cada computadora.

## 2. Alcance

### Dentro del alcance (In scope)
- Durante el enriquecimiento de cada host vivo, intentar descubrir las impresoras instaladas en ese equipo (incluidas las conectadas únicamente por USB).
- Mostrar por host las impresoras encontradas con: nombre, tipo de conexión (USB/Red/Local/Otro), puerto/interfaz si está disponible, y modelo/fabricante si es discernible.
- Clasificar visualmente en la tabla/topología que un equipo tiene impresora USB asociada.
- No bloquear ni abortar el escaneo completo si la enumeración falla en un host.
- Registrar trazabilidad (REQ/TASK) y resultados en los archivos `.spec/`.

### Fuera del alcance (Out of scope)
- Instalar controladores o configurar impresoras.
- Escanear redes fuera del rango indicado.
- Acceso administrativo remoto con credenciales de terceros.
- Soporte multiplataforma garantizado inicialmente solo para hosts Windows (ver Open Questions).

## 3. Épicas

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| EPIC-1 | Descubrimiento de impresoras USB por host | Añadir fase de detección de impresoras instaladas localmente a cada host vivo. | Alta |
| EPIC-2 | Presentación en UI | Mostrar las impresoras USB encontradas por host y en exportación. | Media |

## 4. Requerimientos funcionales

| ID | Épica | Requerimiento | Criterio global |
|---|---|---|---|
| REQ-1 | EPIC-1 | Para cada host vivo, intentar enumerar las impresoras instaladas en el sistema operativo del equipo, incluyendo las conectadas solo por USB. | Se reportan resultados por host sin romper el escaneo. |
| REQ-2 | EPIC-1 | Capturar al menos nombre de impresora y tipo de conexión (USB/Red/Local/Desconocido). | Campos visibles en detalle/export. |
| REQ-3 | EPIC-1 | Distinguir impresoras descubiertas por red (ya existentes) de las instaladas localmente USB. | Sin duplicados engañosos. |
| REQ-4 | EPIC-1 | Timeout y manejo de errores por host (host caído, firewall, acceso denegado). | Escaneo sigue completo; fallos registrados. |
| REQ-5 | EPIC-2 | Mostrar en la tabla de hosts y en el detalle un indicador/contador de impresoras USB asociadas. | UI coherente con estilo existente. |
| REQ-6 | EPIC-2 | Exportar impresoras por host en CSV/JSON (ampliando exportador actual). | Formato estable y documentado. |
| REQ-7 | EPIC-1 | Respetar privacidad/seguridad: solo comandos de lectura, sin credenciales en claro ni persistencia de datos sensibles. | Sin secretos en logs/archivos. |

## 5. Restricciones y no-funcionales

- Ejecución privilegiada ya existente (`requestedExecutionLevel: requireAdministrator`), lo que puede facilitar enumeración local.
- El sondeo remoto debe usar timeouts cortos para no bloquear el escaneo.
- No degradar rendimiento: enumeración paralela con el límite de concurrencia ya usado (lotes de 24 hosts).
- Compatibilidad con hosts Windows inicialmente; otros SO se marcan como "no soportado".

## 6. Open Questions (para el usuario)

1. **Mecanismo preferido** para enumerar impresoras remotas:
   a) Comandos Windows (`net view \\host`, `wmic printer`, `powershell Get-Printer`) cuando el host comparte.
   b) Solo hosts Windows accesibles sin autenticación adicional.
   c) Requerir credenciales de dominio por el usuario (mayor cobertura, mayor complejidad/riesgo).
2. **Impresoras USB no compartidas**: ¿se acepta no detectarlas (limitación técnica) o se requiere un agente/servicio local en cada PC?
3. **Granularidad en UI**: ¿lista de impresoras dentro del panel de detalle de host o nueva columna "Impresoras USB"?
4. **Plataformas objetivo**: ¿solo Windows o también Linux/macOS (CUPS) en la red?

## 7. Métricas de éxito

- % de hosts Windows analizados con resultado de enumeración (éxito/fallo/timeout) registrado.
- Número de impresoras USB detectadas reportadas por escaneo.
- Tiempo adicional por host dentro de límite acordado (por definir en Planificador).
- Sin regresiones en `npm test` / `npm run check`.

## 8. Dependencias y riesgos

- **Riesgo alto**: enumeración remota de impresoras puede requerir privilegios/credenciales y estar bloqueada por firewall; cobertura limitada.
- **Riesgo medio**: falsos positivos/duplicados entre impresoras de red y USB.
- **Riesgo bajo**: impacto en rendimiento si no se acota timeout.

---

> Siguiente paso (si aprobado): invocar a `planificador` para generar `.spec/02-task-breakdown.md`.

---

# Requerimiento adicional 2: Detección de teléfonos celulares en la red escaneada

> Añadido: 2026-10-14. Versión maestra 1.1 (pendiente de aprobación).

## P1. Problema y motivación

El escáner ya identifica PCs, impresoras, cámaras y VoIP por OUI/puertos/banners, pero no **clasifica de forma específica teléfonos celulares (smartphones)** conectados por WiFi, ni muestra sus características (SO móvil, fabricante, modelo estimado, etc.). El usuario requiere identificar teléfonos en la red y mostrar sus características principales.

## P2. Alcance

### Dentro del alcance
- Clasificar hosts como `smartphone` (o `phone`) cuando haya evidencia suficiente.
- Mostrar características: tipo de dispositivo, SO móvil estimado (iOS/Android u otro), fabricante/modelo estimado, hostname, MAC, IP, puertos abiertos, latencia.
- No bloquear el escaneo ni degradar rendimiento.
- Integrar con tabla/detalle/topología/exportación existentes.
- Filtro/búsqueda por nombre de fabricante/modelo/hostname.

### Fuera del alcance
- Leer batería, ubicación o datos del usuario.
- Romper cifrado, autenticación o capturar tráfico.
- Identificación exacta de modelo garantizada (es best-effort).

## P3. Épicas

| ID | Nombre | Descripción | Prioridad |
|---|---|---|---|
| EPIC-3 | Detección de teléfonos móviles | Identificar smartphones en el rango escaneado. | Alta |
| EPIC-4 | Características del teléfono | Mostrar atributos móviles en UI/exportación. | Media |

## P4. Requerimientos funcionales

| ID | Épica | Requerimiento | Criterio global |
|---|---|---|---|
| REQ-8 | EPIC-3 | Clasificar un host como teléfono móvil (`smartphone`) cuando haya evidencia (OUI, hostname, puertos, mDNS/SIP si aplica). | Clasificación visible en tabla/topología. |
| REQ-9 | EPIC-3 | Mostrar SO móvil estimado (`iOS`, `Android`, `Mobile OS (unknown)`) y fabricante/modelo estimado si es posible. | Campos en detalle/export/API. |
| REQ-10 | EPIC-3 | Evitar falsos positivos: no clasificar PCs/tablets/IoT como teléfono sin evidencia suficiente. | Reglas ordenadas y prioridad. |
| REQ-11 | EPIC-3 | Manejar MAC aleatorizada: si vendor es `private`/desconocido, no afirmar fabricante; marcar evidencia baja. | Estado de confianza. |
| REQ-12 | EPIC-4 | Integrar atributos en tabla (icono/badge), detalle, búsqueda y exportación (CSV/JSON). | UI coherente. |
| REQ-13 | EPIC-3 | Sin impacto en rendimiento ni bloqueos. | Timeouts y no degradación. |
| REQ-14 | EPIC-3 | Respetar privacidad/seguridad. | Sin datos sensibles ni credenciales. |

## P5. Restricciones y no-funcionales

- Identificación best-effort basada en señales pasivas (OUI, hostname, puertos, mDNS, SIP).
- MAC aleatorizada reduce precisión; mostrar nivel de confianza (`high/medium/low`).
- No añadir nuevas dependencias obligatorias salvo aprobación.

## P6. Open Questions

1. ¿Considerar tablets como teléfonos (`smartphone`) o categoría separada (`tablet`)?
2. ¿Incorporar descubrimiento mDNS (`_hap._tcp`, `_androidtvremote._tcp`, etc.) activo/pasivo o solo heurísticas OUI/hostname?
3. ¿Qué nivel de detalle mínimo de "características" se espera (solo SO/fabricante vs. servicios/puertos/latencia)?
4. ¿Se requiere un badge visual en topología para smartphones?
5. ¿Debe el filtro por tipo existente incluir `type:phone`?

## P7. Métricas de éxito

- % de hosts móviles correctamente clasificados en entorno de prueba.
- Tasa de falsos positivos < umbral a definir.
- Sin regresiones (`npm test`, `npm run check`).

---

> Siguiente paso (si aprobado): invocar a `planificador`.
