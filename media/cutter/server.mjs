#!/usr/bin/env node
/**
 * Clip cutter: a local editor for short social-media cuts of the website's clips.
 *
 *   node media/cutter/server.mjs [--port 1436] [--out ~/Videos/flux-cuts]      (or: npm run cut)
 *
 * Pick a clip from the visual tour, scrub it, drag a range on its filmstrip, add the range to the
 * sequence, repeat, then export the sequence as one MP4. Exports are re-encoded with ffmpeg from the
 * published 1920x1440 clips, frame-accurately. Editing plays scrub proxies (1280 wide, a keyframe
 * every 8 frames, so seeking is instant) made once per clip in tmp/cutter/, which is gitignored.
 *
 * Local only: binds 127.0.0.1, is never published, and writes nothing under site/.
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
const PORT = Number(opt('port', 1436));
const OUT = path.resolve(opt('out', path.join(os.homedir(), 'Videos', 'flux-cuts')).replace(/^~(?=$|\/)/, os.homedir()));
const ASSETS = path.join(ROOT, 'site', 'assets');
const MEDIA = path.join(ASSETS, 'media');
const FILM = path.join(ASSETS, 'film', '2160p');   // the homepage film's 4K60 rendition (HLS)
const CACHE = path.join(ROOT, 'tmp', 'cutter');
const TILE_W = 160;   // filmstrip tiles: one per half second, 60 to 400 per clip
const SIZES = ['1920x1440', '1440x1080', '1280x960', '960x720', '3840x2160', '2560x1440', '1920x1080', '1280x720'];
const LEGACY_SIZES = { 1920: '1920x1440', 1440: '1440x1080', 1280: '1280x960', 960: '960x720' };
// "auto": 1080 tall, in the shape of the first segment (1440x1080 for a tour clip, 1920x1080 for the film).
function outputSize(value, first) {
  value = LEGACY_SIZES[value] || String(value || 'auto');
  if (SIZES.includes(value)) return value.split('x').map(Number);
  return [Math.round(1080 * first.width / first.height / 2) * 2, 1080];
}
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const PREP_AT_ONCE = Math.max(1, Math.min(4, Math.floor(os.availableParallelism() / 8)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8' };

// ---------------------------------------------------------------- helpers

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err = (err + d).slice(-8000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`)));
  });
}

const decode = html => html.replace(/<[^>]+>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

const exists = file => fsp.access(file).then(() => true, () => false);

async function probe(file) {
  const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', file]));
  const s = j.streams[0];
  const [n, d] = s.r_frame_rate.split('/').map(Number);
  const fps = n / d;
  const frames = Number(s.nb_frames) || Math.round(Number(j.format.duration) * fps);
  return { width: s.width, height: s.height, fps, frames, duration: frames / fps };
}

// ---------------------------------------------------------------- the clip catalogue

const clips = new Map();   // id -> clip
let groups = [];           // [{ chapter, title, ids }]

// The film is published as HLS (video and sound in 4 s fragments). Its 4K picture is remuxed once, without
// re-encoding and without the sound, into one MP4 that can be seeked and cut like any clip.
async function loadFilm() {
  const index = path.join(FILM, 'index.m3u8');
  if (!(await exists(index))) return null;
  const [st, init] = await Promise.all([fsp.stat(index), fsp.stat(path.join(FILM, 'init.mp4'))]);
  const file = path.join(CACHE, `film-src-${init.size}-${Math.floor(st.mtimeMs)}.mp4`);
  if (!(await exists(file))) {
    await fsp.mkdir(CACHE, { recursive: true });
    console.log('  copying the film\'s 4K picture (no sound) into tmp/cutter/ …');
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', index, '-map', '0:v:0', '-c', 'copy', '-an', '-movflags', '+faststart', `${file}.part.mp4`]);
    await fsp.rename(`${file}.part.mp4`, file);
  }
  return file;
}

async function loadCatalog() {
  const filmFile = await loadFilm();
  if (filmFile) {
    clips.set('film', { id: 'film', file: filmFile, src: `/cache/${path.basename(filmFile)}`, poster: '/assets/film/poster.webp',
      caption: 'The Flux film from the homepage, without its soundtrack (the 3840x2160 60 fps rendition).',
      description: '', flux: null, source: 'site/assets/film/2160p (video only)' });
    groups.push({ chapter: 'Homepage', title: 'The Flux film', ids: ['film'] });
  }
  const pitch = JSON.parse(await fsp.readFile(path.join(ROOT, 'media', 'pitch.json'), 'utf8'));
  const qmd = await fsp.readFile(path.join(ROOT, 'site', 'visual-tour', 'index.qmd'), 'utf8');
  const found = [];
  const label = (title, attrs) => /nav="([^"]+)"/.exec(attrs || '')?.[1] || title;
  let chapter = 'Visual tour', group = null;
  for (const line of qmd.split('\n')) {
    const h = /^(#{2,3})\s+(.+?)\s*(\{[^}]*\})?\s*$/.exec(line);
    if (h) {
      if (h[1] === '##') { chapter = label(h[2], h[3]); group = null; }
      else { group = { chapter, title: label(h[2], h[3]), ids: [] }; groups.push(group); }
      continue;
    }
    for (const fig of line.matchAll(/<figure class="[^"]*article-clip[^"]*">([\s\S]*?)<\/figure>/g)) {
      const sources = [...fig[1].matchAll(/<source src="\/assets\/media\/([^"]+\.mp4)"/g)].map(m => m[1]);
      const rel = sources.find(s => !/-1280\.mp4$/.test(s)) || sources[0];
      if (!rel) continue;
      if (!group) { group = { chapter, title: chapter, ids: [] }; groups.push(group); }
      const id = path.basename(rel, '.mp4');
      if (clips.has(id)) continue;
      const poster = /poster="\/assets\/media\/([^"]+)"/.exec(fig[1])?.[1];
      clips.set(id, { id, rel, poster: poster ? `/media/${poster}` : null,
        caption: decode(/<figcaption>([\s\S]*?)<\/figcaption>/.exec(fig[1])?.[1] || ''),
        description: decode(/aria-label="([^"]*)"/.exec(fig[1])?.[1] || ''),
        flux: pitch.takes?.[id]?.flux?.revision || null });
      group.ids.push(id);
    }
  }
  // The guides' clips, after the tour's.
  const guideDir = path.join(MEDIA, 'docs', 'clips');
  const guideFiles = (await fsp.readdir(guideDir).catch(() => [])).filter(f => f.endsWith('.mp4') && !f.endsWith('-1280.mp4')).sort();
  if (guideFiles.length) {
    const g = { chapter: 'Guides', title: 'Guide clips', ids: [] };
    for (const f of guideFiles) {
      const base = path.basename(f, '.mp4'), id = `guide-${base}`;
      const poster = await exists(path.join(guideDir, `${base}.webp`)) ? `/media/docs/clips/${base}.webp` : null;
      clips.set(id, { id, rel: `docs/clips/${f}`, poster, caption: `Guide clip: ${base.replace(/-/g, ' ')}`, description: '', flux: null });
      g.ids.push(id);
    }
    groups.push(g);
  }
  groups = groups.filter(g => g.ids.length);
  await Promise.all([...clips.values()].map(async clip => {
    clip.file ??= path.join(MEDIA, clip.rel);
    clip.src ??= `/media/${clip.rel}`;
    clip.source ??= `site/assets/media/${clip.rel}`;
    const st = await fsp.stat(clip.file);
    Object.assign(clip, await probe(clip.file), { bytes: st.size, mtimeMs: st.mtimeMs });
    const tileH = Math.round(TILE_W * clip.height / clip.width / 2) * 2;
    clip.strip = { tiles: clamp(Math.round(clip.duration * 2), 60, 400), w: TILE_W, h: tileH };
    const key = `${clip.id}-${clip.bytes}-${Math.floor(clip.mtimeMs)}-t${clip.strip.tiles}-p2`;
    clip.proxyFile = path.join(CACHE, `${key}.mp4`);
    clip.stripFile = path.join(CACHE, `${key}.jpg`);
    clip.state = (await exists(clip.proxyFile)) && (await exists(clip.stripFile)) ? 'ready' : 'idle';
    clip.waiters = [];
  }));
}

const publicClip = c => ({ id: c.id, caption: c.caption, description: c.description, src: c.src, poster: c.poster,
  width: c.width, height: c.height, fps: c.fps, frames: c.frames, duration: c.duration, strip: c.strip, state: c.state,
  proxy: c.state === 'ready' ? `/cache/${path.basename(c.proxyFile)}` : null,
  stripUrl: c.state === 'ready' ? `/cache/${path.basename(c.stripFile)}` : null });

// ---------------------------------------------------------------- scrub proxies + filmstrips (one decode each)

const queue = [];
let active = 0;

function schedule(clip, urgent = false) {
  if (clip.state === 'ready' || clip.state === 'running') return;
  const at = queue.indexOf(clip);
  if (at >= 0) { if (urgent) { queue.splice(at, 1); queue.unshift(clip); } return; }
  clip.state = 'queued';
  urgent ? queue.unshift(clip) : queue.push(clip);
  pump();
}

function pump() {
  while (active < PREP_AT_ONCE && queue.length) {
    const clip = queue.shift();
    active++;
    clip.state = 'running';
    makeProxy(clip).then(() => { clip.state = 'ready'; }, err => { clip.state = 'error'; clip.error = err.message; console.error(`proxy ${clip.id}: ${err.message}`); })
      .finally(() => { active--; for (const wake of clip.waiters.splice(0)) wake(); pump(); });
  }
}

async function makeProxy(clip) {
  await fsp.mkdir(CACHE, { recursive: true });
  const partProxy = `${clip.proxyFile}.part.mp4`, partStrip = `${clip.stripFile}.part.jpg`;
  const rate = (clip.strip.tiles / clip.duration).toFixed(6);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', clip.file, '-filter_complex',
    `[0:v]split=2[a][b];[a]scale=1280:-2:flags=bicubic,format=yuv420p[p];` +
    `[b]fps=${rate},scale=${clip.strip.w}:${clip.strip.h}:flags=bicubic,tile=${clip.strip.tiles}x1[s]`,
    '-map', '[p]', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'fastdecode', '-crf', '23',
    '-g', '8', '-keyint_min', '8', '-bf', '0', '-sc_threshold', '0', '-movflags', '+faststart', '-an', partProxy,
    '-map', '[s]', '-frames:v', '1', '-update', '1', '-q:v', '4', partStrip]);
  await fsp.rename(partProxy, clip.proxyFile);
  await fsp.rename(partStrip, clip.stripFile);
  // Older proxies of the same clip (from before it was re-filmed) are stale.
  const keep = new Set([path.basename(clip.proxyFile), path.basename(clip.stripFile)]);
  for (const f of await fsp.readdir(CACHE)) {
    if (f.startsWith(`${clip.id}-`) && /^\d/.test(f.slice(clip.id.length + 1)) && !keep.has(f)) await fsp.rm(path.join(CACHE, f), { force: true });
  }
}

const settled = clip => clip.state === 'ready' || clip.state === 'error' ? Promise.resolve() : new Promise(r => clip.waiters.push(r));

// ---------------------------------------------------------------- export

const jobs = new Map();
let jobCount = 0;

async function uniqueName(base) {
  for (let i = 1; ; i++) {
    const name = i === 1 ? base : `${base}-${i}`;
    if (!(await exists(path.join(OUT, `${name}.mp4`)))) return name;
  }
}

async function startExport(body) {
  if (!Array.isArray(body.segments) || !body.segments.length) throw new Error('The sequence is empty.');
  if (body.segments.length > 200) throw new Error('Too many segments.');
  const segs = body.segments.map((s, i) => {
    const clip = clips.get(String(s.id));
    if (!clip) throw new Error(`Segment ${i + 1}: unknown clip ${s.id}.`);
    const f = clip.fps;
    const a = clamp(Math.round(Number(s.in) * f), 0, clip.frames - 1), b = clamp(Math.round(Number(s.out) * f), a + 1, clip.frames);
    const speed = SPEEDS.includes(Number(s.speed)) ? Number(s.speed) : 1;
    return { clip, inFrame: a, outFrame: b, in: a / f, out: b / f, speed, len: (b - a) / f / speed };
  });
  const [W, H] = outputSize(body.size, segs[0].clip);
  const fps = Number(body.fps) === 30 ? 30 : 60;
  let fade = body.transition === 'fade' && segs.length > 1 ? clamp(Number(body.fade) || 0.25, 1 / fps, 2) : 0;
  if (fade) fade = Math.min(fade, Math.min(...segs.map(s => s.len)) / 2);
  const total = segs.reduce((t, s) => t + s.len, 0) - fade * (segs.length - 1);

  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const base = String(body.name || '').trim().replace(/\.mp4$/i, '').replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80) || `flux-cut-${stamp}`;
  await fsp.mkdir(OUT, { recursive: true });
  const name = await uniqueName(base);
  const file = path.join(OUT, `${name}.mp4`), part = path.join(OUT, `.${name}.part.mp4`);

  // Input seeking, half a frame early, so the trim lands between frames: frame `in` is the first one
  // kept and frame `out - 1` the last.
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1'];
  for (const s of segs) {
    const half = 0.5 / s.clip.fps, from = Math.max(0, s.in - half);
    args.push('-ss', from.toFixed(5), '-t', (s.out - half - from).toFixed(5), '-i', s.clip.file);
  }
  const graph = segs.map((s, i) =>
    `[${i}:v]setpts=(PTS-STARTPTS)/${s.speed},fps=${fps},` +
    `scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x100F0F,setsar=1,format=yuv420p[v${i}]`);
  let last = 'v0';
  if (segs.length > 1 && !fade) {
    graph.push(`${segs.map((_, i) => `[v${i}]`).join('')}concat=n=${segs.length}:v=1:a=0[vc]`);
    last = 'vc';
  } else if (segs.length > 1) {
    let length = segs[0].len;
    for (let i = 1; i < segs.length; i++) {
      graph.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade.toFixed(5)}:offset=${(length - fade).toFixed(5)}[x${i}]`);
      last = `x${i}`;
      length += segs[i].len - fade;
    }
  }
  args.push('-filter_complex', graph.join(';'), '-map', `[${last}]`, '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', part);

  const job = { id: String(++jobCount), state: 'running', progress: 0, name, file, total, error: null };
  jobs.set(job.id, job);
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  job.child = child;
  let err = '';
  child.stdout.on('data', d => {
    for (const m of String(d).matchAll(/out_time_us=(\d+)/g)) job.progress = clamp(Number(m[1]) / 1e6 / total, 0, 0.999);
  });
  child.stderr.on('data', d => { err = (err + d).slice(-8000); });
  child.on('close', async code => {
    job.child = null;
    if (job.state === 'cancelled') { await fsp.rm(part, { force: true }); return; }
    if (code !== 0) { job.state = 'error'; job.error = err.trim().split('\n').slice(-4).join('\n') || `ffmpeg exited ${code}`; await fsp.rm(part, { force: true }); return; }
    await fsp.rename(part, file);
    const recipe = { created: new Date().toISOString(), tool: 'fluxsci.github.io/media/cutter', size: [W, H], fps,
      transition: fade ? { type: 'fade', seconds: Number(fade.toFixed(4)) } : { type: 'cut' }, duration: Number(total.toFixed(4)),
      segments: segs.map(s => ({ clip: s.clip.id, source: s.clip.source, in: Number(s.in.toFixed(5)), out: Number(s.out.toFixed(5)),
        frames: [s.inFrame, s.outFrame], speed: s.speed, flux: s.clip.flux })) };
    await fsp.writeFile(path.join(OUT, `${name}.json`), `${JSON.stringify(recipe, null, 2)}\n`);
    job.bytes = (await fsp.stat(file)).size;
    job.progress = 1;
    job.state = 'done';
  });
  return job;
}

const publicJob = j => ({ id: j.id, state: j.state, progress: j.progress, name: j.name, path: j.file, bytes: j.bytes ?? null,
  duration: j.total, error: j.error, url: j.state === 'done' ? `/out/${encodeURIComponent(j.name)}.mp4` : null });

async function listExports() {
  const files = (await fsp.readdir(OUT).catch(() => [])).filter(f => f.endsWith('.mp4') && !f.startsWith('.'));
  const list = await Promise.all(files.map(async f => {
    const name = f.slice(0, -4), st = await fsp.stat(path.join(OUT, f));
    const recipe = await fsp.readFile(path.join(OUT, `${name}.json`), 'utf8').then(JSON.parse, () => null);
    return { name, path: path.join(OUT, f), url: `/out/${encodeURIComponent(f)}`, bytes: st.size, mtime: st.mtimeMs, recipe };
  }));
  return list.sort((a, b) => b.mtime - a.mtime);
}

// ---------------------------------------------------------------- http

async function sendFile(req, res, file, cacheControl = 'no-cache') {
  let st;
  try { st = await fsp.stat(file); } catch { return send(res, 404, { error: 'Not found' }); }
  if (!st.isFile()) return send(res, 404, { error: 'Not found' });
  const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': cacheControl };
  let start = 0, end = st.size - 1, status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    if (range[1] === '') start = Math.max(0, st.size - Number(range[2]));
    else { start = Number(range[1]); if (range[2] !== '') end = Math.min(end, Number(range[2])); }
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', d => { data += d; if (data.length > 1e6) { reject(new Error('Body too large.')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Invalid JSON.')); } });
  });
}

const within = (dir, rel) => { const p = path.resolve(dir, rel); return p.startsWith(dir + path.sep) ? p : null; };

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(url.pathname);
  const isPost = req.method === 'POST';
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (p === '/') return sendFile(req, res, path.join(HERE, 'index.html'));
    if (p === '/app.js' || p === '/app.css') return sendFile(req, res, path.join(HERE, p.slice(1)));
    if (p === '/api/clips') return send(res, 200, { out: OUT, groups: groups.map(g => ({ chapter: g.chapter, title: g.title, clips: g.ids.map(id => publicClip(clips.get(id))) })) });
    if (p === '/api/status') return send(res, 200, { clips: Object.fromEntries([...clips.values()].map(c => [c.id, publicClip(c)])) });
    if (p === '/api/exports') return send(res, 200, { out: OUT, exports: await listExports() });
    let m;
    if ((m = /^\/api\/export\/(\d+)$/.exec(p))) { const job = jobs.get(m[1]); return job ? send(res, 200, publicJob(job)) : send(res, 404, { error: 'No such export.' }); }
    if (p.startsWith('/media/')) { const f = within(MEDIA, p.slice(7)); return f ? sendFile(req, res, f) : send(res, 404, { error: 'Not found' }); }
    if (p.startsWith('/assets/')) { const f = within(ASSETS, p.slice(8)); return f ? sendFile(req, res, f) : send(res, 404, { error: 'Not found' }); }
    if (p.startsWith('/cache/')) { const f = within(CACHE, p.slice(7)); return f ? sendFile(req, res, f, 'public, max-age=31536000, immutable') : send(res, 404, { error: 'Not found' }); }
    if (p.startsWith('/out/')) { const f = within(OUT, path.basename(p.slice(5))); return f ? sendFile(req, res, f) : send(res, 404, { error: 'Not found' }); }
  }
  if (isPost) {
    let m;
    if ((m = /^\/api\/prepare\/([\w.-]+)$/.exec(p))) {
      const clip = clips.get(m[1]);
      if (!clip) return send(res, 404, { error: 'Unknown clip.' });
      schedule(clip, true);
      await settled(clip);
      return send(res, 200, publicClip(clip));
    }
    if (p === '/api/export') {
      try { return send(res, 200, publicJob(await startExport(await readBody(req)))); }
      catch (err) { return send(res, 400, { error: err.message }); }
    }
    if ((m = /^\/api\/export\/(\d+)\/cancel$/.exec(p))) {
      const job = jobs.get(m[1]);
      if (job?.child) { job.state = 'cancelled'; job.child.kill('SIGTERM'); }
      return send(res, 200, job ? publicJob(job) : { error: 'No such export.' });
    }
  }
  send(res, 404, { error: 'Not found' });
}

await loadCatalog();
for (const g of groups) for (const id of g.ids) schedule(clips.get(id));
http.createServer((req, res) => handle(req, res).catch(err => { console.error(err); if (!res.headersSent) send(res, 500, { error: err.message }); else res.destroy(); }))
  .listen(PORT, '127.0.0.1', () => {
    const waiting = [...clips.values()].filter(c => c.state !== 'ready').length;
    console.log(`Clip cutter: http://127.0.0.1:${PORT}/`);
    console.log(`  ${clips.size} clips${waiting ? `, making ${waiting} scrub proxies in tmp/cutter/ (${PREP_AT_ONCE} at a time)` : ''}`);
    console.log(`  exports go to ${OUT}`);
  });
