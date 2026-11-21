// Capture the published 3D slide with Flux's native sampler. This needs the pinned Flux
// source with its generated slide/model runtimes, Playwright Chromium and FFmpeg.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const arg = process.argv.indexOf('--flux-source');
if (arg < 0 || !process.argv[arg + 1]) throw new Error('Pass --flux-source /path/to/pinned/flux');
const source = path.resolve(process.argv[arg + 1]);
const pin = JSON.parse(await fs.readFile(path.join(root, 'flux-source.json'), 'utf8')).slidePlayer;
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== pin.revision) throw new Error('Unpinned Flux source');
const actualDiff = execFileSync('git', ['-C', source, 'diff', 'HEAD', '--', 'src', 'flux-core', 'scripts', 'package.json', 'package-lock.json'], { encoding: 'utf8' });
if (actualDiff) throw new Error('Use the clean pinned Flux checkout to capture 3D frames');

const output = 'site/demos/slides/3d-fallback';
const input = 'site/demos/slides/slide_muz2tp5izb92_249.json.gz';
const payloadBytes = await fs.readFile(path.join(root, input));
const payload = JSON.parse(gunzipSync(payloadBytes));
const slide = payload.deck.slides[0];
if (slide.beats.length !== 3 || !slide.elements.some(e => e.type === 'model3d')) throw new Error('Unexpected 3D slide');
const { build } = await import(pathToFileURL(path.join(source, 'node_modules/esbuild/lib/main.js')).href);
const generated = file => fs.readFile(path.join(source, '.generated', file), 'utf8').then(JSON.parse);
const [{ fonts }, { runtime }] = await Promise.all([
  generated('slide-embed-assets.json'), generated('slide-embed-model3d-assets.json')
]);
const width = 1280;
const height = 720;
const fps = 30;
const bundle = await build({
  stdin: { resolveDir: source, contents: `
    import {createPlayer} from './src/lib/slide/player/player';
    import {embedPlayerOptions} from './src/lib/slide/embedRender';
    import {payloadModelHost,payloadModelContext} from './src/lib/slide/export/model3dPayloadHost';
    window.startCapture = async payload => {
      const model3d = payloadModelHost(payload);
      if (!model3d) throw Error('Capture needs WebGL2');
      const host = document.getElementById('capture');
      const scale = ${height} / payload.deck.stage.height;
      host.style.transform = 'scale(' + scale + ')';
      await document.fonts.ready;
      const player = createPlayer(host, payload.deck, {
        ...embedPlayerOptions(payload), ...payloadModelContext(payload), model3d, captureMode: true, pixelScale: scale
      });
      await player.readyMedia();
      if (player.state().issues.length) throw Error(JSON.stringify(player.state().issues));
      window.capture = async (beat, time) => {
        player.seek(0, beat, time);
        await player.settleRaster();
        await player.captureMedia([], time);
        const visible = node => {
          for (let element = node; element; element = element.parentElement) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          }
          return true;
        };
        const liveCanvases = [...host.querySelectorAll('canvas[data-slide-model3d]')].filter(visible);
        const placeholders = [...host.querySelectorAll('[data-model3d-placeholder]')].filter(visible);
        if (liveCanvases.length < 2 || placeholders.length) {
          throw Error('Native 3D frame unavailable in step ' + beat + ' at ' + time + 'ms (' +
            liveCanvases.length + ' live canvases, ' + placeholders.length + ' placeholders)');
        }
      };
      return player.beatDurations();
    };
  ` },
  define: { 'import.meta.env.DEV': 'false' },
  bundle: true, platform: 'browser', format: 'iife', target: 'es2022', write: false
});

const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'flux-site-3d-'));
let browser;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const files = {};
try {
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<!doctype html><style>${fonts}body{margin:0;overflow:hidden;background:#000}#capture{transform-origin:0 0}</style><main id="capture"></main>`);
  await page.addScriptTag({ content: runtime });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const durations = await page.evaluate(payload => window.startCapture(payload), payload);
  for (const beat of [1, 2]) {
    const sampleCount = Math.round(durations[beat] * fps / 1000);
    if (!sampleCount) throw new Error(`No motion in step ${beat}`);
    const frames = path.join(scratch, String(beat));
    await fs.mkdir(frames);
    for (let frame = 0; frame <= sampleCount; frame++) {
      // Use exact localized endpoints. The start is the preceding settled view.
      await page.evaluate(([beat, frame, ms]) => window.capture(frame === 0 ? beat - 1 : beat, frame === 0 ? Infinity : ms),
        [beat, frame, frame * durations[beat] / sampleCount]);
      await page.screenshot({ path: path.join(frames, `${String(frame).padStart(3, '0')}.png`) });
    }
    for (const direction of ['forward', 'reverse']) {
      const rel = `${output}/step-${beat}-${direction}.mp4`;
      const staged = path.join(scratch, path.basename(rel));
      const filter = direction === 'reverse' ? ['-vf', 'reverse'] : [];
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-framerate', String(fps),
        '-i', path.join(frames, '%03d.png'), ...filter, '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-threads', '2', '-movflags', '+faststart', staged], { stdio: 'inherit' });
      const bytes = await fs.readFile(staged);
      files[rel] = { bytes: bytes.length, sha256: sha256(bytes) };
    }
    console.log(`Captured native 3D step ${beat} (${sampleCount + 1} frames)`);
  }
  const manifest = { source: { revision, slideId: slide.id, path: input, sha256: sha256(payloadBytes) },
    capture: { width, height, fps, sampler: 'Flux createPlayer in captureMode, using SwiftShader', durations }, outputs: files };
  await fs.mkdir(path.join(root, output), { recursive: true });
  await Promise.all(Object.keys(files).map(rel => fs.copyFile(path.join(scratch, path.basename(rel)), path.join(root, rel))));
  await fs.writeFile(path.join(root, 'media/slide-3d-fallback.json'), JSON.stringify(manifest, null, 2) + '\n');
} finally {
  await browser?.close();
  await fs.rm(scratch, { recursive: true, force: true });
}
