function usesSoftwareWebGL() {
  // The inline Flux host owns its WebGL canvas and does not expose rendering
  // capabilities. Release this short-lived probe immediately.
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /swiftshader|llvmpipe|softpipe|software rasterizer|basic render driver|swangle/i.test(renderer);
}

// Adapt a native single-slide player for the recorded 3D demo. The native player
// remains the source of every resting view, including when a clip cannot play.
export function recorded3dPlayer(player, art, { liveModel }) {
  const liveMotion = !!liveModel && !usesSoftwareWebGL();
  art.dataset.motion3d = liveMotion ? 'live' : 'recorded';
  const durations = player.beatDurations();
  const clips = new Map();
  const listeners = new Map();
  let active, visible, frame, failure, landing = false;
  const state = () => {
    const native = player.state();
    const issues = failure ? [...native.issues, { reason: failure }] : native.issues;
    if (!active) return { ...native, issues };
    const { beat, direction, video, playing, initial, waiting } = active;
    const duration = durations[beat];
    const fraction = waiting || !Number.isFinite(video.duration) ? initial : video.currentTime / video.duration;
    return { ...native, beat, duration, playing, issues,
      time: duration * (direction === 'reverse' ? 1 - fraction : fraction),
      reversing: direction === 'reverse', rewindTo: direction === 'reverse' ? beat - 1 : undefined };
  };
  const emit = event => {
    for (const listener of listeners.get(event) ?? []) listener(state());
  };
  const tick = () => {
    if (!active?.playing) return;
    emit('frame');
    frame = requestAnimationFrame(tick);
  };
  const show = video => {
    if (visible && visible !== video) visible.hidden = true;
    visible = video;
    if (visible) visible.hidden = false;
  };
  const cancel = (clearPicture = true) => {
    if (active) {
      clearTimeout(active.timeout);
      active.video.pause();
      active.cleanup();
      active = undefined;
    }
    cancelAnimationFrame(frame);
    if (clearPicture) show(undefined);
  };
  function land(run, failed = false) {
    if (active !== run) return;
    if (failed) {
      failure = 'Recorded 3D motion is unavailable. Showing the saved view.';
      art.dataset.recordedMotionError = failure;
      notice.hidden = false;
    }
    cancel(false);
    landing = true;
    try {
      player.goTo(0, run.direction === 'reverse' ? run.beat - 1 : run.beat);
    } finally {
      landing = false;
    }
    show(undefined);
    if (run.direction === 'forward') emit('beatEnd');
    emit('change');
  }
  function clip(beat, direction) {
    const key = `step-${beat}-${direction}`;
    if (!clips.has(key)) {
      const video = document.createElement('video');
      video.src = `/demos/slides/3d-fallback/${key}.mp4`;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.hidden = true;
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      art.append(video);
      clips.set(key, video);
    }
    return clips.get(key);
  }
  function start(beat, direction, initial = 0) {
    const video = clip(beat, direction);
    cancel(false);
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', prepare);
      video.removeEventListener('seeked', ready);
      video.removeEventListener('playing', display);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', failed);
    };
    const run = { beat, direction, video, initial, playing: true, waiting: true, cleanup };
    active = run;
    player.pause();
    function prepare() {
      if (active !== run) return;
      video.playbackRate = direction === 'reverse' ? Math.max(1, video.duration / .8) : 1;
      const at = initial * video.duration;
      if (Math.abs(video.currentTime - at) < .002 && !video.seeking) ready();
      else video.currentTime = at;
    }
    function ready() {
      if (active !== run) return;
      run.waiting = false;
      if (run.playing) video.play().catch(() => { if (run.playing) failed(); });
    }
    function display() {
      if (active !== run) return;
      clearTimeout(run.timeout);
      show(video);
    }
    function ended() { land(run); }
    function failed() { land(run, true); }
    video.addEventListener('loadedmetadata', prepare);
    video.addEventListener('seeked', ready);
    video.addEventListener('playing', display);
    video.addEventListener('ended', ended);
    video.addEventListener('error', failed);
    run.timeout = setTimeout(failed, 6000);
    if (direction === 'forward') emit('beatStart');
    emit('change');
    tick();
    if (video.error) failed();
    else if (video.readyState >= HTMLMediaElement.HAVE_METADATA) prepare();
  }
  const unbind = ['change', 'beatStart', 'beatEnd', 'frame'].map(event => player.on(event, () => {
    if (!active && !landing) emit(event);
  }));
  const notice = document.createElement('div');
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  notice.textContent = 'Recorded 3D motion is unavailable. Showing the saved view.';
  notice.style.cssText = 'position:absolute;left:8px;bottom:8px;padding:6px;color:#fff;background:#171717;font:12px system-ui,sans-serif';
  art.append(notice);
  return {
    ...player,
    state,
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
    goTo(slide, beat, options) {
      const before = state();
      if (!liveMotion && options?.animate && beat > before.beat && durations[beat]) {
        start(beat, 'forward');
        return;
      }
      cancel();
      player.goTo(slide, beat, options);
    },
    next(options) {
      if (options?.animate === false || (!liveMotion && failure)) {
        const { beat, totalBeats } = state();
        cancel();
        player.goTo(0, Math.min(beat + 1, totalBeats - 1));
        return;
      }
      if (active) {
        if (active.direction === 'reverse') {
          const { beat, time, duration } = state();
          start(beat, 'forward', Math.max(0, Math.min(.999, time / duration)));
        }
        return;
      }
      if (liveMotion) { player.next(options); return; }
      const { beat, totalBeats } = state();
      if (beat < totalBeats - 1) start(beat + 1, 'forward');
    },
    prev(options) {
      const { beat, time, duration, reversing } = state();
      if (!beat || reversing) return;
      if (options?.animate === false || failure || time <= 0 || !duration) {
        cancel();
        player.goTo(0, beat - 1);
        return;
      }
      start(beat, 'reverse', Math.max(0, Math.min(.999, 1 - time / duration)));
    },
    pause() {
      if (!active) { player.pause(); return; }
      active.playing = false;
      active.video.pause();
      clearTimeout(active.timeout);
      cancelAnimationFrame(frame);
      emit('change');
    },
    resume() {
      if (!active) { player.resume(); return; }
      const run = active;
      if (run.playing) return;
      run.playing = true;
      run.timeout = setTimeout(() => land(run, true), 6000);
      if (!run.waiting) run.video.play().catch(() => { if (run.playing) land(run, true); });
      tick();
      emit('change');
    },
    destroy() {
      cancel();
      for (const video of clips.values()) {
        video.removeAttribute('src');
        video.load();
        video.remove();
      }
      notice.remove();
      unbind.forEach(off => off());
      listeners.clear();
      player.destroy();
    }
  };
}
