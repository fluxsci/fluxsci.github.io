/** Read-only selection from the owner's master project. Only selected figure assets
 * are copied; captions and slides are authored in the disposable website snapshot. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const TITLE='Patterns across scales';
export const DECK_ID='website-showcase';
export const FIGURE_ID='fig_mut5bjopik7r_124';
export const MATERIALS_ID='fig-1';
const hash=b=>createHash('sha256').update(b).digest('hex');
export const captions={
 [MATERIALS_ID]: 'Materials across scales. An authored composition of typical stiffness–density values, a computed bracket stress field, the analytic Kirsch solution, MgB₂ Fermi-surface geometry and sections, an illustrative density of states, and crystal structures. The crystal models use Crystallography Open Database records; the Fermi-surface data come from FermiSurfer. These panels combine reference data, calculations and illustrations, not one experiment.',
 [FIGURE_ID]: 'Anatomy and population responses. Allen CCF2017 brain geometry and a coronal section sit beside MICrONS neuron reconstructions, selected cell responses, direction preferences, response similarity, population trajectories, trial distributions and a 143-cell response atlas. Functional recordings are from Allen Brain Observatory experiment 501940850. Anatomical reconstructions are separate specimens; the circular links show response similarity, not anatomical connectivity.'
};
export async function prepareShowcase(source,authored,project){
 const load=p=>import(pathToFileURL(path.join(source,p)).href);
 const [ops,{buildScaffoldTree},{planFigSave,executeFigSave},{svgIntrinsicSize}]=await Promise.all([load('src/lib/slide/ops.ts'),load('src/lib/project/scaffoldTree.ts'),load('src/lib/project/figfiles.ts'),load('src/lib/plot/svgGeometry.ts')]);
 const inputs={},read=async rel=>{const b=await fs.readFile(path.join(authored,rel));inputs[rel]=hash(b);return b;};
 const index=JSON.parse(await read('fig/index.json')),canvas=JSON.parse(await read('fig/canvases/canvas-1.json'));
 const figures=structuredClone(canvas.figures.filter(f=>[MATERIALS_ID,FIGURE_ID].includes(f.id)));
 if(figures.length!==2)throw Error('Expected the two reviewed master figures');
 const selectedIds=new Set(figures.flatMap(f=>f.elements.flatMap(e=>e.assetId?[e.assetId]:[])));
 const assets=index.assets.filter(a=>selectedIds.has(a.id));
 const write=async(rel,b)=>{const p=path.join(project,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,b);};
 await fs.rm(project,{recursive:true,force:true});await fs.mkdir(project,{recursive:true});
 const files=await fs.readdir(path.join(authored,'fig/assets'));
 for(const a of assets)for(const name of files.filter(n=>n.startsWith(a.id+'.')))await write('fig/assets/'+name,await read('fig/assets/'+name));
 // Sources are remapped to the accepted local assets. Never follow an external
 // library path, refresh a plot, change its overrides, or change its geometry.
 for(const f of figures){
   f.captions={__figure__:captions[f.id]};f.title=f.id===FIGURE_ID?'Anatomy and population responses':'Materials across scales';
   for(const e of f.elements){if(!e.assetId||!e.source)continue;const a=assets.find(a=>a.id===e.assetId),stem='fig/assets/'+a.id;
     e.source={...(a.kind==='glb'?{glbPath:stem+'.glb',sha256:e.source.sha256}:{svgPath:stem+'.svg'}),...(files.includes(a.id+'.fluxplot.json')?{manifestPath:stem+'.fluxplot.json'}:{})};
   }
 }
 const deck=ops.createDeck({id:DECK_ID,title:TITLE,stage:{width:1200,height:760},theme:'flux-light',withTitleSlide:false});
 const plots={};
 const copyPlot=async(name,rel)=>{const svg=await read(rel+'.svg'),size=svgIntrinsicSize(svg.toString());const a={id:name,kind:'svg',name,path:`assets/${name}.svg`,naturalWidth:size.w,naturalHeight:size.h};ops.addAsset(deck,a);plots[name]=a;
   for(const ext of ['svg','fluxplot.json']){const b=ext==='svg'?svg:await read(rel+'.'+ext);await write(`slides/${DECK_ID}/assets/${name}.${ext}`,b);await write(`plots/showcase/${name}.${ext}`,b);}
 };
 const base='plots/neuroscience_project_from_website/';
 for(const [name,rel]of [['profiles','flagship/23-population-atlas-profiles'],['atlas','flagship/23-population-atlas-heatmap'],['rose','flagship/32-preferred-directions'],['geometry-1','advanced/14-response-geometry-01hz'],['geometry-4','advanced/14-response-geometry-04hz'],['geometry-15','advanced/14-response-geometry-15hz']])await copyPlot(name,base+rel);
 for(const [name,rel]of [['section-a','fermi_mgb2_section_A'],['section-gamma','fermi_mgb2_section_gamma']])await copyPlot(name,'plots/materials_and_engineering/'+rel);
 const txt=(s,text,x,y,w,h,size=21,color='#575653',family='Arial')=>ops.addSlideText(deck,s.id,{text,x,y,width:w,height:h,fontSize:size,color,fontFamily:family,sizing:'fixed'});
 const slide=(id,name,title,sub,credit)=>{const s=ops.addSlide(deck,{id,name,layout:'blank',background:'#ffffff'});txt(s,'FLUX    /    PATTERNS ACROSS SCALES',52,29,1080,24,13);txt(s,title,50,75,1100,70,47,'#100f0f','Georgia');txt(s,sub,53,153,1090,36,21);txt(s,credit,53,716,1090,25,12);return s;};
 const plot=(s,name,x,y,w)=>{const a=plots[name];return ops.addPlotToSlide(deck,s.id,{assetId:name,source:{svgPath:`plots/showcase/${name}.svg`,manifestPath:`plots/showcase/${name}.fluxplot.json`},x,y,width:w,height:w*a.naturalHeight/a.naturalWidth});};
 const atlas=slide('population-atlas','A population of responses','One stimulus. Many responses.','Eight directions of motion, seen through a population of visual neurons.','Data: Allen Institute for Brain Science · Brain Observatory 501940850 · 143 cells');
 plot(atlas,'profiles',44,224,770);plot(atlas,'atlas',44,345,770);
 txt(atlas,'143',900,234,246,99,82,'#205ea6','Georgia');txt(atlas,'recorded cells',908,331,242,34,22,'#100f0f');
 plot(atlas,'rose',905,411,238);
 const note=txt(atlas,'Rows keep each cell visible.\nColour reveals its response.',890,655,290,52,17);
 const aBeat=ops.addBeat(deck,atlas.id,{id:'atlas-explain',label:'Read the population',advance:'click'});
 ops.setAnimation(deck,atlas.id,aBeat.id,{target:note,preset:'fade',duration:650,start:0});
 const geometry=slide('response-geometry','Follow the same cells','The stimulus changes. Identity stays.','143 cells in a common response space, at three temporal frequencies.','Data: Allen Institute for Brain Science · Same cells and PCA basis; interpolation illustrates the change');
 const gp=plot(geometry,'geometry-1',66,218,640);
 const hz=txt(geometry,'1 Hz',818,257,320,100,74,'#205ea6','Georgia');
 txt(geometry,'A point is one cell.',825,377,300,36,24,'#100f0f');txt(geometry,'Follow each point as the\nstimulus frequency changes.\n\nThe coordinates move;\nthe cell identity is retained.',825,435,322,182,22);
 for(const [i,name,label]of [[1,'geometry-4','4 Hz'],[2,'geometry-15','15 Hz'],[3,'geometry-1','1 Hz']]){const b=ops.addBeat(deck,geometry.id,{id:`geometry-${i}`,label,advance:'click'});ops.setTransform(deck,geometry.id,b.id,gp,{toAssetId:name,svgPath:`plots/showcase/${name}.svg`,manifestPath:`plots/showcase/${name}.fluxplot.json`,duration:2100,easing:'smooth',start:0});ops.setTransform(deck,geometry.id,b.id,hz,{state:{text:label},duration:250});}
 const material=slide('fermi-surface','A structure in motion','A different angle. The same structure.','A Fermi surface and two sections through the electronic structure of MgB₂.','FermiSurfer example data · M. Kawamura, Computer Physics Communications 239, 197 (2019)');
 const original=figures[0].elements.find(e=>e.type==='model3d'&&e.name==='fermi_surface_mgb2');
 const model={...structuredClone(original),id:'fermi-model',x:52,y:220,width:550,height:460};ops.addElement(deck,material.id,model);
 for(const [name,x] of [['section-a',643],['section-gamma',908]]){const a=plots[name];ops.addImageToSlide(deck,material.id,{assetId:name,x,y:287,width:254,height:254*a.naturalHeight/a.naturalWidth});}
 txt(material,'3D GEOMETRY',80,225,500,27,13);txt(material,'TWO CROSS-SECTIONS',668,225,470,27,13);
 txt(material,'Rotate the model to see how the surfaces connect.',653,604,500,70,23,'#100f0f','Georgia');
 for(const [i,turns]of [[1,.5],[2,.5]]){const b=ops.addBeat(deck,material.id,{id:`fermi-turn-${i}`,label:i===1?'Turn the structure':'Complete the turn',advance:'click'});ops.addTurntable(deck,{slideId:material.id,beatId:b.id,target:model.id,turns,durationMs:3800});}
 for(const s of deck.slides)ops.setSlide(deck,s.id,{notes:'Original website slides using unchanged plots from the authorized master project. See website visual credits for sources and interpretation.',transition:'fade'});
 const tree=buildScaffoldTree({title:TITLE,author:'Flux demonstration'},deck);
 for(const dir of tree.dirs)await fs.mkdir(path.join(project,dir),{recursive:true});for(const [rel,b]of tree.files)await write(rel,b);
 await write(`slides/${DECK_ID}/deck.json`,JSON.stringify(deck,null,2)+'\n');
 const modelProject={version:2,name:TITLE,canvases:[{id:'canvas-1',name:'Scientific figures'}],figures,assets,palette:index.palette??[],textStyles:index.textStyles??[],colorGroups:index.colorGroups??[]};
 const plan=planFigSave(modelProject,null);await executeFigSave(plan,{read:async rel=>fs.readFile(path.join(project,rel),'utf8').catch(()=>null),write});
 const manifest=tree.manifest;manifest.id='proj_website_showcase';manifest.title=TITLE;manifest.figures=JSON.parse(plan.index.text).figures;manifest.slides=[{id:DECK_ID,title:deck.title,path:`slides/${DECK_ID}/deck.json`,order:1}];manifest.manuscript.path='paper/manuscript.qmd';manifest.documentOrder=['paper/manuscript.qmd'];
 await fs.rm(path.join(project,'paper/notes.qmd'),{force:true});await write('project.json',JSON.stringify(manifest,null,2)+'\n');
 // Compare every visual property against the owner's source, including source-independent metadata.
 for(const f of figures){const clean=v=>{v=structuredClone(v);delete v.captions;delete v.title;v.elements.forEach(e=>delete e.source);return JSON.stringify(v);};if(clean(f)!==clean(canvas.figures.find(o=>o.id===f.id)))throw Error('Authored figure changed: '+f.id);}
 for(const [rel,digest]of Object.entries(inputs))if(hash(await fs.readFile(path.join(authored,rel)))!==digest)throw Error('Authored source changed while copying: '+rel);
 return {inputs};
}
export const references=[['demo-manuscript',TITLE,'Flux demonstration',2026,'Visual study','Figures; Population responses','','An original visual explanation using the authored master figures and public source data.'],['allen-observatory','A large-scale standardized physiological survey reveals functional organization of the mouse visual cortex','de Vries and colleagues',2020,'Nature Neuroscience','Allen Institute; Visual cortex','https://doi.org/10.1038/s41593-019-0550-9','Public visual-response data from the Allen Brain Observatory.'],['fermisurfer','FermiSurfer: Fermi-surface viewer providing multiple representation schemes','Mitsuaki Kawamura',2019,'Computer Physics Communications','Electronic structure; Fermi surfaces','https://doi.org/10.1016/j.cpc.2019.01.017','Source of the MgB2 example data used in the authored materials figure.']];
export const bib=references.map(([key,title,author,year,journal,keywords,url,note])=>`@misc{${key},\n title={${title}},\n author={{${author}}},\n year={${year}},\n journal={${journal}},\n url={${url}},\n note={${note}},\n keywords={${keywords}}\n}`).join('\n\n');
