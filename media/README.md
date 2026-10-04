# Reviewed product media

Normal builds use checked-in screenshots, native player exports, fonts and plot files. No application code, private project, or personal Flux configuration is read during a normal build.

## Inputs and boundaries

`flux-source.json` pins the reviewed upstream Flux revision. The owner's visual source is supplied explicitly as `--project`; for this milestone it is the `FLUX_TEST_PROJ` folder inside the owner-provided `main_test_project_and_data` directory. This local location is deliberately not stored in public output.

Only the selected files under `plots/` are read. Existing test decks and figure canvases are not showcase material and are never copied. `media/showcase.mjs` creates a separate, new website presentation and figure composition from byte-identical source plots. All values are synthetic. `media/demo-manuscript.qmd` is the original website narrative; generated figure captions describe the illustrations without claiming experimental results.

The temporary capture project lives in `.cache/visual-project/`. It is not an editable example shipped with the website and is never published. Refresh refuses an unpinned or modified product checkout. The owner's input project is read-only throughout.

## Refresh

Prepare a clean Flux checkout at the pinned revision, with its locked Node dependencies installed. Check port 1420 before starting that checkout's dev server; stop a server you own when finished. Then, from the website root:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /path/to/pinned/flux --project /path/to/authored/FLUX_TEST_PROJ
node scripts/capture-media.mjs --flux-source /path/to/pinned/flux
npm test
```

Set `FLUX_CHROME` to the Chrome/Chromium executable if Brave is not installed. Set `FLUX_URL` when the isolated product preview uses a port other than 1420. The screenshot script mirrors the temporary composition through the real application's in-memory FileBridge; it seeds an isolated Library using explicitly labeled demonstration notes and an original manuscript PDF. It accesses no personal library and fabricates no application UI. Screenshots are captured at 2× display density; manifest dimensions describe their displayed viewport.

Review all five workspaces and part editing, plus each slide at every step. The slides are exported using `mountSlideEmbed` from the pinned app. Animation, transforms, and per-part rendering belong to Flux. Website code only loads the isolated player, changes scene, and pauses it offscreen.

`media/native-assets.json` records the pinned product revision, original plot input hashes, and published runtime/plot hashes. `media/screenshots.json` records capture conditions and image hashes. `media/installer.json` pins the upstream installer's exact bytes; copy it from the same reviewed revision when deliberately updating it.

## Licenses

The native runtime carries Flux's MIT notice and licenses for every bundled third-party package under `site/assets/licenses/`. Gelasio's SIL OFL notice is in `site/assets/fonts/OFL.txt`. Plot examples in this milestone are the owner's original synthetic demonstrations; the former Allen Institute example and its assets are no longer published.
