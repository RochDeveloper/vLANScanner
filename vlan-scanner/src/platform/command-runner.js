'use strict';

const { execFile } = require('child_process');
const { createAbortError, throwIfAborted } = require('../domain/cancellation');

class CommandRunner {
  run(executable, args = [], { timeout = 5000, signal, windowsHide = true, encoding = 'utf8' } = {}) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      let settled = false;
      let child;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const settle = (error, stdout, stderr) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve({ stdout: stdout || '', stderr: stderr || '' });
      };
      const onAbort = () => {
        try { child?.kill(); } catch (_) { /* proceso ya terminado */ }
        settle(createAbortError());
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      child = execFile(executable, args, { timeout, windowsHide, encoding }, (error, stdout, stderr) => {
        settle(error, stdout, stderr);
      });
    });
  }
}

module.exports = { CommandRunner };
