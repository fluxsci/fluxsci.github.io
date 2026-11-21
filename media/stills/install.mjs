/** Install PNG masters and web images from a reviewed capture directory. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folders = process.argv.slice(2).map(folder => path.resolve(folder));
assert(folders.length, 'Pass capture directories after visual review');
const categories = new Set(['screenshots', 'docs-screenshots', 'feature-captures']);
const pin = JSON.parse(await fs.readFile(path.join(root, 'flux-source.json'), 'utf8'));
const documents = new Map();
const files = new Map();
for (const folder of folders) {
  const {source, outputs, manifestFor} = JSON.parse(await fs.readFile(path.join(folder, 'captures.json'), 'utf8'));
  assert.equal(source.repository, pin.repository);
  assert([pin.revision, ...(pin.captureRevisions ?? [])].includes(source.revision), 'This capture revision is absent from the reviewed site pins');
  assert.equal(source.version, pin.version);
  for (const [rel, metadata] of Object.entries(outputs)) {
    assert.match(rel, /^site\/assets\/media\/(?:[a-z0-9-]+\.webp|docs\/[a-z0-9-]+\.png)$/);
    const category = manifestFor[rel];
    assert(categories.has(category));
    const file = path.join(folder, path.basename(rel));
    const bytes = await fs.readFile(file);
    assert.equal(bytes.length, metadata.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256);
    files.set(rel, file);
    if (category === 'screenshots' && metadata.captureKind !== 'native-figure-plate') {
      const basename = path.basename(rel, '.webp') + '.png';
      files.set('media/masters/' + basename, path.join(folder, basename));
    }
    const manifestPath = path.join(root, 'media', category + '.json');
    if (!documents.has(manifestPath)) documents.set(manifestPath, JSON.parse(await fs.readFile(manifestPath, 'utf8')));
    const manifest = documents.get(manifestPath);
    // Retain the earlier source for captures still awaiting a refresh.
    manifest.outputs[rel] = manifest.source.revision === source.revision ? metadata : {...metadata, source};
  }
}
for (const [rel, file] of files) {
  const destination = path.join(root, rel);
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await fs.copyFile(file, destination);
  console.log('Installed', rel);
}
for (const [file, manifest] of documents) {
  const sources = new Map();
  const counts = new Map();
  for (const [rel, metadata] of Object.entries(manifest.outputs)) {
    const source = metadata.source ?? manifest.source;
    sources.set(rel, source);
    const count = counts.get(source.revision)?.count ?? 0;
    counts.set(source.revision, {count: count + 1, source});
  }
  const [primary] = [...counts.values()].sort((a, b) => b.count - a.count);
  manifest.source = primary.source;
  for (const [rel, metadata] of Object.entries(manifest.outputs)) {
    const source = sources.get(rel);
    if (source.revision === manifest.source.revision) delete metadata.source;
    else metadata.source = source;
  }
  await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}
