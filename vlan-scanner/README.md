# VLAN Network Scanner — Guía de instalación

## Requisitos
- **Node.js 18+** → https://nodejs.org
- **Windows 10/11** (la app requiere permisos de administrador para ARP/ICMP)

---

## Instalación y ejecución (modo desarrollo)

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar la app (modo desarrollo)
npm start
```

> **IMPORTANTE:** Ejecuta la terminal como **Administrador** para que el escáner
> tenga acceso a ICMP (ping) y ARP. Sin esto, no se detectarán los MACs ni fabricantes.

---

## Compilar instalador para Windows

```bash
# Instalar electron-builder si no está
npm install -g electron-builder

# Generar instalador .exe + versión portable
npm run build
```

Los archivos compilados quedan en la carpeta `dist/`:
- `VLAN Network Scanner Setup x.x.x.exe` — instalador NSIS
- `VLAN Network Scanner x.x.x.exe` — versión portable (sin instalación)

---

## Funcionalidades

### Escaneo de red
- **Ping sweep** — detecta hosts activos en el rango IP definido
- **Resolución de hostname** — via nslookup/DNS inverso
- **Detección de MAC** — via tabla ARP de Windows
- **Identificación de fabricante** — base de datos OUI integrada (Cisco, HP, Dell, Ubiquiti, TP-Link, etc.)
- **Escaneo de puertos** — SSH, HTTP, HTTPS, RDP, SMB, FTP, Telnet, VNC, etc.
- **Clasificación automática** — router, switch, server, workstation, VM, VoIP, cámara

### VLANs
- Configuración manual de VLANs con ID, nombre, subred y color
- Detección automática de VLANs por coincidencia de subred IP
- Filtrado visual por VLAN en la tabla y topología

### Topología
- Vista gráfica interactiva de la red descubierta
- Agrupación visual por VLAN
- Arrastrar nodos para reorganizar
- Zoom con rueda del ratón

### Exportación
- **CSV** — compatible con Excel, LibreOffice
- **JSON** — compatible con el VLAN Mapper web u otras herramientas

---

## Dependencias clave

| Paquete | Uso |
|---------|-----|
| `electron` | Framework de app de escritorio |
| `ping` | Ping sweep multiplataforma |
| `node-arp` | Lectura de tabla ARP |
| `electron-builder` | Compilación a .exe instalable |

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| No detecta MACs | Ejecuta como Administrador |
| El ping no funciona | Verifica que el firewall de Windows permita ICMP |
| App no abre | Verifica Node.js >= 18 con `node --version` |
| Error de módulo faltante | Ejecuta `npm install` nuevamente |
