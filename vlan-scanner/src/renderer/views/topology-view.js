(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createTopologyModule() {
  const { DEVICE_ICONS } = globalThis.VLANScanner;

  class TopologyView {
    constructor({ canvas, wrap, idsForHost, ResizeObserverClass = globalThis.ResizeObserver }) {
      this.canvas = canvas;
      this.wrap = wrap;
      this.idsForHost = idsForHost;
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      this.hosts = [];
      this.vlans = [];
      this.nodes = [];
      this.positions = new Map();
      this.dragging = null;
      this.hovered = null;
      this.handleMouseDown = (event) => this.mouseDown(event);
      this.handleMouseMove = (event) => this.mouseMove(event);
      this.handleMouseUp = () => { this.dragging = null; };
      this.handleWheel = (event) => {
        event.preventDefault();
        this.zoomAt(event.offsetX, event.offsetY, event.deltaY < 0 ? 1.12 : 0.88);
      };
      this.handleResize = () => {
        this.resize();
        this.draw();
      };
      this.canvas.addEventListener('mousedown', this.handleMouseDown);
      this.canvas.addEventListener('mousemove', this.handleMouseMove);
      this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
      globalThis.addEventListener('mouseup', this.handleMouseUp);
      this.observer = ResizeObserverClass ? new ResizeObserverClass(this.handleResize) : null;
      this.observer?.observe(this.wrap);
      this.resize();
    }

    resize() {
      this.canvas.width = Math.max(1, this.wrap.clientWidth);
      this.canvas.height = Math.max(1, this.wrap.clientHeight);
    }

    update(hosts, vlans) {
      this.hosts = hosts;
      this.vlans = vlans;
      this.nodes = hosts.map((host, index) => {
        const ids = this.idsForHost(host);
        const vlan = vlans.find((candidate) => candidate.id === ids[0]);
        const previous = this.positions.get(host.ip);
        const position = previous || this.initialPosition(index, hosts.length);
        this.positions.set(host.ip, position);
        return { host, ...position, vlanColor: vlan?.color || '#388bfd', radius: 20 };
      });
      this.draw();
    }

    initialPosition(index, total) {
      const angle = (index / Math.max(total, 1)) * Math.PI * 2;
      const radius = 160 + Math.floor(index / 8) * 80;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }

    draw() {
      if (!this.canvas.width || !this.canvas.height) return;
      const context = this.canvas.getContext('2d');
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const centerX = this.canvas.width / 2 + this.panX;
      const centerY = this.canvas.height / 2 + this.panY;
      this.drawGrid(context, centerX, centerY);
      this.drawVlanZones(context, centerX, centerY);
      this.drawLinks(context, centerX, centerY);
      this.drawNodes(context, centerX, centerY);
    }

    drawGrid(context, centerX, centerY) {
      const grid = Math.max(8, 40 * this.scale);
      context.strokeStyle = 'rgba(255,255,255,0.03)';
      context.lineWidth = 1;
      const offsetX = ((centerX % grid) + grid) % grid;
      const offsetY = ((centerY % grid) + grid) % grid;
      for (let x = offsetX; x < this.canvas.width; x += grid) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, this.canvas.height);
        context.stroke();
      }
      for (let y = offsetY; y < this.canvas.height; y += grid) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(this.canvas.width, y);
        context.stroke();
      }
    }

    drawVlanZones(context, centerX, centerY) {
      for (const vlan of this.vlans) {
        const members = this.nodes.filter((node) => this.idsForHost(node.host).includes(vlan.id));
        if (members.length < 2) continue;
        const xs = members.map((node) => centerX + node.x * this.scale);
        const ys = members.map((node) => centerY + node.y * this.scale);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const radiusX = Math.max((maxX - minX) / 2 + 40, 40);
        const radiusY = Math.max((maxY - minY) / 2 + 40, 30);
        context.save();
        context.globalAlpha = 0.06;
        context.fillStyle = vlan.color;
        context.beginPath();
        context.ellipse((minX + maxX) / 2, (minY + maxY) / 2, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        context.fillStyle = `${vlan.color}99`;
        context.font = `${10 * this.scale}px Segoe UI`;
        context.textAlign = 'center';
        context.fillText(`VLAN ${vlan.id}: ${vlan.name}`, (minX + maxX) / 2, (minY + maxY) / 2 - radiusY * 0.65);
      }
    }

    drawLinks(context, centerX, centerY) {
      const gateways = this.nodes.filter((node) => ['router', 'switch', 'firewall'].includes(node.host.deviceType));
      for (const node of this.nodes) {
        if (gateways.includes(node)) continue;
        const nodeVlans = this.idsForHost(node.host);
        const gateway = gateways.find((candidate) => this.idsForHost(candidate.host).some((id) => nodeVlans.includes(id))) || gateways[0];
        if (!gateway) continue;
        context.strokeStyle = `${node.vlanColor}60`;
        context.lineWidth = 1;
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(centerX + node.x * this.scale, centerY + node.y * this.scale);
        context.lineTo(centerX + gateway.x * this.scale, centerY + gateway.y * this.scale);
        context.stroke();
        context.setLineDash([]);
      }
    }

    drawNodes(context, centerX, centerY) {
      for (const node of this.nodes) {
        const x = centerX + node.x * this.scale;
        const y = centerY + node.y * this.scale;
        const radius = node.radius * this.scale;
        context.save();
        context.shadowColor = node.vlanColor;
        context.shadowBlur = node === this.hovered ? 15 : 6;
        context.fillStyle = `${node.vlanColor}cc`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255,255,255,0.3)';
        context.lineWidth = 1.5;
        context.stroke();
        context.shadowBlur = 0;
        context.font = `${Math.max(10, radius * 0.7)}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#fff';
        context.fillText(DEVICE_ICONS[node.host.deviceType] || DEVICE_ICONS.default, x, y);
        if (this.scale > 0.5) {
          context.font = `${Math.max(9, 10 * this.scale)}px Segoe UI`;
          context.fillStyle = 'rgba(230,237,243,0.9)';
          context.textBaseline = 'top';
          context.fillText(node.host.hostname || node.host.ip, x, y + radius + 3);
        }
        context.restore();
      }
    }

    mouseDown(event) {
      const centerX = this.canvas.width / 2 + this.panX;
      const centerY = this.canvas.height / 2 + this.panY;
      const node = this.nodes.find((candidate) => {
        const dx = event.offsetX - (centerX + candidate.x * this.scale);
        const dy = event.offsetY - (centerY + candidate.y * this.scale);
        return dx * dx + dy * dy <= (candidate.radius * this.scale) ** 2;
      });
      this.dragging = node
        ? { node, offsetX: event.offsetX, offsetY: event.offsetY, x: node.x, y: node.y }
        : { pan: true, offsetX: event.offsetX, offsetY: event.offsetY, panX: this.panX, panY: this.panY };
    }

    mouseMove(event) {
      if (!this.dragging) return;
      if (this.dragging.pan) {
        this.panX = this.dragging.panX + event.offsetX - this.dragging.offsetX;
        this.panY = this.dragging.panY + event.offsetY - this.dragging.offsetY;
      } else {
        this.dragging.node.x = this.dragging.x + (event.offsetX - this.dragging.offsetX) / this.scale;
        this.dragging.node.y = this.dragging.y + (event.offsetY - this.dragging.offsetY) / this.scale;
        this.positions.set(this.dragging.node.host.ip, { x: this.dragging.node.x, y: this.dragging.node.y });
      }
      this.draw();
    }

    zoom(factor) {
      this.zoomAt(this.canvas.width / 2, this.canvas.height / 2, factor);
    }

    zoomAt(screenX, screenY, factor) {
      const worldX = (screenX - this.canvas.width / 2 - this.panX) / this.scale;
      const worldY = (screenY - this.canvas.height / 2 - this.panY) / this.scale;
      this.scale = Math.max(0.2, Math.min(4, this.scale * factor));
      this.panX = screenX - this.canvas.width / 2 - worldX * this.scale;
      this.panY = screenY - this.canvas.height / 2 - worldY * this.scale;
      this.draw();
    }

    reset() {
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      this.draw();
    }

    destroy() {
      this.observer?.disconnect();
      this.canvas.removeEventListener('mousedown', this.handleMouseDown);
      this.canvas.removeEventListener('mousemove', this.handleMouseMove);
      this.canvas.removeEventListener('wheel', this.handleWheel);
      globalThis.removeEventListener('mouseup', this.handleMouseUp);
    }
  }

  return { TopologyView };
});
