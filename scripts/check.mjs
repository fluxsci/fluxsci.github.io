import { readdir, readFile, lstat, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { load } from 'cheerio';
import { ROOT, SOURCE, OUTPUT, isInside } from './paths.mjs';
import {routes,ORIGIN} from './routes.mjs';

const PUBLIC_ASSET = /^(?:assets|demos)\/(?:[\w@().-]+\/)*[\w@().-]+\.(?:html|css|js|svg|png|webp|jpg|jpeg|avif|woff2?|ttf|mp4|webm|vtt)$/;
// The homepage film is an HLS ladder of fragmented-MP4 segments (playlists, init and media segments) with its own budget.
const FILM_ASSET = /^assets\/film\/(?:[\w-]+\/)?[\w.-]+\.(?:m3u8|m4s|mp4|webp|vtt)$/;
const FILM_BUDGET_MB = 600;
// Clips for the tour article (media/pitch.json): two sizes of each, about 6–16 MB a clip, 21 clips.
const CLIP_ASSET = /^assets\/media\/pitch\//;
const CLIP_BUDGET_MB = 320;
const SITE_BUDGET_MB = 150;
const SLIDE_PAYLOAD = /^demos\/slides\/slide_[a-z0-9_]+\.json\.gz$/;
const FONT_LICENSE = /^assets\/fonts\/(?:OFL|LICENSE)[\w.-]*\.txt$/;
const RUNTIME_LICENSE = /^assets\/licenses\/[\w.-]+\.txt$/;
const SOURCE_FILES = new Set([...routes.map(r=>r.source), '_quarto.yml', 'robots.txt','install.sh']);
const OUTPUT_FILES = new Set([...routes.map(r=>r.output),'robots.txt','sitemap.xml','.nojekyll','install.sh','search-index.json']);

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
  if (file.startsWith('assets/film/')) return FILM_ASSET.test(file);
  return (PUBLIC_ASSET.test(file) && (!file.endsWith('.html') || file.startsWith('demos/'))) || SLIDE_PAYLOAD.test(file) || FONT_LICENSE.test(file) || RUNTIME_LICENSE.test(file);
}

// Every published film file is recorded in media/film.json (bytes + SHA-256), produced by media/film/encode.mjs.
async function filmManifest() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'media/film.json'), 'utf8'));
  assert(Object.keys(manifest.outputs).length, 'media/film.json has no outputs.');
  for (const file of Object.keys(manifest.outputs)) assert(file.startsWith('site/assets/film/') && FILM_ASSET.test(file.slice(5)), `Invalid film output: ${file}`);
  return manifest;
}

