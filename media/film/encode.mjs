// Encode the Flux film for the homepage: an HLS ladder of fragmented-MP4 segments (2160p, 1440p, 1080p, 720p at
// 60 fps, H.264 High + AAC-LC), a poster and a captions file, then record every published file in media/film.json.
// Safari and iOS play the ladder natively; site/assets/scripts/film.js plays the same segments elsewhere.
//
//   node media/film/encode.mjs --film /path/to/film-4k60.mp4 --audio /path/to/mastered.wav --poster-time 152.4
//
// The film master and the soundtrack master stay outside the repository; only their hashes are recorded.
// Requires ffmpeg/ffprobe (libx264, AudioToolbox AAC) and cwebp on PATH.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'site/assets/film');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (index % 2 ? pairs : [...pairs, [value.replace(/^--/, ''), all[index + 1]]]), []));
for (const required of ['film', 'audio', 'poster-time']) if (!args[required]) throw new Error(`Missing --${required}`);
const SEGMENT = 4, GOP = 120;            // 4 s segments, a closed GOP every 2 s: every segment starts on a keyframe
// Constant-quality encodes with a VBV ceiling keep every segment well under the 15 MB per-file publication limit.
const LADDER = [
  { name: '2160p', width: 3840, height: 2160, crf: 19, maxrate: 18000, level: '5.2' },
  { name: '1440p', width: 2560, height: 1440, crf: 19, maxrate: 10000, level: '5.1' },
  { name: '1080p', width: 1920, height: 1080, crf: 20, maxrate: 6500, level: '4.2' },
  { name: '720p', width: 1280, height: 720, crf: 21, maxrate: 3200, level: '4.2' },
];
// --rungs 1080p,720p encodes part of the ladder (for quick previews); the published film uses all four.
const rungs = args.rungs ? new Set(args.rungs.split(',')) : null;
// --reuse yes rebuilds the playlists, poster, captions and provenance from the segments already in site/assets/film.
const reuse = args.reuse === 'yes';
// --preset medium trades a little efficiency for a faster encode (previews); the published film uses slow.
const preset = args.preset || 'slow';

function run(command, list) {
  const result = spawnSync(command, list, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result.stdout.toString();
}
const sha256 = file => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
});
const probe = (file, entries, stream = 'v:0') => JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', stream, '-show_entries', entries, '-of', 'json', file]));

const film = path.resolve(args.film), audio = path.resolve(args.audio);
const source = probe(film, 'stream=width,height,r_frame_rate,nb_frames:format=duration');
const [{ width, height, r_frame_rate: rate }] = source.streams;
if (width !== 3840 || height !== 2160 || rate !== '60/1') throw new Error(`Expected a 3840x2160 60 fps master, got ${width}x${height} ${rate}`);
const duration = Number(source.format.duration);
await mkdir(OUT, { recursive: true });

// One AAC encode of the lossless soundtrack, shared by every rendition (AudioToolbox AAC-LC, 256 kb/s).
const scratch = path.join(ROOT, '.cache/film');
await mkdir(scratch, { recursive: true });
const aac = path.join(scratch, 'soundtrack.m4a');
if (!reuse) run('ffmpeg', ['-v', 'error', '-y', '-i', audio, '-t', duration.toFixed(3), '-c:a', 'aac_at', '-b:a', '256k', '-ar', '48000', aac]);

const variants = [];
if (!reuse) { await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true }); }
for (const rung of LADDER.filter(rung => !rungs || rungs.has(rung.name))) {
  const dir = path.join(OUT, rung.name);
  if (reuse) {
    if (await stat(path.join(dir, 'index.m3u8')).catch(() => null)) variants.push({ ...rung, dir });
    continue;
  }
  await mkdir(dir, { recursive: true });
  const scale = rung.height === 2160 ? [] : ['-vf', `scale=${rung.width}:${rung.height}:flags=lanczos+accurate_rnd+full_chroma_int`];
  run('ffmpeg', ['-v', 'error', '-stats', '-y', '-i', film, '-i', aac, '-map', '0:v:0', '-map', '1:a:0', ...scale,
    '-c:v', 'libx264', '-preset', preset, '-crf', String(rung.crf), '-maxrate', `${rung.maxrate}k`, '-bufsize', `${rung.maxrate * 2}k`,
    '-profile:v', 'high', '-level', rung.level, '-pix_fmt', 'yuv420p', '-g', String(GOP), '-keyint_min', String(GOP), '-sc_threshold', '0',
    '-x264-params', 'open-gop=0', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'copy', '-shortest',
    '-f', 'hls', '-hls_time', String(SEGMENT), '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4', '-hls_flags', 'independent_segments',
    '-hls_fmp4_init_filename', 'init.mp4', '-hls_segment_filename', path.join(dir, 'seg_%03d.m4s'), path.join(dir, 'index.m3u8')]);
  variants.push({ ...rung, dir });
}

