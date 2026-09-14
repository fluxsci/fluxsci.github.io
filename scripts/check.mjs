import { readdir, readFile, lstat, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { ROOT, SOURCE, OUTPUT, isInside } from './paths.mjs';

const PUBLIC_ASSET = /^(?:assets|demos)\/(?:[\w@().-]+\/)*[\w@().-]+\.(?:html|css|js|svg|png|webp|jpg|jpeg|avif|woff2?|ttf|mp4|webm|vtt)$/;
const FONT_LICENSE = /^assets\/fonts\/(?:OFL|LICENSE)[\w.-]*\.txt$/;
const RUNTIME_LICENSE = /^assets\/licenses\/[\w.-]+\.txt$/;
const SOURCE_FILES = new Set(['index.qmd', '404.qmd', '_quarto.yml', 'robots.txt']);
const OUTPUT_FILES = new Set(['index.html', '404.html', 'robots.txt', 'sitemap.xml', '.nojekyll']);

async function filesIn(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes:true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.quarto' && directory === SOURCE) continue;
    const relative = path.posix.join(prefix, entry.name);
    assert(!entry.isSymbolicLink(), `Symlinks cannot be published: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

function allowedAsset(file) {
  return file === 'downloads/neural-populations.zip' || (PUBLIC_ASSET.test(file) && (!file.endsWith('.html') || file.startsWith('demos/'))) || FONT_LICENSE.test(file) || RUNTIME_LICENSE.test(file);
}

export async function checkSource() {
  const files = await filesIn(SOURCE);
  for (const required of SOURCE_FILES) assert(files.includes(required), `Required source missing: site/${required}`);
  for (const file of files) assert(SOURCE_FILES.has(file) || file === '.gitignore' || allowedAsset(file), `Unexpected public source: site/${file}. Keep private plans, fixtures and provenance outside site/.`);
  const pin = JSON.parse(await readFile(path.join(ROOT, 'flux-source.json'), 'utf8'));
  assert(/^[a-f0-9]{40}$/.test(pin.revision), 'flux-source.json must pin a full commit hash.');
  assert.equal(pin.repository, 'https://github.com/fluxsci/flux.git');
  for (const manifestFile of ['media/native-assets.json', 'media/screenshots.json']) {
    const manifest = JSON.parse(await readFile(path.join(ROOT, manifestFile), 'utf8'));
    assert.deepEqual(manifest.source, pin, `${manifestFile} does not match the pinned Flux source.`);
    assert(Object.keys(manifest.outputs).length, `${manifestFile} has no output provenance.`);
    for (const [file, expected] of Object.entries(manifest.outputs)) {
      assert(file.startsWith('site/') && isInside(SOURCE, path.resolve(ROOT, file)), `Invalid asset provenance path: ${file}`);
      assert(allowedAsset(file.slice(5)), `Provenance references an unapproved public asset: ${file}`);
      const bytes = await readFile(path.join(ROOT, file));
      assert.equal(bytes.length, expected.bytes, `Asset size changed; refresh provenance for ${file}`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Asset hash changed; refresh provenance for ${file}`);
    }
  }
  return files;
}

async function resolveLocal(reference, from, label) {
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(reference)) return;
  assert(!/^[a-z]+:/i.test(reference), `Unsupported URL in ${label}: ${reference}`);
  const url = new URL(reference, `https://fluxsci.github.io/${from}`);
  if (url.origin !== 'https://fluxsci.github.io') return;
  let filename = path.resolve(OUTPUT, `.${decodeURIComponent(url.pathname)}`);
  assert(isInside(OUTPUT, filename), `Path escapes output in ${label}: ${reference}`);
  const stat = await lstat(filename).catch(() => null);
  if (stat?.isDirectory()) filename = path.join(filename, 'index.html');
  await access(filename).catch(() => { throw new Error(`Broken local reference in ${label}: ${reference}`); });
  if (url.hash && filename.endsWith('.html')) {
    const document = load(await readFile(filename, 'utf8'));
    const id = decodeURIComponent(url.hash.slice(1));
    assert(document('[id]').toArray().some(element => document(element).attr('id') === id), `Missing anchor in ${label}: ${reference}`);
  }
}

