(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createFilterPanelModule() {
  const { createElement, clear } = globalThis.VLANScanner;

  class FilterPanel {
    constructor({ vlanList, typeList, printerList, allButton, onlineStat, vlanStat, badge, onFilter, idsForHost, deviceIcons }) {
      this.vlanList = vlanList;
      this.typeList = typeList;
      this.printerList = printerList || null;
      this.allButton = allButton;
      this.onlineStat = onlineStat;
      this.vlanStat = vlanStat;
      this.badge = badge;
      this.onFilter = onFilter;
      this.idsForHost = idsForHost;
      this.deviceIcons = deviceIcons;
      this.handleClick = (event) => {
        const item = event.target.closest('[data-filter]');
        if (item) this.onFilter(item.dataset.filter);
      };
      this.vlanList.addEventListener('click', this.handleClick);
      this.typeList.addEventListener('click', this.handleClick);
      if (this.printerList) this.printerList.addEventListener('click', this.handleClick);
      this.allButton.addEventListener('click', this.handleClick);
    }

    render(hosts, vlans, activeFilter) {
      clear(this.vlanList);
      clear(this.typeList);
      if (this.printerList) clear(this.printerList);
      const vlanCounts = new Map(vlans.map((vlan) => [vlan.id, 0]));
      for (const host of hosts) {
        for (const id of this.idsForHost(host)) vlanCounts.set(id, (vlanCounts.get(id) || 0) + 1);
      }

      for (const vlan of vlans) {
        const item = this.createItem(`vlan:${vlan.id}`, `VLAN ${vlan.id} — ${vlan.name}`, vlanCounts.get(vlan.id) || 0);
        const dot = createElement('span', 'tree-dot');
        dot.style.backgroundColor = vlan.color;
        item.prepend(dot);
        this.vlanList.append(item);
      }

      const typeCounts = hosts.reduce((counts, host) => {
        const type = host.deviceType || 'unknown';
        counts.set(type, (counts.get(type) || 0) + 1);
        return counts;
      }, new Map());
      for (const [type, count] of [...typeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const item = this.createItem(`type:${type}`, `${this.deviceIcons[type] || '❓'} ${type}`, count);
        this.typeList.append(item);
      }

      if (this.printerList) {
        let sharedHosts = 0;
        let usbHosts = 0;
        for (const host of hosts) {
          const printers = host.printers || [];
          if (printers.some((printer) => printer.shared === true)) sharedHosts += 1;
          if (printers.some((printer) => printer.connectionType === 'USB')) usbHosts += 1;
        }
        this.printerList.append(this.createItem('printers:shared', '🔗 Con impresora compartida', sharedHosts));
        this.printerList.append(this.createItem('printers:usb', '🖨️ Con impresora USB', usbHosts));
      }

      this.onlineStat.textContent = String(hosts.length);
      this.vlanStat.textContent = String(vlans.length);
      this.badge.textContent = String(hosts.length);
      this.setActive(activeFilter);
    }

    createItem(filter, label, count) {
      const item = createElement('div', 'tree-item');
      item.dataset.filter = filter;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.append(createElement('span', '', label));
      item.append(createElement('span', 'tree-badge', String(count)));
      return item;
    }

    setActive(activeFilter) {
      for (const item of document.querySelectorAll('[data-filter]')) {
        item.classList.toggle('active', item.dataset.filter === activeFilter);
      }
    }

    destroy() {
      this.vlanList.removeEventListener('click', this.handleClick);
      this.typeList.removeEventListener('click', this.handleClick);
      if (this.printerList) this.printerList.removeEventListener('click', this.handleClick);
      this.allButton.removeEventListener('click', this.handleClick);
    }
  }

  return { FilterPanel };
});
