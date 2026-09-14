# Flux website and user guide — content and styling plan

**Date:** 2026-09-13

**Status:** Editorial and visual roadmap for the independent `fluxsci/fluxsci.github.io` website. The current implementation covers only the complete homepage and infrastructure; guide, module, and example subpages are later phases. Media assignments below describe the full-site target, not a claim that every asset is already produced.

The first homepage is now implemented and reviewed. Its actual media, visual treatment and
verification are recorded in the [implementation review](implementation-review.md).

**Companion:** [Technical implementation plan](technical-plan.md). That document owns the framework, repository, publishing, build, and verification decisions. This document owns the story, page inventory, feature coverage, media assignments, and visual conventions. Read together, they define the public website and its phased delivery. `site/` owns public source in this repository; these internal plans live in `plans/`.

**Product baseline:** `fluxsci/flux` at `4bb72d895b7879acc404ca83863cdc385982b0b5`, including the new inline slide embeds. Product claims below derive from the current mode guides, configuration and agent references, and inspected implementation. Recheck claims against the release/revision used for launch.

## 1. The story and the two reader journeys

Present Flux as **a desktop studio for scientific work, where papers, figures, slides, reading, and references connect through files the researcher owns**. Lead with the work and its visible results. Explain configuration and agent tooling once the visitor understands the studio.

Proposed homepage copy direction:

> **One studio for your scientific work.**
>
> Write papers, compose figures, build talks, and keep your reading connected. Flux brings the work together in a project folder you own.

Primary action: **Get started** → installation. Secondary action: **Explore Flux** → the five module sections. A persistent **User guide** link serves people who already have Flux. Use a **Download** button only once a corresponding release artifact and platform instructions have been verified.

The website should support two journeys without forcing either through the other:

| Reader | What they need to learn or do | Intended path |
| --- | --- | --- |
| New visitor | Understand Flux, see real work, judge whether it fits their research | Homepage → relevant module showcase → example or installation |
| Working user | Complete a task or resolve a specific uncertainty | Search or guide index → task page → exact section/shortcut/example |
| Researcher evaluating agent integration | Understand control, context, supported tools, and review | Agents showcase → setup → context and review guide → reproducible example |

Teach five principles, each with a visible demonstration:

1. **Keep the work connected.** A saved reference becomes a citation; a composed figure appears in a paper; a slide becomes an interactive document block.
2. **Keep the files yours.** Show a readable project folder and the distinction between authored sources and generated exports.
3. **Preserve the meaning of a plot.** Show selection of a named series or label and an accepted source update that retains its styling.
4. **Make precise work feel immediate.** Demonstrate direct editing with honest recordings. Treat responsiveness as a design principle, not an unqualified benchmark claim.
5. **Let agents work alongside you.** Show a concrete, reviewed change with persistent project context. Explain the terminal and tools without requiring visitors to know the architecture first.

Use one recurring research example across the site. A connected story will explain Flux more clearly than a sequence of unrelated feature screenshots.

## 2. Navigation and full-website page inventory

Routes below are relative to the organization-site root `https://fluxsci.github.io/`. Directory entries map to `index.qmd`; entries ending in `.html` map to identically named `.qmd` sources. These are proposed destination paths, not links to pages that already exist.

The primary navigation is **Explore · User guide · Examples · Get started**, with Search, appearance, and GitHub as supporting controls. Explore contains the five modules, FluxConfig, Agents, and Connected workflows. Keep module names visible alongside icons. The home page also has a compact, non-sticky row of links to its five module sections.

Guide navigation groups **Start here · Paper · Figure · Slides · Library · Reader · FluxConfig · Agents · Concepts · Integrations · Reference**. A small companion link identifies Lighttable separately. The active group expands; the rest remain easy to scan. A page contents rail provides section navigation on wide screens. Search results show the page title, module/type, and a useful excerpt; a user searching for “insert slide” should reach the task guide before a broad showcase page.

### Showcase and entry pages — 10 pages

| Route | Page title / purpose | Primary visual and next action |
| --- | --- | --- |
| `/` | Flux — the whole studio and its principles | `S01`, five substantial module sections, one `E01` embed; Get started |
| `/paper/` | Paper — write with the evidence beside you | `S02`, `S08`, `E01`; open the Paper guide |
| `/figure/` | Figure — compose and refine scientific figures | `S03`, `S07`, `S13`; compose a first figure |
| `/slides/` | Slides — explain a result one step at a time | `S04`, `E01`; author an animation or open the example |
| `/library/` | Library — one collection across your projects | `S05`, `D02`; collect and search papers |
| `/reader/` | Reader — read, annotate, and return to the evidence | `S06`, `S12`; read and annotate a paper |
| `/fluxconfig/` | FluxConfig — your research environment across projects | `D02`, `S10`; understand and configure its contents |
| `/agents/` | Agents — a collaborator with project context | `D03`, `S11`; set up a principal agent |
| `/workflows/` | Connected workflows — routes through the studio | `D01`, three short workflow summaries; open a worked example |
| `/examples/` | Examples — inspect the result and try the source | Three clearly described examples with stills and source downloads |

