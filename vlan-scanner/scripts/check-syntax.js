'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const sourceRoot = path.join(__dirname, '..', 'src');
const ignoredDirectories = new Set(['node_modules', 'dist']);

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

const failures = [];
for (const file of collectJavaScriptFiles(sourceRoot)) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'pipe', encoding: 'utf8' });
  if (result.status === 0) continue;
  failures.push({ file, error: result.stderr || result.stdout || 'Error de sintaxis' });
}

if (failures.length) {
  for (const failure of failures) {
    process.stderr.write(`\n${failure.file}\n${failure.error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Sintaxis correcta: ${collectJavaScriptFiles(sourceRoot).length} archivos JavaScript.\n`);
}