export async function checkOutput() {
  const files = await filesIn(OUTPUT);
  for (const required of OUTPUT_FILES) assert(files.includes(required), `Required output missing: ${required}`);
  let bytes = 0;
  for (const file of files) {
    assert(OUTPUT_FILES.has(file) || allowedAsset(file), `Unexpected output: ${file}. The publication allowlist must be deliberately reviewed.`);
    const stat = await lstat(path.join(OUTPUT, file)); bytes += stat.size;
    const limitMB = file === 'downloads/neural-populations.zip' ? 40 : 15;
    assert(stat.size <= limitMB * 1024 * 1024, `Oversized public asset (>${limitMB} MB): ${file}`);
    if (!/\.(?:html|css|js|svg|xml|txt)$/.test(file)) continue;
    const text = await readFile(path.join(OUTPUT, file), 'utf8');
    assert(!/(?:\/Users\/|\/home\/)[a-zA-Z0-9_-]+\//.test(text), `Local machine path in output: ${file}`);
    if (file.endsWith('.css')) {
      for (const match of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) await resolveLocal(match[1], file, file);
    }
    if (!file.endsWith('.html')) continue;
    const $ = load(text);
    assert($('html').attr('lang'), `Missing document language: ${file}`);
    assert($('title').text().trim(), `Missing title: ${file}`);
    const ids = $('[id]').toArray().map(element => $(element).attr('id'));
    assert.equal(new Set(ids).size, ids.length, `Duplicate element IDs: ${file}`);
    for (const element of $('a[href], img[src], script[src], link[href], iframe[src], source[src], video[poster], [data-src]').toArray()) {
      const tag = $(element);
      const reference = tag.attr('href') ?? tag.attr('src') ?? tag.attr('poster') ?? tag.attr('data-src');
      if (!reference) continue;
      assert(reference !== '#', `Placeholder link in ${file}`);
      await resolveLocal(reference, file, file);
    }
    for (const element of $('[srcset]').toArray()) {
      for (const item of $(element).attr('srcset').split(',')) {
        const reference = item.trim().split(/\s+/)[0];
        if (reference) await resolveLocal(reference, file, file);
      }
    }
    if (file === 'index.html') {
      assert.equal($('h1').length, 1, 'Homepage needs exactly one h1.');
      assert($('meta[name="description"]').attr('content')?.trim(), 'Homepage needs a description.');
      assert.equal($('link[rel="canonical"]').attr('href'), 'https://fluxsci.github.io/');
      for (const image of $('img').toArray()) assert($(image).attr('alt') !== undefined, 'Every homepage image needs alt text (empty for decoration).');
      for (const iframe of $('iframe').toArray()) assert($(iframe).attr('title')?.trim(), 'Every iframe needs a title.');
    }
  }
  assert(bytes <= 150 * 1024 * 1024, 'Site exceeds 150 MB publication budget.');
  const bundle = JSON.parse(await readFile(path.join(ROOT, 'media/project-bundle.json'), 'utf8'));
  const download = await readFile(path.join(OUTPUT, 'downloads/neural-populations.zip'));
  assert.equal(createHash('sha256').update(download).digest('hex'), bundle.sha256, 'Published project download differs from the verified bundle.');
  for (const manifestFile of ['media/native-assets.json', 'media/screenshots.json']) {
    const manifest = JSON.parse(await readFile(path.join(ROOT, manifestFile), 'utf8'));
    for (const [file, expected] of Object.entries(manifest.outputs)) {
      const published = await readFile(path.join(OUTPUT, file.slice(5)));
      assert.equal(createHash('sha256').update(published).digest('hex'), expected.sha256, `Published asset differs from reviewed provenance: ${file}. Rebuild the site.`);
    }
  }
  console.log(`Publication checks: ${files.length} approved files, ${(bytes / 1024 / 1024).toFixed(2)} MB; local links and metadata pass.`);
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await checkSource();
  await checkOutput();
}