### User guide — 30 pages

These are substantive pages, not a separate page for every command. Use stable section anchors for smaller features. The existing 20-page corpus supplies much of the material.

| Route under `/guide/` | Title and coverage | Main evidence |
| --- | --- | --- |
| `index.html` → canonical `/guide/` | Guide start: installation, first project, module routes, common tasks, reference | Task links; small `D01` |
| `installation.html` | Install and verify: supported delivery route, platform steps, companions by capability, first run, troubleshooting | Actual release/source instructions and verification output |
| `getting-started.html` | Your first connected project: open the example, read, compose, cite, make a slide, export | Crops from `S01`–`S06`; expected result at each step |
| `paper/` | Write and organize: workspace, documents/folders, source and preview, formatting, tables/math, local corrections, dictionaries, text size, split panes, Vim | `S02`, `S16`; focused table/text-size crops |
| `paper/citations-and-figures.html` | Cite and reference: DOI paste, citation groups/styles, bibliography, figures/panels, captions, insertion and resizing | `S02`, `S13` |
| `paper/inline-slides.html` | Insert and use a slide: deck picker, steps, sizing, replacement, source changes, export differences, source syntax | `S08`, `E01`, `D04` |
| `paper/review-and-export.html` | Review and publish: comments, detached threads, margin panes, PDF/Word/HTML, journal styles and Journal Check, selected-document export, failures | `S09`, `S16`, `D04` |
| `figure/` | Compose a figure: canvas, gallery/import, selection, layers, properties, physical size, arranging, frame resizing, drawing, guides, undo | `S03`, `S07` |
| `figure/semantic-plots.html` | Work inside a plot: fluxplot contract, plain-image differences, X-ray/parts, overrides, recipes, source refresh/freeze/relink, dissections | `S03`, `D01`; source-status and dissection crops |
| `figure/exporting-and-reuse.html` | Identity and output: titles/reference keys/numbers, families, panels/captions, catalog/used-in, presets/cascade, print formats, Send to deck | `S13`, export crop, `D01` |
| `slides/` | Build a deck: filmstrip, layouts, shared composition tools, stage size, notes, presets, figure-to-slide copies | `S04` |
| `slides/animation.html` | Animate a result: Start/steps, Design versus Edit after step, Animator, appearances, changes, emphasis, exits, timing, semantic parts, morphs/ghosts, cascade | `S04`, `E01`; later `V02` |
| `slides/presenting-and-sharing.html` | Present and share: presenter controls, HTML export, source assets, document insertion, deletion dependencies, limits | `D04`, full-deck download when verified; link to inline-slide guide |
| `library/` | Build the collection: DOI/URL, imports, inbox, web capture, Zotero entry point, PDFs/supplements, copy versus link, enrichment and failures | `S05`, `D02`; import/PDF detail crops |
| `library/search-and-organize.html` | Find and organize: field filters, `ft:`, result-to-Reader jumps, World search, tags/status/collections, sorting, bulk actions, project subset | `S05`; later `V03` |
| `reader/` | Read and navigate: layouts, page/zoom, tabs and split panes, find, outline, reference/cited-by panes, citation peek, supplements, library panel | `S06`, `S17` |
| `reader/annotations-and-snips.html` | Capture evidence: anchored highlights/comments, notes export, figure pop-outs, snips/provenance, terminal selection handoff | `S12`; later `V03` |
| `fluxconfig/` | Understand FluxConfig: resolved location, FluxLib, user/stock/project contexts, agent roster, design/slide/animation presets, customization ownership, Settings/Move | `D02`, `S10`; sanitized `flux config` output |
| `fluxconfig/backup-and-portability.html` | Back up and move: project versus personal state, copied versus linked PDFs, external paths, machine prerequisites and credentials | `D02`; explicit copy/restore checklist |
| `agents/` | Set up and work with agents: supported CLI configuration, principal launch, terminal, worker policy, ordinary app use without an agent | `S11`, small launch example |
| `agents/context-and-review.html` | Maintain context and review: mission/notebook/rules, user versus stock context, comments, Add/Send, attend behavior, dispatch records, current-tool boundaries | `D03`, `S11`, `S16` |
| `concepts/projects-and-files.html` | Project model: source/derived/app-managed files, autosave, external edits/conflicts, version control, portability, multiple machines | `D01`; concise tree |
| `concepts/library-and-fluxlib.html` | One library, many projects: citekeys, project bibliography subset, attachments, indexes, portability boundaries | `D02` |
| `integrations/zotero.html` | Connect Zotero: Better BibTeX auto-export, one-way additive sync, copy/link choice, large libraries, backfill, disconnect/troubleshooting | `S14` |
| `integrations/web-capture.html` | Capture from the browser: setup/status, article/PDF/supplement capture, where files land, supported browser behavior | `S15` |
| `integrations/grobid.html` | Optional structured extraction: what it adds, prerequisites, setup, storage, removal and limits | Small input/output diagram and commands; no required hero |
| `reference/shortcuts.html` | Searchable action reference: module, context, exact platform binding, click/menu alternative | Keycaps and compact table |
| `reference/cli.html` | CLI and MCP: setup, shared verb reference, examples, insert-slide-embed and compile --doc, links to deeper agent guidance | Generated reference and copyable examples |
| `reference/project-layout.html` | Exact file map: canonical paths, ownership, derived files, legacy layouts, embedded-slide posters | Annotated file tree |
| `companions/lighttable.html` | Lighttable: what the separate companion does and where to read its own guide | Small approved still or external source link |

