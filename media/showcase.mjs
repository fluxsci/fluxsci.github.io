/** New website-only composition from unchanged, user-authorized source plots.
 * Never reads the owner's test decks, canvases, manuscript, context or library. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const TITLE='Patterns in a changing population';
export const DECK_ID='website-showcase';
export const FIGURE_ID='fig-population';
export async function prepareShowcase(source, authored, project) {
 const load=p=>import(pathToFileURL(path.join(source,p)).href);
 const [ops,{buildScaffoldTree},{planFigSave,executeFigSave},{svgIntrinsicSize}]=await Promise.all([load('src/lib/slide/ops.ts'),load('src/lib/project/scaffoldTree.ts'),load('src/lib/project/figfiles.ts'),load('src/lib/plot/svgGeometry.ts')]);
 const deck=ops.createDeck({id:DECK_ID,title:'Patterns in motion',stage:{width:1100,height:720},theme:'flux-light',withTitleSlide:false});
 const names=['tuning_baseline','tuning_sharpened','tuning_rebalanced','neurons_mixed','neurons_clustered','neurons_reconfigured'];
 const assets={},inputs={};
 const write=async(rel,bytes)=>{const p=path.join(project,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,bytes);};
 await fs.rm(project,{recursive:true,force:true});await fs.mkdir(project,{recursive:true});
 for(const name of names){
   const stem=`plots/data_morph/${name}`,svg=await fs.readFile(path.join(authored,stem+'.svg'),'utf8'),size=svgIntrinsicSize(svg),id=name;
   assets[name]={id,kind:'svg',name:name.replaceAll('_',' '),path:`assets/${id}.svg`,naturalWidth:size.w,naturalHeight:size.h};
   ops.addAsset(deck,assets[name]);
   for(const ext of ['svg','fluxplot.json','recipe.json']){
    const rel=stem+'.'+ext,bytes=await fs.readFile(path.join(authored,rel));
    inputs[rel]=createHash('sha256').update(bytes).digest('hex');
    for(const dst of [rel,`fig/assets/${id}.${ext}`,`slides/${DECK_ID}/assets/${id}.${ext}`])await write(dst,bytes);
   }
 }
 const addText=(s,text,x,y,width,height,fontSize=20,color='#100f0f',family='Arial')=>ops.addSlideText(deck,s.id,{text,x,y,width,height,fontSize,color,fontFamily:family,sizing:'fixed'});
 const makeSlide=(id,name,title,sub)=>{
   const s=ops.addSlide(deck,{id,name,layout:'blank',background:'#ffffff'});
   addText(s,'PATTERNS IN MOTION    /    A FLUX STUDY',52,30,950,24,13,'#575653');
   addText(s,title,50,78,1000,68,46,'#100f0f','Georgia');
   addText(s,sub,52,151,985,35,21,'#575653');
   addText(s,'SYNTHETIC DATA   ·   An illustration, not an experimental finding',52,671,995,22,13,'#575653');
   return s;
 };
 const addPlot=(s,name,x,y,width)=>{const a=assets[name];return ops.addPlotToSlide(deck,s.id,{assetId:a.id,source:{svgPath:`plots/data_morph/${name}.svg`,manifestPath:`plots/data_morph/${name}.fluxplot.json`,recipePath:`plots/data_morph/${name}.recipe.json`},x,y,width,height:width*a.naturalHeight/a.naturalWidth});};
 function morph(s,plotId,labelId,states,labels){
  states.forEach((name,i)=>{
   const b=ops.addBeat(deck,s.id,{id:`${s.id}-step-${i+1}`,label:labels[i],advance:'click'});
   ops.setTransform(deck,s.id,b.id,plotId,{toAssetId:name,svgPath:`plots/data_morph/${name}.svg`,manifestPath:`plots/data_morph/${name}.fluxplot.json`,duration:1800,easing:'smooth',start:0});
   ops.setTransform(deck,s.id,b.id,labelId,{state:{text:labels[i]},duration:250});
  });
 }
 const tuning=makeSlide('response-shapes','Response profiles','A response is a shape.','Three model populations. The same input, a different response.');
 const tp=addPlot(tuning,'tuning_baseline',110,208,880);
 const tl=addText(tuning,'01   Broad responses',57,629,950,30,20,'#205ea6');
 morph(tuning,tp,tl,['tuning_sharpened','tuning_rebalanced','tuning_baseline'],['02   Responses sharpen and shift','03   Response strength redistributes','01   Broad responses']);
 const population=makeSlide('population-patterns','Population geometry','Follow the pattern. Keep the identity.','108 model neurons move through three illustrative configurations.');
 const np=addPlot(population,'neurons_mixed',50,215,600);
 addText(population,'108',794,266,230,86,78,'#205ea6','Georgia');
 addText(population,'points retain their names',794,363,254,60,21);
 addText(population,'Three groups.\nNew positions.\nOne continuous story.',794,445,250,115,21,'#575653');
 const nl=addText(population,'01   Mixed population',57,629,950,30,20,'#205ea6');
 morph(population,np,nl,['neurons_clustered','neurons_reconfigured','neurons_mixed'],['02   Three clusters emerge','03   The geometry reorganizes','01   Mixed population']);
 for(const s of deck.slides)ops.setSlide(deck,s.id,{notes:'Original website presentation. Source plots are byte-for-byte copies of the supplied demonstration project. All data are synthetic. These slides do not use any authored test deck.',transition:'fade'});
 const tree=buildScaffoldTree({title:TITLE,author:'Flux demonstration'},deck);
 for(const dir of tree.dirs)await fs.mkdir(path.join(project,dir),{recursive:true});
 for(const [rel,text]of tree.files)await write(rel,text);
 await write(`slides/${DECK_ID}/deck.json`,JSON.stringify(deck,null,2)+'\n');
 const originalPlot=(name,id,x,y,width)=>({id,type:'plot',name:name.replaceAll('_',' '),x,y,width,height:width*assets[name].naturalHeight/assets[name].naturalWidth,rotation:0,assetId:name,source:{svgPath:`plots/data_morph/${name}.svg`,manifestPath:`plots/data_morph/${name}.fluxplot.json`,recipePath:`plots/data_morph/${name}.recipe.json`},frozen:false});
 const label=(id,text,x,y,width,size=22)=>({id,type:'text',text,x,y,width,height:42,fontSize:size,fontFamily:'Arial',fontWeight:400,color:'#100f0f',sizing:'fixed',rotation:0});
 const figure={id:FIGURE_ID,referenceKey:FIGURE_ID,name:'Figure 1',title:'Response profiles and population geometry',nickname:'Response profiles and population geometry',family:'figure',number:1,canvasId:'canvas-1',x:0,y:0,width:1100,height:490,background:'#fff',elements:[label('figure-title','Complementary views of a population',35,24,1000,29),label('panel-a','a   Response profiles',35,95,550,21),label('panel-b','b   Population geometry',663,95,400,21),originalPlot('tuning_baseline','tuning-plot',16,155,632),originalPlot('neurons_clustered','population-plot',642,155,436)],captions:{__figure__:'Complementary views of a synthetic population. (a) Three model response profiles across stimulus direction. (b) 108 synthetic points arranged into three groups in arbitrary response coordinates. These constructed examples illustrate a visual workflow; they are not matched experimental measurements.'}};
 const model={version:2,name:TITLE,canvases:[{id:'canvas-1',name:'Response profiles'}],figures:[figure],assets:Object.values(assets),palette:['#205ea6','#bc5215','#5e409d'],textStyles:[],colorGroups:[]};
 const plan=planFigSave(model,null);await executeFigSave(plan,{read:async rel=>fs.readFile(path.join(project,rel),'utf8').catch(()=>null),write});
 const manifest=tree.manifest;manifest.id='proj_website_showcase';manifest.title=TITLE;manifest.figures=JSON.parse(plan.index.text).figures;manifest.slides=[{id:DECK_ID,title:deck.title,path:`slides/${DECK_ID}/deck.json`,order:1}];manifest.manuscript.path='paper/manuscript.qmd';manifest.documentOrder=['paper/manuscript.qmd'];
 await fs.rm(path.join(project,'paper/notes.qmd'),{force:true});
 await write('project.json',JSON.stringify(manifest,null,2)+'\n');
 return {inputs};
}
export const references=[['demo-manuscript',TITLE,'Flux demonstration',2026,'Demonstration manuscript','Synthetic data; Neural responses','','Original illustrative manuscript using synthetic plots from the supplied visual project.'],['demo-response','Response profiles: visual study','Flux demonstration',2026,'Project notes','Synthetic data; Tuning','','A visual explanation of three synthetic response functions.'],['demo-population','Population geometry: visual study','Flux demonstration',2026,'Project notes','Synthetic data; Population geometry','','108 synthetic points keep their identity while their coordinates change.']];
export const bib=references.map(([key,title,author,year,journal,keywords,url,note])=>`@misc{${key},\n title={${title}},\n author={{${author}}},\n year={${year}},\n note={${note}},\n keywords={${keywords}}\n}`).join('\n\n');
