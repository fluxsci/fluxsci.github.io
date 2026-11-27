// Clip cutter: the page. The server (server.mjs) lists the clips, makes scrub proxies and runs ffmpeg.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));
const fmt = t => { const cs = Math.round(Math.max(0, t) * 100), m = Math.floor(cs / 6000); return `${m}:${((cs % 6000) / 100).toFixed(2).padStart(5, '0')}`; };
const secs = t => `${t.toFixed(2)} s`;
const mb = b => `${(b / 1e6).toFixed(1)} MB`;
const uid = () => Math.random().toString(36).slice(2, 10);

const player = $('#player'), pv = $$('.pv'), result = $('#result');
const tl = $('#timeline'), ruler = $('#ruler'), strip = $('#strip'), selEl = $('#sel'), ph = $('#ph'), hover = $('#hover');
const STORE = 'flux-cutter-v1';

const S = {
  groups: [], clips: new Map(), order: [],
  clip: null,         // the clip on the timeline
  sel: null,          // { in, out } in seconds, on frame boundaries; out is exclusive
  editing: null,      // uid of the sequence segment the range is bound to
  playhead: 0,
  view: { t0: 0, t1: 1 },   // the stretch of the clip the timeline shows (wheel zooms)
  seq: [],            // [{ uid, id, in, out, speed }]
  settings: { transition: 'cut', fade: 0.25, size: 'auto', fps: '60', name: '' },
  mode: 'edit',       // 'edit' | 'preview' | 'result'
  undo: [],
};

// ---------------------------------------------------------------- frames

const fps = () => S.clip?.fps || 60;
const span = () => S.view.t1 - S.view.t0;
const pct = t => (t - S.view.t0) / span() * 100;
const snap = t => Math.round(t * fps()) / fps();
const frameOf = t => Math.floor(t * fps() + 1e-4);
const segLen = s => (s.out - s.in) / s.speed;
function joinFade() {
  if (S.settings.transition !== 'fade' || S.seq.length < 2) return 0;
  return Math.min(Number(S.settings.fade) || 0.25, Math.min(...S.seq.map(segLen)) / 2);
}
function outputSize() {
  const v = S.settings.size, first = S.clips.get(S.seq[0]?.id);
  if (v !== 'auto') return v.replace('x', ' × ');
  return first ? `${Math.round(1080 * first.width / first.height / 2) * 2} × 1080` : '';
}
const seqTotal = () => S.seq.reduce((t, s) => t + segLen(s), 0) - joinFade() * Math.max(0, S.seq.length - 1);

// ---------------------------------------------------------------- persistence + undo

function save() {
  localStorage.setItem(STORE, JSON.stringify({ seq: S.seq, settings: S.settings, clip: S.clip?.id, sel: S.sel, playhead: S.playhead }));
}
function pushUndo() { S.undo.push(JSON.stringify(S.seq)); if (S.undo.length > 100) S.undo.shift(); }
function undo() {
  const prev = S.undo.pop();
  if (!prev) return;
  S.seq = JSON.parse(prev);
  if (S.editing && !S.seq.some(s => s.uid === S.editing)) S.editing = null;
  else if (S.editing) { const s = S.seq.find(x => x.uid === S.editing); S.sel = { in: s.in, out: s.out }; }
  afterSeqChange();
  renderRange();
}

// ---------------------------------------------------------------- library

async function boot() {
  const data = await (await fetch('/api/clips')).json();
  S.groups = data.groups;
  for (const g of S.groups) for (const c of g.clips) { S.clips.set(c.id, c); S.order.push(c.id); }
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch {}
  S.seq = (saved.seq || []).filter(s => S.clips.has(s.id));
  Object.assign(S.settings, saved.settings || {});
  S.settings.size = { 1920: '1920x1440', 1440: '1440x1080', 1280: '1280x960', 960: '960x720' }[S.settings.size] || S.settings.size;
  for (const k of ['transition', 'fade', 'size', 'fps', 'name']) $(`#${k}`).value = S.settings[k];
  $('#fadeWrap').hidden = S.settings.transition !== 'fade';
  renderLibrary();
  afterSeqChange(false);
  loadExports();
  if (saved.clip && S.clips.has(saved.clip)) selectClip(saved.clip, { sel: saved.sel, at: saved.playhead });
  pollPrep();
}