export async function checkSource() {
  const files = await filesIn(SOURCE);
  for (const required of SOURCE_FILES) assert(files.includes(required), `Required source missing: site/${required}`);
  for (const file of files) assert(SOURCE_FILES.has(file) || file === '.gitignore' || allowedAsset(file), `Unexpected public source: site/${file}. Keep private plans, fixtures and provenance outside site/.`);
  const pin = JSON.parse(await readFile(path.join(ROOT, 'flux-source.json'), 'utf8'));
  assert(/^[a-f0-9]{40}$/.test(pin.revision), 'flux-source.json must pin a full commit hash.');
  assert.equal(pin.repository, 'https://github.com/fluxsci/flux.git');
  // An unaffected surface can be captured on an earlier reviewed build. Each still
  // and recording must resolve to an explicit capture revision. The native player
  // and the generated figure assets have their own exact source contracts.
  const captureRevisions = new Set([pin.revision, ...(pin.captureRevisions ?? [])]);
  for (const revision of captureRevisions) assert(/^[a-f0-9]{40}$/.test(revision), 'Invalid capture revision.');
  const stillManifests = new Set(['media/screenshots.json', 'media/docs-screenshots.json', 'media/feature-captures.json']);
  const release = { repository: pin.repository, revision: pin.revision, version: pin.version };
  const reviewedDocs = JSON.parse(await readFile(path.join(ROOT, 'media/documentation.json'), 'utf8'));
  assert.equal(reviewedDocs.sources[0].revision, pin.revision, 'The guide audit must identify the reviewed application source.');
  const publishedGuides = routes.filter(route => route.kind === 'guide').map(({source, url, title}) => ({source, url, title}));
  assert.deepEqual(reviewedDocs.guides, publishedGuides, 'Guide audit differs from the published routes.');
  const player = pin.slidePlayer;
  assert(/^[a-f0-9]{40}$/.test(player?.revision ?? ''), 'flux-source.json must pin the slide player to a full commit hash.');
  for (const patch of player.patches) assert.equal(createHash('sha256').update(await readFile(path.join(ROOT, patch.path))).digest('hex'), patch.sha256, `Slide player patch changed: ${patch.path}`);
  const recorded3d = JSON.parse(await readFile(path.join(ROOT, 'media/slide-3d-fallback.json'), 'utf8'));
  const recordedPayload = `demos/slides/${recorded3d.source.slideId}.json.gz`;
  assert(SLIDE_PAYLOAD.test(recordedPayload) && recorded3d.source.path === 'site/' + recordedPayload);
  assert.equal(recorded3d.source.revision, player.revision, '3D motion uses a different player revision.');
  const compressed = await readFile(path.join(SOURCE, recordedPayload));
  assert.equal(createHash('sha256').update(compressed).digest('hex'), recorded3d.source.sha256, 'Recapture 3D motion for the current slide.');
  const [slide] = JSON.parse(gunzipSync(compressed)).deck.slides;
  const recordedDirectory = 'demos/slides/3d-fallback/';
  const recordedPaths = slide.beats.slice(1).flatMap((_, i) => ['forward', 'reverse'].map(direction =>
    recordedDirectory + `step-${i + 1}-${direction}.mp4`)).sort();
  assert.deepEqual(files.filter(file => file.startsWith(recordedDirectory)).sort(), recordedPaths);
  assert.deepEqual(Object.keys(recorded3d.outputs).sort(), recordedPaths.map(file => 'site/' + file));
  for (const file of recordedPaths) {
    const bytes = await readFile(path.join(SOURCE, file));
    const expected = recorded3d.outputs['site/' + file];
    assert.equal(bytes.length, expected.bytes, `3D recording size changed: ${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `3D recording changed: ${file}`);
  }
  const playerSource = { repository: pin.repository, revision: player.revision, patches: player.patches.map(({ path, sha256 }) => ({ path, sha256 })) };
  for (const [manifestFile, expected] of [['media/native-assets.json', release], ['media/screenshots.json', release], ['media/docs-demos.json', release], ['media/docs-screenshots.json', release], ['media/feature-captures.json', release], ['media/slides.json', playerSource]]) {
    const manifest = JSON.parse(await readFile(path.join(ROOT, manifestFile), 'utf8'));
    const still = stillManifests.has(manifestFile);
    if (!still) assert.deepEqual(manifest.source, expected, `${manifestFile} does not match the pinned Flux source.`);
    assert(Object.keys(manifest.outputs).length, `${manifestFile} has no output provenance.`);
    for (const [file, expected] of Object.entries(manifest.outputs)) {
      if (still) {
        const source = expected.source ?? manifest.source;
        assert(source && source.repository === pin.repository && source.version === pin.version &&
          captureRevisions.has(source.revision), `Unreviewed screenshot source for ${file}`);
      }
      assert(file.startsWith('site/') && isInside(SOURCE, path.resolve(ROOT, file)), `Invalid asset provenance path: ${file}`);
      assert(allowedAsset(file.slice(5)), `Provenance references an unapproved public asset: ${file}`);
      const bytes = await readFile(path.join(ROOT, file));
      assert.equal(bytes.length, expected.bytes, `Asset size changed; refresh provenance for ${file}`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Asset hash changed; refresh provenance for ${file}`);
    }
  }
  // Illustrative plots drawn with fluxplot for the guides: bytes and hashes are recorded in media/docs-plots.json.
  const drawings = JSON.parse(await readFile(path.join(ROOT, 'media/docs-plots.json'), 'utf8'));
  assert(drawings.source?.fluxplot && Object.keys(drawings.outputs).length, 'media/docs-plots.json must record the fluxplot version and its outputs.');
  for (const [file, expected] of Object.entries(drawings.outputs)) {
    assert(file.startsWith('site/') && allowedAsset(file.slice(5)), `Provenance references an unapproved public asset: ${file}`);
    const bytes = await readFile(path.join(ROOT, file));
    assert.equal(bytes.length, expected.bytes, `Drawing changed; refresh provenance for ${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Drawing hash changed; refresh provenance for ${file}`);
  }
  // Clips for the pitch article, filmed in the real app by media/pitch/make.mjs.
  const pitch = JSON.parse(await readFile(path.join(ROOT, 'media/pitch.json'), 'utf8'));
  assert.deepEqual(files.filter(file => file.startsWith('assets/media/pitch/')).map(file => `site/${file}`).sort(), Object.keys(pitch.outputs).sort(), 'site/assets/media/pitch differs from media/pitch.json; re-run media/pitch/make.mjs.');
  for (const [file, expected] of Object.entries(pitch.outputs)) {
    const bytes = await readFile(path.join(ROOT, file));
    assert.equal(bytes.length, expected.bytes, `Pitch clip size changed: ${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Pitch clip hash changed: ${file}`);
  }
  const guideClips = JSON.parse(await readFile(path.join(ROOT, 'media/docs-clips.json'), 'utf8'));
  const clipDirectory = 'site/assets/media/docs/clips/';
  const guideFiles = Object.keys(guideClips.outputs).sort();
  assert.deepEqual(files.filter(file => file.startsWith(clipDirectory.slice(5))).map(file => `site/${file}`).sort(), guideFiles, 'Guide clip files differ from media/docs-clips.json.');
  const expectedGuideFiles = Object.entries(guideClips.takes).flatMap(([name, take]) => {
    assert(/^[a-z][a-z0-9-]*$/.test(name), `Invalid guide clip name: ${name}`);
    assert(take.window.scale === 4 && take.width === 1920 && take.height === 1080, `Guide clip must be a 1920×1080 encode from a 4× window: ${name}`);
    assert(captureRevisions.has(take.flux.revision) && !take.flux.dirty, `Guide clip needs clean production build provenance: ${name}`);
    assert(Number.isFinite(take.seconds) && take.seconds >= 12, `Guide clip must run for at least 12 seconds: ${name}`);
    return ['.mp4', '-1280.mp4', '.webp'].map(suffix => clipDirectory + name + suffix);
  }).sort();
  assert.deepEqual(guideFiles, expectedGuideFiles, 'Each guide clip needs both video sizes and a poster.');
  for (const [file, expected] of Object.entries(guideClips.outputs)) {
    const bytes = await readFile(path.join(ROOT, file));
    assert.equal(bytes.length, expected.bytes, `Guide clip size changed: ${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Guide clip hash changed: ${file}`);
  }
  const film = await filmManifest();
  const filmFiles = files.filter(file => file.startsWith('assets/film/')).map(file => `site/${file}`);
  assert.deepEqual(filmFiles.sort(), Object.keys(film.outputs).sort(), 'site/assets/film differs from media/film.json; re-run media/film/encode.mjs.');
  for (const [file, expected] of Object.entries(film.outputs)) {
    const bytes = await readFile(path.join(ROOT, file));
    assert.equal(bytes.length, expected.bytes, `Film file size changed: ${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `Film file hash changed: ${file}`);
  }
  const installer=JSON.parse(await readFile(path.join(ROOT,'media/installer.json'),'utf8'));
  assert.equal(createHash('sha256').update(await readFile(path.join(SOURCE,'install.sh'))).digest('hex'),installer.sha256,'Installer differs from reviewed upstream script');
  return files;
}

async function resolveLocal(reference, from, label) {
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(reference)) return;
  assert(!/^[a-z]+:/i.test(reference), `Unsupported URL in ${label}: ${reference}`);
  const url = new URL(reference, `https://fluxsci.org/${from}`);
  if (url.origin !== 'https://fluxsci.org') return;
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
  let bytes = 0, filmBytes = 0, clipBytes = 0;
  for (const file of files) {
    assert(OUTPUT_FILES.has(file) || allowedAsset(file), `Unexpected output: ${file}. The publication allowlist must be deliberately reviewed.`);
    const stat = await lstat(path.join(OUTPUT, file));
    if (file.startsWith('assets/film/')) filmBytes += stat.size; else if (CLIP_ASSET.test(file)) clipBytes += stat.size; else bytes += stat.size;
    const limitMB = 15;
    assert(stat.size <= limitMB * 1024 * 1024, `Oversized public asset (>${limitMB} MB): ${file}`);
    if (SLIDE_PAYLOAD.test(file)) {
      const data = gunzipSync(await readFile(path.join(OUTPUT, file))).toString('utf8');
      assert(!/(?:file:\/\/|\/(?:Users|home)\/[\w.-]+\/)/i.test(data), `Local file path in slide: ${file}`);
      const slides = JSON.parse(data).deck.slides;
      assert.equal(slides.length, 1, `Expected one public slide in ${file}`);
      assert.equal(path.basename(file), slides[0].id + '.json.gz', `Unexpected slide in ${file}`);
      assert(!slides[0].notes && !slides[0].speakerNotes, `Private presenter notes in ${file}`);
    }
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
    if (routes.some(r=>r.output===file)) {
      assert.equal($('h1').length, 1, `${file} needs exactly one h1.`);
      assert($('meta[name="description"]').attr('content')?.trim(), `${file} needs a description.`);
      assert.equal($('link[rel="canonical"]').attr('href'),ORIGIN+routes.find(r=>r.output===file).url);
      for (const image of $('img').toArray()) assert($(image).attr('alt') !== undefined, `Every image in ${file} needs alt text (empty for decoration).`);
      for (const iframe of $('iframe').toArray()) assert($(iframe).attr('title')?.trim(), 'Every iframe needs a title.');
    }
  }
  const installer = JSON.parse(await readFile(path.join(ROOT,'media/installer.json'),'utf8'));
  assert.equal(createHash('sha256').update(await readFile(path.join(OUTPUT,'install.sh'))).digest('hex'),installer.sha256,'Published installer differs from reviewed upstream script');
  assert(bytes <= SITE_BUDGET_MB * 1024 * 1024, `Site exceeds ${SITE_BUDGET_MB} MB publication budget.`);
  assert(filmBytes <= FILM_BUDGET_MB * 1024 * 1024, `The film exceeds its ${FILM_BUDGET_MB} MB budget.`);
  assert(clipBytes <= CLIP_BUDGET_MB * 1024 * 1024, `The article clips exceed their ${CLIP_BUDGET_MB} MB budget.`);
  for (const [file, expected] of Object.entries((await filmManifest()).outputs)) {
    const published = await readFile(path.join(OUTPUT, file.slice(5)));
    assert.equal(createHash('sha256').update(published).digest('hex'), expected.sha256, `Published film file differs from media/film.json: ${file}. Rebuild the site.`);
  }
  for (const manifestFile of ['media/native-assets.json', 'media/screenshots.json', 'media/docs-demos.json', 'media/docs-screenshots.json', 'media/feature-captures.json', 'media/docs-plots.json', 'media/slides.json', 'media/pitch.json', 'media/docs-clips.json']) {
    const manifest = JSON.parse(await readFile(path.join(ROOT, manifestFile), 'utf8'));
    for (const [file, expected] of Object.entries(manifest.outputs)) {
      const published = await readFile(path.join(OUTPUT, file.slice(5)));
      assert.equal(createHash('sha256').update(published).digest('hex'), expected.sha256, `Published asset differs from reviewed provenance: ${file}. Rebuild the site.`);
    }
  }
  console.log(`Publication checks: ${files.length} approved files, ${(bytes / 1024 / 1024).toFixed(2)} MB site + ${(clipBytes / 1024 / 1024).toFixed(2)} MB clips + ${(filmBytes / 1024 / 1024).toFixed(2)} MB film; local links and metadata pass.`);
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await checkSource();
  await checkOutput();
}
