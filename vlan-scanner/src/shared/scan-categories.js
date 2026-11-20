(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createScanCategoryModule() {
  /**
   * Categorías disponibles para limitar un escaneo a un solo tipo de equipo.
   * `deviceTypes` son los valores que produce DeviceClassifier.
   */
  const SCAN_CATEGORIES = Object.freeze([
    {
      id: 'all',
      label: 'Todas las categorías',
      shortLabel: 'todas las categorías',
      icon: '🔎',
      aliases: ['todas', 'todos', 'any'],
      deviceTypes: []
    },
    {
      id: 'printer',
      label: 'Impresoras',
      shortLabel: 'impresoras',
      icon: '🖨️',
      aliases: ['printers', 'impresora', 'impresoras'],
      deviceTypes: ['printer']
    },
    {
      id: 'workstation',
      label: 'Workstations / PCs',
      shortLabel: 'workstations',
      icon: '💻',
      aliases: ['workstations', 'pc', 'pcs', 'equipos', 'estaciones'],
      deviceTypes: ['workstation']
    },
    {
      id: 'server',
      label: 'Servidores',
      shortLabel: 'servidores',
      icon: '🖥️',
      aliases: ['servers', 'servidor', 'servidores'],
      deviceTypes: ['server', 'windows-server']
    },
    {
      id: 'recorder',
      label: 'Grabadores / Cámaras',
      shortLabel: 'grabadores y cámaras',
      icon: '📹',
      aliases: ['recorders', 'grabador', 'grabadores', 'camera', 'cameras', 'camara', 'camaras', 'nvr', 'dvr'],
      deviceTypes: ['nvr-camera']
    },
    {
      id: 'voip',
      label: 'Teléfonos VoIP',
      shortLabel: 'teléfonos VoIP',
      icon: '📞',
      aliases: ['telefono', 'telefonos', 'telefono ip', 'telefonos ip'],
      deviceTypes: ['voip']
    },
    {
      id: 'network',
      label: 'Equipos de red',
      shortLabel: 'equipos de red',
      icon: '🔀',
      aliases: ['red', 'networking', 'router', 'routers', 'switch', 'switches', 'firewall'],
      deviceTypes: ['router', 'switch', 'ap', 'firewall']
    },
    {
      id: 'mobile',
      label: 'Móviles / Tablets',
      shortLabel: 'móviles y tablets',
      icon: '📱',
      aliases: ['moviles', 'movil', 'tablet', 'tablets', 'smartphone', 'smartphones'],
      deviceTypes: ['smartphone', 'tablet']
    },
    {
      id: 'vm',
      label: 'Máquinas virtuales',
      shortLabel: 'máquinas virtuales',
      icon: '☁️',
      aliases: ['virtual', 'virtuales', 'vms'],
      deviceTypes: ['vm']
    }
  ]);

  const DEFAULT_CATEGORY = 'all';

  function findScanCategory(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return null;
    return SCAN_CATEGORIES.find((category) => category.id === normalized
      || (category.aliases || []).includes(normalized)) || null;
  }

  function normalizeScanCategory(value) {
    const text = String(value ?? '').trim();
    if (!text) return DEFAULT_CATEGORY;
    const category = findScanCategory(text);
    if (!category) throw new Error('Categoría de escaneo inválida');
    return category.id;
  }

  function getScanCategory(value) {
    return findScanCategory(value) || findScanCategory(DEFAULT_CATEGORY);
  }

  function matchesScanCategory(deviceType, categoryId) {
    const category = getScanCategory(categoryId);
    if (!category || category.id === DEFAULT_CATEGORY) return true;
    return category.deviceTypes.includes(String(deviceType || '').trim().toLowerCase());
  }

  return {
    SCAN_CATEGORIES,
    DEFAULT_CATEGORY,
    findScanCategory,
    normalizeScanCategory,
    getScanCategory,
    matchesScanCategory
  };
});