function renderLibrary() {
  const q = $('#filter').value.trim().toLowerCase();
  const nav = $('#clips');
  nav.textContent = '';
  let chapter = null;
  for (const g of S.groups) {
    const list = g.clips.filter(c => !q || `${c.id} ${c.caption} ${c.description} ${g.title} ${g.chapter}`.toLowerCase().includes(q));
    if (!list.length) continue;
    if (g.chapter !== chapter) { chapter = g.chapter; nav.insertAdjacentHTML('beforeend', `<h2 class="chapter">${esc(chapter)}</h2>`); }
    if (g.title !== g.chapter) nav.insertAdjacentHTML('beforeend', `<h3 class="section">${esc(g.title)}</h3>`);
    for (const c of list) {
      const b = document.createElement('button');
      b.className = 'clip';
      b.dataset.id = c.id;
      b.title = c.description || c.caption;
      b.innerHTML = `${c.poster ? `<img loading="lazy" alt="" src="${c.poster}">` : '<span class="noimg"></span>'}
        <span class="name">${esc(c.id)} <span class="len">${fmt(c.duration)}</span></span>
        <span class="cap">${esc(c.caption)}</span><span class="uses"></span>`;
      b.addEventListener('click', () => selectClip(c.id));
      nav.append(b);
    }
  }
  markLibrary();
}

function markLibrary() {
  const uses = {};
  for (const s of S.seq) uses[s.id] = (uses[s.id] || 0) + 1;
  for (const b of $$('.clip')) {
    b.classList.toggle('on', b.dataset.id === S.clip?.id);
    $('.uses', b).textContent = uses[b.dataset.id] || '';
  }
}

// Scrub proxies are made in the background; the page swaps them in as they arrive.
async function pollPrep() {
  const { clips } = await (await fetch('/api/status')).json();
  let ready = 0, total = 0, failed = 0;
  for (const [id, info] of Object.entries(clips)) {
    const c = S.clips.get(id);
    if (!c) continue;
    total++;
    if (info.state === 'ready') ready++;
    if (info.state === 'error') failed++;
    const was = c.proxy;
    Object.assign(c, info);
    if (!was && c.proxy) clipReady(c);
  }
  $('#prep').textContent = ready + failed < total ? `Making scrub proxies ${ready}/${total}…` : failed ? `${failed} proxies failed (using originals)` : '';
  if (ready + failed < total) setTimeout(pollPrep, 1500);
}

function clipReady(c) {
  loadStrip(c).then(() => {
    if (S.clip === c) drawStrip();
    for (const card of $$('.seg')) { const s = S.seq.find(x => x.uid === card.dataset.uid); if (s?.id === c.id) drawThumb($('canvas', card), c, s.in); }
  });
  if (S.clip === c && S.mode === 'edit' && player.dataset.src !== c.proxy) setSource(c, S.playhead, !player.paused);
}

const strips = new Map();
function loadStrip(c) {
  if (!c.stripUrl) return Promise.resolve(null);
  if (!strips.has(c.id)) strips.set(c.id, new Promise(r => { const img = new Image(); img.onload = () => r(img); img.onerror = () => r(null); img.src = c.stripUrl; }));
  return strips.get(c.id);
}

// ---------------------------------------------------------------- the clip on the timeline

function selectClip(id, { sel = null, editing = null, at = null } = {}) {
  const c = S.clips.get(id);
  if (!c) return;
  showEditor();
  S.clip = c;
  S.sel = sel && sel.out > sel.in ? { in: sel.in, out: Math.min(sel.out, c.duration) } : null;
  S.editing = editing;
  S.view = { t0: 0, t1: c.duration };
  $('#empty').hidden = true;
  $('#caption').textContent = c.caption;
  $('#dur').textContent = fmt(c.duration);
  ph.hidden = false;
  setSource(c, at ?? S.sel?.in ?? 0, false);
  if (c.state !== 'ready') fetch(`/api/prepare/${c.id}`, { method: 'POST' }).then(r => r.json()).then(info => { const had = c.proxy; Object.assign(c, info); if (!had && c.proxy) clipReady(c); });
  loadStrip(c).then(() => S.clip === c && drawStrip());
  layoutTimeline();
  renderRange();
  renderSeq();
  markLibrary();
  $('.clip.on')?.scrollIntoView({ block: 'nearest' });
  save();
}

function setSource(c, t, play) {
  const url = c.proxy || c.src;
  const go = () => { seekTo(t, true); if (play) player.play(); };
  if (player.dataset.src !== url) {
    player.dataset.src = url;
    player.src = url;
    player.loop = true;
    S.playhead = t;
    drawPlayhead();
    once(player, 'loadedmetadata').then(() => { if (player.dataset.src === url) go(); });
  } else go();
}

