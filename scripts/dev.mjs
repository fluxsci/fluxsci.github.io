import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ROOT, SOURCE } from './paths.mjs';

// Every preview uses the same document decoration and publication checks as CI.
let building = false, pending = false, timer, child, server, stopping = false;
async function build() {
  if (building) { pending = true; return; }
  building = true;
  child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'inherit' });
  const code = await new Promise(resolve => child.once('exit', resolve));
  building = false;
  if (stopping) return;
  if (code === 0 && !server) {
    server = spawn(process.execPath, ['scripts/serve.mjs', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
    server.once('exit', code => { if (!stopping) stop(code ?? 1); });
  }
  if (pending) { pending = false; await build(); }
}
function authored(directory, relative) {
  if (relative.split('/').some(part => part.startsWith('.')) || (directory === SOURCE && relative === 'docs/index.qmd')) return false;
  // Quarto creates intermediate HTML beside source files while rendering.
  return /\.(?:qmd|yml|mjs|js|css|svg|png|webp|jpg|woff2?|sh)$/.test(relative) || (relative.startsWith('demos/') && relative.endsWith('.html'));
}
const fingerprints = new Map();
const hash = async file => readFile(file).then(bytes => createHash('sha256').update(bytes).digest('hex')).catch(() => null);
const directories = [SOURCE, path.join(ROOT, 'scripts')];
for (const directory of directories) {
  for (const relative of await readdir(directory, { recursive: true })) {
    if (authored(directory, relative)) fingerprints.set(path.join(directory, relative), await hash(path.join(directory, relative)));
  }
}
const watchers = directories.map(directory => watch(directory, { recursive: true }, async (_event, filename) => {
  const relative = String(filename ?? '').replaceAll('\\', '/');
  if (!authored(directory, relative)) return;
  // Quarto can touch resources without changing them; ignore those notifications.
  const file = path.join(directory, relative), current = await hash(file);
  if (fingerprints.get(file) === current || stopping) return;
  fingerprints.set(file, current);
  clearTimeout(timer);
  timer = setTimeout(build, 250);
}));
function stop(code = 0) {
  stopping = true;
  clearTimeout(timer);
  watchers.forEach(watcher => watcher.close());
  child?.kill(); server?.kill();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
await build();