For the guide root, author `guide/index.qmd` and link to `/guide/`; `index.html` above identifies the generated file only. All other directory routes follow the same convention.

### Worked examples — 3 pages, plus one utility page

| Route | Deliverable and learning outcome |
| --- | --- |
| `/examples/connected-research.html` | A small complete research project, its paper/figure/talk outputs, and a guided path from reading to writing. Each stage links to its task guide. |
| `/examples/animated-result.html` | One real inline slide with explanatory steps, the static step-0 output, and downloadable source; demonstrates authoring and document reuse. |
| `/examples/agent-review.html` | A short, reproducible review task with the starting document, actual feedback, resulting change, and sanitized context. Clearly identify any excerpted recording and its revision. |
| `/404.html` | A useful missing-page message with search, guide, and home links. No promotional animation. |

The full roadmap is **43 content pages plus the 404 page**. The homepage phase publishes only `/` and `/404.html`, with a native demo asset; navigation uses section anchors and the existing upstream guides rather than placeholders. Redirects and generated demo player files do not count as editorial pages. The 30 guide pages reorganize and extend the current corpus; they do not imply 30 new tutorials written from scratch. There is no launch blog, testimonial section, pricing page, or public roadmap to maintain.

## 3. Homepage composition, section by section

Aim for roughly 900–1,200 words across the homepage, with substantial visual sections. This is an editorial target, not a rigid limit. The five module sections each get approximately 70–110 words, one prominent visual, two or three concrete capabilities, and a clear guide link.

| Order / anchor | Message and content | Composition and media |
| --- | --- | --- |
| 1. Hero | The studio, the five kinds of work, files you own; two entry actions | Warm paper, large serif title, one wide `S01` screenshot beneath the copy. Avoid a tiny collage of five unreadable windows. |
| 2. Principles | Connected work, owned files, meaningful plots, immediate editing, optional agent collaboration | Five short statements in a quiet two-column editorial list; one small connection diagram. No decorative scorecards. |
| 3. `#paper` | Write with citations, figures, and the margin close at hand | `S02` with readable prose and a figure/citation detail; links to Paper showcase and writing guide |
| 4. `#figure` | Compose at publication size and edit meaningful plot parts | Large dark-framed `S03`; a small numbered annotation points to the selected series and its properties |
| 5. `#slides` | Turn a result into a paced explanation; put that explanation in a document | `E01`, the homepage's single live player, with a nearby `S04` authoring still and a short instruction to advance |
| 6. `#library` | Keep a permanent collection and find evidence inside it | `S05` showing a readable `ft:` result and its page number; a sentence distinguishes personal library from project citations |
| 7. `#reader` | Read closely, keep anchored notes, and inspect the figure beside its discussion | `S06`, with the annotation rail or a pop-out visible; route to annotation/snipping instructions |
| 8. `#projects` | A project is a folder with recognizable sources and exports | `D01`, a compact file tree and two sentences about ownership; link to the concepts guide |
| 9. `#fluxconfig` | Carry your library and working context across projects | `D02` with FluxConfig and two project folders; make personal and project scope explicit |
| 10. `#agents` | Give a collaborator context and review its work where you are working | `S11` plus a short `D03` review loop; setup and review guide links |
| 11. `#workflow` | Try the same connected example shown throughout the page | One final project/output still and **Open the example** |
| 12. Get started / footer | Installation, documentation, example source, repository | Calm close; verified installation route; no repeated feature grid |

Use two or three composition patterns across these sections: wide artwork below prose, a 40/60 text–visual split, and a full-width interactive stage. Keep the reading order consistent when stacked on mobile. A darker Figure/Slides region can frame the artwork; do not alternate the entire background at every section or force the user through slides while scrolling.

## 4. What each module showcase must explain

Each module page is more detailed than its homepage section but shorter than its guide: approximately 450–750 words, three to five feature stories, one workspace view, selected detail crops, and a final set of task links. Introduce unfamiliar terms immediately beside their first use.