// Seeks are chained: a new one starts when the last has landed, always at the latest target, so a
// fast drag never queues up stale frames.
let seekBusy = false, seekWant = null;
function seekTo(t, force = false) {
  if (!S.clip) return;
  t = clamp(t, 0, S.clip.duration - 1 / fps());
  S.playhead = t;
  drawPlayhead();
  if (!force && !player.paused) player.pause();
  seekWant = t;
  if (!seekBusy) pumpSeek();
}
function pumpSeek() {
  if (seekWant == null || player.readyState < 1) { seekBusy = false; return; }
  seekBusy = true;
  player.currentTime = seekWant + 0.3 / fps();   // inside the frame, never on its edge
  seekWant = null;
}
player.addEventListener('seeked', () => { seekBusy = false; pumpSeek(); });
player.addEventListener('play', () => { $('#play').textContent = '❚❚'; });
player.addEventListener('pause', () => { $('#play').textContent = '▶'; });

function togglePlay() {
  if (S.mode !== 'edit') return showEditor();
  if (!S.clip) return;
  if (!player.paused) { player.pause(); S.playhead = frameOf(player.currentTime) / fps(); drawPlayhead(); return; }
  const s = S.sel, t = S.playhead;
  if (s && $('#loopSel').checked && (t < s.in || t >= s.out - 0.5 / fps())) seekTo(s.in, true);
  player.play();
}

function step(n) {
  if (!S.clip) return;
  player.pause();
  seekTo((frameOf(S.playhead) + n) / fps());
}

function markIn() {
  if (!S.clip) return;
  const t = frameOf(S.playhead) / fps();
  editBegin();
  S.sel = { in: t, out: S.sel && S.sel.out > t ? S.sel.out : S.clip.duration };
  rangeChanged();
}
function markOut() {
  if (!S.clip) return;
  const t = Math.min(S.clip.duration, (frameOf(S.playhead) + 1) / fps());
  editBegin();
  S.sel = { in: S.sel && S.sel.in < t ? S.sel.in : 0, out: t };
  rangeChanged();
}
function clearSel() {
  if (S.editing) return stopEditing();
  S.sel = null;
  rangeChanged();
}

// While a segment is being edited, the range is that segment: every change lands in the sequence.
function editBegin() { if (S.editing) pushUndo(); }
function rangeChanged() {
  if (S.editing && S.sel) {
    const s = S.seq.find(x => x.uid === S.editing);
    if (s) { s.in = S.sel.in; s.out = S.sel.out; afterSeqChange(); }
  }
  renderRange();
  save();
}

function stopEditing() {
  S.editing = null;
  S.sel = null;
  renderRange();
  renderSeq();
  save();
}

function addSegment() {
  if (S.editing) return stopEditing();
  if (!S.clip || !S.sel) return;
  pushUndo();
  S.seq.push({ uid: uid(), id: S.clip.id, in: S.sel.in, out: S.sel.out, speed: 1 });
  S.sel = null;
  afterSeqChange();
  renderRange();
  const last = $('#seq .seg:last-of-type');
  last?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

function editSegment(u) {
  const s = S.seq.find(x => x.uid === u);
  if (!s) return;
  if (S.editing === u && S.clip?.id === s.id && S.mode === 'edit') return;
  selectClip(s.id, { sel: { in: s.in, out: s.out }, editing: u, at: s.in });
}

function renderRange() {
  const has = !!(S.clip && S.sel);
  selEl.hidden = !has;
  if (has) {
    selEl.style.left = `${pct(S.sel.in)}%`;
    selEl.style.width = `${(S.sel.out - S.sel.in) / span() * 100}%`;
  }
  const n = S.editing ? S.seq.findIndex(x => x.uid === S.editing) + 1 : 0;
  $('#rangeInfo').innerHTML = has ? `${fmt(S.sel.in)} → ${fmt(S.sel.out)} · ${secs(S.sel.out - S.sel.in)}${n ? `<span class="edit">editing segment ${n}: changes apply to it</span>` : ''}` : '';
  $('#clearSel').disabled = !has;
  $('#clearSel').textContent = S.editing ? 'Stop editing' : 'Clear range';
  $('#addSeg').disabled = !has;
  $('#addSeg').innerHTML = S.editing ? 'Done <kbd>Enter</kbd>' : 'Add to sequence <kbd>Enter</kbd>';
  $('#play').disabled = !S.clip;
  renderUsed();
}

function renderUsed() {
  const box = $('#used');
  box.textContent = '';
  if (!S.clip) return;
  S.seq.forEach((s, i) => {
    if (s.id !== S.clip.id) return;
    const d = document.createElement('div');
    d.style.left = `${pct(s.in)}%`;
    d.style.width = `${(s.out - s.in) / span() * 100}%`;
    d.title = `Segment ${i + 1}: ${fmt(s.in)} → ${fmt(s.out)} (click to edit)`;
    d.classList.toggle('editing', s.uid === S.editing);
    d.addEventListener('pointerdown', e => { e.stopPropagation(); editSegment(s.uid); });
    box.append(d);
  });
}

// ---------------------------------------------------------------- timeline drawing

let W = 0;
const dpr = () => window.devicePixelRatio || 1;
function layoutTimeline() {
  W = tl.clientWidth;
  for (const [cv, h] of [[ruler, 22], [strip, 72]]) { cv.width = Math.round(W * dpr()); cv.height = Math.round(h * dpr()); }
  drawRuler();
  drawStrip();
  drawPlayhead();
}
new ResizeObserver(layoutTimeline).observe(tl);

const x2t = x => clamp(S.view.t0 + x / W * span(), 0, S.clip?.duration || 0);

function drawRuler() {
  const ctx = ruler.getContext('2d'), k = dpr();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, W, 22);
  if (!S.clip) return;
  const { t0, t1 } = S.view, pps = W / (t1 - t0), X = t => Math.round((t - t0) * pps);
  const major = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60].find(s => s * pps >= 64) || 60;
  const minor = major / (major >= 5 || major === 1 ? 5 : 2);
  const first = s => Math.ceil(t0 / s - 1e-6) * s;
  ctx.fillStyle = '#575653';
  for (let t = first(minor); t <= t1 + 1e-6; t += minor) ctx.fillRect(X(t), 16, 1, 6);
  ctx.fillStyle = '#878580';
  ctx.font = '10.5px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  for (let t = first(major); t <= t1 + 1e-6; t += major) {
    const x = X(t);
    ctx.fillRect(x, 10, 1, 12);
    const label = major < 1 ? fmt(t) : fmt(t).slice(0, -3);
    if (x + 30 < W) ctx.fillText(label, x + 3, 2);
  }
}

