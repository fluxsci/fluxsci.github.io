/** Record a guide clip with the production desktop capture pipeline, or install a reviewed take. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const option = name => args[args.indexOf('--' + name) + 1];
const required = name => {
  assert(args.includes('--' + name) && option(name) && !option(name).startsWith('--'), 'Pass --' + name);
  return option(name);
};
const take = required('take');
assert(/^[a-z][a-z0-9-]*$/.test(take) && existsSync(path.join(here, 'takes', take + '.mjs')), 'Unknown guide take');
const work = path.resolve(required('work'));
const sharedTake = '../../docs-clips/takes/' + take;
if (!args.includes('--install')) {
  const source = path.resolve(required('flux-source'));
  const project = path.resolve(required('project'));
  const extras = ['display', 'port'].flatMap(name =>
    args.includes('--' + name) ? ['--' + name, required(name)] : []);
  const workOption = args.includes('--reuse') ? '--reuse' : '--keep';
  execFileSync(process.execPath, [path.join(here, '../pitch/make.mjs'), '--flux-source', source,
    '--project', project, '--take', sharedTake, workOption, work, '--no-install', ...extras],
    {cwd: root, stdio: 'inherit'});
  process.exit(0);
}

const manifestFile = path.join(root, 'media/docs-clips.json');
const videoDirectory = 'site/assets/media/docs/clips';
const takeFile = path.join(work, 'take.json');
const recorded = JSON.parse(readFileSync(takeFile, 'utf8'));
const capturedAt = statSync(takeFile).mtimeMs;
assert.equal(recorded.take, sharedTake);
assert.equal(recorded.window.scale, 4, 'Guide clips require a 4× desktop capture');
assert.equal(recorded.flux.dirty, false, 'Record against a clean production build');
assert.equal(recorded.aspect, 16/9, 'Expected a wide guide clip');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {
  description: 'Guide clips recorded in production Flux with real input and composed by media/pitch. The shared recorder adds the Flux cursor, click rings and keycaps.',
  takes: {}, outputs: {},
};
const assets = [
  ['clip.mp4', take + '.mp4'],
  ['clip-1280.mp4', take + '-1280.mp4'],
  ['poster.webp', take + '.webp'],
].map(([file, name]) => {
  const output = path.join(work, file);
  assert(statSync(output).mtimeMs >= capturedAt, 'Compose the current take before installing: ' + name);
  const bytes = readFileSync(output);
  assert(bytes.length > 0 && bytes.length <= 15 * 1024**2, 'Guide asset size out of bounds: ' + name);
  return {bytes, rel: videoDirectory + '/' + name};
});
mkdirSync(path.join(root, videoDirectory), {recursive: true});
manifest.takes[take] = {
  recorded: recorded.recorded,
  flux: recorded.flux,
  window: recorded.window,
  width: 1920,
  height: 1080,
  seconds: Number(((recorded.marks.end - recorded.marks.start) / 1000).toFixed(2)),
};
for (const {rel, bytes} of assets) {
  writeFileSync(path.join(root, rel), bytes);
  manifest.outputs[rel] = {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log('Installed guide clip ' + take);
