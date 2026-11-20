'use strict';

class ScanManager {
  constructor({ scanner, hostnameResolver, createPlan }) {
    this.scanner = scanner;
    this.hostnameResolver = hostnameResolver;
    this.createPlan = createPlan;
    this.active = null;
  }

  start(request, sender) {
    const plan = this.createPlan(request);
    if (this.active) throw new Error('Ya existe un escaneo activo');

    const run = {
      runId: plan.runId,
      controller: new AbortController(),
      state: 'running',
      sender,
      plan
    };
    this.active = run;
    this.hostnameResolver.clearCacheForScan();
    this.sendState(sender, run, { scanned: 0, total: plan.total });

    const execution = this.execute(run);
    run.execution = execution;
    return execution;
  }

  async execute(run) {
    try {
      const hosts = await this.scanner.scan(run.plan, {
        signal: run.controller.signal,
        onProgress: (progress) => this.send('scan-progress', run.sender, progress),
        onHostFound: (event) => this.send('scan-host-found', run.sender, event)
      });
      const summary = { runId: run.runId, status: 'completed', category: run.plan.category, hosts, found: hosts.length };
      this.sendState(run.sender, run, { scanned: run.plan.total, total: run.plan.total }, summary);
      return summary;
    } catch (error) {
      if (error?.name === 'AbortError' || run.controller.signal.aborted) {
        const summary = { runId: run.runId, status: 'cancelled', category: run.plan.category, hosts: [], found: 0 };
        this.sendState(run.sender, run, this.lastProgress(run), summary);
        return summary;
      }
      this.sendState(run.sender, run, this.lastProgress(run), {
        runId: run.runId,
        status: 'failed',
        category: run.plan.category,
        error: { code: 'SCAN_FAILED', message: error.message || 'Error de escaneo' }
      });
      throw error;
    } finally {
      if (this.active === run) this.active = null;
    }
  }

  cancel(runId) {
    if (!this.active || this.active.runId !== runId) return { runId, status: 'not-found' };
    if (!this.active.controller.signal.aborted) {
      this.active.state = 'cancelling';
      this.active.controller.abort();
    }
    return { runId, status: 'cancelling' };
  }

  cancelAll() {
    if (!this.active) return false;
    this.cancel(this.active.runId);
    return true;
  }

  get activeRunId() {
    return this.active?.runId || null;
  }

  lastProgress(run) {
    return run.lastProgress || { scanned: 0, total: run.plan.total };
  }

  sendState(sender, run, progress, summary = {}) {
    run.state = summary.status || run.state;
    this.send('scan-state', sender, { ...summary, runId: run.runId, status: run.state, progress });
  }

  send(channel, sender, payload) {
    if (channel === 'scan-progress') this._rememberProgress(payload);
    if (!sender || sender.isDestroyed?.()) return;
    sender.send(channel, payload);
  }

  _rememberProgress(progress) {
    const run = this.active;
    if (run && progress?.runId === run.runId) run.lastProgress = progress;
  }
}

module.exports = { ScanManager };
