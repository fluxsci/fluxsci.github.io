
**The through-line.** One figure, followed through its whole life: it arrives from Python, gets
refined, survives new data, goes into the paper, and becomes a slide. The claim the reader should
leave with is *nothing is ever redone, because nothing is ever a dead picture*. Every clip should
use the same materials figure (Figure 1 on `canvas_4`), so a reader recognises the panels from one
clip to the next: panel **c** (the stress–strain curves) for anything about lines and points,
panel **e** (the stress map) for colour.
{a note: THIS ONE POINT ALONE, the fact that a plot is a live object and so you nevery have to redo stuff, is not enough to convince people to switch, and is while it is a nice feature/advantage of flux, it is not the BIG main story. The introduction should be roughly as follows below}


# Flux: a brief tour — story outline (draft 1)
{introduction below}

Flux is fundamentally an integrated collection of software tools that functions as a studio for creating scientific and technical materials such as figures, posters, slide decks, and documents such as journal articles, grant submissions, book chapters, etc.

Typically, when a scientist creates these materials, they are required to use a large number of different tools, all of which are isolated from each other, and none of which have actually been designed _for science_. The scientist typically needs to arrange figures in something like Adobe Illustrator or Figma or Inkscape, then export those figures so they can be pasted into e.g. a word or overleaf document, then take screenshots or some subsets of those figures and paste them into tools like powerpoint or After Effects to make presentations or posters. If anything about the analysis changes, the figures have to be manually updated, reexported, reinserted, etc. Depending on the journal one is submitting to and the requirements, the scientist must make a large number of manual and tedious edits which in the end are a near total waste of time: how figures are referenced in the text, font sizes and types, the sections/structure of the manuscript, etc. Additionally, since none of these tools were really designed with science in mind, the results are often less inspiring than they could be if the scientist had a better set of tools.

Flux aims to solve all of these problems. For each critical component of the system (Figures, Papers, Slides, References + Reading), it provides a tool that is designed from the ground up for science, and integrates them in way where every component of the project can interact with every other component. In short, Flux has 5 different "parts". See the docs for a deeper dive on each one:

1. Figure. Flux figure is where the scientist can take plots they've made in e.g. python, and compile them into full multi-panel figures. Flux figure is best thought of as "What if Figma were designed for science from the start?". The Flux figure editor knows what each part of a plot is, so you can easily do things like "Hide the x-axis title on this plot" or "Align the y-axis spines of these plots". The plots are tied to the data and scripts that generated them, so you can easily regenerate a plot with new data and it updates in place right on the figure, with any visual edits you've already applied.
2. Paper. Flux paper is where, for example, a manuscript can be written. The central premise of Flux paper is that the scientist should focus on the _content_ of the paper, and should only have to write the paper once. Then, from that one source of truth, the paper can be exported with the proper structure and formatting to one or multiple of any arbitrary number of defined formats. Write the paper once, then export one copy for submission to Nature, and one copy for submission to BioRxiv. Anything else within a project that a paper references (figures, statistics, references, etc.) all update live. 
3. Slides. Flux Slides operates on the following premise: once you have designed the ideal figure editor for science (Flux Figure), making slides should be easy as you can use the same editing surface and objects, but compiled into decks with first-class animation/motion capability. This is what Flux Slides enables - any figure can become a slide with one click, and adding _beautiful_ animations are easy... if you can imagine an animation in your head, it is likely possible in Flux Slides. Flux slides can be thought of as a mix between, and replacement for, PowerPoint and After Effects, and attempts to be easier to use than either of them, without sacrificing power.
4. Library: Flux Library enables you keep a user-level library of all of your references. It does all of the things that reference managers should do, including automatic abstract and full-text fetching, full-text extraction, semantic labeling, integration of open indices such as OpenAlex and Semantic Scholar. For any paper in your library, you can view its full context in the larger literature - with a click, you can search for papers that cite a given paper, papers cited by a given paper, or semantically similar papers. Library can be thought of as a replacement for things like Zotero or EndNote, but because Zotero has already done a pretty good job on this front and is open-source, Flux also supports integrating an existing Zotero library.
5. Reader: Flux Reader is a PDF reader, with some additional science-focused features. 

Each component is designed to be the optimal tool for humans first and foremost. Additionally, there is deep (and optional) AI integration out of the box: take any AI agent (Claude Code, Codex, etc.) that you already use, in whatever way you already use them (CLI, desktop app, etc.), give them one simple 'flux-connect' command, and they immediately gain knowledge of how to use every part of flux, and can see, read, and edit any part of the project. In essence, while using Flux, you can point to anything you see on the screen, and ask a connected agent to do anything you would like - the agent sees exactly what you see and work live alongside you. Flux was in part inspired by the 'File over App' philosophy, and as such a project in Flux is just a directory of normal files, so the scientist at any time can simply take those files and do anything they would like with them. Flux is 100% free, open source, and runs locally. This also means that, through the use of AI programming agents, contributing to, modifying, extending, fixing, or personalizing Flux is trivially easy.

For further details on any component of flux, please see the docs or watch the short intro video. {links}. To try it, [installing is as easy as copy-pasting one line]{link}. Below, we provide a brief and visual tour highlighting just a small fraction of Flux's standout capabilities.