| Module | Required feature stories | Essential distinction to make clear |
| --- | --- | --- |
| Paper | Fluid source/reading surface; citations and bibliography; live figure references and captions; new inline slide playback; tables/math; margin review; journal-aware export | The editable source stays in the project. An inline slide is animated in HTML, while PDF/Word show step 0. |
| Figure | Gallery to composition; physical size/layout; semantic-part styling/X-ray; retained overrides on source refresh; identity/panels/captions; reusable designs and print output | A plain image does not acquire semantic anatomy automatically. Frame size, object size, figure order, publication numbering, and stable identity are different things. |
| Slides | Shared figure composition; semantic animations; steps and timeline; changes/morphs/ghosts; presentation/HTML sharing; document embedding | A figure sent to a deck has its own slide layout. Shared plot sources do not mean every figure-layout edit propagates to the slide. |
| Library | DOI/import/capture; Zotero; full-text/metadata search; reading organization; PDFs/supplements/enrichment; project citation subset | Stored PDF text search differs from World search. Fetching, discovery, and enrichment can need network access. |
| Reader | Reading layouts and tabs; split views; anchored annotation; search and citation context; pop-outs/snips; terminal handoff | A pop-out is a viewing aid; a snip is a project asset with provenance. Sending selected text to the terminal prefills a prompt for review. |

FluxConfig and Agents receive equally deliberate pages. FluxConfig explains **what stays with you across projects**: library, reusable design/slide/animation presets, personal context, and agent configuration. Distinguish user-owned material from stock FluxContext that Flux refreshes on update. Agents explains **how a collaborator gets context and how you inspect its work**. Their showcase pages should use diagrams and recognizable app views before showing JSON or commands.

Keep advanced parameter lists, full query grammar, shortcut tables, and setup diagnostics in the guide. Every major showcase claim must link to a task page or example that makes it concrete.

## 5. One coherent demonstration project

Use the original project **Neuronal networks flexibly encode diverse stimuli**. The broad
idea is that populations of neurons respond differently to stimuli and reveal structure when
viewed together. The showcase favors compelling, professional scientific graphics and a
coherent visual story; the title is illustrative, not a claim of a new research finding.

The canonical project lives in `examples/neural-populations/` inside this website repository.
A downloadable ZIP contains the same editable files. It includes:

- An original manuscript and source/methods notes, with an inline native slide.
- Twelve semantic SVG plots and reproducible recipes: anatomical brain surfaces, neuronal
  reconstructions, a response-similarity network, heatmap, tuning profiles, selectivity
  distributions, paired comparisons, population PCA, correlation, time traces, response
  metrics, and explained variance.
- An eight-panel flagship figure and a four-panel supporting composition. Show the flagship
  in the real Figure workspace and as a separate large plate that can be enlarged.
- Four native slides: response patterns, anatomy, tuning, and population structure. The
  first uses meaningful reveals of heatmap observations, network relationships, and the
  explanatory text; the viewer chooses each step and each scene.
- Three public dataset source records and original project notes, plus an original
  manuscript PDF for the Reader. No research paper text, figures, DOI, or authorship is invented.
- A project mission, methods, notebook, and editing instructions.

All prose and figure design are original. Numerical observations, neuron reconstructions,
and brain surfaces come from public Allen Institute sources with exact identifiers and
provenance. Anatomical specimens and functional recordings are separate contextual sources;
response-similarity edges are not anatomical connectivity. Preserve the source data's
noncommercial-use and attribution terms in the download and provide same-page credits.

Use white scientific panels, fine navy axes, readable labels, and a controlled teal, blue,
orange, and plum palette. Dense rasterized data layers retain semantic names and sit within
editable SVG panels. Published PNG/WebP captures are derivatives; the project retains the
source SVGs, sidecars, recipes, and native compositions. Opening the accepted project needs
no analysis environment or network; regeneration instructions list the additional tools.

The first release ships the complete project. A separate starter archive and more tutorial
exercises remain future guide work. Personal library material is never copied into the demo;
source records can be imported normally without replacing anyone's FluxConfig.

## 6. Screenshot, embed, video, and diagram inventory

The IDs below become entries in the technical plan's media manifest. They are editorial assignments. All launch captures must come from the current app with the shared demonstration content; existing regression screenshots are implementation evidence, not finished marketing assets.

### Screenshots

| ID | Capture / exact state to show | Main placements |
| --- | --- | --- |
| `S01` | Whole Paper workspace: real title/outline, readable result paragraph, composed figure, a restrained margin; current Flux mark visible | Homepage hero, connected example |
| `S02` | Paper detail: citation group and figure reference near the relevant paragraph, enough surrounding text to establish context | Home Paper section, Paper showcase and guide |
| `S03` | Figure workspace: finished eight-panel figure, one series selected, X-ray or Properties exposing its semantic name and style | Home Figure section, Figure showcase, semantic guide |
| `S04` | Slide authoring: same result, named steps, Animator timing lanes, selected target | Slides showcase and animation guide; secondary home still |
| `S05` | Library: a short field/full-text query, readable result snippets, page number and a small collection/status context | Home Library section, Library showcase/search guide |
| `S06` | Reader: owned PDF, anchored highlight/comment, readable passage and page context | Home Reader section, Reader showcase |
| `S07` | Plot gallery: selected plots in a legible grid; optional second frame showing the actual pinned window beside Figure | Figure composition and first-project guide |
| `S08` | Insert slide: deck choice, slide thumbnail choice, then the resulting Paper block | Inline-slide guide; three numbered crops, not three full-window images |
| `S09` | Export: format and journal-style choices, paired with a real rendered result | Review/export guide and Paper showcase |
| `S10` | Settings: actual FluxConfig location and Move control using a clean demonstration location | FluxConfig guide; small contextual crop |
| `S11` | Agent collaboration: project mission or annotated result with shared terminal and actual reviewed change | Agents showcase, review example, homepage |
| `S12` | Reader evidence: figure pop-out beside discussion; separate snip naming/provenance detail | Reader showcase and annotations/snips guide |
| `S13` | Figure identity: title, permanent reference, designation/panels and caption; show the matching Paper reference nearby | Figure reuse/export and Paper reference guides |
| `S14` | Zotero connection and copy/link choice, using the sample collection | Zotero integration guide |
| `S15` | Browser capture on an approved article/PDF plus Flux's connection/result state | Web-capture guide |
| `S16` | Paper review: anchored comment, reply/resolution and a readable text-size or split-pane detail as a separate crop | Paper writing/review guide, agent review guide |
| `S17` | Reader navigation: two-pane comparison or the persistent Library panel, shown as distinct states | Reader navigation guide |

