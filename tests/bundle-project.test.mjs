import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROJECT_ROOT, REVIEWED_EXPORTS, projectFiles } from '../scripts/bundle-project.mjs';
import { ROOT } from '../scripts/paths.mjs';

test('project download excludes transient local artifacts and retains its dependency lock', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flux-project-bundle-'));
  const keep = ['README.md', 'plots/example.svg', 'scripts/advanced/uv.lock',
    'exports/manuscript.pdf', 'exports/advanced-previews/overview.png',
    'fig/renders/fig-neural-populations.svg'];
  const omit = ['.meta/journal.ndjson', '.cache/session.json', 'scripts/.venv/pyvenv.cfg',
    'scripts/advanced/rerun.lock', 'scripts/advanced/__pycache__/plot.pyc',
    'exports/advanced-previews/generation-verification.json', 'exports/unreviewed.png',
    'exports/advanced-previews/licenses/unreviewed.txt', 'fig/renders/unfinished.svg',
    'fig/index.json.bak', 'plots/unfinished.svg.tmp'];
  try {
    for (const file of [...keep, ...omit]) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive:true });
      await writeFile(path.join(directory, file), file);
    }
    assert.deepEqual((await projectFiles(directory)).sort(), keep.sort());
  } finally {
    await rm(directory, { recursive:true, force:true });
  }
});

test('reviewed project exports survive a clean Git checkout with their license notices', async () => {
  const files = await projectFiles();
  assert.equal(REVIEWED_EXPORTS.size, 45);
  for (const file of REVIEWED_EXPORTS) assert(files.includes(file), `Reviewed export missing: ${file}`);
  assert(files.includes('scripts/advanced/uv.lock'));
  assert(!files.some(file => file.endsWith('generation-verification.json')));
  // --no-index applies ignore rules even after the initial commit has tracked a file.
  const candidates = [...REVIEWED_EXPORTS, 'scripts/advanced/uv.lock'].map(file =>
    path.posix.join('examples/neural-populations', file));
  const ignored = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd:ROOT, input:candidates.join('\n') + '\n', encoding:'utf8'
  });
  assert.equal(ignored.status, 1, `Required downloads are Git-ignored: ${ignored.stdout || ignored.stderr}`);
  for (const name of ['Flux-MIT.txt', 'svelte-LICENSE.txt', 'esm-env-LICENSE.txt']) {
    assert.deepEqual(await readFile(path.join(PROJECT_ROOT, 'exports/advanced-previews/licenses', name)),
      await readFile(path.join(ROOT, 'site/assets/licenses', name)));
  }
});

test('the complete project ZIP is byte-identical across local and CI timezones', async () => {
  const outputs = ['site/downloads/neural-populations.zip', 'media/project-bundle.json'];
  const saved = await Promise.all(outputs.map(file => readFile(path.join(ROOT, file)).catch(() => null)));
  const program = `import { bundleProject } from './scripts/bundle-project.mjs';
    import { readFile } from 'node:fs/promises';
    await bundleProject();
    console.log(JSON.parse(await readFile('media/project-bundle.json', 'utf8')).sha256);`;
  try {
    const hashes = ['UTC', 'America/Chicago'].map(TZ => {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
        cwd:ROOT, env:{ ...process.env, TZ }, encoding:'utf8'
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return result.stdout.trim().split('\n').at(-1);
    });
    assert.match(hashes[0], /^[a-f0-9]{64}$/);
    assert.equal(hashes[0], hashes[1], 'ZIP timestamps must not depend on the build machine timezone.');
  } finally {
    await Promise.all(outputs.map((file, index) => saved[index] === null
      ? rm(path.join(ROOT, file), { force:true })
      : writeFile(path.join(ROOT, file), saved[index])));
  }
});
