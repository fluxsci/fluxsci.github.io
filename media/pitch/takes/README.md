# Takes

One file per clip. A take is a module whose default export is:

```js
export default {
  window: {width: 1840, height: 1100},   // CSS px of the app window (optional; scale defaults to 4)
  aspect: 4/3,                            // of the clip (optional)
  electronArgs: [],                       // extra Electron flags for this take (optional)
  prepare(projectDir) {},                 // edit the SCRATCH project before the app opens it (optional)
  async setup(ctx) { … return {cover}; }, // set the stage, rest the pointer with ctx.place(); cover = the box every camera frame stays inside
  async run(ctx) { … },                   // the performance; must mark('start') and mark('end')
  camera(ctx) { return [[t, frame], …]; } // camera keys on the page clock, from ctx.marks and ctx.boxes
};
```

`record.mjs` runs it: stage (scratch copy of the project, `prepare`), `setup`, then it starts the
grab and calls `run`, then asks `camera` for the keys. Run with `--explore --scale 2` to set the
stage and leave the app up for poking from another script (`lib.mjs` `attach(port)`); see the
header of `record.mjs`.

## ctx

- **The page:** `page` (Playwright), `cdp`, `rect(selector)`, `textRect(scope, selector, text)`,
  `need(what, fn, ms)` (poll until truthy), `shot(file, clip, scale)`, `sleep(ms)`.
- **Input, all logged for the compositor:** `glide(to, {bow, ms})`, `click()`, `doubleClick()`,
  `down()` … `glide` … `up()` (a drag), `key(k, {label, where})`, `hold(k)` / `release(k)` for a
  modifier held across clicks (its badge stays up), `type(text)`, `wheel(dy, {steps, gap})`
  (shows a scroll badge), `place(to)` (before the take only), `at` (where the pointer is).
- **Moments and boxes:** `mark(name)` stamps `ctx.marks[name]`; put every on-screen box the
  camera needs in `ctx.boxes` (they are saved with the take).
- **Framing:** `frame(x0, x1, {cy | top | bottom, within})` is a frame of the clip's aspect
  spanning x0..x1; `around(box, {pad, within})` is the smallest frame holding a box. `lib` has
  the canvas helpers (`openCanvas`, `zoomCanvas`, `panCanvas`, `figurePages`, `union`, `centre`).
- `WIDTH`, `HEIGHT`, `SCALE`, `ASPECT`.

`camera` returns `[time, frame]` pairs in time order; the camera eases between consecutive keys,
so a hold is the same frame twice. Every frame must lie inside `cover` and be at least
`1920 / SCALE` (480) px wide, or the compositor refuses it rather than enlarge pixels.

## House rules (what the owner asked for)

- **Open on the whole figure, move in for each action, show a whole menu or panel when it
  appears, end back on the whole figure.** The last frames dissolve into the first, so start and
  end on the same framing with the pointer back where it rested.
- **Legibility on a phone is set by how many CSS px of the app span the frame.** While something
  small is read or clicked, hold a framing of about 550–800 px. Wider is for showing where things
  are. Flux's menus are a fixed size, so a smaller canvas zoom makes the menu larger relative to
  the plot; hiding the side rails (Ctrl+B, Ctrl+Shift+B) gives the canvas the whole window.
- **Menus open beside the selection** (right, else left, else below, else above: `src/lib/ui/anchor.ts`
  in Flux), aligned to the pointer and clamped to the window. Place the selection so the part of
  the menu being used lands next to it; `colormap.mjs` shows how.
- **The pointer is Flux's own** and is drawn by the compositor; never draw one. Keys get a badge
  (`key`, `hold`); put it where it covers nothing that matters (`where: [fx, fy]`).
- **Pace:** a glide's duration follows its distance; leave 150–250 ms before a click and
  500–900 ms after anything the viewer must take in. A clip is 12–25 s.
- **Continuity:** the Figure 1 clips run in the order c, d, e, f, b and each starts from the
  earlier clips' results (`carryOver` in `_figure1.mjs`), ending in the state of the owner's
  "EndStateFig 1".
- Wait for things with `need(...)`, not fixed sleeps, and throw if the app did not do what the
  take assumes: a wrong take should fail, not film.