`S01`–`S06`, `S08`, and `S11` are the first capture batch because they establish the public story. The remaining captures complete task coverage. Reuse a master when its state is genuinely the same; do not stage contradictory controls into one composite screenshot.

Capture conventions:

- Use consistent application dimensions, initially 1600 × 1000 logical pixels at 2× capture scale, then verify actual text size at the intended web placement. Keep the native aspect ratio unless a crop has a clear purpose.
- A whole workspace establishes orientation. A task illustration crops tightly enough to read the control without enlargement. On phones, use a designated detail crop with a route to the full image rather than shrinking the desktop window into illegibility.
- Keep actual app chrome, cursor/selection state, and output colors. Do not paint invented controls, retouch feature behavior, recolor scientific plots to suit the surrounding section, or use angled laptop mockups.
- Numbered editorial callouts sit in a separate annotation layer and refer to a caption. Preserve the untouched master. Limit a task image to roughly three callouts.
- Captions explain the result: “A saved source update retains the series styling.” Alt text describes the useful visible state: “A tuning-series line is selected; X-ray identifies its named plot part.” Decorative repeated crops receive empty alt text when nearby text already carries their meaning.
- Record the app revision, fixture state, viewport, theme, crop, source rights, and every page that uses the asset. Recapture when the depicted behavior or control layout changes.

### Native slide embeds

| ID | Content and interaction | Placement and fallback |
| --- | --- | --- |
| `E01` | The signature result slide: observations → fit → interpretation, advanced through the real compact Flux player | Home Slides section, Paper/Slides showcases, inline-slide guide, animated-result example; no more than one live embed on each page |

Reuse the same source slide across these pages, with captions appropriate to the task. The example page explains how it was authored; the Paper page explains why it belongs in a document. There is no need to make a different animation for each context.

The first control prompt is **Advance the slide to reveal the result**. Keep visible Next, Back, Reset, step count, and Animation controls. Preserve the native distinction between finishing an in-progress step and advancing to another. Provide a meaningful step-0 poster, a short text equivalent of every step, and a completed-state still in the worked example. Label these as an **Interactive slide**, not as a video.

A full-deck HTML download/open action belongs on the presenting guide and example once verified. It is a separate presentation surface. Multiple specialized embeds, automated playback, and a second advanced morph demonstration are later editorial additions, not launch requirements.

### Optional short recordings

| ID | Storyboard | Length target / placement |
| --- | --- | --- |
| `V01` | Select a named plot series → change one property → regenerate the source → show retained styling in the composed figure | 15–25 s; Figure showcase/semantic guide |
| `V02` | Open `/slide` → choose the result slide → advance it within Paper → show its HTML output | 15–25 s; inline-slide guide and Paper showcase |
| `V03` | Search `ft:` → open the page-numbered hit → highlight the passage → inspect its figure | 15–25 s; Library/Reader showcases and connected example |
| `V04` | Record review feedback → show the actual agent pass/result → inspect and resolve the change | 25–40 s; agent example; label cuts or elapsed time |

These recordings improve the launch but do not block it if the static sequences and `E01` are excellent. User interaction timing should remain honest. Cut or label long waits rather than speeding up the whole interface. Prefer silent clips with short captions; narrated versions require subtitles and a transcript. All have poster images, visible controls, and no sound or looping motion on page load.

### Explanatory diagrams

| ID | Diagram content | Meaning to preserve |
| --- | --- | --- |
| `D01` | Connected work: library entry → project citation; plot source → composed figure → Paper reference; figure → slide copy; slide → inline document reference | Label arrows “cite,” “reference,” “copy composition,” or “embed”; do not imply all connections share the same update behavior |
| `D02` | Two scopes: FluxConfig containing FluxLib, UserContext/FluxContext, roster and reusable presets; alongside independent project folders with their own bibliography and Context | FluxConfig belongs to the user across projects; project data is separate; linked external files and machine credentials have additional portability requirements |
| `D03` | Review loop: context → principal → app change → researcher feedback → revised work; worker branch shown only in the detailed guide | Add queues feedback; Send marks a work boundary; a running principal/attend process determines when it is acted on |
| `D04` | Same slide, three reading surfaces: Paper/HTML interactive steps; PDF/Word step-0 still | Export behavior is format-specific, and current playback state is not the print state |

