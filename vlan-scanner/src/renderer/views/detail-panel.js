(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createDetailPanelModule() {
  const { createElement, clear } = globalThis.VLANScanner;
  const { DEVICE_ICONS, PORT_NAMES, vendorColor, getVoipVendor, buildWebUrls } = globalThis.VLANScanner;

  class DetailPanel {
    constructor({ content, empty, idsForHost, onOpenExternal, onCopy }) {
      this.content = content;
      this.empty = empty;
      this.idsForHost = idsForHost;
      this.onOpenExternal = onOpenExternal;
      this.onCopy = onCopy;
      this.handleAction = async (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        if (button.dataset.action === 'open') await this.onOpenExternal(button.dataset.url);
        if (button.dataset.action === 'copy') await this.onCopy(button.dataset.value);
      };
      this.content.addEventListener('click', this.handleAction);
    }

    render(host, vlans) {
      clear(this.content);
      this.content.style.display = host ? 'block' : 'none';
      this.empty.style.display = host ? 'none' : 'flex';
      if (!host) return;

      this.content.append(
        createElement('div', 'detail-icon', DEVICE_ICONS[host.deviceType] || DEVICE_ICONS.default),
        createElement('div', 'detail-name', host.hostname || host.ip),
        createElement('div', 'detail-ip', host.ip)
      );

      const vlanInfo = createElement('div', '', '');
      vlanInfo.style.textAlign = 'center';
      vlanInfo.style.marginBottom = '8px';
      for (const id of this.idsForHost(host)) {
        const vlan = vlans.find((candidate) => candidate.id === id);
        if (!vlan) continue;
        const badge = createElement('span', '', `VLAN ${vlan.id}: ${vlan.name}`);
        Object.assign(badge.style, {
          backgroundColor: `${vlan.color}20`, color: vlan.color, border: `1px solid ${vlan.color}40`,
          borderRadius: '4px', padding: '1px 6px', fontSize: '10px', margin: '1px'
        });
        vlanInfo.append(badge);
      }
      this.content.append(vlanInfo, createElement('div', 'detail-section', 'Red'));
      this.appendRow('IP', host.ip);
      this.appendRow('SO', host.os || 'Detectando...');
      this.appendRow('MAC', host.mac || '\u2014');
      this.appendRow('Hostname', host.hostname || '\u2014');
      const vendor = this.appendRow('Fabricante', host.vendor || 'Desconocido');
      vendor.style.color = vendorColor(host.vendor);
      this.appendRow('Tipo', host.deviceType || '\u2014');
      this.appendRow('Latencia', host.latencyMs == null ? '\u2014' : `${host.latencyMs}ms`);

      this.content.append(createElement('div', 'detail-section', 'Puertos abiertos'));
      const ports = createElement('div', '', '');
      ports.style.marginBottom = '8px';
      if ((host.openPorts || []).length) {
        for (const port of host.openPorts) ports.append(createElement('span', 'port-badge', `${port} ${PORT_NAMES[port] || ''}`));
      } else {
        const emptyText = createElement('span', '', 'Ninguno detectado');
        emptyText.style.fontSize = '11px';
        ports.append(emptyText);
      }
      this.content.append(ports);

      if (host.deviceType === 'smartphone') {
         this.content.append(createElement('div', 'detail-section', 'Tel\u00e9fono m\u00f3vil'));
         this.appendRow('SO m\u00f3vil', host.phoneOS || 'Mobile OS (unknown)');
         this.appendRow('Fabricante/modelo (estimado)', host.phoneHint || 'No estimado');
         this.appendRow('Confianza', host.phoneConfidence || '\u2014');
         this.appendRow('Evidencias', (host.phoneEvidence || []).join(', ') || '\u2014');
       }

       this.content.append(createElement('div', 'detail-section', 'Impresoras (remoto)'));
      const probeStatus = host.printerProbe?.status || 'skipped';
      const allPrinters = host.printers || [];
      const sharedPrinters = allPrinters.filter((p) => p.shared === true);
      const usbCount = allPrinters.filter((p) => p.connectionType === 'USB').length;
      let printerSummary = '';
      if (probeStatus === 'success') {
        printerSummary = `Detectadas: ${allPrinters.length} (USB: ${usbCount}, compartidas: ${sharedPrinters.length})`;
      } else if (probeStatus === 'unsupported') {
        printerSummary = 'No aplicable (SO no Windows o host no Windows)';
      } else if (probeStatus === 'skipped') {
        printerSummary = 'Omitido';
      } else {
        const msg = host.printerProbe?.error?.message || host.printerProbe?.error?.code || probeStatus;
        printerSummary = `No disponible: ${msg}`;
      }
      this.content.append(createElement('div', '', printerSummary));

      if (sharedPrinters.length > 0) {
        const sharedBox = createElement('div', 'shared-box');
        const sharedTitle = createElement('div', '', `\ud83d\udd17 ${sharedPrinters.length} impresora(s) compartida(s)`);
        sharedTitle.style.fontWeight = '600';
        sharedBox.append(sharedTitle);
        for (const printer of sharedPrinters) {
          const line = createElement('div', '', `${printer.name} \u2014 ${printer.connectionType}${printer.port ? ` (${printer.port})` : ''}`);
          line.style.fontSize = '11px';
          sharedBox.append(line);
          if (printer.shareName) {
            const share = createElement('div', '', `recurso compartido: \\\\${printer.shareName}`);
            share.style.fontSize = '10px';
            share.style.fontFamily = 'monospace';
            share.style.color = 'var(--text3)';
            sharedBox.append(share);
          }
        }
        this.content.append(sharedBox);
      }

      if (probeStatus === 'success') {
        if (allPrinters.length === 0) {
          const emptyPrinters = createElement('span', '', 'Sin impresoras reportadas');
          emptyPrinters.style.fontSize = '11px';
          this.content.append(emptyPrinters);
        } else {
          for (const printer of allPrinters) {
            const isShared = printer.shared === true;
            const line = createElement('div', '', `${isShared ? '\ud83d\udd17' : '\ud83d\udda8\ufe0f'} ${printer.name} \u2014 ${printer.connectionType}${printer.port ? ` (${printer.port})` : ''}`);
            line.style.fontSize = '11px';
            if (isShared) {
              line.style.color = 'var(--amber)';
              const badge = createElement('span', 'shared-badge', 'COMPARTIDA');
              badge.style.marginLeft = '4px';
              line.append(badge);
            }
            this.content.append(line);
          }
        }
      }

      this.content.append(createElement('div', 'detail-section', 'Acciones rápidas'));
      this.appendActions(host);
    }

    appendRow(key, value) {
      const row = createElement('div', 'detail-row');
      row.append(createElement('span', 'detail-key', key));
      const result = createElement('span', 'detail-val', value);
      row.append(result);
      this.content.append(row);
      return result;
    }

    appendActions(host) {
      const urls = buildWebUrls(host);
      if (urls.length === 1) this.appendOpenButton(urls[0], '\ud83c\udf10 Abrir interfaz web');
      else {
        const label = createElement('div', '', 'Interfaces web detectadas:');
        label.style.fontSize = '10px';
        label.style.color = 'var(--text3)';
        label.style.marginBottom = '4px';
        this.content.append(label);
        for (const url of urls) this.appendOpenButton(url, `${url.startsWith('https') ? '\ud83d\udd12' : '\ud83c\udf10'} ${url}`);
      }

      const voip = host.deviceType === 'voip' ? getVoipVendor(host.vendor) : null;
      if (voip) {
        this.appendInfoBox('\ud83d\udd11 Credenciales por defecto', voIPCredentialsPlaceholder(voip), 'Cámbielas si aún son las originales', 'var(--amber)');
        this.appendInfoBox('\ud83d\udca1 Si el navegador no abre', 'Acepta el certificado SSL si aparece advertencia. Prueba con HTTP y verifica que estés en la misma VLAN que el teléfono.', '', 'var(--text2)');
      }

      if (host.deviceType === 'smartphone') {
         this.appendInfoBox('\ud83d\udcca Identificaci\u00f3n pasiva', 'Modelo estimado, no garantizado. MAC aleatorizada puede reducir precisi\u00f3n.', '', 'var(--text2)');
       }

       this.appendActionButton('copy', host.ip, '\ud83d\udccb Copiar IP');
      if ((host.openPorts || []).includes(3389)) this.appendActionButton('open', `ms-rd:v=${host.ip}`, '\ud83d\udd27 Conectar RDP', 'var(--purple)');
      if ((host.openPorts || []).includes(22)) this.appendActionButton('copy', `ssh ${host.ip}`, '\ud83d\udfe2 Copiar comando SSH', 'var(--green)');
    }

    appendOpenButton(url, label) {
      this.appendActionButton('open', url, label, url.startsWith('https') ? 'var(--green)' : '');
    }

    appendActionButton(action, value, label, color = '') {
      const button = createElement('button', 'btn ping-btn', label);
      button.type = 'button';
      button.dataset.action = action;
      button.dataset.value = value;
      if (action === 'open') button.dataset.url = value;
      button.style.marginTop = '6px';
      button.style.color = color;
      this.content.append(button);
    }

    appendInfoBox(title, text, footer, valueColor) {
      const box = createElement('div', '', '');
      Object.assign(box.style, {
        marginTop: '8px', background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: '6px', padding: '8px 10px'
      });
      const heading = createElement('div', '', title);
      heading.style.fontSize = '10px';
      heading.style.color = 'var(--text3)';
      heading.style.marginBottom = '4px';
      const body = createElement('div', '', text);
      body.style.fontSize = '11px';
      body.style.fontFamily = 'monospace';
      body.style.color = valueColor || 'var(--text2)';
      body.style.whiteSpace = 'pre-wrap';
      box.append(heading, body);
      if (footer) {
        const note = createElement('div', '', footer);
        note.style.fontSize = '10px';
        note.style.color = 'var(--text3)';
        note.style.marginTop = '3px';
        box.append(note);
      }
      this.content.append(box);
    }

    destroy() {
      this.content.removeEventListener('click', this.handleAction);
    }
  }

  function voIPCredentialsPlaceholder(voip) {
    return voip.credentials;
  }

  return { DetailPanel };
});