async function drawStrip() {
  const ctx = strip.getContext('2d'), k = dpr(), H = 72;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#1C1B1A';
  ctx.fillRect(0, 0, W, H);
  const c = S.clip;
  if (!c) return;
  const img = await loadStrip(c);
  if (S.clip !== c) return;
  if (!img) {
    ctx.fillStyle = '#575653';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Making the filmstrip…', 12, H / 2 + 4);
    return;
  }
  const { tiles, w, h } = c.strip, dw = H * w / h;
  for (let x = 0; x < W; x += dw) {
    const i = clamp(Math.floor(x2t(x + dw / 2) / c.duration * tiles), 0, tiles - 1);
    ctx.drawImage(img, i * w, 0, w, h, x, 0, dw, H);
  }
  ctx.fillStyle = 'rgba(16,15,15,.5)';
  for (let x = dw; x < W; x += dw) ctx.fillRect(Math.round(x), 0, 1, H);
}

function drawPlayhead() {
  if (!S.clip) return;
  const p = pct(S.playhead);
  ph.style.left = `${p}%`;
  ph.style.visibility = p < 0 || p > 100 ? 'hidden' : '';
  $('#now').textContent = fmt(S.playhead);
}

function drawThumb(cv, c, t) {
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  loadStrip(c).then(img => {
    if (!img) return;
    const { tiles, w, h } = c.strip, i = clamp(Math.floor(t / c.duration * tiles), 0, tiles - 1);
    const k = Math.min(cv.width / w, cv.height / h), dw = w * k, dh = h * k;
    ctx.drawImage(img, i * w, 0, w, h, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
  });
}

// The playhead follows playback; a looped range wraps at its out point.
function tick() {
  if (S.mode === 'edit' && S.clip && !player.paused) {
    const t = player.currentTime, s = S.sel;
    if (s && $('#loopSel').checked && (t >= s.out || t < s.in - 0.05)) player.currentTime = s.in + 0.3 / fps();
    S.playhead = Math.min(player.currentTime, S.clip.duration);
    if (S.playhead > S.view.t1 || S.playhead < S.view.t0) setView(S.playhead - span() * 0.1, span());
    drawPlayhead();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Wheel zooms the timeline around the pointer; Shift+wheel or a sideways swipe pans; F fits.
function setView(t0, len) {
  const d = S.clip.duration;
  len = clamp(len, Math.min(d, 1), d);
  t0 = clamp(t0, 0, d - len);
  S.view = { t0, t1: t0 + len };
  drawRuler();
  drawStrip();
  drawPlayhead();
  renderRange();
}
function fitView() { if (S.clip) setView(0, S.clip.duration); }
tl.addEventListener('wheel', e => {
  if (!S.clip) return;
  e.preventDefault();
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? W : 1;
  const dx = e.deltaX * unit, dy = e.deltaY * unit;
  if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) { setView(S.view.t0 + (dx || dy) / W * span(), span()); return; }
  const at = x2t(x), len = span() * Math.exp(dy * 0.0015);
  setView(at - x / W * clamp(len, Math.min(S.clip.duration, 1), S.clip.duration), len);
}, { passive: false });

// ---------------------------------------------------------------- timeline input

let drag = null;
const EDGE = 8;

function hitTest(x, y) {
  if (y < 22) return 'scrub';
  if (S.sel) {
    const xi = pct(S.sel.in) / 100 * W, xo = pct(S.sel.out) / 100 * W;
    const di = Math.abs(x - xi), dout = Math.abs(x - xo);
    if (Math.min(di, dout) <= EDGE) return di < dout || (di === dout && x < xi) ? 'in' : 'out';
    if (x > xi && x < xo) return 'move';
  }
  return 'new';
}

tl.addEventListener('pointerdown', e => {
  if (!S.clip || e.button !== 0) return;
  if (S.mode !== 'edit') showEditor();
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const mode = hitTest(x, y);
  const wasPlaying = !player.paused;
  player.pause();
  drag = { mode, x0: x, vx: x, lastX: x, t0: x2t(x), sel0: S.sel && { ...S.sel }, moved: mode === 'scrub', wasPlaying, undo: false };
  tl.setPointerCapture(e.pointerId);
  if (mode === 'scrub') seekTo(snap(x2t(x)));
  e.preventDefault();
});

tl.addEventListener('pointermove', e => {
  const r = tl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (!S.clip) return;
  if (!drag) {
    const m = hitTest(x, y);
    tl.style.cursor = m === 'scrub' ? 'col-resize' : m === 'in' || m === 'out' ? 'ew-resize' : m === 'move' ? 'grab' : 'crosshair';
    hover.hidden = false;
    hover.style.left = `${clamp(x, 0, W)}px`;
    $('span', hover).textContent = fmt(snap(x2t(x)));
    return;
  }
  hover.hidden = true;
  drag.vx += (x - drag.lastX) * (e.shiftKey ? 0.1 : 1);   // Shift: a tenth of the speed, for single frames
  drag.lastX = x;
  if (!drag.moved && Math.abs(x - drag.x0) < 3) return;
  drag.moved = true;
  if (!drag.undo && drag.mode !== 'scrub') { editBegin(); drag.undo = true; }
  const d = S.clip.duration, f = 1 / fps(), t = snap(x2t(drag.vx));
  switch (drag.mode) {
    case 'scrub': seekTo(t); return;
    case 'in': S.sel.in = clamp(t, 0, S.sel.out - f); seekTo(S.sel.in); break;
    case 'out': S.sel.out = clamp(t, S.sel.in + f, d); seekTo(S.sel.out - f); break;
    case 'move': {
      const len = drag.sel0.out - drag.sel0.in;
      S.sel.in = clamp(snap(drag.sel0.in + x2t(drag.vx) - drag.t0), 0, d - len);
      S.sel.out = S.sel.in + len;
      seekTo(S.sel.in);
      tl.style.cursor = 'grabbing';
      break;
    }
    case 'new': {
      const a = snap(drag.t0), b = t;
      S.sel = { in: Math.min(a, b), out: Math.max(a, b) };
      if (S.sel.out - S.sel.in < f) S.sel.out = Math.min(d, S.sel.in + f);
      seekTo(b < a ? S.sel.in : S.sel.out - f);
      break;
    }
  }
  renderRange();
});

tl.addEventListener('pointerleave', () => { if (!drag) hover.hidden = true; });

function endDrag(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) seekTo(snap(d.t0));
  else if (d.mode !== 'scrub') rangeChanged();
  if (d.mode === 'scrub' && d.wasPlaying) player.play();
  if (d.mode === 'new' && d.moved && S.sel && !S.editing) $('#addSeg').focus({ preventScroll: true });
  save();
}
tl.addEventListener('pointerup', endDrag);
tl.addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------- the sequence

function afterSeqChange(persist = true) {
  renderSeq();
  renderUsed();
  markLibrary();
  if (persist) save();
}

let dragUid = null;
function renderSeq() {
  const ol = $('#seq');
  ol.textContent = '';
  if (!S.seq.length) ol.innerHTML = '<li class="hint">Drag across a clip\'s filmstrip to mark a range, then press Enter to add it here. Segments play in this order; drag them to reorder.</li>';
  S.seq.forEach((s, i) => {
    const c = S.clips.get(s.id);
    const li = document.createElement('li');
    li.className = 'seg';
    li.draggable = true;
    li.dataset.uid = s.uid;
    li.classList.toggle('editing', s.uid === S.editing);
    li.title = `${c.id}: ${fmt(s.in)} → ${fmt(s.out)}. Click to re-trim; drag to reorder.`;
    li.innerHTML = `<canvas width="160" height="120"></canvas>
      <div class="row"><span class="num">${i + 1}</span><span class="nm">${esc(c.id)}</span></div>
      <div class="row tm">${fmt(s.in)} → ${fmt(s.out)}</div>
      <div class="row"><span class="len">${secs(segLen(s))}</span>
        <select aria-label="Speed" title="Playback speed">${[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(v => `<option value="${v}"${v === s.speed ? ' selected' : ''}>${v}×</option>`).join('')}</select>
        <button class="x ghost" aria-label="Remove segment" title="Remove">×</button></div>`;
    drawThumb($('canvas', li), c, s.in);
    $('select', li).addEventListener('change', e => { pushUndo(); s.speed = Number(e.target.value); afterSeqChange(); });
    $('select', li).addEventListener('click', e => e.stopPropagation());
    $('.x', li).addEventListener('click', e => { e.stopPropagation(); removeSegment(s.uid); });
    li.addEventListener('click', () => editSegment(s.uid));
    ol.append(li);
  });
  const total = seqTotal();
  $('#seqInfo').textContent = S.seq.length ? `${S.seq.length} segment${S.seq.length > 1 ? 's' : ''} · ${secs(total)} · ${outputSize()}` : '';
  $('#playSeq').disabled = !S.seq.length;
  $('#export').disabled = !S.seq.length;
  const bar = $('#seqBar');
  bar.textContent = '';
  for (const [i, s] of S.seq.entries()) {
    const seg = document.createElement('i');
    seg.style.flex = `${segLen(s)} 1 0`;
    seg.title = `${i + 1}. ${s.id} · ${secs(segLen(s))}`;
    seg.classList.toggle('editing', s.uid === S.editing);
    seg.addEventListener('click', () => editSegment(s.uid));
    bar.append(seg);
  }
}

function removeSegment(u) {
  pushUndo();
  S.seq = S.seq.filter(x => x.uid !== u);
  if (S.editing === u) { S.editing = null; S.sel = null; renderRange(); }
  afterSeqChange();
}

const seqList = $('#seq');
seqList.addEventListener('dragstart', e => {
  const li = e.target.closest('.seg');
  if (!li) return;
  dragUid = li.dataset.uid;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragUid);
  li.classList.add('dragging');
});
function dropIndex(x) {
  const cards = $$('.seg', seqList).filter(li => li.dataset.uid !== dragUid);
  const at = cards.findIndex(li => { const r = li.getBoundingClientRect(); return x < r.left + r.width / 2; });
  return { cards, at: at < 0 ? cards.length : at };
}
seqList.addEventListener('dragover', e => {
  if (!dragUid) return;
  e.preventDefault();
  const { cards, at } = dropIndex(e.clientX);
  for (const li of $$('.seg', seqList)) li.classList.remove('drop-before', 'drop-after');
  if (at < cards.length) cards[at].classList.add('drop-before'); else cards.at(-1)?.classList.add('drop-after');
});
seqList.addEventListener('drop', e => {
  if (!dragUid) return;
  e.preventDefault();
  const { cards, at } = dropIndex(e.clientX);
  const moving = S.seq.find(s => s.uid === dragUid);
  const before = cards[at]?.dataset.uid;
  pushUndo();
  S.seq = S.seq.filter(s => s.uid !== dragUid);
  const idx = before ? S.seq.findIndex(s => s.uid === before) : S.seq.length;
  S.seq.splice(idx, 0, moving);
  dragUid = null;
  afterSeqChange();
});
seqList.addEventListener('dragend', () => { dragUid = null; for (const li of $$('.seg', seqList)) li.classList.remove('dragging', 'drop-before', 'drop-after'); });

