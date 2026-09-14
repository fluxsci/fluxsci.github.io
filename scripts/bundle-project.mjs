/** Package the editable, repository-owned project. Never inspect personal projects/config. */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipSync, unzipSync } from 'fflate';
import { ROOT, SOURCE } from './paths.mjs';

export const PROJECT_ROOT = path.join(ROOT, 'examples/neural-populations');
export const BUNDLE_PATH = 'downloads/neural-populations.zip';
export const REVIEWED_EXPORTS = new Set(JSON.parse(await readFile(new URL('./project-exports.json', import.meta.url), 'utf8')));
const OMIT = new Set(['.git', '.DS_Store', '__pycache__', '.venv', 'node_modules', '.quarto', '.meta', '.cache']);
const TOP_LEVEL = new Set(['project.json', 'README.md', 'AGENTS.md', 'LICENSE.md', 'LICENSE', 'LICENSE.txt', '.gitignore', '_quarto.yml', 'requirements.txt', 'paper', 'plots', 'fig', 'slides', 'references', 'Context', 'exports', 'data', 'scripts', 'assets', 'styles', 'supplementary']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function projectFiles(directory = PROJECT_ROOT, prefix = '') {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes:true })).sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
    const rel = path.posix.join(prefix, entry.name);
    if (OMIT.has(entry.name) || /\.(?:pyc|bak|tmp)$/.test(entry.name) || (entry.name.endsWith('.lock') && rel !== 'scripts/advanced/uv.lock')) continue;
    // Local review tools produce disposable files here. Only explicitly reviewed
    // derivatives enter the download, so local and clean CI builds agree.
    if (rel === 'exports' || rel.startsWith('exports/') || rel === 'fig/renders' || rel.startsWith('fig/renders/')) {
      if (!REVIEWED_EXPORTS.has(rel) && ![...REVIEWED_EXPORTS].some(file => file.startsWith(`${rel}/`))) continue;
    }
    assert(!entry.isSymbolicLink(), `Project bundle must not follow symlinks: ${rel}`);
    if (!prefix) assert(TOP_LEVEL.has(entry.name), `Review new project bundle entry: ${rel}`);
    if (entry.isDirectory()) result.push(...await projectFiles(path.join(directory, entry.name), rel));
    else result.push(rel);
  }
  return result;
}

export async function bundleProject() {
  const files = await projectFiles();
  for (const required of ['project.json', 'README.md', 'paper/manuscript.qmd', 'fig/index.json', 'slides/neural-populations/deck.json', 'references/library.bib', 'data/README.md', 'scripts/advanced/uv.lock', ...REVIEWED_EXPORTS]) {
    assert(files.includes(required), `Incomplete editable project: ${required}`);
  }
  const entries = {}, manifest = {};
  for (const file of files) {
    const bytes = new Uint8Array(await readFile(path.join(PROJECT_ROOT, file)));
    if (/\.(?:json|md|qmd|bib|svg|py|txt|ya?ml|html|mjs|toml|lock)$/.test(file)) {
      assert(!/(?:\/Users\/|\/home\/)[a-zA-Z0-9_-]+\//.test(new TextDecoder().decode(bytes)), `Nonportable machine path in project bundle: ${file}`);
    }
    manifest[file] = { bytes:bytes.length, sha256:sha(bytes) };
    entries[`neural-populations/${file}`] = [bytes, { mtime:new Date('2026-09-13T12:00:00Z') }];
  }
  const zipped = zipSync(entries, { level:6 });
  assert(zipped.length <= 40 * 1024 * 1024, 'Project download exceeds 40 MB; review data and export duplication.');
  // Round-trip proves the archive contains the current editable files, byte for byte.
  const unpacked = unzipSync(zipped);
  assert.equal(Object.keys(unpacked).length, files.length);
  for (const file of files) assert.equal(sha(unpacked[`neural-populations/${file}`]), manifest[file].sha256, `ZIP mismatch: ${file}`);
  await mkdir(path.join(SOURCE, 'downloads'), { recursive:true });
  await writeFile(path.join(SOURCE, BUNDLE_PATH), zipped);
  await writeFile(path.join(ROOT, 'media/project-bundle.json'), JSON.stringify({
    project:'examples/neural-populations', archive:`site/${BUNDLE_PATH}`,
    bytes:zipped.length, sha256:sha(zipped), files:manifest
  }, null, 2) + '\n');
  console.log(`Editable project: ${files.length} files, ${(zipped.length / 1024 / 1024).toFixed(2)} MB ZIP; archive contents verified.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await bundleProject();
