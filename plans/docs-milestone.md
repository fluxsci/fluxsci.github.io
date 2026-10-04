# Documentation review milestone — 2026-10-04

Deliver and publish the homepage, installation, documentation navigation/search, and two complete guides. Pause for owner feedback before the full migration.

## Delivered pages

- `/`: refreshed native application screenshots; unchanged source plots; new native two-scene presentation; local install and docs links. Legacy example ZIP and source fixture retired.
- `/install/`: reviewed curl installer, current release availability, supported platforms, setup window, Python plotting, verification, updates, troubleshooting, and contributor path.
- `/docs/`: seven topic groups across the ecosystem, with 24 destinations and explicit upstream markers.
- `/docs/first-project.html`: runnable Python example, figure editing, literature, writing, presentation, and export.
- `/docs/projects-and-files.html`: source/managed/derived files, linked-source states, references, autosave/conflicts, AI coexistence, and portable handoff.

## Remaining migration after feedback

1. Paper: editor, scientific content, figures/citations, tables, comments, inline slides, journals/export.
2. Figure: gallery, layouts, transforms, typography/colors, X-ray and source sync, 3D models, exports, metadata and reference identity.
3. Slides: composition, beat model, animations and timelines, data/shape morphs, video and 3D, presentation/export, native embeds.
4. Library and Reader: intake, metadata, attachments, organization, full-text search, reading/tabs/splits, notes, provenance/snips.
5. Fluxplot: current Python API, semantic contracts, recipes/notebooks, style/color/consistency/accessibility, signature plots, statistics, image channels, native 3D/GLB fields/shapes.
6. Agents: setup, project sessions, principal/worker roles, context/memory, tools/skills, review comments and Inbox.
7. Integrations and reference: Zotero, browser capture, GROBID, CLI, keyboard shortcuts, files/config; distinguish the independent Lighttable companion.

Keep the maintained upstream guides as the factual baseline and verify UI labels against the app. Replace each upstream destination only after its new page is complete; do not create empty routes.

## Source and release state

Website initially at 0f5546b. Flux fetched through upstream 9f5c7ccb; local Mac commits preserved by merge 7f3dc46a (merge conflict in the disk-read test resolved to upstream's equivalent fix; 22 checks passed). Assets use a clean upstream 9f5c7ccb checkout, not the local merge. Fluxplot fast-forwarded through 713d0f6. The user explicitly requested that v0.2.0 stay in draft. Publishing the website must not publish that release.

The owner subsequently clarified that all existing test slides are unsuitable. Only original plot files are read; the website's slides and compositions are new. Temporary outputs live under `.cache/` and do not alter the original project. Two untracked remnants of the retired example were moved to `.cache/retired-example-local-files/` so they remain locally recoverable; tracked history remains in Git.

## Verification before publication

- Publication allowlist, local routes/fragments, metadata, privacy checks, and reviewed output hashes pass: 41 files, 4.82 MB.
- 81 browser checks pass locally across Chromium, desktop WebKit, and mobile Safari, including accessibility in light/dark, keyboard navigation, search/copy controls, no-JavaScript fallbacks, screenshots, and native slides. Local Firefox fails before page load with “Could not find profile folder”; all 108 checks, including Firefox, passed on Ubuntu in Actions run 37188429183 before deployment.
- The tutorial's Python example runs against the published fluxplot package and writes all three expected files.
- The pinned installer's 19 fixture checks pass. Linux download tests use a test-only x86-64 architecture shim on this arm64 Mac; they do not run apt or perform a real Linux install. Website installer bytes match upstream exactly.
- Native playback traversed all four states in both original scenes with no reported runtime issues. Desktop/mobile and light/dark layouts, application screenshots, and slide composition were visually reviewed. Source plot hashes match the author's files.

## Deployment and concurrent release change

Commit ae0a9a4 was deployed successfully by Actions run 37188429183. All five live page URLs returned 200, the installer matched reviewed upstream bytes, and live search/navigation, inline playback, mobile geometry, and the styled 404 passed.

The app release was verified as draft before the website push. During that deployment, v0.2.0 became public at 2026-10-04 08:20:41 UTC through a separate action. This task did not change the app release. Anonymous GitHub API and asset requests confirmed the public state. The installation note was corrected to reflect that availability without modifying the release itself.
