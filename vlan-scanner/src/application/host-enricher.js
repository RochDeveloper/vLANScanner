'use strict';

const { throwIfAborted } = require('../domain/cancellation');
const { ttlToOsHint } = require('../identification/os-detector');

function selectWebPort(openPorts) {
  return [80, 8080, 8000, 443].find((port) => openPorts.includes(port)) || null;
}

function probeWindowsLikeHost({ os, openPorts }) {
  const osText = String(os || '').toLowerCase();
  if (osText.includes('windows')) return true;
  const ports = Array.isArray(openPorts) ? openPorts : [];
  return [135, 139, 445, 5985].some((port) => ports.includes(port));
}

class HostEnricher {
  constructor({
    hostnameResolver,
    arpLookup,
    portScanner,
    httpBannerProbe,
    serviceBannerProbe,
    smbProbe,
    vendorIdentifier,
    deviceClassifier,
    osFingerprintService,
    printerProbe = null,
    mobilePhoneClassifier = null
  }) {
    this.hostnameResolver = hostnameResolver;
    this.arpLookup = arpLookup;
    this.portScanner = portScanner;
    this.httpBannerProbe = httpBannerProbe;
    this.serviceBannerProbe = serviceBannerProbe;
    this.smbProbe = smbProbe;
    this.vendorIdentifier = vendorIdentifier;
    this.deviceClassifier = deviceClassifier;
    this.osFingerprintService = osFingerprintService;
    this.printerProbe = printerProbe;
    this.mobilePhoneClassifier = mobilePhoneClassifier;
  }

  async enrich(pingResult, { resolveHostnames, scanPorts, probePrinters = true, signal, onPhase = () => {} } = {}) {
    const { ip, latencyMs, ttl } = pingResult;
    throwIfAborted(signal);
    onPhase('resolviendo');

    let [hostname, mac] = await Promise.all([
      resolveHostnames ? this.hostnameResolver.resolve(ip, { signal }) : Promise.resolve(''),
      this.arpLookup.lookup(ip, { signal })
    ]);
    throwIfAborted(signal);

    const vendor = this.vendorIdentifier.identify(mac);
    let openPorts = [];
    let banner = '';

    if (scanPorts) {
      onPhase('puertos');
      openPorts = await this.portScanner.scan(ip, undefined, { signal });
      throwIfAborted(signal);

      const webPort = selectWebPort(openPorts);
      if (webPort) {
        onPhase('identificando');
        banner = await this.httpBannerProbe.grab(ip, webPort, { signal });
      }
    }

    onPhase('detectando SO');
    const hasSip = [5060, 5061, 5080].some((port) => openPorts.includes(port));
    const sipPort = [5060, 5061, 5080].find((port) => openPorts.includes(port)) || 5060;
    const [sshBanner, smbResult, sipResult] = await Promise.all([
      openPorts.includes(22) ? this.serviceBannerProbe.grabSsh(ip, { signal }) : Promise.resolve(''),
      openPorts.includes(445) && resolveHostnames ? this.smbProbe.inspect(ip, { signal }) : Promise.resolve({ output: '', hostname: '' }),
      hasSip ? this.serviceBannerProbe.probeSip(ip, sipPort, { signal }) : Promise.resolve({ isSip: false, banner: '' })
    ]);
    throwIfAborted(signal);

    if (resolveHostnames && !hostname && smbResult.hostname) hostname = smbResult.hostname;
    if (sipResult.isSip) banner += ' sip-confirmed';

    const preliminaryDeviceType = this.deviceClassifier.classify({
      ports: openPorts,
      hostname,
      vendor,
      banner,
      sipConfirmed: sipResult.isSip
    });
    const os = this.osFingerprintService.detect({
      ttl,
      osHint: ttlToOsHint(ttl),
      sshBanner,
      httpBanner: banner,
      smbInfo: smbResult.output,
      ports: openPorts,
      vendor,
      deviceType: preliminaryDeviceType
    });

    let phoneAnalysis = {
      isPhone: false,
      deviceType: null,
      phoneOS: null,
      phoneHint: null,
      phoneConfidence: null,
      phoneEvidence: [],
      phoneFormFactor: null,
      conflicts: []
    };
    let phoneErrorEvidence = [];
    if (this.mobilePhoneClassifier) {
      try {
        phoneAnalysis = this.mobilePhoneClassifier.analyze({
          hostname,
          vendor,
          os,
          openPorts,
          banner,
          ttl,
          sipConfirmed: sipResult.isSip,
          mdnsServices: []
        });
      } catch (error) {
        phoneAnalysis = {
          isPhone: false,
          deviceType: null,
          phoneOS: null,
          phoneHint: null,
          phoneConfidence: null,
          phoneEvidence: ['classifier-error'],
          phoneFormFactor: null,
          conflicts: []
        };
        phoneErrorEvidence = ['classifier-error'];
      }
    }

    const isPhone = phoneAnalysis && phoneAnalysis.isPhone === true;
    const deviceType = isPhone
      ? 'smartphone'
      : this.deviceClassifier.classify({
          ports: openPorts,
          hostname,
          vendor,
          banner,
          sipConfirmed: sipResult.isSip,
          os
        });

    // Impresoras (remoto, solo lectura).
    let printers = [];
    let printerProbeStatus = probePrinters ? 'skipped' : 'skipped';
    let printerProbeElapsedMs = 0;
    let printerProbeError = null;
    if (probePrinters && this.printerProbe) {
      const windowsLike = probeWindowsLikeHost({ os, openPorts });
      try {
        if (!windowsLike) {
          printerProbeStatus = 'unsupported';
        } else {
          onPhase('impresoras');
          const result = await this.printerProbe.probe(ip, { signal, osHint: os });
          printers = Array.isArray(result.printers) ? result.printers : [];
          printerProbeStatus = result.status;
          printerProbeElapsedMs = result.elapsedMs;
          printerProbeError = result.error || null;
        }
      } catch (error) {
        printers = [];
        printerProbeStatus = 'failed';
        printerProbeElapsedMs = 0;
        printerProbeError = { code: 'UNHANDLED', message: String(error && error.message || error).slice(0, 240) };
      }
    }
    throwIfAborted(signal);

    const phoneFields = isPhone ? {
      phoneOS: phoneAnalysis.phoneOS ?? null,
      phoneHint: phoneAnalysis.phoneHint ?? null,
      phoneConfidence: phoneAnalysis.phoneConfidence ?? null,
      phoneEvidence: Array.isArray(phoneAnalysis.phoneEvidence) ? phoneAnalysis.phoneEvidence : [],
      phoneFormFactor: phoneAnalysis.phoneFormFactor ?? null
    } : {
      phoneOS: null,
      phoneHint: null,
      phoneConfidence: null,
      phoneEvidence: phoneErrorEvidence,
      phoneFormFactor: null
    };

    return {
      ip,
      hostname: hostname || '',
      mac,
      vendor,
      openPorts,
      deviceType,
      os,
      latencyMs,
      status: 'online',
      printers,
      printerProbe: {
        status: printerProbeStatus,
        elapsedMs: printerProbeElapsedMs,
        error: printerProbeError
      },
      usbPrinterCount: printers.filter((p) => p.connectionType === 'USB').length,
      ...phoneFields
    };
  }
}

module.exports = { HostEnricher, selectWebPort, probeWindowsLikeHost };
