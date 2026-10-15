(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createViewControllerModule() {
  class ViewController {
    constructor({ tabs, tableView, topologyView, vlanView, onTopologyShow }) {
      this.tabs = [...tabs];
      this.tableView = tableView;
      this.topologyView = topologyView;
      this.vlanView = vlanView;
      this.onTopologyShow = onTopologyShow;
      this.active = 'table';
      this.handleClick = (event) => {
        const tab = event.target.closest('[data-view]');
        if (tab) this.show(tab.dataset.view);
      };
      this.tabs.forEach((tab) => tab.addEventListener('click', this.handleClick));
    }

    show(name) {
      this.active = name;
      for (const tab of this.tabs) tab.classList.toggle('active', tab.dataset.view === name);
      this.tableView.style.display = name === 'table' ? 'flex' : 'none';
      this.topologyView.style.display = name === 'topology' ? 'block' : 'none';
      this.vlanView.style.display = name === 'vlan' ? 'block' : 'none';
      if (name === 'topology') this.onTopologyShow();
    }

    destroy() {
      this.tabs.forEach((tab) => tab.removeEventListener('click', this.handleClick));
    }
  }

  return { ViewController };
});
