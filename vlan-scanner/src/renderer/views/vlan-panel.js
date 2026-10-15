(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createVlanPanelModule() {
  const { createElement, clear } = globalThis.VLANScanner;

  class VlanPanel {
    constructor({ tbody, onRemove, onColor }) {
      this.tbody = tbody;
      this.onRemove = onRemove;
      this.onColor = onColor;
      this.handleClick = (event) => {
        const button = event.target.closest('[data-remove-vlan]');
        if (button) this.onRemove(Number(button.dataset.removeVlan));
      };
      this.handleColor = (event) => {
        const input = event.target.closest('[data-vlan-color]');
        if (input) this.onColor(Number(input.dataset.vlanColor), input.value);
      };
      this.tbody.addEventListener('click', this.handleClick);
      this.tbody.addEventListener('change', this.handleColor);
    }

    render(vlans, hostCounts) {
      clear(this.tbody);
      for (const vlan of vlans) {
        const row = document.createElement('tr');
        row.append(createElement('td', '', String(vlan.id)));
        const name = document.createElement('td');
        const dot = createElement('span', 'vlan-color-dot');
        dot.style.backgroundColor = vlan.color;
        name.append(dot, document.createTextNode(vlan.name));
        const subnet = createElement('td', '', vlan.subnet);
        subnet.style.fontFamily = 'monospace';
        subnet.style.color = 'var(--accent-light)';
        const color = document.createElement('input');
        color.type = 'color';
        color.value = vlan.color;
        color.dataset.vlanColor = String(vlan.id);
        Object.assign(color.style, { width: '30px', height: '22px', padding: '1px', border: 'none', borderRadius: '4px' });
        const actions = document.createElement('td');
        const remove = createElement('button', 'btn btn-icon', '✕');
        remove.type = 'button';
        remove.dataset.removeVlan = String(vlan.id);
        remove.style.fontSize = '11px';
        remove.style.color = 'var(--red)';
        remove.disabled = vlan.id === 1;
        actions.append(remove);
        row.append(name, subnet, createElement('td', '', String(hostCounts.get(vlan.id) || 0)), color, actions);
        this.tbody.append(row);
      }
    }

    destroy() {
      this.tbody.removeEventListener('click', this.handleClick);
      this.tbody.removeEventListener('change', this.handleColor);
    }
  }

  return { VlanPanel };
});