// ---------------------------------------------------------------- previewing the sequence

let pvToken = 0;
function cue(v, s) {
  const c = S.clips.get(s.id), url = c.proxy || c.src;
  return (async () => {
    if (v.dataset.src !== url) { v.dataset.src = url; v.src = url; await once(v, 'loadedmetadata'); }
    v.playbackRate = s.speed;
    v.currentTime = s.in + 0.3 / c.fps;
    await once(v, 'seeked');
  })();
}

async function playSequence() {
  if (!S.seq.length) return;
  if (S.mode === 'preview') return showEditor();
  showEditor();
  player.pause();
  const token = ++pvToken;
  S.mode = 'preview';
  document.body.classList.add('previewing');
  const segs = S.seq.map(s => ({ ...s, fps: S.clips.get(s.id).fps }));
  const fade = joinFade(), total = seqTotal();
  const starts = [];
  segs.reduce((acc, s) => { starts.push(acc); return acc + segLen(s) - fade; }, 0);
  for (const v of pv) { v.pause(); v.style.transition = 'none'; v.style.opacity = 0; v.style.zIndex = 1; }
  const label = $('#stageLabel');
  label.hidden = false;
  let cur = pv[0], nxt = pv[1], i = 0, switching = false;
  const show = () => { $('span', label).textContent = `Sequence preview · segment ${i + 1} of ${segs.length} · ${secs(total)}`; };
  show();
  await cue(cur, segs[0]);
  if (token !== pvToken) return;
  cur.style.opacity = 1;
  cur.play();
  let nextReady = segs.length > 1 ? cue(nxt, segs[1]) : null;
  const bar = $('#seqBar'), mark = document.createElement('b');
  bar.append(mark);
  const frame = async () => {
    if (token !== pvToken) return;
    const s = segs[i], t = cur.currentTime;
    mark.style.left = `${clamp((starts[i] + (t - s.in) / s.speed) / total, 0, 1) * 100}%`;
    const lead = fade * s.speed;
    if (!switching && i < segs.length - 1 && t >= s.out - lead - 0.5 / s.fps) {
      switching = true;
      await nextReady;
      if (token !== pvToken) return;
      const prev = cur;
      cur = nxt; nxt = prev; i++;
      show();
      cur.style.zIndex = 2; prev.style.zIndex = 1;
      cur.style.transition = fade ? `opacity ${fade}s linear` : 'none';
      cur.style.opacity = 1;
      cur.play();
      const settle = () => {
        if (token !== pvToken) return;
        prev.pause();
        prev.style.transition = 'none';
        prev.style.opacity = 0;
        nextReady = i + 1 < segs.length ? cue(prev, segs[i + 1]) : null;
        switching = false;
      };
      if (fade) setTimeout(settle, fade * 1000); else settle();
    } else if (i === segs.length - 1 && t >= s.out - 0.5 / s.fps) {
      cur.pause();
      mark.style.left = '100%';
      setTimeout(() => token === pvToken && showEditor(), 600);
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function showEditor() {
  if (S.mode === 'edit') return;
  pvToken++;
  for (const v of pv) { v.pause(); v.style.opacity = 0; }
  result.pause();
  result.hidden = true;
  $('#seqBar b')?.remove();
  $('#stageLabel').hidden = true;
  document.body.classList.remove('previewing');
  S.mode = 'edit';
}

function showResult(url, text) {
  showEditor();
  player.pause();
  S.mode = 'result';
  result.hidden = false;
  result.src = url;
  result.play().catch(() => {});
  $('#stageLabel').hidden = false;
  $('span', $('#stageLabel')).textContent = text;
}

// ---------------------------------------------------------------- export

let job = null;
async function doExport() {
  if (!S.seq.length || job) return;
  const body = { name: S.settings.name, segments: S.seq.map(({ id, in: a, out, speed }) => ({ id, in: a, out, speed })),
    transition: S.settings.transition, fade: joinFade(), size: S.settings.size, fps: S.settings.fps };
  const box = $('#exportState');
  box.hidden = false;
  box.classList.remove('error');
  $('progress', box).hidden = false;
  $('#exportCancel').hidden = false;
  $('span', box).textContent = 'Starting…';
  $('#export').disabled = true;
  const r = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) return exportFailed(j.error);
  job = j;
  while (job) {
    const st = await (await fetch(`/api/export/${job.id}`)).json();
    $('#exportProg').value = st.progress;
    if (st.state === 'running') {
      $('span', box).textContent = `Encoding ${st.name}.mp4 · ${Math.round(st.progress * 100)}%`;
      await new Promise(res => setTimeout(res, 300));
      continue;
    }
    job = null;
    $('#export').disabled = !S.seq.length;
    if (st.state === 'error') return exportFailed(st.error);
    if (st.state === 'cancelled') { box.hidden = true; return; }
    $('progress', box).hidden = true;
    $('#exportCancel').hidden = true;
    $('span', box).innerHTML = `Saved <b>${esc(st.path)}</b> · ${secs(st.duration)} · ${mb(st.bytes)} <button class="ghost" id="copyNew">Copy path</button>`;
    $('#copyNew').addEventListener('click', () => navigator.clipboard.writeText(st.path));
    loadExports();
    showResult(st.url, `${st.name}.mp4 · ${secs(st.duration)} · ${mb(st.bytes)}`);
  }
}
function exportFailed(msg) {
  job = null;
  $('#export').disabled = !S.seq.length;
  const box = $('#exportState');
  box.classList.add('error');
  $('progress', box).hidden = true;
  $('#exportCancel').hidden = true;
  $('span', box).textContent = `Export failed: ${msg}`;
}
$('#exportCancel').addEventListener('click', () => job && fetch(`/api/export/${job.id}/cancel`, { method: 'POST' }));

async function loadExports() {
  const { out, exports } = await (await fetch('/api/exports')).json();
  $('#exportsInfo').textContent = `${exports.length} in ${out}`;
  const ul = $('#exports');
  ul.textContent = '';
  for (const x of exports) {
    const li = document.createElement('li');
    const when = new Date(x.mtime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const meta = [x.recipe ? secs(x.recipe.duration) : null, mb(x.bytes), x.recipe ? `${x.recipe.segments.length} segments` : null, when].filter(Boolean).join(' · ');
    li.innerHTML = `<span class="nm">${esc(x.name)}</span><span class="meta">${meta}</span><span class="spacer"></span>
      <button class="ghost" data-a="watch">Watch</button>${x.recipe ? '<button class="ghost" data-a="load">Load its sequence</button>' : ''}<button class="ghost" data-a="copy">Copy path</button>`;
    li.addEventListener('click', e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'watch') showResult(x.url, `${x.name}.mp4 · ${meta}`);
      if (a === 'copy') navigator.clipboard.writeText(x.path);
      if (a === 'load') loadRecipe(x);
    });
    ul.append(li);
  }
}

function loadRecipe(x) {
  const segs = x.recipe.segments.filter(s => S.clips.has(s.clip));
  pushUndo();
  S.seq = segs.map(s => ({ uid: uid(), id: s.clip, in: s.in, out: s.out, speed: s.speed || 1 }));
  S.editing = null;
  S.sel = null;
  const t = x.recipe.transition || {};
  Object.assign(S.settings, { transition: t.type === 'fade' ? 'fade' : 'cut', fade: t.seconds || S.settings.fade,
    size: x.recipe.size ? x.recipe.size.join('x') : S.settings.size, fps: String(x.recipe.fps || S.settings.fps), name: x.name });
  for (const k of ['transition', 'fade', 'size', 'fps', 'name']) $(`#${k}`).value = S.settings[k];
  $('#fadeWrap').hidden = S.settings.transition !== 'fade';
  renderRange();
  afterSeqChange();
}

// ---------------------------------------------------------------- controls + keys

$('#play').addEventListener('click', togglePlay);
$('#addSeg').addEventListener('click', addSegment);
$('#clearSel').addEventListener('click', clearSel);
$('#playSeq').addEventListener('click', playSequence);
$('#export').addEventListener('click', doExport);
$('#stageClose').addEventListener('click', showEditor);
$('#filter').addEventListener('input', renderLibrary);
for (const k of ['transition', 'fade', 'size', 'fps', 'name']) {
  $(`#${k}`).addEventListener('input', e => {
    S.settings[k] = e.target.value;
    $('#fadeWrap').hidden = S.settings.transition !== 'fade';
    renderSeq();
    save();
  });
}
$('#helpBtn').addEventListener('click', () => {
  const h = $('#help');
  h.hidden = !h.hidden;
  $('#helpBtn').setAttribute('aria-expanded', String(!h.hidden));
});
// A pointer click leaves no focus behind, so Space and Enter keep meaning play and add.
document.addEventListener('click', e => { if (e.detail > 0) e.target.closest('button')?.blur(); });

document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea')) { if (e.key === 'Escape' || e.key === 'Enter') e.target.blur(); return; }
  if (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { undo(); e.preventDefault(); }
    return;
  }
  const d = S.clip?.duration || 0, f = 1 / fps();
  switch (e.key) {
    case ' ': togglePlay(); break;
    case 'ArrowLeft': step(e.shiftKey ? -Math.round(fps()) : -1); break;
    case 'ArrowRight': step(e.shiftKey ? Math.round(fps()) : 1); break;
    case 'i': case 'I': markIn(); break;
    case 'o': case 'O': markOut(); break;
    case 'Enter': addSegment(); break;
    case 'Escape':
      if (!$('#help').hidden) $('#helpBtn').click();
      else if (S.mode !== 'edit') showEditor();
      else clearSel();
      break;
    case 'p': case 'P': playSequence(); break;
    case 'Home': seekTo(S.sel ? S.sel.in : 0); break;
    case 'End': seekTo(S.sel ? S.sel.out - f : d - f); break;
    case 'ArrowUp': case 'ArrowDown': {
      const visible = $$('.clip').map(b => b.dataset.id);
      const at = visible.indexOf(S.clip?.id);
      const next = visible[clamp(at + (e.key === 'ArrowUp' ? -1 : 1), 0, visible.length - 1)];
      if (next && next !== S.clip?.id) selectClip(next);
      break;
    }
    case 'Delete': case 'Backspace': if (S.editing) removeSegment(S.editing); else return; break;
    case 'f': case 'F': fitView(); break;
    case 'z': case 'Z': if (S.sel) { const pad = (S.sel.out - S.sel.in) * 0.15; setView(S.sel.in - pad, S.sel.out - S.sel.in + 2 * pad); } break;
    case '?': $('#helpBtn').click(); break;
    default: return;
  }
  e.preventDefault();
});

boot();
