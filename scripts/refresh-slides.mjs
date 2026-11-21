/** Export the owner's Plots in Motion and launch-film slides through Flux's native player. The source project is read-only:
 *  the selected decks are copied into .cache/film-slides/ and exported from there. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const site=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--flux-source')||!arg('--project'))throw Error('Pass --flux-source /path/to/flux and --project /path/to/MASTER_DEMO_FluxProj. Pass --film-project with the original October film export if available. Add --review to review all animated slides in the supplied decks.');
const source=path.resolve(arg('--flux-source')),authored=path.resolve(arg('--project')),project=path.join(site,'.cache','film-slides'),review=process.argv.includes('--review');
const pin=JSON.parse(await fs.readFile(path.join(site,'flux-source.json'),'utf8')),player=pin.slidePlayer;
// The player is the pinned revision plus the reviewed patches listed in flux-source.json, nothing else.
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==player.revision)throw Error('Flux checkout does not match slidePlayer.revision in flux-source.json');
const expectedDiff=(await Promise.all(player.patches.map(p=>fs.readFile(path.join(site,p.path),'utf8')))).join('');
for(const p of player.patches)if(createHash('sha256').update(await fs.readFile(path.join(site,p.path))).digest('hex')!==p.sha256)throw Error(`Patch changed: ${p.path}`);
if(execFileSync('git',['-C',source,'diff','HEAD','--','src','flux-core','scripts','package.json','package-lock.json'],{encoding:'utf8'})!==expectedDiff)throw Error('Flux checkout must be the pinned revision with exactly the listed patches applied');
if(!process.env.FLUX_ASSET_CHILD){
 execFileSync(process.execPath,['scripts/gen-slide-embed-assets.mjs'],{cwd:source,stdio:'inherit'});
 execFileSync(process.execPath,['scripts/gen-model3d-viewer.mjs'],{cwd:source,stdio:'inherit'});
 execFileSync(process.execPath,['--import',path.join(source,'node_modules/tsx/dist/loader.mjs'),fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,FLUX_ASSET_CHILD:'1'}});process.exit(0);
}
const {FILM_DECKS,MOTION,HOMEPAGE,STUDIES}=await import('../media/film-slides.mjs');
const load=rel=>import(pathToFileURL(path.join(source,rel)).href);
const [{validateDeckFile},{ensureDom},{createSlideRepository},{prepareSlideDocument},{renderSlidePosterSvg,evaluateSlide},{build}]=await Promise.all([
 load('src/lib/project/validate.ts'),load('flux-core/render.ts'),load('src/lib/slide/embedRepository.ts'),load('src/lib/slide/embedDocument.ts'),load('src/lib/slide/embedRender.ts'),load('node_modules/esbuild/lib/main.js')]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const exists=p=>fs.access(p).then(()=>true,()=>false);

// The current master and October film master are separate revisions. Keep their asset registries
// separate so a deck's external references always resolve against the project that produced it.
const filmSource=arg('--film-project') ? path.resolve(arg('--film-project')) : null;
const sources=[{root:authored,ids:[MOTION],name:'motion'},...(filmSource?[{root:filmSource,ids:FILM_DECKS,name:'film'}]:[])];
const owners=new Map();
await fs.rm(project,{recursive:true,force:true});
for(const item of sources){
 const root=path.join(project,item.name);
 const manifest=JSON.parse(await fs.readFile(path.join(item.root,'project.json'),'utf8'));
 const entries=manifest.slides.filter(entry=>item.ids.includes(entry.id));
 const inputs={};
 const copy=async rel=>{
  const bytes=await fs.readFile(path.join(item.root,rel));inputs[rel]=hash(bytes);
  const dest=path.join(root,rel);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);return bytes;
 };
 const figIndex=JSON.parse(await copy('fig/index.json')),figFiles=await fs.readdir(path.join(item.root,'fig/assets'));
 for(const id of item.ids){
  const entry=entries.find(d=>d.id===id);if(!entry)throw Error('Missing slide deck '+id);
  const dir=path.dirname(entry.path);
  await fs.cp(path.join(item.root,dir),path.join(root,dir),{recursive:true,filter:p=>!path.basename(p).startsWith('._')&&!p.includes('/renders')});
  const deck=JSON.parse(await copy(entry.path));const errors=validateDeckFile(deck);if(errors.length)throw Error(`${id}: ${errors.join('; ')}`);
  const own=new Map(deck.assets.map(a=>[a.id,a.path]));
  for(const assetId of new Set(deck.slides.flatMap(s=>s.elements.map(e=>e.assetId)).filter(a=>a&&!own.has(a)))){
   if(!figIndex.assets.some(a=>a.id===assetId))throw Error(`${id} uses an unknown asset ${assetId}`);
   for(const name of figFiles.filter(n=>n.startsWith(assetId+'.')))await copy('fig/assets/'+name);
  }
  owners.set(id,{root,entry,deck,own,inputs,manifest,figIndex});
 }
 await fs.writeFile(path.join(root,'project.json'),JSON.stringify({...manifest,figures:[],slides:entries,documentOrder:[]},null,2));
}
await ensureDom();

const io={readText:p=>fs.readFile(p,'utf8'),readFile:p=>fs.readFile(p),exists};
const {resolveModelPosters}=await load('flux-core/model3dPosterCache.ts');
const {partStatesFromOpacity,modelPartOpacity}=await load('src/lib/model3d/appearance.ts');
const {staticModelRequest}=await load('src/lib/model3d/static.ts');
async function modelPoster(root,request,relative){
 const figure={id:'poster',name:'Slide',canvasId:'slide',x:0,y:0,width:request.element.width,height:request.element.height,background:'transparent',elements:[request.element]};
 const bytes=(await fs.stat(path.join(root,relative))).size;
 const rendered=await resolveModelPosters(root,[figure],[{...request.asset,bytes,path:relative}],{policy:'project',surface:'slide',assetPrefix:'',manifests:{[request.asset.id]:request.manifest},partStates:()=>partStatesFromOpacity(request.partOpacity)});
 if(rendered.warnings.length)throw Error(rendered.warnings.join('\n'));const url=rendered.urls[request.ref];if(!url)throw Error('Missing native 3D poster');return url;
};
const repositories=new Map();
for(const owner of owners.values()){
 const {root,inputs}=owner;
 if(repositories.has(root))continue;
 const read=async p=>{const bytes=await fs.readFile(p);inputs[path.relative(root,p)]=hash(bytes);return bytes;};
 repositories.set(root,createSlideRepository(root,{...io,readFile:read,readText:async p=>(await read(p)).toString('utf8')}));
}

// The film master may be unavailable. The previously published player pages contain portable
// native Flux payloads (including model bytes and stored views); verify those pages with the
// publication manifest and extract just their data. Their old JavaScript is never used.
const FILM_SNAPSHOT='d85533f4b1b9874e6773df8c68d49b2175d5ddb0';
const history=rel=>execFileSync('git',['-C',site,'show',`${FILM_SNAPSHOT}:${rel}`],{maxBuffer:32*1024*1024});
const prior=filmSource?null:JSON.parse(history('media/slides.json'));
const inherited=new Map();
const inheritedInputs={};
if(prior){
 const checked=rel=>{
  const bytes=history(rel),expected=prior.outputs[rel].sha256;
  if(hash(bytes)!==expected)throw Error('Historical slide export hash changed: '+rel);
  inheritedInputs[rel]=expected;return bytes.toString('utf8');
 };
 const extract=rel=>JSON.parse(checked(rel).match(/<script type="application\/json" id="payload">([^]*?)<\/script>/)[1]);
 for(const payload of extract('site/demos/slides/index.html'))inherited.set(payload.deck.slides[0].id,{payload});
 for(const sel of STUDIES){
  const rel=`site/demos/studies/${sel.id}`;
  const [payload]=extract(rel+'.html');
  inherited.set(sel.slide,{payload,poster:checked(rel+'.svg')});
 }
}
async function snapshot(sel){
 const owner=owners.get(sel.deck);
 if(!owner){
  const snap=inherited.get(sel.slide);
  if(!snap)throw Error('Missing reviewed film slide '+sel.slide);
  return snap;
 }
 const snap=await repositories.get(owner.root).materialize({deck:sel.deck,slide:sel.slide},{portable:true});if(snap.warnings.length)throw Error(snap.warnings.join('\n'));
 const single=snap.payload,slide=single.deck.slides[0];
 if(sel.title)slide.name=sel.title;
 // Browsers without WebGL show a saved view of every 3D element at each step.
 for(let step=0;step<slide.beats.length;step++){
  const frame=evaluateSlide(single,step);
  for(const element of frame.elements.filter(e=>e.type==='model3d')){
   const asset=single.deck.assets.find(a=>a.id===element.assetId);
   const request=staticModelRequest(element,asset,single.modelManifests?.[asset.id],'slide',modelPartOpacity(frame.partStates[element.id]));
   if(!single.assets[request.ref])single.assets[request.ref]=await modelPoster(owner.root,request,path.join(path.dirname(owner.entry.path),owner.own.get(asset.id)));
  }
 }
 return {payload:single};
}
// Each slide keeps its own deck payload: the decks differ in theme, palette and styles.
const DECK_TITLE='The Flux film';
const HOME_TITLE='Flux slides in motion';
const payloads=(snaps,single)=>snaps.map(s=>({...s.payload,deck:{...s.payload.deck,title:single?DECK_TITLE:HOME_TITLE}}));
const runtimeAssets=JSON.parse(await fs.readFile(path.join(source,'.generated/slide-embed-assets.json'),'utf8'));
const {loadEmbedModelRuntime}=await load('src/lib/slide/embedAssets.ts');
const modelRuntime=await loadEmbedModelRuntime();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const poster=(snap,step)=>snap.poster??renderSlidePosterSvg(snap.payload,step).replace('</svg>',`<style>${runtimeAssets.fonts}</style></svg>`);
const styleRef=HOMEPAGE[0],styleOwner=owners.get(styleRef.deck);
const prepared=await prepareSlideDocument(`![](x.svg){.flux-slide deck="${styleRef.deck}" slide="${styleRef.slide}" width=100%}`,repositories.get(styleOwner.root),{interactive:true,strict:true});

// The homepage loads only the selected payload. Studies embed one portable snapshot.
// Flux governs rendering, animation and transforms in both players.
const recorded3d=JSON.parse(await fs.readFile(path.join(site,'media/slide-3d-fallback.json'),'utf8'));
const hostSource=`import {recorded3dPlayer} from ${JSON.stringify(path.join(site,'scripts/slide-3d-fallback.mjs'))};
import {payloadModelHost} from ${JSON.stringify(path.join(source,'src/lib/slide/export/model3dPayloadHost.ts'))};
import {mountSlideEmbed} from ${JSON.stringify(path.join(source,'src/lib/slide/embedPlayer.ts'))};
const entries=JSON.parse(document.getElementById('payload').textContent);
const host=document.getElementById('native-player'),selector=document.getElementById('slide-select');
const count=document.getElementById('selected-slide-status'),error=document.getElementById('slide-load-error');
const single=document.documentElement.dataset.single==='true',states=new Map(),loads=new Map();
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let controller,selected=-1,request=0,reduced=preference.matches;
function useMotionPreference(value){
 reduced=value;
 controller?.setReducedMotion(value);
}
preference.addEventListener('change',event=>useMotionPreference(event.matches));
function payloadAt(index){
 const entry=entries[index];
 if(!entry.file)return Promise.resolve(entry);
 if(!loads.has(index)){
  const pending=fetch(entry.file).then(async response=>{
   if(!response.ok)throw Error('Slide download failed');
   let bytes=new Uint8Array(await response.arrayBuffer());
   // A host can serve the stored gzip file either as an encoded response or as a download.
   // The browser may already have removed a transport layer. Match the actual bytes and
   // allow at most two layers: the stored payload plus one layer added by a host.
   for(let layer=0;layer<2&&bytes[0]===0x1f&&bytes[1]===0x8b;layer++){
    const data=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes=new Uint8Array(await new Response(data).arrayBuffer());
   }
   return JSON.parse(new TextDecoder().decode(bytes));
  });
  loads.set(index,pending);
  pending.catch(()=>loads.delete(index));
 }
 return loads.get(index);
}
async function mount(index,play=false){
 if(!entries[index])return;
 const token=++request;
 if(selector){selector.value=String(index);count.textContent='Loading slide…';}
 error.hidden=true;
 if(selected!==index)controller?.pauseOffscreen();
 let payload;
 try{payload=await payloadAt(index);}
 catch{
  if(token!==request)return;
  error.hidden=false;
  if(selector){selector.value=String(Math.max(0,selected));count.textContent='';}
  return;
 }
 if(token!==request)return;
 const slide=payload.deck.slides[0];
 if(selected!==index){
  controller?.destroy();
  const modelHost=payloadModelHost(payload),recorded=slide.id===${JSON.stringify(recorded3d.source.slideId)};
  const stills=!modelHost&&!recorded&&slide.elements.some(e=>e.type==='model3d');
  controller=mountSlideEmbed(host,payload,{
   model3d:modelHost,
   adaptPlayer:recorded?(player,art)=>recorded3dPlayer(player,art,{liveModel:!!modelHost}):undefined,
   state:{beatId:states.get(slide.id)?.beatId??slide.beats[0].id,reduced:stills||reduced},
   onState:state=>{states.set(slide.id,state);if(!stills)reduced=state.reduced}
  });
  if(stills){
   const motion=host.querySelector('[aria-label="Toggle animation"]');
   motion.disabled=true;motion.title='This browser shows saved 3D views. Use the arrows to change view.';
  }
  selected=index;
  for(const credit of document.querySelectorAll('[data-credit]'))credit.hidden=credit.dataset.credit!==slide.id;
  document.documentElement.classList.add('enhanced');
 }
 if(selector){
  count.textContent='Slide '+(index+1)+' of '+entries.length;
  if(parent!==window)parent.postMessage({type:'flux-demo-selected',index},location.origin);
 }
 if(play&&!reduced&&controller.player.state().beat===0&&!controller.player.state().playing){
  const next=host.querySelector('[aria-label="Next animation step"]');
  if(next&&!next.disabled)next.click();
 }
}
function fromHash(){
 const h=location.hash.slice(1);
 if(/^scene=[0-9]+$/.test(h))return Math.min(Number(h.slice(6)),entries.length-1);
 const index=entries.findIndex(e=>e.id===h||e.study===h||e.deck?.slides[0].id===h);
 return Math.max(index,0);
}
selector?.addEventListener('change',()=>mount(Number(selector.value)));
addEventListener('hashchange',()=>mount(fromHash()));
window.fluxWebsiteDemo={pause:()=>controller?.pauseOffscreen(),state:()=>controller?.player.state(),selectedSlide:()=>entries[selected]?.id??entries[selected]?.deck?.slides[0].id,select:mount};
document.documentElement.classList.add('has-player');
mount(fromHash());
if(parent!==window){let previous=0;new ResizeObserver(()=>{const height=Math.ceil(document.body.getBoundingClientRect().height);if(height>0&&height!==previous){previous=height;parent.postMessage({type:single?'flux-docs-resize':'flux-demo-resize',height},location.origin)}}).observe(document.body);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)controller?.pauseOffscreen()});
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;if(event.data?.type==='flux-demo-pause')controller?.pauseOffscreen();if(event.data?.type==='motion-preference'&&typeof event.data.reducedMotion==='boolean')useMotionPreference(event.data.reducedMotion);});
window.addEventListener('pagehide',event=>{if(event.persisted)controller?.pauseOffscreen();else{request++;controller?.destroy()}});`;
const bundle=await build({stdin:{contents:hostSource,resolveDir:source,sourcefile:'flux-website-slides.js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'inline',metafile:true,logLevel:'silent'});
const STYLE=`<style>html,body{margin:0;background:#fffcf0;color:#22272e}body{padding:0 1px}.flux-slide-embed{margin:0!important;width:100%!important}.deck-selector{display:none;align-items:center;gap:12px;justify-content:space-between;padding:10px 14px;background:#f7f8f8;border-bottom:1px solid #e5e7e8;font:12px system-ui,sans-serif}.has-player .deck-selector{display:flex}.load-error{margin:8px 12px;font:12px system-ui,sans-serif}.deck-selector label{font-weight:600;white-space:nowrap}.deck-selector select{min-width:0;max-width:100%;min-height:44px;flex:1;font:inherit;border:1px solid #c9ced3;border-radius:5px;padding:8px 30px 8px 10px;background:#fff;color:#22272e}.source-credit{margin:0;padding:8px 12px;border-top:1px solid #e5e7e8;font:10px/1.5 system-ui,sans-serif;color:#646b72}.source-credit[hidden]{display:none}.flux-slide-status{display:none}.source-credit a{color:#266e9e}.slide-count{font-variant-numeric:tabular-nums;white-space:nowrap;color:#575e65}.flux-slide-bar{padding:5px 12px;gap:8px;min-height:44px;border-top:1px solid #e5e7e8}.flux-slide-bar button{min-width:44px;min-height:44px}.flux-slide-art:focus-visible,button:focus-visible,select:focus-visible{outline:2px solid #266e9e;outline-offset:-3px}.flux-slide-title{font-size:12px}.fallback{width:100%;height:auto;display:block}.enhanced .fallback{display:none}@media(max-width:550px){.flux-slide-title,.slide-count{display:none}.deck-selector{gap:8px;padding:8px}.deck-selector label{font-size:11px}}@media print{#native-player,.deck-selector{display:none!important}.fallback{display:block!important}}</style>`;
function page({title,selections,snaps,single,fallback,fallbackAlt,files}){
 const entries=files
  ? snaps.map((snap,i)=>({id:snap.payload.deck.slides[0].id,file:files[i]}))
  : payloads(snaps,single).map((payload,i)=>({...payload,...(selections[i].id?{study:selections[i].id}:{})}));
 const json=JSON.stringify(entries).replace(/</g,'\\u003c');
 const selector=single?'':`<div class="deck-selector"><label for="slide-select">Choose a slide</label><select id="slide-select">${selections.map((s,i)=>`<option value="${i}">${escape(s.title||snaps[i].payload.deck.slides[0].name)}</option>`).join('')}</select><span id="selected-slide-status" class="slide-count" aria-live="polite"></span></div>`;
 const credits=selections.map((s,i)=>`<p class="source-credit" data-credit="${escape(snaps[i].payload.deck.slides[0].id)}"${i?' hidden':''}>${s.credit??''}${s.credit?' · ':''}<a href="/docs/visual-credits.html" target="_top">Visual credits</a> · Native Flux player.</p>`).join('');
 return `<!doctype html><html lang="en" data-single="${single}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="robots" content="noindex">${prepared.style}${STYLE}</head><body>${selector}<img class="fallback" alt="${escape(fallbackAlt)}" src="${escape(fallback)}"><div id="native-player"></div><p class="load-error" id="slide-load-error" role="alert" hidden>Slide could not load. Choose it again to retry.</p>${credits}<script type="application/json" id="payload">${json}</script><script>${modelRuntime}</script><script>${bundle.outputFiles[0].text}</script></body></html>`;
}

if(review){
 const all=[];for(const [id,{deck}] of owners)for(const s of deck.slides)if(s.elements.length&&s.beats.length>1)all.push({deck:id,slide:s.id,title:`${deck.title} · ${s.name}`});
 const snaps=[];for(const sel of all){process.stdout.write('.');snaps.push(await snapshot(sel));}
 const out=path.join(site,'.cache/slides-review/index.html');await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.writeFile(out,page({title:'Flux slides review',selections:all,snaps,single:false,fallback:'',fallbackAlt:''}));
 console.log(`\nReview export: ${all.length} slides → ${path.relative(site,out)}`);for(const repo of repositories.values())repo.dispose();process.exit(0);
}

const outputs={};
const write=async(rel,data)=>{const p=path.join(site,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,data);outputs[rel]={bytes:Buffer.byteLength(data),sha256:hash(data)};};
const homeSnaps=[];for(const sel of HOMEPAGE)homeSnaps.push(await snapshot(sel));
const homePoster=poster(homeSnaps[0],HOMEPAGE[0].posterStep??homeSnaps[0].payload.deck.slides[0].beats.length-1);
const files=[];
for(const payload of payloads(homeSnaps,false)){
 const file=`${payload.deck.slides[0].id}.json.gz`;
 const json=JSON.stringify(payload);
 if(/(?:\/Users\/|\/home\/)[a-zA-Z0-9_-]+\//.test(json))throw Error('Local machine path in slide '+file);
 await write(`site/demos/slides/${file}`,gzipSync(json));
 files.push(file);
}
await write('site/demos/slides/index.html',page({title:HOME_TITLE,selections:HOMEPAGE,snaps:homeSnaps,single:false,fallback:'/assets/media/slide-poster.svg',fallbackAlt:HOMEPAGE[0].alt,files}));
await write('site/assets/media/slide-poster.svg',homePoster);
// Each documentation example is its own small page, loaded only when a reader asks for it.
for(const sel of STUDIES){const snap=await snapshot(sel),still=poster(snap,sel.posterStep??snap.payload.deck.slides[0].beats.length-1);await write(`site/demos/studies/${sel.id}.svg`,still);
 await write(`site/demos/studies/${sel.id}.html`,page({title:`${sel.title} — a Flux slide`,selections:[sel],snaps:[snap],single:true,fallback:`${sel.id}.svg`,fallbackAlt:sel.alt}));}
// Optional reference capture project with the light film slides in the film’s order. Never published.
if(filmSource){
 const film=FILM_DECKS[0],{root,entry,deck,manifest,figIndex}=owners.get(film);
 // 3D thumbnails need the newer engine, so the 3D slide stays out of this release screenshot.
 const order=[...HOMEPAGE,...STUDIES].filter(s=>s.deck===film).map(s=>s.slide).filter((id,i,a)=>a.indexOf(id)===i&&!deck.slides.find(x=>x.id===id).elements.some(e=>e.type==='model3d'));
 const capture=path.join(site,'.cache/film-capture-project');await fs.rm(capture,{recursive:true,force:true});
 await fs.cp(path.join(root,path.dirname(entry.path)),path.join(capture,'slides/film'),{recursive:true});
 await fs.cp(path.join(root,'fig/assets'),path.join(capture,'fig/assets'),{recursive:true});
 const used=new Set((await fs.readdir(path.join(capture,'fig/assets'))).map(n=>n.split('.')[0]));
 await fs.writeFile(path.join(capture,'fig/index.json'),JSON.stringify({...figIndex,canvases:[{id:'canvas-1',name:'Figures'}],figures:[],families:[],assets:figIndex.assets.filter(a=>used.has(a.id))},null,2));
 await fs.writeFile(path.join(capture,'slides/film/deck.json'),JSON.stringify({...deck,id:'film',title:DECK_TITLE,slides:order.map(id=>{const s=deck.slides.find(x=>x.id===id),t=[...HOMEPAGE,...STUDIES].find(x=>x.slide===id).title;return {...s,name:t};})},null,2));
 await fs.writeFile(path.join(capture,'project.json'),JSON.stringify({...manifest,title:DECK_TITLE,figures:[],slides:[{id:'film',title:DECK_TITLE,path:'slides/film/deck.json',order:1}],documentOrder:[]},null,2));
 // Plot sources resolve, so the workspace shows no missing-source notice.
 const sources=new Set(order.flatMap(id=>[...JSON.stringify(deck.slides.find(x=>x.id===id)).matchAll(/"(?:svgPath|manifestPath)":"(plots\/[^"]+)"/g)].map(m=>m[1])));
 for(const rel of sources){const from=path.join(filmSource,rel);if(await exists(from)){await fs.mkdir(path.dirname(path.join(capture,rel)),{recursive:true});await fs.copyFile(from,path.join(capture,rel));}}
}
const packages=[...new Set(['three',...Object.keys(bundle.metafile.inputs).map(p=>p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean)])];
for(const pkg of packages){const base=path.join(source,'node_modules',pkg),found=(await fs.readdir(base)).find(n=>/^(?:licen[cs]e|copying)(?:\.md|\.txt)?$/i.test(n));if(!found)throw Error(`Bundled dependency ${pkg} needs a license notice`);await write(`site/assets/licenses/${pkg.replace(/^@/,'').replaceAll('/','-')}-LICENSE.txt`,await fs.readFile(path.join(base,found)));}
const provenance=id=>{
 const {manifest,inputs}=owners.get(id);
 delete inputs['project.json']; // An isolated manifest was generated for the exporter.
 return {id:manifest.id,inputHashes:inputs};
};
const motion={...provenance(MOTION),decks:[MOTION]};
const film=filmSource
 ? {...provenance(FILM_DECKS[0]),decks:FILM_DECKS}
 : {...prior.project,export:{revision:FILM_SNAPSHOT,source:prior.source,inputHashes:inheritedInputs}};
await fs.writeFile(path.join(site,'media/slides.json'),JSON.stringify({
 source:{repository:pin.repository,revision:player.revision,patches:player.patches.map(({path,sha256})=>({path,sha256}))},
 description:'Authored Plots in Motion and launch-film slides from the master demonstration project, played with the native Flux player. See visual credits for data sources.',
 projects:{motion,film},homepage:HOMEPAGE.map(s=>s.slide),studies:STUDIES.map(s=>({id:s.id,slide:s.slide})),bundledPackages:packages,outputs,
},null,2)+'\n');
for(const repo of repositories.values())repo.dispose();
console.log(`Exported ${HOMEPAGE.length} homepage slides and ${STUDIES.length} documentation studies.`);
