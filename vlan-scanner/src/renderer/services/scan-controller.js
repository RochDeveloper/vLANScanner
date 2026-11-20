(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VLANScanner = Object.assign(root.VLANScanner || {}, api);
})(globalThis, function createScanControllerModule() {
  const TERMINAL_STATES = new Set(['completed', 'cancelled', 'failed']);
  const createRunId = () => globalThis.crypto?.randomUUID?.()
    || `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  class ScanController {
    constructor({
      networkPort,
      onStatus = () => {},
      onProgress = () => {},
      onHost = () => {},
      onElapsed = () => {},
      now = () => Date.now(),
      setTimer = (callback, milliseconds) => setInterval(callback, milliseconds),
      clearTimer = (timer) => clearInterval(timer),
      runIdFactory = createRunId
    }) {
      this.networkPort = networkPort;
      this.onStatus = onStatus;
      this.onProgress = onProgress;
      this.onHost = onHost;
      this.onElapsed = onElapsed;
      this.now = now;
      this.setTimer = setTimer;
      this.clearTimer = clearTimer;
      this.runIdFactory = runIdFactory;
      this.active = null;
      this.subscriptions = [];
    }

    initialize() {
      if (this.subscriptions.length) return;
      this.subscriptions = [
        ['progress', this.networkPort.onProgress((event) => this.handleEvent('progress', event))],
        ['host', this.networkPort.onHost((event) => this.handleEvent('host', event))],
        ['state', this.networkPort.onState((event) => this.handleEvent('state', event))]
      ];
    }

    isBusy() {
      return Boolean(this.active);
    }

    async start(request) {
      if (this.active) throw new Error('Ya existe un escaneo activo');
      const run = {
        runId: this.runIdFactory(),
        startedAt: this.now(),
        status: 'running',
        progress: { scanned: 0, total: 0, phase: 'starting' },
        terminal: false
      };
      this.active = run;

      try {
        this.emitStatus(run);
        run.timer = this.setTimer(() => this.onElapsed(Math.floor((this.now() - run.startedAt) / 1000)), 1000);
        this.initialize();
        const summary = await this.networkPort.scan({
          runId: run.runId,
          fromIp: request.fromIp,
          toIp: request.toIp,
          category: request.category || 'all',
          scanPorts: Boolean(request.scanPorts),
          resolveHostnames: Boolean(request.resolveHostnames)
        });
        this.markTerminal(summary.status || 'completed', summary, null);
        return summary;
      } catch (error) {
        this.markTerminal('failed', null, { code: 'SCAN_REQUEST_FAILED', message: error.message || 'No se pudo iniciar el escaneo' });
        throw error;
      } finally {
        this.clearTimer(run.timer);
        if (this.active === run) this.active = null;
      }
    }

    async stop() {
      const run = this.active;
      if (!run || run.terminal) return { status: 'not-running' };
      run.status = 'stopping';
      this.emitStatus(run);
      return this.networkPort.cancel(run.runId);
    }

    handleEvent(kind, event) {
      const run = this.active;
      if (!run || run.terminal || event?.runId !== run.runId) return;
      if (kind === 'progress') {
        run.progress = event;
        this.onProgress(event);
      } else if (kind === 'host') {
        this.onHost(event.host, event);
      } else if (kind === 'state') {
        run.progress = event.progress || run.progress;
        if (TERMINAL_STATES.has(event.status)) this.markTerminal(event.status, event, event.error || null);
      }
    }

    markTerminal(status, details = {}, error = null) {
      const run = this.active;
      if (!run || run.terminal) return;
      const terminalDetails = details || {};
      run.terminal = true;
      run.status = status;
      run.progress = terminalDetails.progress || run.progress;
      this.emitStatus(run, { details, error });
    }

    emitStatus(run, extra = {}) {
      this.onStatus({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt,
        progress: { ...run.progress },
        ...extra
      });
    }

    dispose() {
      if (this.active) this.stop();
      for (const [kind, id] of this.subscriptions) this.networkPort.unsubscribe(kind, id);
      this.subscriptions = [];
    }
  }

  return { ScanController, TERMINAL_STATES };
});
