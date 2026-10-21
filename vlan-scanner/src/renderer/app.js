(function bootstrap(root) {
  const {
    createRangePlan,
    VlanService,
    DEVICE_ICONS,
    NetworkAdapter,
    PlatformAdapter,
    ScanController,
    FilterPanel,
    HostTable,
    DetailPanel,
    VlanPanel,
    TopologyView,
    ViewController
  } = root.VLANScanner;

  class ScannerApplication {
    constructor(api) {
      this.api = api;
      this.network = new NetworkAdapter(api);
      this.platform = new PlatformAdapter(api);
      this.vlanService = new VlanService();
      this.hosts = [];
      this.interfaces = [];
      this.hasScanned = false;
      this.renderFrame = null;
      this.ui = {
        activeFilter: 'all',
        search: '',
        sort: { key: 'ip', ascending: true },
        selectedIp: null
      };
      this.scanState = { status: 'idle', progress: { scanned: 0, total: 0 } };
      this.elements = this.collectElements();
      this.scanController = new ScanController({
        networkPort: this.network,
        onStatus: (status) => this.handleScanStatus(status),
        onProgress: (progress) => this.handleProgress(progress),
        onHost: (host) => this.handleHost(host),
        onElapsed: (seconds) => { this.elements.sbTime.textContent = `${seconds}s`; }
      });
      this.createViews();
      this.bindEvents();
      this.scanController.initialize();
    }

    collectElements() {
      const byId = (id) => document.getElementById(id);
      return {
        titleButtons: {
          minimize: byId('btn-minimize'),
          maximize: byId('btn-maximize'),
          close: byId('btn-close')
        },
        ifaceSelect: byId('iface-select'),
        ipFrom: byId('ip-from'),
        ipTo: byId('ip-to'),
        scanPorts: byId('chk-ports'),
        resolveHostnames: byId('chk-hostname'),
        scan: byId('btn-scan'),
        stop: byId('btn-stop'),
        exportCsv: byId('btn-export-csv'),
        exportJson: byId('btn-export-json'),
        search: byId('search-box'),
        progress: byId('progress-bar'),
        statScanned: byId('stat-scanned'),
        sbStatus: byId('sb-status'),
        sbIp: byId('sb-ip'),
        sbTime: byId('sb-time'),
        sbIface: byId('sb-iface'),
        detailEmpty: byId('detail-empty'),
        detailContent: byId('detail-content'),
        vlanForm: {
          id: byId('new-vlan-id'),
          name: byId('new-vlan-name'),
          subnet: byId('new-vlan-subnet'),
          color: byId('new-vlan-color'),
          add: byId('btn-add-vlan')
        },
        topologyControls: {
          zoomIn: byId('topo-zoom-in'),
          zoomOut: byId('topo-zoom-out'),
          reset: byId('topo-reset')
        }
      };
    }

    createViews() {
      const idsForHost = (host) => this.vlanService.idsForHost(host);
      this.filterPanel = new root.VLANScanner.FilterPanel({
        vlanList: document.getElementById('vlan-filter-list'),
        typeList: document.getElementById('type-filter-list'),
        printerList: document.getElementById('printer-filter-list'),
        allButton: document.getElementById('filter-all'),
        onlineStat: document.getElementById('stat-online'),
        vlanStat: document.getElementById('stat-vlans'),
        badge: document.getElementById('badge-all'),
        onFilter: (filter) => this.setFilter(filter),
        idsForHost,
        deviceIcons: DEVICE_ICONS
      });
      this.hostTable = new root.VLANScanner.HostTable({
        table: document.getElementById('results-table'),
        tbody: document.getElementById('results-tbody'),
        emptyState: document.getElementById('empty-state'),
        headings: document.querySelectorAll('#results-table thead th'),
        onSelect: (ip) => this.selectHost(ip),
        onSort: (key) => this.sortBy(key),
        idsForHost
      });
      this.detailPanel = new root.VLANScanner.DetailPanel({
        content: this.elements.detailContent,
        empty: this.elements.detailEmpty,
        idsForHost,
        onOpenExternal: (url) => this.openExternal(url),
        onCopy: (text) => this.copyText(text)
      });
      this.vlanPanel = new root.VLANScanner.VlanPanel({
        tbody: document.getElementById('vlan-tbody'),
        onRemove: (id) => this.removeVlan(id),
        onColor: (id, color) => this.updateVlanColor(id, color)
      });
      this.topology = new root.VLANScanner.TopologyView({
        canvas: document.getElementById('topo-canvas'),
        wrap: document.getElementById('topo-wrap'),
        idsForHost
      });
      this.viewController = new root.VLANScanner.ViewController({
        tabs: document.querySelectorAll('[data-view]'),
        tableView: document.getElementById('table-view'),
        topologyView: document.getElementById('topo-wrap'),
        vlanView: document.getElementById('vlan-wrap'),
        onTopologyShow: () => setTimeout(() => {
          this.topology.resize();
          this.topology.draw();
        }, 0)
      });
    }

    bindEvents() {
      this.elements.titleButtons.minimize.addEventListener('click', () => this.platform.minimize());
      this.elements.titleButtons.maximize.addEventListener('click', () => this.platform.maximize());
      this.elements.titleButtons.close.addEventListener('click', () => this.platform.close());
      this.elements.scan.addEventListener('click', () => this.startScan());
      this.elements.stop.addEventListener('click', () => this.stopScan());
      this.elements.exportCsv.addEventListener('click', () => this.exportResults('csv'));
      this.elements.exportJson.addEventListener('click', () => this.exportResults('json'));
      this.elements.ifaceSelect.addEventListener('change', () => this.onInterfaceChange());
      this.elements.search.addEventListener('input', () => {
        this.ui.search = this.elements.search.value;
        this.scheduleRender();
      });
      this.elements.vlanForm.add.addEventListener('click', () => this.addVlan());
      this.elements.topologyControls.zoomIn.addEventListener('click', () => this.topology.zoom(1.2));
      this.elements.topologyControls.zoomOut.addEventListener('click', () => this.topology.zoom(0.8));
      this.elements.topologyControls.reset.addEventListener('click', () => this.topology.reset());
      window.addEventListener('beforeunload', () => this.dispose(), { once: true });
    }

    async initialize() {
      this.render();
      try {
        this.interfaces = await this.network.listInterfaces();
        this.renderInterfaces();
        if (this.interfaces.length) this.onInterfaceChange();
        else this.setStatus('No se encontraron interfaces IPv4');
      } catch (error) {
        this.setStatus(`Error al cargar interfaces: ${error.message}`, true);
        this.elements.ifaceSelect.disabled = true;
      }
    }

    renderInterfaces() {
      this.elements.ifaceSelect.replaceChildren();
      if (!this.interfaces.length) {
        this.elements.ifaceSelect.add(new Option('Sin interfaces IPv4', ''));
        return;
      }
      this.interfaces.forEach((network, index) => {
        this.elements.ifaceSelect.add(new Option(`${network.interface} — ${network.ip} (${network.cidr})`, String(index)));
      });
    }

    onInterfaceChange() {
      const interfaceItem = this.interfaces[Number(this.elements.ifaceSelect.value)];
      if (!interfaceItem) return;
      this.elements.ipFrom.value = interfaceItem.suggestedFrom || `${interfaceItem.base}.1`;
      this.elements.ipTo.value = interfaceItem.suggestedTo || `${interfaceItem.base}.254`;
      this.elements.sbIface.replaceChildren(
        document.createTextNode('Interfaz: '),
        Object.assign(document.createElement('span'), { className: 'val', textContent: `${interfaceItem.interface} (${interfaceItem.ip})` })
      );
    }

    async startScan() {
      if (this.scanController.isBusy()) return;
      let plan;
      try {
        plan = createRangePlan(this.elements.ipFrom.value, this.elements.ipTo.value);
      } catch (error) {
        alert(`Rango IP inválido.\n${error.message}`);
        return;
      }
      if (plan.total > 5000 && !confirm(`El rango abarca ${plan.total.toLocaleString('es-ES')} direcciones.\nEsto puede tardar varios minutos.\n¿Continuar?`)) return;

      this.hosts = [];
      this.hasScanned = true;
      this.ui.selectedIp = null;
      this.ui.activeFilter = 'all';
      this.ui.search = '';
      this.elements.search.value = '';
      this.elements.statScanned.textContent = '0';
      this.elements.progress.style.width = '0%';
      this.elements.sbIp.textContent = '—';
      this.elements.sbTime.textContent = '0s';
      this.detailPanel.render(null, this.vlanService.all());
      this.setScanningControls(true);
      this.render();

      try {
        await this.scanController.start({
          fromIp: plan.fromIp,
          toIp: plan.toIp,
          scanPorts: this.elements.scanPorts.checked,
          resolveHostnames: this.elements.resolveHostnames.checked
        });
      } catch (error) {
        this.setStatus(`No se pudo completar el escaneo: ${error.message}`, true);
      } finally {
        this.setScanningControls(false);
        this.render();
      }
    }

    async stopScan() {
      if (!this.scanController.isBusy()) return;
      this.elements.stop.disabled = true;
      this.setStatus('Deteniendo el escaneo...');
      try {
        await this.scanController.stop();
      } catch (error) {
        this.setStatus(`No se pudo detener: ${error.message}`, true);
      }
    }

    setScanningControls(scanning) {
      this.elements.scan.disabled = scanning;
      this.elements.stop.disabled = !scanning;
      this.elements.ifaceSelect.disabled = scanning;
      this.elements.ipFrom.disabled = scanning;
      this.elements.ipTo.disabled = scanning;
      this.elements.scanPorts.disabled = scanning;
      this.elements.resolveHostnames.disabled = scanning;
    }

    handleScanStatus(status) {
      this.scanState = status;
      if (status.progress && Number.isFinite(Number(status.progress.scanned))) {
        this.elements.statScanned.textContent = String(status.progress.scanned);
      }
      if (status.status === 'running') {
        this.setStatus(`Escaneando ${status.progress.total.toLocaleString('es-ES')} direcciones...`);
      } else if (status.status === 'stopping') {
        this.setStatus('Deteniendo el escaneo...');
      } else if (status.status === 'completed') {
        this.elements.progress.style.width = '100%';
        this.setStatus(`Escaneo completado — ${this.hosts.length} hosts encontrados`);
      } else if (status.status === 'cancelled') {
        this.setStatus(`Escaneo detenido — ${status.progress.scanned || 0}/${status.progress.total || 0} direcciones comprobadas`);
      } else if (status.status === 'failed') {
        this.setStatus(`Error de escaneo: ${status.error?.message || 'error desconocido'}`, true);
      }
    }

    handleProgress(progress) {
      if (this.scanState.status === 'completed' || this.scanState.status === 'cancelled' || this.scanState.status === 'failed') return;
      if (this.scanState.status === 'stopping') {
        this.elements.statScanned.textContent = String(progress.scanned || 0);
        this.setStatus('Deteniendo el escaneo...');
        return;
      }
      const percent = progress.total ? Math.min(100, Math.round((progress.scanned / progress.total) * 100)) : 0;
      this.elements.progress.style.width = `${percent}%`;
      this.elements.statScanned.textContent = String(progress.scanned);
      this.elements.sbIp.textContent = progress.ip || '—';
      if (progress.phase === 'probing') this.setStatus(`Comprobando red... ${percent}%`);
      else this.setStatus(`Analizando ${progress.ip || 'equipo'}... ${percent}%`);
    }

    handleHost(host) {
      if (!host || this.hosts.some((candidate) => candidate.ip === host.ip)) return;
      this.hosts.push({ ...host });
      this.scheduleRender();
    }

    setFilter(filter) {
      this.ui.activeFilter = filter;
      this.filterPanel.setActive(filter);
      this.hostTable.render(this.hosts, this.vlanService.all(), this.ui, this.hasScanned);
    }

    sortBy(key) {
      if (this.ui.sort.key === key) this.ui.sort.ascending = !this.ui.sort.ascending;
      else this.ui.sort = { key, ascending: true };
      this.scheduleRender();
    }

    selectHost(ip) {
      this.ui.selectedIp = ip;
      const host = this.hosts.find((candidate) => candidate.ip === ip);
      this.detailPanel.render(host, this.vlanService.all());
      this.hostTable.render(this.hosts, this.vlanService.all(), this.ui, this.hasScanned);
    }

    addVlan() {
      try {
        this.vlanService.add({
          id: this.elements.vlanForm.id.value,
          name: this.elements.vlanForm.name.value,
          subnet: this.elements.vlanForm.subnet.value,
          color: this.elements.vlanForm.color.value
        });
        this.elements.vlanForm.name.value = '';
        this.elements.vlanForm.subnet.value = '';
        this.render();
      } catch (error) {
        alert(error.message);
      }
    }

    removeVlan(id) {
      try {
        this.vlanService.remove(id);
        if (this.ui.activeFilter === `vlan:${id}`) this.ui.activeFilter = 'all';
        this.render();
      } catch (error) {
        alert(error.message);
      }
    }

    updateVlanColor(id, color) {
      try {
        this.vlanService.updateColor(id, color);
        this.render();
      } catch (error) {
        alert(error.message);
      }
    }

    async exportResults(format) {
      if (!this.hosts.length) {
        alert('No hay datos para exportar. Ejecuta un escaneo primero.');
        return;
      }
      try {
        const exported = await this.platform.exportResults(this.hosts, format);
        if (exported) this.setStatus(`Resultados exportados en ${format.toUpperCase()}`);
      } catch (error) {
        alert(`No se pudo exportar: ${error.message}`);
      }
    }

    async openExternal(url) {
      try {
        await this.platform.openExternal(url);
      } catch (error) {
        alert(`No se pudo abrir la URL: ${error.message}`);
      }
    }

    async copyText(text) {
      try {
        const copied = await this.platform.copy(text);
        this.setStatus(copied ? 'Copiado al portapapeles' : 'No se pudo copiar', !copied);
      } catch (error) {
        this.setStatus(`No se pudo copiar: ${error.message}`, true);
      }
    }

    setStatus(message, error = false) {
      this.elements.sbStatus.textContent = message;
      this.elements.sbStatus.style.color = error ? 'var(--red)' : '';
    }

    scheduleRender() {
      if (this.renderFrame !== null) return;
      this.renderFrame = requestAnimationFrame(() => {
        this.renderFrame = null;
        this.render();
      });
    }

    render() {
      const vlans = this.vlanService.all();
      const counts = this.vlanService.countHosts(this.hosts);
      this.filterPanel.render(this.hosts, vlans, this.ui.activeFilter);
      this.hostTable.render(this.hosts, vlans, this.ui, this.hasScanned);
      this.vlanPanel.render(vlans, counts);
      this.topology.update(this.hosts, vlans);
      const selected = this.hosts.find((host) => host.ip === this.ui.selectedIp) || null;
      this.detailPanel.render(selected, vlans);
    }

    dispose() {
      this.scanController.dispose();
      this.filterPanel.destroy();
      this.hostTable.destroy();
      this.detailPanel.destroy();
      this.vlanPanel.destroy();
      this.topology.destroy();
      this.viewController.destroy();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!root.api) {
      document.body.textContent = 'No se pudo inicializar el puente seguro de Electron.';
      return;
    }
    const application = new ScannerApplication(root.api);
    root.scannerApplication = application;
    application.initialize();
  });
})(globalThis);
