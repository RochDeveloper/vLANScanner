(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createHostTableModule() {
  const { createElement, clear } = globalThis.VLANScanner;
  const { selectVisibleHosts } = globalThis.VLANScanner;
  const { DEVICE_ICONS, PORT_NAMES, presentOs, vendorColor } = globalThis.VLANScanner;

  class HostTable {
    constructor({ table, tbody, emptyState, headings, onSelect, onSort, idsForHost }) {
      this.table = table;
      this.tbody = tbody;
      this.emptyState = emptyState;
      this.emptyText = this.emptyState.querySelector('.es-text');
      this.defaultEmptyText = this.emptyText.textContent;
      this.headings = [...headings];
      this.onSelect = onSelect;
      this.onSort = onSort;
      this.idsForHost = idsForHost;
      this.handleRowClick = (event) => {
        const row = event.target.closest('tr[data-ip]');
        if (row) this.onSelect(row.dataset.ip);
      };
      this.handleSort = (event) => {
        const heading = event.target.closest('[data-sort]');
        if (heading) this.onSort(heading.dataset.sort);
      };
      this.tbody.addEventListener('click', this.handleRowClick);
      this.headings.forEach((heading) => heading.addEventListener('click', this.handleSort));
    }

    render(hosts, vlans, ui, hasScanned) {
      const visibleHosts = selectVisibleHosts(hosts, ui, this.idsForHost);
      clear(this.tbody);
      const hasVisibleHosts = visibleHosts.length > 0;
      this.table.style.display = hasVisibleHosts ? '' : 'none';
      this.emptyState.style.display = hasVisibleHosts ? 'none' : 'flex';
      this.emptyText.textContent = hasScanned
        ? (hosts.length ? 'No hay hosts que coincidan con el filtro' : 'No se encontraron equipos en el rango')
        : this.defaultEmptyText;

      const fragment = document.createDocumentFragment();
      for (const host of visibleHosts) fragment.append(this.renderRow(host, vlans, ui.selectedIp));
      this.tbody.append(fragment);
      this.updateSortIndicators(ui.sort);
    }

    renderRow(host, vlans, selectedIp) {
      const row = document.createElement('tr');
      row.dataset.ip = host.ip;
      row.classList.toggle('selected', selectedIp === host.ip);

      const statusCell = document.createElement('td');
      const dot = createElement('span', 'status-dot online');
      statusCell.append(dot);
      for (const id of this.idsForHost(host)) {
        const vlan = vlans.find((candidate) => candidate.id === id);
        if (!vlan) continue;
        const vlanDot = createElement('span');
        Object.assign(vlanDot.style, {
          display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: vlan.color, marginRight: '3px'
        });
        vlanDot.title = `VLAN ${vlan.id}: ${vlan.name}`;
        statusCell.append(vlanDot);
      }

      const ipCell = createElement('td', 'td-ip', host.ip);
      const hostnameCell = createElement('td', '', host.hostname || '\u2014');
      const macCell = createElement('td', 'td-mac', host.mac || '\u2014');
      const vendorCell = document.createElement('td');
      if (host.vendor) {
        const badge = createElement('span', 'vendor-badge', host.vendor);
        const color = vendorColor(host.vendor);
        badge.style.color = color;
        badge.style.backgroundColor = `${color}18`;
        vendorCell.append(badge);
      }
      const typeCell = createElement('td', '', `${DEVICE_ICONS[host.deviceType] || DEVICE_ICONS.default} ${host.deviceType || '\u2014'}`);
       if (host.deviceType === 'smartphone') {
         typeCell.title = [host.phoneHint, host.phoneOS, host.phoneConfidence ? `confianza ${host.phoneConfidence}` : null]
           .filter(Boolean).join(' \u2014 ');
       }
      const portsCell = document.createElement('td');
      const ports = (host.openPorts || []).slice(0, 6);
      if (ports.length) {
        for (const port of ports) portsCell.append(this.renderPort(port));
      } else {
        portsCell.append(createElement('span', '', 'ninguno'));
        portsCell.style.color = 'var(--text3)';
      }
      const osCell = document.createElement('td');
      const os = presentOs(host.os);
      const osLabel = createElement('span', '', `${os.icon} ${os.label}`);
      osLabel.style.color = os.color;
      osCell.append(osLabel);
      const printerCell = document.createElement('td');
      if (host.usbPrinterCount > 0) {
        printerCell.textContent = `\ud83d\udda8\ufe0f ${host.usbPrinterCount}`;
        printerCell.style.color = 'var(--green)';
        printerCell.title = (host.printers || []).filter((p) => p.connectionType === 'USB').map((p) => p.name).join(', ');
      } else {
        printerCell.textContent = '\u2014';
        printerCell.style.color = 'var(--text3)';
      }
      const sharedCell = document.createElement('td');
      const sharedPrinters = (host.printers || []).filter((p) => p.shared === true);
      if (sharedPrinters.length > 0) {
        const badge = createElement('span', 'shared-badge', `\ud83d\udd17 ${sharedPrinters.length}`);
        sharedCell.append(badge);
        sharedCell.title = sharedPrinters
          .map((p) => `${p.name}${p.shareName ? ` (${p.shareName})` : ''}`)
          .join(', ');
      } else {
        sharedCell.textContent = '\u2014';
        sharedCell.style.color = 'var(--text3)';
      }
      const latencyCell = createElement('td', '', host.latencyMs === null || host.latencyMs === undefined ? '\u2014' : `${host.latencyMs}ms`);
      latencyCell.style.color = 'var(--green)';

      row.append(statusCell, ipCell, hostnameCell, macCell, vendorCell, typeCell, portsCell, osCell, printerCell, sharedCell, latencyCell);
      return row;
    }

    renderPort(port) {
      const badge = createElement('span', `port-badge ${this.portClass(port)}`, PORT_NAMES[port] || String(port));
      return badge;
    }

    portClass(port) {
      if (port === 22) return 'ssh';
      if (port === 3389) return 'rdp';
      if (port === 80 || port === 443) return 'http';
      if (port === 445 || port === 139) return 'smb';
      return '';
    }

    updateSortIndicators(sort) {
      for (const heading of this.headings) {
        const active = heading.dataset.sort === sort.key;
        heading.classList.toggle('sorted-asc', active && sort.ascending);
        heading.classList.toggle('sorted-desc', active && !sort.ascending);
        if (heading.dataset.sort) heading.setAttribute('aria-sort', active ? (sort.ascending ? 'ascending' : 'descending') : 'none');
      }
    }

    destroy() {
      this.tbody.removeEventListener('click', this.handleRowClick);
      this.headings.forEach((heading) => heading.removeEventListener('click', this.handleSort));
    }
  }

  return { HostTable };
});
