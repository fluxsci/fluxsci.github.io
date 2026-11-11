# Tour build: brief for clip builders

You are building looping demo clips of **Flux** (a desktop app for scientific figures, papers,
slides and reading) for one web page: "Flux: a brief tour", live (unlisted) at
https://fluxsci.org/in-60-seconds/ . Its first section (Flux Figure, six clips) is published and
the owner called it "EXCELLENT, basically PERFECT". You are extending it. The owner's standard:
"as close to perfection and beauty as possible", at or above the clips already there. The
orchestrator (the main session) reviews your work frame by frame and will send it back if it
falls short. Work autonomously; the owner is asleep and cannot answer questions.

## Read first (in this order)

1. `~/fluxsci.github.io/media/pitch/takes/README.md` — the take contract, `ctx`, house rules.
2. `~/fluxsci.github.io/README.md`, section "Article clips" — the pipeline.
3. `~/fluxsci.github.io/plans/brief-tour-slides-paper.md` — the plan for the sections being
   built (what each clip says and shows). Your assignment names your points.
4. Two finished takes as models: `takes/xray-lines.mjs` (menus, search, wheel, key badges) and
   `takes/arrange.mjs` (drags, rail, long choreography). `takes/_figure1.mjs` has Figure 1's
   element ids and `carryOver`.
5. `media/pitch/lib.mjs` and the header of `media/pitch/record.mjs` (the driver).
6. The published page source `site/in-60-seconds/index.qmd`, for the voice of the prose.
7. Flux's user docs for your surface, in `~/fluxsci.github.io/site/docs/*.qmd` (e.g. `slides.qmd`,
   `animation.qmd`, `transforms.qmd`, `slide-media.qmd`, `present-and-export.qmd`, `paper.qmd`,
   `citations-and-figures.qmd`, `export-documents.qmd`, `reader.qmd`, `library.qmd`,
   `comments.qmd`, `connect.qmd`, `shortcuts.qmd`, `cli.qmd`, `commands.qmd`), then the Flux
   source where the docs are not enough: `~/flux/src` (Svelte 5 + Electron; `~/flux/AGENTS.md`).
   Do NOT read `~/flux/docs/AGENT_ENGINEERING_GUIDE-RUNNING.md` in full (12k lines); grep it.

Look at the published clips' contact sheets to calibrate: `/tmp/flux-xray-take-9yy8/sheet.png`,
`/tmp/flux-arr-take2-GqE0/sheet.png`, `/tmp/flux-pitch-axisview-A48b/sheet.png` (if still there).

## The project and its figures