// Master playlist: measured peak and average bitrates, exact codec strings. 1080p is listed first (a sound start).
const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
const summary = [];
for (const rung of [...variants].sort((a, b) => (a.height === 1080 ? -1 : b.height === 1080 ? 1 : b.height - a.height))) {
  const playlist = await readFile(path.join(rung.dir, 'index.m3u8'), 'utf8');
  const segments = [...playlist.matchAll(/#EXTINF:([\d.]+),\s*\n([^\n]+)/g)].map(match => ({ seconds: Number(match[1]), file: match[2].trim() }));
  let peak = 0, total = 0, seconds = 0;
  for (const segment of segments) {
    const bytes = (await stat(path.join(rung.dir, segment.file))).size;
    if (segment.seconds >= 1) peak = Math.max(peak, bytes * 8 / segment.seconds);
    total += bytes; seconds += segment.seconds;
  }
  const level = Math.round(Number(rung.level) * 10);          // H.264 High (0x64), no constraint flags, level as encoded
  const codecs = `avc1.6400${level.toString(16).padStart(2, '0')},mp4a.40.2`;
  lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${Math.ceil(peak)},AVERAGE-BANDWIDTH=${Math.ceil(total * 8 / seconds)},CODECS="${codecs}",RESOLUTION=${rung.width}x${rung.height},FRAME-RATE=60.000,CLOSED-CAPTIONS=NONE`);
  lines.push(`${rung.name}/index.m3u8`);
  summary.push(`${rung.name}: ${segments.length} segments, ${(total / 1048576).toFixed(1)} MB, avg ${(total * 8 / seconds / 1e6).toFixed(2)} Mb/s, peak ${(peak / 1e6).toFixed(2)} Mb/s`);
}
await writeFile(path.join(OUT, 'master.m3u8'), lines.join('\n') + '\n');

// Poster: one frame of the master, 1920x1080 WebP.
const png = path.join(scratch, 'poster.png');
run('ffmpeg', ['-v', 'error', '-y', '-ss', String(args['poster-time']), '-i', film, '-frames:v', '1', '-vf', 'scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int', png]);
run('cwebp', ['-quiet', '-q', '90', '-m', '6', '-sharp_yuv', png, '-o', path.join(OUT, 'poster.webp')]);

// The film has no dialogue: captions name the music so a viewer relying on captions knows what they hear.
const stamp = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${(s % 60).toFixed(3).padStart(6, '0')}`;
await writeFile(path.join(OUT, 'captions.vtt'), `WEBVTT\n\n1\n${stamp(0.5)} --> ${stamp(6)}\n[Bright marimba music]\n\n2\n${stamp(duration - 14)} --> ${stamp(duration - 9)}\n[The music swells to a gong]\n\n3\n${stamp(duration - 6)} --> ${stamp(duration - 0.5)}\n[Music fades out]\n`);

// Provenance: inputs by hash, every published file by size and hash.
const outputs = {};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (!entry.name.startsWith('.')) outputs[path.relative(ROOT, file).split(path.sep).join('/')] = { bytes: (await stat(file)).size, sha256: await sha256(file) };
  }
}
await walk(OUT);
const sorted = Object.fromEntries(Object.entries(outputs).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
await writeFile(path.join(ROOT, 'media/film.json'), JSON.stringify({
  description: 'The Flux film on the homepage (HLS ladder, poster, captions). Produced by media/film/encode.mjs.',
  inputs: {
    film: { name: path.basename(film), bytes: (await stat(film)).size, sha256: await sha256(film), duration: Number(duration.toFixed(3)) },
    audio: { name: path.basename(audio), bytes: (await stat(audio)).size, sha256: await sha256(audio) },
  },
  encode: { segmentSeconds: SEGMENT, gop: GOP, video: `libx264 High, preset ${preset}, CRF + VBV ceiling, yuv420p, BT.709`, audio: 'AAC-LC 256 kb/s 48 kHz (AudioToolbox)', posterTime: Number(args['poster-time']), ladder: LADDER },
  outputs: sorted,
}, null, 1) + '\n');
console.log(summary.join('\n'));
const largest = Object.entries(sorted).sort((a, b) => b[1].bytes - a[1].bytes)[0];
console.log(`${Object.keys(sorted).length} files, ${(Object.values(sorted).reduce((sum, o) => sum + o.bytes, 0) / 1048576).toFixed(1)} MB; largest ${largest[0]} ${(largest[1].bytes / 1048576).toFixed(2)} MB`);