Draw diagrams as accessible, clean SVG or HTML with selectable labels where feasible. Use Flux line weights, typography, and accents. Static arrows are sufficient; the only major animation on these pages should teach actual Flux behavior.

## 7. Visual identity and styling specification

### Overall character

The reference is **Flux itself: a quiet scientific workspace with the warmth of paper and the precision of a drawing tool**. Build the website from its existing Flexoki tokens, phyllotaxis mark, and Georgia/Gelasio typography. Use large editorial compositions and clear relationships between text and real artifacts.

The multicolored phyllotaxis mark is the identity accent; blue carries primary interface actions. Other colors are small functional details, annotations, or the actual scientific content. Preserve the app's mode icons where suitable, with labels, rather than inventing a competing icon set. Reserve mark clear space of at least half its displayed width; do not crop, stretch, recolor, or continuously animate it.

### Palette and theme behavior

These are proposed website roles using existing app values. The implementation generates its subset from the canonical tokens rather than maintaining an unrelated palette.

| Role | Light appearance | Dark appearance |
| --- | --- | --- |
| Page | Paper `#fffcf0` | Ink `#100f0f` |
| Quiet inset / code surface | `#f2f0e5` | `#1c1b1a` |
| Raised surface | `#e6e4d9` used sparingly | `#282726` |
| Main text | `#100f0f` | `#e6e4d9` |
| Secondary text | `#575653` | `#b7b5ac` |
| Primary link / focus accent | Blue `#205ea6` | Blue `#66a0c8` |
| Primary button | `#205ea6` with paper text | `#4385be` with ink text |
| Quiet rule | `#dad8ce` | `#403e3c` |

Use the user's appearance preference when available and offer a clear persistent Light/Dark/System control. Both themes receive deliberate review. The Paper-first light appearance is the primary capture/design reference, while dark bands may frame Figure/Slides artwork in that theme. Dark appearance is a full design, not an image-inversion filter. Keep screenshot/PDF/plot colors unchanged in either theme.

Separators may be quiet; text, focus rings, and control boundaries must remain legible. Measure final pairings rather than assuming every app token is appropriate for small web text. Target WCAG AA text contrast, including 4.5:1 for normal text; decorative colors must not be the only indication of a state. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### Typography

| Element | Proposed treatment |
| --- | --- |
| Wordmark and display headings | Georgia, Gelasio fallback; preserve the app's serif character |
| Homepage H1 | Fluid 40–76 px, approximately 1.06 line height; at most three short lines on a phone |
| Showcase section title | Fluid 30–48 px; strong serif hierarchy without oversized all-caps |
| Guide title / subsections | Approximately 36–44 / 25–30 px, with normal document hierarchy |
| Long-form prose | 18 px desktop, 17–18 px narrow screens, 1.6–1.7 line height, serif; roughly 65–72 characters per line |
| Navigation, controls, metadata | System sans-serif, 14–16 px; readable contrast; no condensed or ultra-light labels |
| Code and keycaps | System monospace, usually 14–15 px; tabular numbers in reference tables |
| Captions | 14–16 px, concise, directly adjacent to the image |

These sizes are starting values for the visual sample, not an invitation to hardcode every page. Use rem-based tokens and fluid sizing. Keep emphasis purposeful: bold for important terms or actual control labels; italics for a short editorial accent. No long italic paragraphs or wide tracking in body text. Host the approved bundled fallback fonts with their licensing information; do not make a third-party font request part of reading the guide.

### Layout, surfaces, and responsive behavior

- **Showcase canvas:** maximum content width about 1240 px, with selected artwork extending to approximately 1440 px. Wide-screen gutters 40–64 px; mobile gutters 20–24 px. Section spacing roughly 96–144 px on desktop and 56–80 px on phones.
- **Guide canvas:** 240 px navigation rail, a flexible article column capped around 720–760 px, and a 180–220 px contents rail when space permits. Hide the contents rail first; on narrow screens, use explicit Guide navigation and On this page disclosures above the article.
- **Screenshot treatment:** one-pixel warm border, 10–14 px corner radius, a restrained shadow where separation is needed. Preserve real desktop chrome. Avoid nesting screenshots inside several rounded panels.
- **Rules and spacing:** use Flux's 4/8/12/16/24/32/48/64/96 spacing family. A fine rule and generous space usually separate sections more clearly than another colored card.
- **Decoration:** a sparse, stationary dot grid may appear in a hero margin or example stage. Keep it away from prose. No background particles, animated contours behind reading text, gradient text, glass panels, or floating decorative objects.
- **Mobile:** stack the text before its visual; use useful crops, full-width embeds, wrapping controls, and readable captions. Tables/code may scroll inside their own region. Never make the whole page horizontally scroll.
- **Sticky elements:** keep the top navigation compact and allow anchor offsets. Do not place a second permanent navigation strip over the article. Enlarged media returns focus to its opening control when closed.

