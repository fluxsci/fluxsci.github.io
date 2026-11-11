# Flux: a brief tour — Slides, Paper and agents

**As built, 2026-11-11.** All three sections below are on the page (https://fluxsci.org/in-60-seconds/). The summary of what was filmed comes first; the original draft follows for reference.

# Flux Slides: the same editor, plus first-class motion (as built)

Lead: A slide in Flux is a figure with time added: the same canvas, the same plots, the same tools, so nothing is exported, pasted or rebuilt to give a talk. Every clip uses the finished protein figure (Figure 1).

## From figure to slide
1. Any figure becomes a slide in one click. Video: **Send to deck…** copies Figure 1 into "Protein structure talk"; on the slide, panel e is deleted and panels d and f are dragged wider (their axes reflow).
2. Plots know how to build themselves. Video: the uptake-curve plot on a slide; **Auto-animate** writes three steps (axes, data, labels); the slide plays them.

## Motion that understands the data
1. Any edit can be a step. Video: the two edits from the Figure clips as steps: the RMSD axis glides from 200–600 out to 0–1000, then the hexagon map turns from rainbow to roma (made on camera, then played).
2. One thing can become another. Video: the six fitted curves are selected, **B**, the six half-time bars are boxed, **Space**; the clip is retimed on the timeline and played: each curve becomes its bar. (New plot: `plots/protein_structure/hdx_half_times`.)
3. 3D models move too. Video: the SARS-CoV-2 spike turns once, opens (one receptor-binding domain swings up, a morph between PDB 6VXX and 6VSB), and the camera moves in on the domain. (New model: `plots/protein_structure/spike_opening`.)

## Timing, and taking it on stage
1. The Animator. Video: the Become's clip is dragged out to 3 s and **Piece lag** raised, so the curves land one at a time.
2. It plays anywhere. No video: the Become slide itself, exported from Flux as one HTML file, embedded in the page and playable there.

# Flux Paper: write once, export anywhere (as built)

Lead: You write the paper once and think only about what it says. Figures and references are the live ones from the project; a journal's formatting is applied on export, never to your text. The clips use a demonstration manuscript, "Reading a protein across scales", written around Figure 1 (fictional authors, real references).

## The manuscript knows the project
1. Figures are live, not pasted. Video: `@@` cites panels c–f as a "Fig. 1c–f" chip; `/figure` embeds the figure with its caption; renumbering the figure in **Figure-Meta** (**Alt+M**) renumbers the chip and the caption.
2. Change the figure, and the paper has already changed. Video: Paper and Figure side by side; panel c's colour map is changed on the canvas and the manuscript's embed changes with it.
3. Cite from your library as you write. Video: `@jumper` picks the AlphaFold paper from the library; the citation and its reference-list entry appear; the hover card's **Read PDF** opens the paper in Reader beside the text.

## One manuscript, every format
1. The journal style is a menu choice. Video: **Alt+E**, Nature, export, the summary of what Flux did; again as a bioRxiv preprint; the manuscript unchanged. Under the clip, the first pages of the two PDFs side by side. (Styles in this build: Nature, Nature Communications, Science, Cell, bioRxiv preprint.)
2. Flux checks the submission for you. Video: **Alt+J** opens Journal Check for Nature; the 205-word abstract is flagged against 200; one sentence is deleted and the item clears.
3. Text only: co-authors can stay in Word (live Zotero citations in the Word export).

# Bring your own agent: Flux gives it the tools (as built)

Lead: Flux does not come with an AI of its own, and does not need one. Connect the agent you already use with one command, `flux-connect`, and it can see, read and edit the open project; then point at anything on the screen and ask. In the clips the agent is Claude, connected through Flux's own agent tools; its edits are made live and its replies are its real answers to the requests.

1. In Figure: point at it, and say what you want. Video: **Ctrl+Shift+M**, an arrow to a dashed reference curve in panel e, "Make these dashed reference curves the blue of the uninhibited enzyme, in all three plots"; the agent recolours them one plot at a time and replies.
2. In Slides: ask for the animation you can picture. Video: "Draw these curves one at a time, fastest exchange first, then bring in the labels"; the Animator fills with one clip per curve; play.
3. In Paper: ask what the literature says. Video: a claim is selected, "What should I cite for this, and does anyone disagree?"; the citation (Tunyasuvunakool et al. 2021) lands in the sentence and the reply names two papers that push back.
4. In Reader: ask the paper. Video: the pLDDT definition in the AlphaFold paper is selected, "What does a score below 50 mean for the low-confidence parts of my Fig. 1a?"; the agent highlights the passage and answers from the paper and its companion.

---

# Original draft

Written to drop under the two "TBD" headings of `flux-visual-tour-plan`. Same form as the Figure
section: a short lead per sub-section, then numbered points, each with what the text says and
what the video shows. Everything keeps using Figure 1 (the protein-structure figure) in its
finished state, so the reader sees the figure they just watched being made become a talk and
then a paper.

# Flux Slides: the same editor, plus first-class motion

Lead: A slide in Flux is a figure with time added. It is the same canvas, the same plots and the
same tools you have just seen, so nothing has to be exported, pasted or rebuilt to give a talk.

## From figure to slide

1. **Any figure becomes a slide in one click.**
   Says: the figure arrives in the deck whole, and every panel is still a live, editable plot.
   Video: Figure 1, finished. Click **Send to deck…**; cut to Slides with the figure on a slide.
   Drag one panel larger and delete two others, to show it is the same editor, not a picture.

2. **Plots know how to build themselves.**
   Says: because Flux knows a plot's anatomy, it can animate it sensibly without being told how.
   Video: the uptake-curve panel alone on a slide. Click **Auto-animate**, then play: the axes
   tick in, the six curves draw on from left to right, their points grow in as each line passes,
   the labels arrive last.

## Motion that understands the data

3. **Any edit can be a step.**
   Says: everything you can change in Figure can change during a talk, in data units, so the
   axis glides and the data follow.
   Video: the RMSD panel. Step one shows 200–600 ns; press the arrow and the x axis glides out
   to 0–1000 while the curves extend. Next step: the colour map of the hexagon panel sweeps from
   rainbow to roma. The same two edits as the Figure clips, now played as steps.

4. **One thing becomes another.**
   Says: parts of a plot can leave it and turn into something else, which is how you show where
   a number comes from.
   Video: the six fitted curves **Become** six bars of their half-times; each bar grows out of
   its own curve in its own colour. Then the hexagon map's cells fall into a histogram. This is
   the showpiece clip of the section.

5. **3D that moves.**
   Says: models turn, and one shape can morph into another, as ordinary steps.
   Video: the ribbon model turns a full circle, then morphs into the surface model beside it,
   and the camera flies in on the orange domain.

## Timing, and taking it on stage

6. **The Animator.**
   Says: every step is a clip on a timeline; drag to retime, stagger a group in one gesture,
   choose an easing or a spring.
   Video: the timeline under the slide from point 4. Drag the six bar clips into a stagger,
   switch their easing to a spring, press play, and the bars now land one after another with a
   small bounce.

7. **It plays anywhere.**
   Says: the deck exports as one self-contained HTML file that plays in any browser, and also as
   PowerPoint (with the builds), PDF and video.
   Shows: no video. Instead the real exported slide from point 4, embedded in the page, with
   "press → to step through it". The reader operates the thing itself. (The site already has
   this player on the homepage.)

# Flux Paper: write once, export anywhere

Lead: In Flux you write the paper once and think only about what it says. The figures, numbers
and references in it are the live ones from the project, and the journal's formatting is applied
when you export, never to your text.

## The manuscript knows the project

1. **Figures are live, not pasted.**
   Says: the manuscript shows the real figure with its caption, and a reference to a panel is a
   link that keeps its own number.
   Video: in a paragraph, type `/figure` and pick Figure 1; it renders in the text. Type
   `@fig-`, pick panel c, and a "Fig. 1c" chip appears mid-sentence. Then drag Figure 1 below
   Figure 2 in the figure list: every chip in the text renumbers to "Fig. 2c" by itself.

2. **Change the figure, and the paper has already changed.**
   Says: there is no export step between figure and paper, so the paper can never show an old
   version.
   Video: paper and figure side by side. Change the hexagon panel's colour map in Figure; the
   figure in the manuscript changes with it. (A direct callback to the first Figure clip.)

3. **Cite from your library as you write.**
   Says: your whole library is one keystroke away, and the bibliography builds itself.
   Video: type `@`, type an author's name, pick the paper; the citation appears and its entry
   is added to the reference list. Hover the citation: a card shows the paper; one click opens
   its PDF in Reader beside the text.

## One manuscript, every format

4. **The journal style is a menu choice.**
   Says: the same text exported for two destinations, with no edits in between.
   Video: **Export**, style **Nature**, PDF: title page, double spacing, line numbers,
   "Fig. 1c", superscript numbered citations. Change the style to **bioRxiv** and export again:
   single-column preprint layout, author–year citations, figures in place. The two PDFs side by
   side, then back to the manuscript, untouched. This is the showpiece clip of the section.

5. **Flux checks the submission for you.**
   Says: each journal's rules (length limits, required sections, figure counts) are checked
   against the manuscript before you submit.
   Video: run the journal check for Nature: a short list ("Abstract: 212 words, limit 200",
   "Methods section missing"). Click the first item; the cursor jumps to the abstract, the
   live word count shows in the margin; trim a sentence and the item clears.

6. **Co-authors can stay in Word.** (text only, no clip)
   Says: export to Word and the citations are live Zotero fields, so a collaborator can keep
   editing references in the tools they already use.

# Bring your own agent: Flux gives it the tools

Lead: Flux does not come with an AI of its own, and does not need one. Take the agent you
already use (Claude Code, Codex, others), run one command, `flux-connect`, and it knows how to
use every part of Flux and can see, read and edit the open project. From then on you can point
at anything on the screen and ask. The four clips are four parts of the project, each with one
request and one real result; the agent's replies and edits are real, made through Flux's own
agent commands.

(Text, with the one command in a code block, before the clips: `flux-connect ~/projects/my-paper`.)

1. **In Figure: point at it, and say what you want.**
   Says: a note is attached to the exact thing you pointed at, so "this" means something.
   Video: Figure 1. Open Annotate, draw an arrow to a panel, type a request for a real edit
   (for example: "give these four plots one shared legend and match their colours to it").
   Send. The agent's reply arrives in the thread and the panel changes on the canvas.

2. **In Slides: ask for the animation you can picture.**
   Says: describing motion is often faster than building it; the agent builds it from the same
   steps and transforms you would use, so you can retime it afterwards.
   Video: a slide with the uptake curves. Ask: "draw these curves one at a time, fastest
   exchange first, then bring in the labels." The agent replies; the Animator fills with clips;
   press play and it happens.

3. **In Paper: ask what the literature says.**
   Says: the agent can search the open literature and your library from inside the sentence you
   are writing.
   Video: in the manuscript, select a claim and ask: "what should I cite for this, and does
   anyone disagree?" The reply lists three papers, each with one line on why; accept one and
   the citation appears in the sentence and the reference list.

4. **In Reader: ask the paper.**
   Says: questions about a paper are answered against its text, and tied to the passage.
   Video: a PDF open in Reader (the AlphaFold paper). Select the passage that defines pLDDT and
   ask: "what does a score below 50 mean for the grey regions in my Figure 1a?" The answer
   appears beside the passage, quoting the paper and naming the panel.

## Open choices

- **Order.** Slides before Paper follows the plan's headings. Paper before Slides would follow
  the usual life of a project (figure, paper, talk); either works with these clips.
- **Statistics in the text.** The introduction says figures, statistics and references all
  update live. I have a clip for figures and one for references; if statistics in the text are
  also live (a p-value or n that follows the data), that deserves to be point 3 of
  "The manuscript knows the project", and I would move citations to point 4.