{note for making the clips in the visual tour below: When I reference figures, slides, or documents, I am always referring to this project: ~/FluxProjects/flux_demo_master/MASTER_DEMO_FluxProj . When I reference slides, I am always referring to slides in the deck titled Slides_Demo_Deck unless otherwise noted. Where possible, you can + should use the things I've already made, but it may be necessary also to create additional materials which I have not yet created, and you can feel free to do this... nothing in this project is mission-critical, it exists only for making demo materials like this}

# Flux Figure - the Ideal Visual Editor for Science

1. Restyle any part of a plot with ease. Flux has a companion python package _fluxplot_, which writes plots as normal svgs, but with 1-2 "sidecar" files written next to each plot. You never need to look at these sidecars, they are effectively invisible, but they give Flux context about each plot so it knows which marks correspond to which parts. Let's say you want to change a colormap on a plot - rather than rerunning the python script or notebook that generates the plot, Flux comes built-in with a curated list of the best colormaps for science, any of which can be applied an modified with a click
	1. Video: click through a couple better colormap options for Fig 1a, show how the 

# Flux Slides - The Editor, plus first class motion and animation 
  

# Flux Paper - Write Once, Export Infinitely and Instantly



  - *Says:* A plot made with fluxplot arrives with every part still named: each series, each
    point, each tick. Flux can tell you what you are pointing at, in the plot's own numbers.
  - *Shows:* Panel c. Hold Ctrl and sweep across it: a curve outlines and names itself, a single
    point shows its x and y, the fracture mark shows its values. Ctrl+click one curve, press
    **F**, recolour it; the curve changes and nothing else moves.

- **2. Restyle the data, not the pixels.**
  - *Says:* Colour scales and axis ranges stay tied to the data, so changing them is a choice in
    a menu and the analysis never runs again.
  - *Shows:* The clip we have: panel e, **F**, colour scale, three colormaps; the map, its colour
    bar and its ticks change together. (Possible addition: tighten the colour range by typing a
    new maximum, to show it is the real scale and not a tint.)

- **3. Real sizes, and plots that re-lay themselves out.**
  - *Says:* A plot lands in the figure at the size it will print. Change its shape and it lays
    itself out again like a fresh plot: the axes reflow, the type stays the same point size.
  - *Shows:* Drag a plot from the Plots rail onto the figure; a readout shows it land in inches.
    Then drag its edge: the axes stretch, the ticks re-space, the legend wraps, and no letter
    gets fatter or thinner. This is the thing a drawing program cannot do.

- **4. New data? The figure keeps up.**
  - *Says:* A placed plot stays linked to the script that made it. Run the analysis again and the
    new plot swaps into the figure, with every change you made by hand still in place.
  - *Shows:* Panel c with the recolour from clip 1. The data changes (a fourth curve appears, or
    the curves extend) while the custom colour, the size and the position all hold. A small
    marker in the Plots rail flags the plot as regenerated.

- **5. Point at it and ask.**
  - *Says:* Connect Claude Code or Codex, then point at what you mean. The agent receives the
    exact part you pointed to and makes the change in the open figure.
  - *Shows:* **Ctrl+Shift+M** freezes the view. Draw an arrow to one curve; the arrow names it.
    Type "make this one dashed and match the red in panel e". The note goes to the Inbox, the
    curve changes on the canvas, and the agent's reply appears in the thread. Filmed with a real
    agent making a real edit.

- **6. Read it, cite it.**
  - *Says:* The literature lives in the same place as the writing. A paper you are reading is a
    keystroke away from being a citation.
  - *Shows:* A PDF in Reader. Hover a citation in its text: a card shows the cited paper; click
    **+ FluxLib** to keep it. Cut to the manuscript: type `@`, pick that paper, and the citation
    appears in the sentence.

- **7. The paper is built from the same figure.**
  - *Says:* The manuscript embeds the live figure, not an export of it. Figure numbers, captions
    and references follow the figure, and the journal's formatting is applied on the way out.
  - *Shows:* In the manuscript, type `@fig-`; a "Fig 1" chip appears and the real figure renders
    beneath, already showing the new colormap from clip 2. Reorder the figures and the chip
    renumbers itself. End on Export with a journal style chosen and the formatted page.

- **8. And it is already a slide.**
  - *Says:* A slide is a figure with time added, in the same editor. Parts of a plot can reveal in
    order, move, or turn into something else, and the deck exports as one file that plays
    anywhere.
  - *Shows:* The figure on a slide. One step: the other panels fall away and panel c grows to
    fill the frame. Next step: its curves **Become** a bar chart of their peak strengths, each
    bar growing out of its own curve in its own colour. Last step: the 3D panel turns. This is
    the finale, so it gets the longest clip.

- **Close (no clip): plain files, free, open source.**
  - *Says:* Everything above is ordinary files in a folder you own (Quarto, BibTeX, SVG, JSON),
    and Flux is free and open source. Then the install button.

## If it needs to be shorter

Cut **6** first (the least unique visually), then **3**. The spine that must survive is
1 → 2 → 4 → 5 → 7 → 8.

## Considered and left out

- **Align, distribute and auto-lettered panels.** Satisfying to watch, but every layout tool has
  a version of it.
- **X-ray** (the tree of a plot's anatomy). A deeper form of clip 1; better as a link than a
  second clip on the same idea.
- **Dissections** (the supporting plots and statistics kept behind a panel). Distinctive, and a
  good ninth clip if we want one for a scientific audience: press **D** on a panel and see what
  is behind it.
- **3D models in a figure** (orbit, named parts). Covered by the last beat of clip 8.
- **Word export with live Zotero citations.** Important to some readers, but nothing to watch.

## Open questions

- **Clip 4 and clip 8 need new material in the demo project**: a second version of panel c's
  data to re-run into, and a bar chart of peak strengths for the curves to become. I can make
  both with fluxplot; say if you would rather supply them.
- **Clip 5 depends on an agent run that is repeatable enough to film.** I would script the
  request and let a real agent session make the edit through Flux's own commands.
- **Clip 7's ending** depends on which journal styles are in the public release (the docs list
  Nature and Nature Communications today).
- **The opening.** The page currently starts with text. An alternative is a five-second clip
  under the title that zooms from the whole project (paper, figure, slide) into panel c.