### Motion and interaction

Use motion to explain a state change or demonstrate the product. Native scrolling, anchor navigation, and search should respond immediately. Small hover/focus transitions may take 120–180 ms; disclosure changes may take up to approximately 200 ms. Never delay content visibility to complete an entrance animation.

Reduce nonessential animation when requested by the system, retain instant control feedback, and keep slide step explanations available without motion. Disabling motion from interaction is an explicit design goal; it is also covered by W3C's animation guidance. [W3C animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

Give touch controls a comfortable target, aiming for 44 px in navigation and demo controls, even when the visible icon is smaller. This is our usability target; the WCAG 2.2 minimum criterion is generally 24 × 24 CSS px with defined exceptions. Keep native keyboard behavior, a visible focus ring, a skip link, logical headings, and sensible focus restoration. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## 8. Reusable page and component conventions

| Component / page type | Editorial and visual contract |
| --- | --- |
| Showcase hero | One concrete headline, a short explanation, one primary action, one secondary route, one meaningful artifact |
| Module section | Module label, outcome, two or three capabilities, large visual, direct task-guide link |
| Task guide | State the outcome and prerequisites; give numbered steps with expected results; add exact shortcuts/alternatives; finish with common failures and related tasks |
| Concept guide | Explain a relationship with a diagram and one concrete example; link to the task that uses it |
| Reference page | Compact, searchable entries with stable anchors; conditions/platform variants remain visible; avoid introductory marketing copy |
| Screenshot / sequence | Media ID, precise crop, alt text, result caption; numbered frames for a process; click to enlarge when useful |
| Interactive slide | Real Flux output, visible step controls, a short instruction, text equivalent, poster, source link |
| Video | Descriptive poster, duration, play controls, caption; transcript for narration; static sequence as fallback |
| Callout | Four restrained types: Note, Tip, Requirement, Caution. A short title and actionable text; no wall of tinted boxes |
| Keycap / command | Actual UI action name and context; platform-specific chord; code-copy only for executable commands |
| Related guides | Two to four named next tasks; no generic “Learn more” repetition |
| Revision note | “Applies to …” and a verified release/revision; record review changes when behavior is checked, not a timestamp generated on every site build |

The next phase's guide visual sample should use **Insert a slide in a document**. It exercises prose, ordered steps, source syntax, a real embed, keyboard details, a format comparison, and troubleshooting in one page. Use the implemented homepage as its visual reference, as specified in the technical plan. These two samples are the acceptance reference for subsequent page migration.

## 9. Voice, terminology, and factual conventions

Write as a knowledgeable colleague explaining a scientific tool. Use concrete verbs and observable results: “Select a series and change its color,” “Open the search hit at the matching page,” “Export the document to Word.” Define semantic plot, step, FluxLib, and principal at first use. Use “step” in ordinary instructions and explain “beat” where the file/CLI terminology matters.

Use **Paper, Figure, Slides, Library, Reader** in public navigation. Where quoting the actual mode/button label, use its exact current text, including **Slide** if that is what the app shows. Use **Flux**, **fluxplot**, **FluxConfig**, and **FluxLib** with those spellings. Keep filenames and commands in code formatting; show control names in bold; use sentence case for page titles and headings.

Each task should explain scope and persistence where they affect the result: this occurrence, this document, this project, or your whole library. Separate “saved source changes appear in Paper” from “a published HTML snapshot updates when rebuilt.” Describe figure-to-slide copies accurately and distinguish static exports from animated ones.

Shortcut documentation requires a specific audit. Do not convert every Ctrl binding to Cmd mechanically or repeat the current blanket equivalence statement. The preceding macOS check demonstrated that CodeMirror Undo/Redo require the platform bindings. Resolve each action against the actual keyboard implementation and native verification; show macOS/Windows/Linux variants and a menu/click path where available. The website itself should not capture Flux app shortcuts merely to make its examples feel authentic.

Avoid unsupported promises: universal sub-100-ms performance, error-free generated science, automatic discovery of every PDF, complete offline operation for network-backed integrations, simultaneous cloud coediting, automatic synchronization across machines, or unrestricted equivalence between every GUI and agent action. Optional providers/services and prerequisites belong beside the feature that uses them. Model menus and release availability should come from maintained references, not frozen promotional copy.

Do not advertise deferred slide rich-text/math/video authoring, cross-project slide imports, or live figure-layout embedding as existing capabilities. A recorded video on the website is not evidence of native video export from Flux. Keep this factual review focused on the claims being published rather than filling public pages with internal implementation caveats.

## 10. Migration, ownership, and phased acceptance

### Existing content migration

