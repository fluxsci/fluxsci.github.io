# Guide clips

These clips use production Electron, a 16:9 frame, and a 4× capture on private Xvfb. The guide
takes and their published manifest use the shared recorder, Flux cursor and compositor.
[Take contract](../pitch/takes/README.md)

The owner’s local `media/pitch/GUIDE.md` has a complete walkthrough of the capture workflow.

Create a new local project with the production `flux new <path> --title "Figure tutorial"` CLI.
Keep this as a disposable Capture project. Supply these files in its `plots/` directory:

- `growth.svg` plus the manifest and recipe produced by `media/docs-plots/make_docs_plots.py`.
- `rose.svg`, `section-a.svg`, `section-gamma.svg` and their manifests, which come from the
  authorized neuroscience showcase prepared by `scripts/refresh-flux-assets.mjs`.
- `cells-in-motion.fluximg`, made by `media/stills/make-image-stack.py` from synthetic pixels.

Capture and review each take, then install it. The site build verifies the installed hashes.

```sh
node media/docs-clips/make.mjs --take plots-rail-place --work /tmp/docs-rail \
  --flux-source /path/to/flux --project /path/to/capture-project --display 149 --port 9399
node media/docs-clips/make.mjs --take plots-rail-place --work /tmp/docs-rail --install
```

Review the contact sheet in the working folder, several full frames and the phone encode.
The shared capture tools only write to a scratch copy of the project. As in the capture
guide, pick an unused display and port and pass `FLUX_XVFB` if Xvfb is outside PATH.

For the private Mesa software stage, set `__EGL_VENDOR_LIBRARY_FILENAMES` to Mesa's vendor
file if the host's default EGL backend fails in Xvfb. The two image takes enable SwiftShader
to give the unmodified image board WebGL2. On a machine with exhausted inotify instances,
`CHOKIDAR_USEPOLLING=true` selects the app's supported polling watcher for the isolated session.
