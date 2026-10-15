(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createVlanModule() {
  const { parseIPv4, toNumber, fromNumber } = globalThis.VLANScanner;

  function createDefaultVlans() {
    return [
      { id: 1, name: 'Default', subnet: '—', color: '#8b949e' },
      { id: 10, name: 'Management', subnet: '192.168.10.0/24', color: '#388bfd' },
      { id: 20, name: 'Servidores', subnet: '10.20.0.0/24', color: '#3fb950' },
      { id: 30, name: 'Usuarios', subnet: '172.16.30.0/24', color: '#bc8cff' },
      { id: 40, name: 'VoIP', subnet: '10.40.0.0/24', color: '#d29922' },
      { id: 50, name: 'DMZ', subnet: '192.168.50.0/24', color: '#f85149' }
    ];
  }

  function parseCidr(value) {
    if (value === '—') return null;
    const [network, prefixText, extra] = String(value || '').trim().split('/');
    if (extra !== undefined) return null;
    const address = parseIPv4(network);
    const prefix = Number(prefixText);
    if (!address || !/^\d{1,2}$/.test(String(prefixText)) || prefix < 0 || prefix > 32) return null;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const networkNumber = (toNumber(network) & mask) >>> 0;
    return { network: fromNumber(networkNumber), prefix, number: networkNumber, mask };
  }

  function normalizeCidr(value) {
    const parsed = parseCidr(value);
    return parsed ? `${parsed.network}/${parsed.prefix}` : null;
  }

  function validateVlan(input, existing = []) {
    const id = Number(input.id);
    if (!Number.isInteger(id) || id < 1 || id > 4094) throw new Error('El ID VLAN debe estar entre 1 y 4094');
    if (existing.some((vlan) => vlan.id === id)) throw new Error('El ID VLAN ya existe');
    const name = String(input.name || '').trim();
    if (!name || name.length > 64) throw new Error('El nombre VLAN debe tener entre 1 y 64 caracteres');
    const subnet = String(input.subnet || '').trim() || '—';
    if (subnet !== '—' && !parseCidr(subnet)) throw new Error('La subred VLAN no es válida');
    const color = String(input.color || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) throw new Error('El color VLAN no es válido');
    return { id, name, subnet: subnet === '—' ? subnet : normalizeCidr(subnet), color };
  }

  class VlanService {
    constructor(initial = createDefaultVlans()) {
      this.vlans = initial.map((vlan) => ({ ...vlan }));
    }

    all() {
      return this.vlans.map((vlan) => ({ ...vlan }));
    }

    add(input) {
      const vlan = validateVlan(input, this.vlans);
      this.vlans.push(vlan);
      return { ...vlan };
    }

    remove(id) {
      if (id === 1) throw new Error('La VLAN Default no se puede eliminar');
      const before = this.vlans.length;
      this.vlans = this.vlans.filter((vlan) => vlan.id !== id);
      if (this.vlans.length === before) throw new Error('La VLAN no existe');
    }

    updateColor(id, color) {
      if (!/^#[0-9a-f]{6}$/i.test(String(color || ''))) throw new Error('Color inválido');
      const vlan = this.vlans.find((candidate) => candidate.id === id);
      if (!vlan) throw new Error('La VLAN no existe');
      vlan.color = String(color).toLowerCase();
    }

    idsForHost(host) {
      const address = parseIPv4(host?.ip || '');
      if (!address) return [1];
      const hostNumber = toNumber(host.ip);
      const matches = this.vlans.filter((vlan) => {
        const cidr = parseCidr(vlan.subnet);
        return cidr && (hostNumber & cidr.mask) >>> 0 === cidr.number;
      }).map((vlan) => vlan.id);
      return matches.length ? matches : [1];
    }

    countHosts(hosts) {
      const counts = new Map(this.vlans.map((vlan) => [vlan.id, 0]));
      for (const host of hosts) {
        for (const id of this.idsForHost(host)) counts.set(id, (counts.get(id) || 0) + 1);
      }
      return counts;
    }
  }

  return { createDefaultVlans, parseCidr, normalizeCidr, validateVlan, VlanService };
});
