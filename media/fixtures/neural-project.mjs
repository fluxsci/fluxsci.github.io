/** Original demonstration narrative and editable Flux composition; no copied paper text. */
export const TITLE = 'Neuronal networks flexibly encode diverse stimuli';
export const DECK_ID = 'neural-populations';
export const FIGURE_ID = 'fig-neural-populations';
export const STAMP = '2026-09-14T00:00:00.000Z';
const INK='#22272e', MUTED='#646b72', BLUE='#266e9e';
export const text = (id,value,x,y,width,height,fontSize=20,color=INK,weight=400) => ({id,type:'text',text:value,x,y,width,height,rotation:0,fontFamily:'Gelasio',fontSize,fontWeight:weight,fontStyle:'normal',align:'left',color,lines:[value],sizing:'fixed'});
export const panelOrder = ['01-brain-regions','02-neuron-morphology','05-response-network','03-response-heatmap','04-tuning-curves','08-population-pca','06-selectivity-distribution','07-paired-responses'];
export const supportingOrder = ['09-response-correlation','10-response-traces','11-frequency-selectivity','12-variance-spectrum'];
export const panelNames = {
 '01-brain-regions':'Anatomical context','02-neuron-morphology':'Neuronal architecture','03-response-heatmap':'Population responses','04-tuning-curves':'Diverse tuning profiles','05-response-network':'Response similarity network','06-selectivity-distribution':'Response selectivity','07-paired-responses':'Within-cell comparisons','08-population-pca':'Population activity space','09-response-correlation':'Shared response structure','10-response-traces':'Responses through time','11-frequency-selectivity':'Response variation by temporal frequency','12-variance-spectrum':'Dimensions of population activity'
};
export function plotElement(key,box,assets,id=key){
 const asset=assets.find(a=>a.id===key);if(!asset)throw Error(`Required panel missing: ${key}`);
 const scale=Math.min(box.width/asset.naturalWidth,box.height/asset.naturalHeight);
 return {id,type:'plot',name:panelNames[key]||key,x:box.x+(box.width-asset.naturalWidth*scale)/2,y:box.y+(box.height-asset.naturalHeight*scale)/2,width:asset.naturalWidth*scale,height:asset.naturalHeight*scale,rotation:0,assetId:key,source:{svgPath:`plots/${key}.svg`,...(asset.hasManifest?{manifestPath:`plots/${key}.fluxplot.json`}:{}),...(asset.hasRecipe?{recipePath:`plots/${key}.recipe.json`}:{}),frozen:false}};
}
export function makeFigureModel(assets){
 const make=(id,keys,cols,rows,number,nickname)=>{
  const width=1440,height=number===1?700:850, margin=22, gap=14, cellW=(width-2*margin-(cols-1)*gap)/cols, cellH=(height-2*margin-(rows-1)*gap)/rows;
  const fig={id,referenceKey:id,name:`Figure ${number}`,family:'figure',number,nickname,canvasId:'canvas-1',x:number===1?0:1500,y:0,width,height,background:'#ffffff',elements:[],captions:{__figure__:number===1?'Neuronal populations encode diverse stimulus features. An original demonstration assembled from public neuronal and anatomical datasets; the panels are exploratory visualizations, not a reproduced publication.':'Complementary views of response structure. Original exploratory summaries of the same public source collection.'}};
  keys.forEach((key,i)=>{const x=margin+(i%cols)*(cellW+gap),y=margin+Math.floor(i/cols)*(cellH+gap);const labelId=`${id}-label-${i}`;const label=text(labelId,String.fromCharCode(97+i),x,y,28,34,27,INK,700);label.fontFamily='Arial';label.panelLabel=true;fig.elements.push(label,plotElement(key,{x:x+3,y:y+30,width:cellW-3,height:cellH-34},assets,`${id}-${key}`));fig.captions[labelId]=panelNames[key]+'.';});
  return fig;
 };
 return {version:2,name:TITLE,canvases:[{id:'canvas-1',name:'Population coding'}],figures:[make(FIGURE_ID,panelOrder,4,2,1,'From neurons to population codes'),make('fig-neural-structure',supportingOrder,2,2,2,'Response structure and variation')],assets:assets.map(({hasManifest,hasRecipe,...a})=>a),palette:['#266e9e','#b44e6c','#368d89','#bd8635','#75649a','#22272e'],textStyles:[],colorGroups:[]};
}
const reveal=(target,id,part)=>({id,target,...(part?{part}:{}),preset:'fade',duration:850,easing:'smooth'});
const rise=(target,id)=>({id,target,preset:'fadeRise',duration:800,easing:'smooth'});
const beat=(id,label,tracks)=>({id,label,advance:'click',tracks});
export function makeDeck(createDeck,assets){
 const d=createDeck({id:DECK_ID,title:'From neurons to neural codes',stage:{width:960,height:540},withTitleSlide:false,theme:'flux-light'});d.created=d.modified=STAMP;
 d.assets=[];d.externalAssetSizes=Object.fromEntries(assets.map(a=>[a.id,{width:a.naturalWidth,height:a.naturalHeight}]));
 const base=(id,name,title,kicker='NEURAL POPULATIONS / A FLUX DEMONSTRATION')=>({id,name,background:'#ffffff',notes:'Original explanatory demo made from public data. Figures are exploratory and do not establish a biological finding. Source records and processing choices are documented in data/ and paper/methods.qmd.',elements:[text(`${id}-eyebrow`,kicker,32,24,880,19,12,MUTED),text(`${id}-title`,title,32,55,900,48,32),text(`${id}-footer`,'Public data · original analysis and presentation · an illustrative Flux project',32,512,900,18,11,MUTED)],beats:[]});
 const results=base('results','Many neurons. Many responses.','An ensemble, many responses.');
 results.elements.push(plotElement('03-response-heatmap',{x:24,y:133,width:510,height:344},assets,'response-map'),plotElement('05-response-network',{x:580,y:133,width:340,height:307},assets,'response-network'),text('response-map-label','01   Patterns across a population',38,111,460,21,14,MUTED),text('network-label','02   Shared response profiles',584,111,342,21,14,MUTED),text('results-caption','Different views. One connected result.',578,466,352,25,18,BLUE));
 results.beats=[beat('initial','The cells and stimulus axes',[]),beat('responses','Reveal population responses',[reveal('response-map','response-map-reveal','cell-responses.x-heatmap')]),beat('relationships','Reveal shared response profiles',[{id:'network-edges-reveal',target:'response-network',part:'signal-correlation-edges.x-similarity-edges',preset:'drawOn',duration:1200,easing:'smooth'}]),beat('interpretation','Bring out the interpretation',[rise('results-caption','conclusion-reveal')])];
 const anatomy=base('anatomy','From anatomy to activity','A circuit begins with its cells.');
 anatomy.elements.push(plotElement('01-brain-regions',{x:32,y:132,width:455,height:342},assets,'brain-context'),plotElement('02-neuron-morphology',{x:500,y:128,width:424,height:350},assets,'neuron-context'),text('anatomy-note','Structure provides context for the activity we measure.',32,478,870,22,17,BLUE));
 anatomy.beats=[beat('initial','Anatomical context',[]),beat('cells','Meet the neurons',[reveal('neuron-context','neurons-reveal')]),beat('context','Connect scales',[rise('anatomy-note','context-note')])];
 const tuning=base('tuning','A diversity of responses','The same input, different preferences.');
 tuning.elements.push(plotElement('04-tuning-curves',{x:27,y:138,width:444,height:327},assets,'tuning-profiles'),plotElement('06-selectivity-distribution',{x:507,y:140,width:414,height:323},assets,'response-statistics'),text('tuning-note','Individual differences become visible in the population.',32,482,890,24,17,BLUE));
 tuning.beats=[beat('initial','Individual tuning profiles',[]),beat('variation','See the variation',[reveal('response-statistics','statistics-reveal')]),beat('summary','Read the population',[rise('tuning-note','tuning-summary')])];
 const population=base('population','Patterns in activity space','A population reveals its structure.');
 population.elements.push(plotElement('08-population-pca',{x:24,y:126,width:498,height:354},assets,'population-space'),plotElement('09-response-correlation',{x:566,y:133,width:356,height:329},assets,'shared-structure'),text('population-note','One dataset. Many ways to see the pattern.',545,474,380,23,17,BLUE));
 population.beats=[beat('initial','Population activity space',[]),beat('shared','Reveal shared structure',[reveal('shared-structure','correlation-reveal')]),beat('summary','Bring the views together',[rise('population-note','population-summary')])];
 d.slides=[results,anatomy,tuning,population];return d;
}
export const article=`---
title: "Neuronal networks flexibly encode diverse stimuli"
subtitle: "An illustrative project in population neuroscience"
author: Flux demonstration project
bibliography: ../references/library.bib
---

## A population view of neural information

A stimulus can recruit many neurons without producing the same response in every cell. We explore this simple idea through public neuronal recordings, reconstructed cell shapes and anatomical surfaces. Each view offers a different scale for the same question: how does activity across a population make information visible?

![](../fig/renders/fig-neural-populations.svg){#fig-neural-populations}

The visual story moves from anatomy to activity. Individual response profiles show preferences; a heatmap brings those profiles together; network and population-space views expose relationships between them. All panels were designed for this demonstration. They are exploratory illustrations, rather than evidence for the paper's intentionally broad working title.

## From a response map to a connected result

A single summary cannot show every relationship in a dataset. The figure combines complementary views while retaining the observations, plot sources and processing notes that produced each panel. The original data sources are identified in the project bibliography [@allenCellMorphologies; @allenVisualResponses; @allenMouseMeshes].

![](../slides/neural-populations/renders/results-step-0.svg){#slide-neural-results .flux-slide deck="neural-populations" slide="results" width=100%}

## Variation is part of the pattern

Neurons differ in their response profiles, selectivity and shared activity. Looking at the individual measurements alongside the population summaries makes this variation visible. Distribution and paired-comparison panels preserve that detail, while the larger heatmap establishes the overall structure.

![](../fig/renders/fig-neural-structure.svg){#fig-neural-structure}

## A working example, ready to edit

The manuscript, compositions, plots and slides are ordinary project files. Their visual vocabulary is shared, so a selected neuron, response group or comparison remains recognizable as the explanation moves between a paper and a presentation.

## Data and interpretation

This is an original Flux showcase project, not a scientific report. Public source datasets supply the numerical and anatomical material; our selection, transformations, visual compositions and wording are new. Anatomical context and activity panels may come from different public specimens or experiments and must not be interpreted as one matched biological sample. The project methods and provenance records identify those boundaries.
`;
export const methods=`---
title: "Methods and source notes"
---

## Purpose

This project demonstrates a connected scientific workflow. Its intentionally broad title is a narrative device, not a tested conclusion. No text or figure was copied from a research paper.

## Public data

The source inventory, download addresses, source identifiers and checksums live in \`data/allen/provenance.json\` and the accompanying data README. Dataset records are cited in \`references/library.bib\`. Raw source files are retained so the plots can be rebuilt or replaced.

## Plot construction

Twelve editable SVG panels are generated by \`scripts/generate-plots.py\`. The same assets are arranged into two Flux Figure compositions and reused by four native slides. Plot processing details are recorded by the generator and inventory. Network edges summarize response similarity; they should not be interpreted as measured synaptic connections. Population projections are descriptive views of the selected response matrix.

## Anatomy and physiology

Brain surfaces, neuronal reconstructions and population measurements provide complementary context. They may come from different public specimens or experiments. The project does not claim a matched multimodal recording.

## Editing and reproducibility

Edit the manuscript in Paper, rearrange panels and labels in Figure, and edit the presentation in Slides. The shared plot sources live in \`plots/\`; accepted copies in \`fig/assets/\` are managed by Flux. Editing or regenerating a plot updates its linked placements. The website refresh command reads this project and rebuilds the public exports without replacing its authored documents or compositions.
`;
export const references=[
 ['allenCellMorphologies','Public neuron reconstructions: three Cell Types Database specimens','Allen Institute for Brain Science',2015,'Public dataset','anatomy; morphology','https://celltypes.brain-map.org/','Dataset source record; see data/allen/provenance.json for exact selected identifiers.'],
 ['allenVisualResponses','Public calcium-imaging responses: Visual Coding experiment 501940850','Allen Institute for Brain Science',2016,'Public dataset','responses; population','https://observatory.brain-map.org/visualcoding/','Dataset source record; see data/allen/provenance.json for exact selected identifiers.'],
 ['allenMouseMeshes','Mouse reference-space surface geometry: 2017 annotation meshes','Allen Institute for Brain Science',2017,'Public dataset','anatomy; atlas','https://atlas.brain-map.org/','Dataset source record; anatomical context is not a matched recording.'],
 ['demo-manuscript',TITLE,'Flux demonstration project',2026,'Project manuscript','neurons; population','','Original demonstration manuscript, not an external research publication.'],
 ['demo-response-map','Constructing a population response map','Flux demonstration project',2026,'Project notebook','responses; methods','','Original project note, not an external research publication.'],
 ['demo-network','A network view of response similarity','Flux demonstration project',2026,'Project notebook','network; analysis','','Original project note, not an external research publication.'],
 ['demo-tuning','Comparing individual response preferences','Flux demonstration project',2026,'Project notebook','tuning; variation','','Original project note, not an external research publication.'],
 ['demo-projection','Population structure in a compact activity space','Flux demonstration project',2026,'Project notebook','population; projection','','Original project note, not an external research publication.'],
 ['demo-figure','Design notes for the neural-population figure','Flux demonstration project',2026,'Project notebook','figures; design','','Original project note, not an external research publication.'],
 ['demo-presentation','Turning a response map into an explanation','Flux demonstration project',2026,'Project notebook','slides; narrative','','Original project note, not an external research publication.']
];
export const bib=references.map(([key,title,author,year,publisher,keywords,url,note])=>`@misc{${key},\n title={${title}},\n author={{${author}}},\n year={${year}},\n publisher={${publisher}},\n keywords={${keywords}},${url?`\n url={${url}},`:''}\n note={${note}}\n}`).join('\n\n')+'\n';
