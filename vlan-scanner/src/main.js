'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { CommandRunner } = require('./platform/command-runner');
const { InterfaceService } = require('./network/interface-service');
const { PingProbe } = require('./network/ping-probe');
const { ArpLookup } = require('./network/arp-lookup');
const { PortScanner, HttpBannerProbe, ServiceBannerProbe } = require('./network/tcp-probes');
const { HostnameResolver } = require('./network/hostname-resolver');
const { SmbProbe } = require('./network/smb-probe');
const { PrinterProbe } = require('./network/printer-probe');
const { MobilePhoneClassifier } = require('./identification/mobile-phone-classifier');
const { VendorIdentifier } = require('./identification/vendor-identifier');
const { DeviceClassifier } = require('./identification/device-classifier');
const { OsFingerprintService } = require('./identification/os-detector');
const { HostEnricher } = require('./application/host-enricher');
const { NetworkScanner } = require('./application/network-scanner');
const { ScanManager } = require('./application/scan-manager');
const { createScanPlan } = require('./application/scan-request');
const { ResultExporter } = require('./export/result-exporter');
const { createMainWindow } = require('./main/create-main-window');
const { registerIpcHandlers } = require('./main/register-ipc-handlers');

let mainWindow = null;
let scanManager = null;
let handlersRegistered = false;

function buildServices() {
  const commandRunner = new CommandRunner();
  const interfaceService = new InterfaceService();
  const pingProbe = new PingProbe(commandRunner);
  const arpLookup = new ArpLookup(commandRunner);
  const portScanner = new PortScanner();
  const httpBannerProbe = new HttpBannerProbe();
  const serviceBannerProbe = new ServiceBannerProbe();
  const hostnameResolver = new HostnameResolver();
  const smbProbe = new SmbProbe();
  const printerProbe = new PrinterProbe({ timeout: 8000 });
  const mobilePhoneClassifier = new MobilePhoneClassifier();
  const vendorIdentifier = new VendorIdentifier();
  const deviceClassifier = new DeviceClassifier();
  const osFingerprintService = new OsFingerprintService();
  const hostEnricher = new HostEnricher({
    hostnameResolver,
    arpLookup,
    portScanner,
    httpBannerProbe,
    serviceBannerProbe,
    smbProbe,
    printerProbe,
    mobilePhoneClassifier,
    vendorIdentifier,
    deviceClassifier,
    osFingerprintService
  });
  const scanner = new NetworkScanner({ pingProbe, hostEnricher });
  scanManager = new ScanManager({ scanner, hostnameResolver, createPlan: createScanPlan });
  return {
    interfaceService,
    scanManager,
    resultExporter: new ResultExporter({ dialog, shell })
  };
}

function createWindow() {
  if (mainWindow) return mainWindow;
  mainWindow = createMainWindow(BrowserWindow);
  mainWindow.on('close', () => scanManager?.cancelAll());
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

function registerHandlers() {
  if (handlersRegistered) return;
  const services = buildServices();
  registerIpcHandlers({
    ipcMain,
    shell,
    getWindow: () => mainWindow,
    ...services
  });
  handlersRegistered = true;
}

app.whenReady().then(() => {
  createWindow();
  registerHandlers();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => scanManager?.cancelAll());