- Demonstration project (the owner's, 2.7 GB): `~/FluxProjects/flux_demo_master/MASTER_DEMO_FluxProj`.
  Canvas `canvas_4` holds **Figure 1 "Protein Structure"** (panels a–f; the Figure clips refine
  it into the state of "EndStateFig 1"), **Figure 2** (planet earth) and **Figure 3**.
  Figure 1 and Figure 2 are the owner's markers for the quality of materials.
- Every clip of the new sections keeps using **Figure 1 in its finished state** where it can
  (`carryOver(project, ['c','d','e','f','b'])` in `prepare`), so a reader sees the figure they
  just watched being made become a talk and then a paper.
- The plot generators live in `~/FluxProjects/flux_demo_master` (a uv project;
  read its `AGENTS.MD` and `CORE/protein_structure/README.md`). You own this code for the
  purposes of the tour: when a clip needs a plot that does not exist, **make it** with fluxplot
  there (new generator code, output into the project's `plots/` like the others), to the
  quality of Figure 1. New files only; never change or delete what the owner made.

## Materials rule

- A take always runs on a **scratch copy** of the project, made fresh by the stage; the take's
  `prepare(projectDir)` may edit that copy before the app opens it.
- New **plots**: add them to the real project's `plots/` via the generator repo (additive).
- New **decks, slides, figures, manuscripts, bibliographies, library items**: never write them
  into the real project. Either build them in `prepare`/`setup` every run (scripted with the
  Flux CLI, `node ~/flux/dist/flux-cli.mjs help`, or by driving the UI before the grab starts),
  or build them once by hand in an `--explore` session and save them as an overlay:
  `node media/pitch/save-overlay.mjs <scratch project> <original project> <name>` writes
  `media/pitch/materials/<name>/`; `lib.applyOverlay(projectDir, '<name>')` in `prepare` applies
  it. Keep overlays small (no multi-hundred-MB assets) and say in the take what they hold.
- The stage's HOME is isolated and empty: no FluxConfig, no library, no settings, no agent
  credentials. Never read or copy the owner's `~/FluxConfig`, their library, or their notes.
  Anything a clip shows from a "library" must be demo material you assemble: real,
  correctly cited papers; PDFs only if openly licensed (CC BY), with the licence noted in your
  report so the page can credit them.
- Writing shown on screen (a manuscript, a reply) must be real and correct: real science, real
  references with real DOIs. No lorem ipsum, no invented citations.

## Honesty rule

Film only what the app really does, driven by real input. Never draw fake UI, never inject DOM
or CSS to change how the app looks, never fake a result. (The one page addition is the 8 px
clock square the recorder adds itself.) If a planned beat is not possible in the app as built,
use the nearest real feature that makes the same point and say so in your report. If the app
shows a bug on camera, film around it if that is honest, and report it.

## Your stage, and running things

Each builder has a private X display and debugging port (given in your assignment). Always:

```sh
cd ~/fluxsci.github.io
P=~/FluxProjects/flux_demo_master/MASTER_DEMO_FluxProj
export FLUX_XVFB=/tmp/flux-analysis-xvfb/root/usr/bin/Xvfb

# explore: set the stage (prepare + setup) and leave the app up; poke it from /tmp scripts
(nohup node media/pitch/record.mjs --flux-source ~/flux --project $P --take <name> --explore --scale 2 --display <D> --port <PORT> > /tmp/explore-<name>.log 2>&1 &)
until grep -q '"exploring"\|rror' /tmp/explore-<name>.log; do sleep 2; done
#   scripts: import {attach} from '~/fluxsci.github.io/media/pitch/lib.mjs'; const {page,cdp,shot,rect,sleep,browser}=await attach(<PORT>);
#   run them with cwd ~/fluxsci.github.io (node resolves @playwright/test from there); shot(file, clip, scale) saves a PNG to Read.

# a full take, composed into a working folder for review (never installs into the site)
K=$(mktemp -d /tmp/tour-<name>-XXXX)
node media/pitch/make.mjs --flux-source ~/flux --project $P --take <name> --keep $K --no-install --display <D> --port <PORT>
#   → $K/clip.mp4, clip-1280.mp4, poster.webp, sheet.png (contact sheet, every 0.5 s), frames/ (full-size, every 1.25 s)
# after a camera-only change: same command with  --reuse $K --no-install  (no re-recording)

# stop your stage (ONLY this way; never `pkill -f`, it kills your own shell)
X=$(pgrep -a -x Xvfb | awk '$3==":<D>"{print $1}'); [ -n "$X" ] && kill $(ps -o ppid= -p $X | tr -d ' ')
```

- Recording and composing each wait for one machine-wide lock, so a full take can sit for a few
  minutes before it starts. That is normal; do not kill it.
- Wait with `until <check>; do sleep 2; done`, never with bare long sleeps.
- A stage copies 2.4 GB into `/tmp` (RAM-backed) and removes it when stopped. Stop your explore
  stage before a full take and when you finish. Never leave stages running.
- The window is 1840×1100 CSS px at 4 device px per CSS px by default (`window` in the take
  changes it). `--scale 2` is for exploring only.
- 3D (WebGL) needs the flags and the scale-2 window in `takes/model3d.mjs`; copy its
  `electronArgs`, `window` and its renderer check.
- Outside the Figure/Slide canvas the app shows the system cursor; the compositor draws Flux's
  pink arrow there too. Nothing to do.
- If a take shows `gaps over 25 ms (longest N ms)` with N above ~130 during action, re-record.

## What a clip must be

- 4:3, 1920×1440 output, a seamless loop: start and end on the same framing with the pointer
  back where it rested; the last 0.45 s dissolves into the first frame.
- 10–25 s; a section's showpiece may run to 40 s. One idea per clip.
- Open wide enough to show where we are, move in for each action, show a whole menu or panel
  when it appears, go close (about 550–800 CSS px across) while something small is read or
  clicked, end on the result. Nothing important half-cut at a frame edge; no stray hover
  outlines, tooltips or toasts over the subject.
- Every key press gets a badge (`key`, `hold`); wheel turns badge themselves.
- Text on screen must be readable on a phone held upright (the clip is ~370 px wide there).
  Prefer larger app text: fewer CSS px across the frame, never browser zoom tricks.
- Throw from the take when the app did not do what the take assumes. A wrong take must fail.

## Files you may write

- Your take files `media/pitch/takes/<name>.mjs` (names in your assignment), plus a shared
  helper for your group if useful (`takes/_<group>.mjs`).
- Overlays under `media/pitch/materials/<name>/`.
- Generator code and new plots in the demo repo (see above).
- Scratch files under `/tmp`.
- Nothing else. In particular: not `lib.mjs`, `record.mjs`, `compose.py`, `stage.mjs`,
  `cursors.mjs`, `badges.mjs`, `make.mjs`, other builders' takes, `site/**`, `media/pitch.json`,
  anything in `~/flux`, and no git commands that change state. Do not build or publish the
  site. If the shared code lacks something, work around it inside your take with `ctx.cdp` /
  `ctx.page` and put the request in your report.

## Review your own work before reporting

After every full take, Read `sheet.png` and at least four full-size frames from `frames/` at
the moments that matter. Check: framing, legibility, pacing (nothing rushed, nothing dead),
sharpness after a zoom or resize (the app re-renders a moment later; wait for it), the pointer
never hiding what it points at, badges not covering content, the final state correct. Iterate
until you would be proud to show it. Typically that is three to six full takes per clip.

## Report (your final message)

For each clip: the kept take folder (`/tmp/tour-…`), duration, sizes of `clip.mp4` and
`clip-1280.mp4`, a one-line beat list, the page text you propose (see below), every deviation
from the plan and why, app bugs seen, licences/credits for any third-party material shown, and
anything the orchestrator should change in shared code. Plain text.

Proposed page text, per clip, in the voice of the published page (plain, concrete, second
person, no hype, no em dashes): the numbered point's paragraph (1–3 sentences), a one-sentence
caption for under the clip, and an `aria-label` describing what happens for someone who cannot
see it (2–4 sentences). Shortcuts in **bold**.

Leave the kept take folders in place; the orchestrator installs them.