| Existing source | Destination / editorial action |
| --- | --- |
| `index.qmd` | Rewrite as showcase; move useful orientation to guide start and project concepts |
| `installation.qmd`, `getting-started.qmd` | Move into guide; verify current delivery paths and rebuild the walkthrough around the shared example |
| `modes/paper.qmd` | Split into the four Paper pages; retain all current smaller features under stable headings |
| `modes/figure.qmd`, `concepts/semantic-plots.qmd`, `concepts/dissections.qmd` | Compose the three Figure guides; keep deep-link aliases for semantic/physical-size/dissection topics |
| `modes/slide.qmd` | Split into composition, animation, and sharing; link to the canonical Paper inline-slide instructions |
| `modes/library.qmd`, `modes/reader.qmd` | Split each into two task-oriented pages |
| `agents/collaboration.qmd` | Separate setup from context/review; reuse the context ownership material in FluxConfig guidance through links or shared fragments |
| `concepts/projects-and-files.qmd`, `concepts/library-and-fluxlib.qmd` | Retain as focused conceptual explanations; extract detailed backup steps to FluxConfig |
| `integrations/*.qmd` | Retain the three integration guides; revise setup screenshots and network/prerequisite details |
| `reference/*.qmd` | Retain three reference pages; audit shortcuts, publish generated verb reference, update file map for slide posters |
| `lighttable.qmd` | Move under Companions; retain the separate-application boundary |

All current 20 public pages have a future destination. They remain authoritative in `flux/docs/` during the homepage phase. Later migrate each page to this repository once, then retire or redirect its old location in a coordinated change; do not maintain two editable copies. Preserve meaningful old URLs and anchors through the technical plan's redirect/alias process. Internal engineering guides, implementation/testing reports, and these two plans remain outside public output.

Assign a maintainer role to each page group, even if one person initially owns them all: module behavior, installation/integration accuracy, shared design, and media provenance. A feature change updates the task guide first; then review its showcase claim, related example, and all media IDs that depend on it. Avoid independently maintained versions of the same shortcut, parameter definition, or setup instructions.

### Production sequence

1. **Homepage and infrastructure (current):** implement the complete main page, real media and native demo, source/output boundaries, local workflow, browser checks, and GitHub Pages configuration. Reserve later routes in this plan only; no placeholder pages become public.
2. **Guide reference (next):** after homepage refinement, compose the inline-slide task page using real `S08` and `E01`; verify both themes and narrow-screen behavior against the accepted homepage.
3. **Complete the guide:** migrate the current 20 pages into the 30-page guide, fill FluxConfig gaps, verify installation, reconcile shortcuts and feature boundaries.
4. **Complete the showcase:** write the module/system stories, capture the remaining stills, and produce the three worked examples with usable downloads.
5. **Polish and verify:** refine crops, typography and spacing; check captions, diagrams, source provenance, accessibility, links, and actual player behavior. Add short recordings if ready.

The earlier 8–14-day full-site estimate is superseded by the phased technical plan and preceded this detailed inventory. Treat it as provisional: 43 edited content pages, 17 capture assignments, diagrams, and three reproducible examples need to be re-estimated after the two visual reference pages and first capture batch. Optional video production is additional work. Preserve the launch coverage by consolidating small topics within these guide pages rather than publishing empty subpages.

### What “complete” means for the full website

- A new visitor can identify all five modules and see a substantial, truthful example of each on the homepage.
- FluxConfig, agent collaboration, project ownership, and cross-module relationships have both explanations and task guidance.
- Every listed content route contains useful material; guide search/navigation reaches important tasks directly; all migrated pages have deliberate destinations.
- The main slide demonstration is real, useful on mobile, manually controlled, and understandable through its still/text fallback.
- Every feature claim has a verified guide/example behind it; diagrams accurately label reference, copy, and scope relationships.
- Screenshots use the current mark, readable controls, consistent scientific content, and documented provenance. Example downloads open with their stated prerequisites.
- The site reads unmistakably as Flux in both appearances: warm surfaces, clear serif hierarchy, quiet controls, precise illustrations, and ample space.
- Technical acceptance follows the companion plan: verified static output, publication boundaries, browser/accessibility checks, performance budgets, and the deployment/rollback process.

## 11. Source references for implementation

Use these as the factual/design sources while writing, not as material to copy wholesale into public pages:

- [App tokens](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/src/styles/tokens.css), [current phyllotaxis mark](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/brand/flux-mark-phyllotaxis.svg), and `src/styles/fonts/` for visual identity.
- [Paper](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/modes/paper.qmd), [Figure](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/modes/figure.qmd), [Slide](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/modes/slide.qmd), [Library](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/modes/library.qmd), and [Reader](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/modes/reader.qmd) for current behavior.
- [Agent collaboration](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/agents/collaboration.qmd), [roster contract](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/resources/flux-context/AGENTS-CONFIG.md), and [configuration paths](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/electron/fluxPaths.cjs) for scope and setup.
- [Project layout](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/reference/project-layout.qmd), [library model](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/concepts/library-and-fluxlib.qmd), and [shared verb registry](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/flux-core/verbs.ts) for exact names and references.
- [Inline slide verification](https://github.com/fluxsci/flux/blob/4bb72d895b7879acc404ca83863cdc385982b0b5/docs/INLINE_SLIDES_TESTING.md) and [technical website plan](technical-plan.md) for embed behavior and publication architecture.
