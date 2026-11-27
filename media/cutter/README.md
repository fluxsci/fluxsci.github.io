# Clip cutter

A local editor for short social-media cuts of the website's clips. Pick clips from the visual tour,
mark ranges on a timeline, put them in order, and export one MP4. Never published.

```sh
npm run cut                      # = node media/cutter/server.mjs, then open http://127.0.0.1:1436/
node media/cutter/server.mjs --port 1437 --out ~/somewhere/else
```

- **Clips** are the published 1920x1440 files in `site/assets/media/pitch/` (listed in the order and sections of
  `site/visual-tour/index.qmd`) and the guides' clips in `site/assets/media/docs/clips/`.
- **The film** (the homepage's 3:37 Flux film) is listed first. Its 3840x2160 60 fps HLS rendition
  (`site/assets/film/2160p/`) is remuxed once, without re-encoding and without the soundtrack, into `tmp/cutter/`.
- **Editing** plays scrub proxies (1280 wide, a keyframe every 8 frames) with filmstrips, made once per clip into
  `tmp/cutter/` (gitignored, about 850 MB with the film; delete it any time and they are remade).
- **Exports** go to `~/Videos/flux-cuts/<name>.mp4`, with `<name>.json` beside it: the segments (clip, frames,
  speed), the size, the joins and each clip's Flux revision. "Load its sequence" in the Exports list restores it.
  Exports are re-encoded from the published clips (not the proxies) with ffmpeg: H.264 High, CRF 18, BT.709,
  `+faststart`, no audio. Cuts are frame-exact: frame `in` is the first frame kept and `out - 1` the last.
- **Size** "Auto" is 1080 tall in the shape of the first segment: 1440x1080 for a tour clip, 1920x1080 for the
  film. A segment of the other shape is fitted inside with dark bars. 1080 tall fits every common platform's limit
  (X caps uploads near 1920x1200); 4:3 and 16:9 sizes up to 3840x2160 can be chosen instead.

Keys: `Space` play, `←/→` a frame (`Shift`: a second), `I`/`O` set the range, `Enter` add it, `Esc` clear,
`P` play the sequence, wheel zooms the timeline (`Z` to the range, `F` fit), `Ctrl+Z` undoes sequence changes.
Click a segment to re-trim it (changes apply live); drag segments to reorder them.
