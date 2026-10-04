export const ORIGIN = 'https://fluxsci.github.io';
export const routes = [
 {source:'index.qmd',output:'index.html',url:'/',title:'Flux — a unified scientific workspace'},
 {source:'install/index.qmd',output:'install/index.html',url:'/install/',title:'Install Flux',kind:'install'},
 {source:'docs/index.qmd',output:'docs/index.html',url:'/docs/',title:'Documentation',kind:'directory'},
 {source:'docs/first-project.qmd',output:'docs/first-project.html',url:'/docs/first-project.html',title:'Your first project',kind:'guide'},
 {source:'docs/projects-and-files.qmd',output:'docs/projects-and-files.html',url:'/docs/projects-and-files.html',title:'Projects and files',kind:'guide'},
 {source:'404.qmd',output:'404.html',url:'/404.html',title:'Page not found'}
];
const upstream = path => `https://github.com/fluxsci/flux/blob/main/docs/${path}.qmd`;
const topic = (title,path,description) => ({title,url:upstream(path),description,external:true});
export const groups = [
 {title:'Start here',id:'start',items:[
 {title:'Installation',url:'/install/',description:'Install the desktop app, set up companions, and keep Flux updated.'},
 {title:'Your first project',url:'/docs/first-project.html',description:'Move from a plot to a figure, a manuscript, and a presentation.'},
 {title:'Projects and files',url:'/docs/projects-and-files.html',description:'Understand source files, saved compositions, autosave, and portability.'}]},
 {title:'The workspaces',id:'workspaces',items:[
 topic('Paper','modes/paper','Documents, equations, tables, citations, live figures, inline slides, review, and export.'),
 topic('Figure','modes/figure','Plot gallery, X-ray, precise layout, parts, typography, 3D models, linked sources, and exports.'),
 topic('Slides','modes/slide','Beats, timelines, animation, morphs, 3D, video, presentation, and embedded playback.'),
 topic('Library','modes/library','Collect references, enrich metadata, organize collections, search full text, and manage attachments.'),
 topic('Reader','modes/reader','PDF reading, tabs, split panes, highlights, notes, citation trails, and figure snips.')]},
 {title:'Plots & data',id:'plots',items:[
 {title:'fluxplot',url:'https://github.com/fluxsci/fluxplot#readme',description:'The Python plotting library: semantic SVG, named series, recipes, color, statistics, images, and signature plots.',external:true},
 topic('Semantic plots','concepts/semantic-plots','Stable part identities, data manifests, regeneration recipes, and retained styling.'),
 {title:'3D scenes & meshes',url:'https://github.com/fluxsci/fluxplot/blob/main/docs/SCENE3D.md',description:'Native GLB scenes, meshes, scalar fields, axes, camera views, and shape states.',external:true},
 topic('Dissections','concepts/dissections','Companion panels and groups that keep a complex plot inspectable.')]},
 {title:'Working with AI',id:'ai',items:[
 topic('Connect an agent','agents/connect','Connect Claude Code or Codex, inspect status, and begin a project session.'),
 topic('Context & memory','agents/context','Personal context, project missions, notebooks, reusable skills, and project rules.'),
 topic('Comments & Inbox','agents/annotations','Attach feedback to the work, route requests, review replies, and resolve threads.')]},
 {title:'Integrations',id:'integrations',items:[
 topic('Zotero','integrations/zotero','Sync a collection, maintain citation keys, and export live Zotero fields to Word.'),
 topic('Web capture','integrations/web-capture','Bring papers, PDFs, and supplementary files into Flux from your browser.'),
 topic('GROBID','integrations/grobid','Extract structured metadata and references from PDFs.')]},
 {title:'Reference',id:'reference',items:[
 topic('Command line','reference/cli','Inspect and edit projects, figures, slides, plots, references, and agent connections.'),
 topic('Keyboard shortcuts','reference/shortcuts','Find global and workspace-specific commands.'),
 topic('Project layout','reference/project-layout','A file-by-file reference for documents, figures, decks, assets, and metadata.'),
 topic('Library & FluxConfig','concepts/library-and-fluxlib','Understand your shared library, personal environment, and each project’s cited subset.')]},
 {title:'Around Flux',id:'ecosystem',items:[
 topic('Lighttable','lighttable','The separate image-set viewer for visual triage, comparison, and exploratory analysis.'),
 {title:'Contributing to Flux',url:'https://github.com/fluxsci/flux#readme',description:'Source code, development setup, issue reporting, and the application repository.',external:true}]}
];
