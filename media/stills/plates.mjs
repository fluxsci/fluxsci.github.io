/** Rasterize the reviewed native SVG exports at twice the published display size. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {FIGURE_ID, MATERIALS_ID} from '../showcase.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [project = path.join(root, '.cache/visual-project'), folder = path.join(root, '.cache/review/stills/plates')] = process.argv.slice(2);
const native = JSON.parse(await fs.readFile(path.join(root, 'media/native-assets.json'), 'utf8'));
const pin = JSON.parse(await fs.readFile(path.join(root, 'flux-source.json'), 'utf8'));
const source = {repository: pin.repository, revision: pin.revision, version: pin.version};
assert.deepEqual(native.source, source);
await fs.mkdir(folder, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const outputs = {}, manifestFor = {};
const browser = await chromium.launch();
try {
  for (const [id, name] of [[FIGURE_ID, 'response-figure'], [MATERIALS_ID, 'materials-figure']]) {
    const svg = await fs.readFile(path.join(project, 'fig/renders', id + '.svg'));
    const viewBox = svg.toString('utf8', 0, 400).match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
    assert(viewBox, 'Native figure export has no viewBox');
    const width = 1800, height = Math.ceil(width * Number(viewBox[2]) / Number(viewBox[1]));
    const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 2});
    await page.setContent(`<body style="margin:0;background:white"><img alt="" style="display:block;width:100%" src="data:image/svg+xml;base64,${svg.toString('base64')}"></body>`);
    await page.evaluate(() => document.images[0].decode());
    const png = path.join(folder, name + '.png');
    await page.screenshot({path: png});
    await page.close();
    const webp = path.join(folder, name + '.webp');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '96', webp]);
    const bytes = await fs.readFile(webp);
    const rel = `site/assets/media/${name}.webp`;
    outputs[rel] = {width, height, bytes: bytes.length, sha256: sha(bytes), captureKind: 'native-figure-plate', svgSha256: sha(svg)};
    manifestFor[rel] = 'screenshots';
  }
  await fs.writeFile(path.join(folder, 'captures.json'), JSON.stringify({source, outputs, manifestFor}, null, 2) + '\n');
} finally {
  await browser.close();
}
