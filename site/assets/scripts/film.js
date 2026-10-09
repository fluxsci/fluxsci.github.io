/* The Flux film. Nothing is fetched until a visitor asks to play it; then the poster becomes a native
   <video>. Safari and iOS play the HLS ladder natively. Elsewhere this small player appends the same
   fragmented-MP4 segments into one MediaSource buffer (one continuous timeline, no gaps between segments),
   choosing the rendition that fits the player's size and the measured connection. */
(() => {
  "use strict";
  const frame = document.querySelector("[data-film]");
  const launch = frame?.querySelector("[data-film-start]");
  if (!frame || !launch) return;
  const MASTER = new URL(frame.dataset.filmSrc, document.baseURI).href;
  const MS = window.ManagedMediaSource || window.MediaSource;
  const AHEAD = 24, BEHIND = 12;

  launch.addEventListener("click", () => {
    const video = document.createElement("video");
    video.className = "film-video";
    video.controls = true;
    video.playsInline = true;
    video.preload = "auto";
    video.poster = frame.dataset.filmPoster;
    video.setAttribute("aria-label", launch.getAttribute("aria-label").replace(/^Play /, ""));
    const track = document.createElement("track");
    Object.assign(track, { kind: "captions", src: frame.dataset.filmCaptions, srclang: "en", label: "English" });
    video.append(track);
    // WebKit (Safari, every iOS browser) streams HLS itself, with AirPlay; other engines use the player below.
    const native = video.canPlayType("application/vnd.apple.mpegurl");
    if (native && (/Apple/.test(navigator.vendor) || !MS)) video.src = MASTER;
    else if (MS) stream(video);
    else video.src = MASTER;
    frame.replaceChildren(video);
    frame.classList.add("is-playing");
    video.focus({ preventScroll: true });
    video.play().catch(() => {});     // inside the click: the visitor asked for sound
  });

  function parse(text, base) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const attrs = line => Object.fromEntries([...line.matchAll(/([A-Z-]+)=("[^"]*"|[^,]*)/g)].map(m => [m[1], m[2].replace(/^"|"$/g, "")]));
    const variants = [], segments = [];
    let init = null, t = 0, duration = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("#EXT-X-STREAM-INF:")) {
        const a = attrs(line), [w, h] = (a.RESOLUTION || "0x0").split("x").map(Number);
        variants.push({ url: new URL(lines[++i], base).href, bandwidth: Number(a.BANDWIDTH), codecs: a.CODECS, width: w, height: h });
      } else if (line.startsWith("#EXT-X-MAP:")) init = new URL(attrs(line).URI, base).href;
      else if (line.startsWith("#EXTINF:")) duration = parseFloat(line.slice(8));
      else if (!line.startsWith("#")) { segments.push({ url: new URL(line, base).href, start: t, end: t + duration }); t += duration; }
    }
    return { variants: variants.sort((a, b) => a.height - b.height), init, segments, total: t };
  }
  async function text(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.text();
  }

  function stream(video) {
    const ms = new MS();
    if (window.ManagedMediaSource) video.disableRemotePlayback = true;
    video.src = URL.createObjectURL(ms);
    let sb = null, ladder = [], playlists = new Map(), current = -1, appendedInit = -1, mime = "";
    let throughput = 0, busy = false, wake = null, generation = 0;

    const op = fn => new Promise((resolve, reject) => {
      const done = () => { sb.removeEventListener("updateend", done); sb.removeEventListener("error", fail); resolve(); };
      const fail = () => { sb.removeEventListener("updateend", done); sb.removeEventListener("error", fail); reject(new Error("append failed")); };
      sb.addEventListener("updateend", done); sb.addEventListener("error", fail);
      try { fn(); } catch (error) { sb.removeEventListener("updateend", done); sb.removeEventListener("error", fail); reject(error); }
    });
    async function fetchBytes(url) {
      for (let attempt = 0; ; attempt++) {
        try {
          const started = performance.now(), response = await fetch(url);
          if (!response.ok) throw new Error(`${response.status} ${url}`);
          const bytes = await response.arrayBuffer(), seconds = Math.max(0.05, (performance.now() - started) / 1000);
          const bps = bytes.byteLength * 8 / seconds;
          if (bytes.byteLength > 250000) throughput = throughput ? 0.6 * throughput + 0.4 * bps : bps;
          return bytes;
        } catch (error) {
          if (attempt >= 3) throw error;
          await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
        }
      }
    }
    async function playlist(index) {
      if (!playlists.has(index)) playlists.set(index, text(ladder[index].url).then(body => parse(body, ladder[index].url)));
      return playlists.get(index);
    }
    // The sharpest rendition the player can show, limited by what the connection sustains.
    function choose() {
      const box = video.getBoundingClientRect(), full = document.fullscreenElement || document.webkitFullscreenElement;
      const need = (full ? screen.height : box.height || 720) * Math.min(window.devicePixelRatio || 1, 2);
      let ideal = ladder.findIndex(variant => variant.height >= need);
      if (ideal < 0) ideal = ladder.length - 1;
      if (!throughput) {                       // until the first segment is measured, start no higher than 1080p
        const hd = ladder.findIndex(variant => variant.height >= 1080);
        return hd < 0 ? ideal : Math.min(ideal, hd);
      }
      while (ideal > 0 && ladder[ideal].bandwidth * 1.25 > throughput) ideal--;
      return ideal;
    }
    function bufferedAhead(t) {
      const ranges = sb.buffered;
      for (let i = 0; i < ranges.length; i++) if (ranges.start(i) <= t + 0.1 && ranges.end(i) > t) return ranges.end(i);
      return t;
    }
    async function pump() {
      if (busy || !sb) return;
      busy = true;
      const token = generation;
      try {
        while (token === generation) {
          const t = video.currentTime, edge = bufferedAhead(t);
          const list = await playlist(current < 0 ? choose() : current);
          if (edge >= Math.min(list.total, t + AHEAD) - 0.05) {
            if (edge >= list.total - 0.05 && !sb.updating && ms.readyState === "open") ms.endOfStream();
            await new Promise(resolve => { wake = resolve; setTimeout(resolve, 1000); });
            continue;
          }
          const next = list.segments.findIndex(segment => segment.end > edge + 0.05);
          if (next < 0) break;
          const index = choose(), chosen = await playlist(index), variant = ladder[index];
          const type = `video/mp4; codecs="${variant.codecs}"`;
          if (appendedInit !== index) {
            const init = await fetchBytes(chosen.init);
            if (token !== generation) break;
            if (type !== mime && sb.changeType) { sb.changeType(type); mime = type; }
            await op(() => sb.appendBuffer(init));
            appendedInit = index;
          }
          current = index;
          const bytes = await fetchBytes(chosen.segments[next].url);
          if (token !== generation) break;
          try { await op(() => sb.appendBuffer(bytes)); }
          catch { await evict(t, 0); await op(() => sb.appendBuffer(bytes)); }
          await evict(video.currentTime, BEHIND);
        }
      } catch (error) {
        console.warn("Flux film:", error);
      } finally {
        busy = false;
        if (token !== generation) pump();
      }
    }
    async function evict(t, keep) {
      const ranges = sb.buffered;
      for (let i = 0; i < ranges.length; i++) {
        const a = ranges.start(i), z = ranges.end(i);
        if (z < t - keep) await op(() => sb.remove(a, z));
        else if (a < t - keep - 1) await op(() => sb.remove(a, t - keep));
        if (keep === 0 && a > t + AHEAD) await op(() => sb.remove(a, z));
      }
    }
    ms.addEventListener("sourceopen", async () => {
      if (sb) return;
      try {
        const master = parse(await text(MASTER), MASTER);
        ladder = master.variants.filter(variant => MS.isTypeSupported(`video/mp4; codecs="${variant.codecs}"`));
        if (!ladder.length) throw new Error("no playable rendition");
        const first = await playlist(choose());
        mime = `video/mp4; codecs="${ladder[choose()].codecs}"`;
        sb = ms.addSourceBuffer(mime);
        sb.mode = "segments";
        ms.duration = first.total;
        pump();
      } catch (error) {
        console.warn("Flux film:", error);
        video.src = MASTER;     // last resort: a browser with its own HLS support
        video.play().catch(() => {});
      }
    }, { once: true });
    video.addEventListener("seeking", () => {
      if (!sb) return;
      if (bufferedAhead(video.currentTime) > video.currentTime + 0.2) { wake?.(); return; }
      generation++; appendedInit = -1;            // a fresh start: the next append re-sends its init segment
      if (!busy) pump(); else wake?.();
    });
    for (const event of ["timeupdate", "playing"]) video.addEventListener(event, () => { if (!busy) pump(); else wake?.(); });
    const refit = () => { if (!busy) pump(); };
    document.addEventListener("fullscreenchange", refit);
    video.addEventListener("webkitendfullscreen", refit);
  }
})();
