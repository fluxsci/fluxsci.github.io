/** Export the owner's launch-film slides through Flux's native player. The source project is read-only:
 *  the selected decks are copied into .cache/film-slides/ and exported from there. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const site=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--flux-source')||!arg('--project'))throw Error('Pass --flux-source /path/to/flux and --project /path/to/MASTER_DEMO_FluxProj. Add --review to export every slide of the film decks for review.');
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
const {DECKS,HOMEPAGE,STUDIES}=await import('../media/film-slides.mjs');
const load=rel=>import(pathToFileURL(path.join(source,rel)).href);
const [{validateDeckFile},{ensureDom},{createSlideRepository},{prepareSlideDocument},{renderSlidePosterSvg,evaluateSlide},{build}]=await Promise.all([
 load('src/lib/project/validate.ts'),load('flux-core/render.ts'),load('src/lib/slide/embedRepository.ts'),load('src/lib/slide/embedDocument.ts'),load('src/lib/slide/embedRender.ts'),load('node_modules/esbuild/lib/main.js')]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const exists=p=>fs.access(p).then(()=>true,()=>false);

// Copy only the film decks. Each deck folder holds its own plot, image and model copies; plots a
// slide shares with a figure are read from the figure's accepted asset copy, as Flux does.
const inputs={};
await fs.rm(project,{recursive:true,force:true});
const manifest=JSON.parse(await fs.readFile(path.join(authored,'project.json'),'utf8'));
const copy=async rel=>{const b=await fs.readFile(path.join(authored,rel));inputs[rel]=hash(b);await fs.mkdir(path.dirname(path.join(project,rel)),{recursive:true});await fs.writeFile(path.join(project,rel),b);return b;};
const figIndex=JSON.parse(await copy('fig/index.json')),figFiles=await fs.readdir(path.join(authored,'fig/assets'));
for(const id of DECKS){
 const entry=manifest.slides.find(d=>d.id===id);if(!entry)throw Error('Missing film deck '+id);
 await fs.cp(path.join(authored,path.dirname(entry.path)),path.join(project,path.dirname(entry.path)),{recursive:true,filter:p=>!path.basename(p).startsWith('._')&&!p.includes('/renders')});
 const deck=JSON.parse(await copy(entry.path));const errors=validateDeckFile(deck);if(errors.length)throw Error(`${id}: ${errors.join('; ')}`);
 const own=new Set(deck.assets.map(a=>a.id));
 for(const assetId of new Set(deck.slides.flatMap(s=>s.elements.map(e=>e.assetId)).filter(a=>a&&!own.has(a)))){
  if(!figIndex.assets.some(a=>a.id===assetId))throw Error(`${id} uses an unknown asset ${assetId}`);
  for(const name of figFiles.filter(n=>n.startsWith(assetId+'.')))await copy('fig/assets/'+name);
 }
}
await fs.writeFile(path.join(project,'project.json'),JSON.stringify({...manifest,figures:[],slides:manifest.slides.filter(d=>DECKS.includes(d.id)),documentOrder:[]},null,2));
await ensureDom();

const io={readText:p=>fs.readFile(p,'utf8'),readFile:p=>fs.readFile(p),exists};
const {resolveModelPosters}=await load('flux-core/model3dPosterCache.ts');
const {partStatesFromOpacity,modelPartOpacity}=await load('src/lib/model3d/appearance.ts');
const {staticModelRequest}=await load('src/lib/model3d/static.ts');
io.modelPoster=async(request,relative)=>{
 const figure={id:'poster',name:'Slide',canvasId:'slide',x:0,y:0,width:request.element.width,height:request.element.height,background:'transparent',elements:[request.element]};
 const bytes=(await fs.stat(path.join(project,relative))).size;
 const rendered=await resolveModelPosters(project,[figure],[{...request.asset,bytes,path:relative}],{policy:'project',surface:'slide',assetPrefix:'',manifests:{[request.asset.id]:request.manifest},partStates:()=>partStatesFromOpacity(request.partOpacity)});
 if(rendered.warnings.length)throw Error(rendered.warnings.join('\n'));const url=rendered.urls[request.ref];if(!url)throw Error('Missing native 3D poster');return url;
};
const repo=createSlideRepository(project,io);
// Payload assets are keyed by content; the source path comes from the copied deck.
const deckAssets=new Map();for(const id of DECKS)for(const a of JSON.parse(await fs.readFile(path.join(project,manifest.slides.find(d=>d.id===id).path),'utf8')).assets)deckAssets.set(a.id,a.path);
const deckPath=id=>path.dirname(manifest.slides.find(d=>d.id===id).path);
async function snapshot(sel){
 const snap=await repo.materialize({deck:sel.deck,slide:sel.slide});if(snap.warnings.length)throw Error(snap.warnings.join('\n'));
 const single=snap.payload,slide=single.deck.slides[0];
 if(sel.title)slide.name=sel.title;
 // Browsers without WebGL show a saved view of every 3D element at each step.
 for(let step=0;step<slide.beats.length;step++){
  const frame=evaluateSlide(single,step);
  for(const element of frame.elements.filter(e=>e.type==='model3d')){
   const asset=single.deck.assets.find(a=>a.id===element.assetId);
   const request=staticModelRequest(element,asset,single.modelManifests?.[asset.id],'slide',modelPartOpacity(frame.partStates[element.id]));
   if(!single.assets[request.ref])single.assets[request.ref]=await io.modelPoster(request,deckPath(sel.deck)+'/'+deckAssets.get(asset.id));
  }
 }
 return snap;
}
// Each slide keeps its own deck payload: the decks differ in theme, palette and styles.
const DECK_TITLE='The Flux film';
const payloads=snaps=>snaps.map(s=>({...s.payload,deck:{...s.payload.deck,title:DECK_TITLE}}));
const runtimeAssets=JSON.parse(await fs.readFile(path.join(source,'.generated/slide-embed-assets.json'),'utf8'));
const {loadEmbedModelRuntime}=await load('src/lib/slide/embedAssets.ts');
const modelRuntime=await loadEmbedModelRuntime();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const poster=(snap,step)=>renderSlidePosterSvg(snap.payload,step).replace('</svg>',`<style>${runtimeAssets.fonts}</style></svg>`);
const styleRef=HOMEPAGE[0]??{deck:DECKS[1],slide:JSON.parse(await fs.readFile(path.join(project,manifest.slides.find(d=>d.id===DECKS[1]).path),'utf8')).slides[0].id};
const prepared=await prepareSlideDocument(`![](x.svg){.flux-slide deck="${styleRef.deck}" slide="${styleRef.slide}" width=100%}`,repo,{interactive:true,strict:true});

// One player page. `#slide-id` opens a single slide (documentation studies); otherwise a selector
// lists every slide (homepage). Website code selects slides and pauses the player offscreen;
// Flux owns rendering, animation and transforms.
const hostSource=`import {payloadModelHost} from ${JSON.stringify(path.join(source,'src/lib/slide/export/model3dPayloadHost.ts'))};
import {mountSlideEmbed} from ${JSON.stringify(path.join(source,'src/lib/slide/embedPlayer.ts'))};
const payloads=JSON.parse(document.getElementById('payload').textContent),host=document.getElementById('native-player'),selector=document.getElementById('slide-select'),single=document.documentElement.dataset.single==='true';
const states=new Map();let controller,selected=0,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function mount(index){controller?.destroy();selected=index;const payload=payloads[index],slide=payload.deck.slides[0],modelHost=payloadModelHost(payload),stills=!modelHost&&slide.elements.some(e=>e.type==='model3d');const state=states.get(slide.id)||{beatId:slide.beats[0].id,reduced};controller=mountSlideEmbed(host,payload,{model3d:modelHost,state:{...state,reduced:stills||state.reduced},onState:state=>{states.set(slide.id,state);if(!stills)reduced=state.reduced}});if(stills){const motion=host.querySelector('[aria-label="Toggle animation"]');motion.disabled=true;motion.title='This browser shows saved 3D views. Use the arrows to change view.';}if(selector){selector.value=String(index);document.getElementById('selected-slide-status').textContent='Slide '+(index+1)+' of '+payloads.length;}for(const c of document.querySelectorAll('[data-credit]'))c.hidden=c.dataset.credit!==slide.id;}
const ids=(document.documentElement.dataset.ids||'').split(','),fromHash=()=>{const h=location.hash.slice(1),i=ids.indexOf(h);return i>=0?i:Math.max(0,payloads.findIndex(p=>p.deck.slides[0].id===h));};
selector?.addEventListener('change',()=>mount(Number(selector.value)));mount(fromHash());document.documentElement.classList.add('enhanced');
addEventListener('hashchange',()=>mount(fromHash()));
window.fluxWebsiteDemo={pause:()=>controller.pauseOffscreen(),state:()=>controller.player.state(),selectedSlide:()=>payloads[selected].deck.slides[0].id,select:mount};
if(parent!==window){let previous=0;new ResizeObserver(()=>{const height=Math.ceil(document.body.getBoundingClientRect().height);if(height>0&&height!==previous){previous=height;parent.postMessage({type:single?'flux-docs-resize':'flux-demo-resize',height},location.origin)}}).observe(document.body);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.pauseOffscreen()});
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;if(event.data?.type==='flux-demo-pause')controller.pauseOffscreen();if(event.data?.type==='motion-preference'&&typeof event.data.reducedMotion==='boolean'){reduced=event.data.reducedMotion;for(const [key,state]of states)states.set(key,{...state,reduced});const button=host.querySelector('[aria-label="Toggle animation"]');if(button&&(button.getAttribute('aria-pressed')==='true')===reduced)button.click();}});
window.addEventListener('pagehide',event=>{if(event.persisted)controller.pauseOffscreen();else controller.destroy()});`;
const bundle=await build({stdin:{contents:hostSource,resolveDir:source,sourcefile:'flux-website-slides.js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'inline',metafile:true,logLevel:'silent'});
const STYLE=`<style>html,body{margin:0;background:#fffcf0;color:#22272e}body{padding:0 1px}.flux-slide-embed{margin:0!important;width:100%!important}.deck-selector{display:none;align-items:center;gap:12px;justify-content:space-between;padding:10px 14px;background:#f7f8f8;border-bottom:1px solid #e5e7e8;font:12px system-ui,sans-serif}.enhanced .deck-selector{display:flex}.deck-selector label{font-weight:600;white-space:nowrap}.deck-selector select{min-width:0;max-width:100%;min-height:44px;flex:1;font:inherit;border:1px solid #c9ced3;border-radius:5px;padding:8px 30px 8px 10px;background:#fff;color:#22272e}.source-credit{margin:0;padding:8px 12px;border-top:1px solid #e5e7e8;font:10px/1.5 system-ui,sans-serif;color:#646b72}.source-credit[hidden]{display:none}.flux-slide-status{display:none}.source-credit a{color:#266e9e}.slide-count{font-variant-numeric:tabular-nums;white-space:nowrap;color:#575e65}.flux-slide-bar{padding:5px 12px;gap:8px;min-height:44px;border-top:1px solid #e5e7e8}.flux-slide-bar button{min-width:44px;min-height:44px}.flux-slide-art:focus-visible,button:focus-visible,select:focus-visible{outline:2px solid #266e9e;outline-offset:-3px}.flux-slide-title{font-size:12px}.fallback{width:100%;height:auto;display:block}.enhanced .fallback{display:none}@media(max-width:550px){.flux-slide-title,.slide-count{display:none}.deck-selector{gap:8px;padding:8px}.deck-selector label{font-size:11px}}@media print{#native-player,.deck-selector{display:none!important}.fallback{display:block!important}}</style>`;
function page({title,selections,snaps,single,fallback,fallbackAlt}){
 const json=JSON.stringify(payloads(snaps)).replace(/</g,'\\u003c');
 const selector=single?'':`<div class="deck-selector"><label for="slide-select">Choose a slide</label><select id="slide-select">${selections.map((s,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} — ${escape(s.title||snaps[i].payload.deck.slides[0].name)}</option>`).join('')}</select><span id="selected-slide-status" class="slide-count" aria-live="polite"></span></div>`;
 const credits=selections.map((s,i)=>`<p class="source-credit" data-credit="${escape(snaps[i].payload.deck.slides[0].id)}"${i?' hidden':''}>${s.credit??''}${s.credit?' · ':''}<a href="/docs/visual-credits.html" target="_top">Visual credits</a> · Native Flux player.</p>`).join('');
 return `<!doctype html><html lang="en" data-single="${single}" data-ids="${selections.map(s=>s.id??'').join(',')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="robots" content="noindex">${prepared.style}${STYLE}</head><body>${selector}<img class="fallback" alt="${escape(fallbackAlt)}" src="${escape(fallback)}"><div id="native-player"></div>${credits}<script type="application/json" id="payload">${json}</script><script>${modelRuntime}</script><script>${bundle.outputFiles[0].text}</script></body></html>`;
}

if(review){
 const all=[];for(const id of DECKS){const deck=JSON.parse(await fs.readFile(path.join(project,manifest.slides.find(d=>d.id===id).path),'utf8'));for(const s of deck.slides)if(s.elements.length&&s.beats.length>1)all.push({deck:id,slide:s.id,title:`${deck.title} · ${s.name}`});}
 const snaps=[];for(const sel of all){process.stdout.write('.');snaps.push(await snapshot(sel));}
 const out=path.join(site,'.cache/slides-review/index.html');await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.writeFile(out,page({title:'Film slides review',selections:all,snaps,single:false,fallback:'',fallbackAlt:''}));
 console.log(`\nReview export: ${all.length} slides → ${path.relative(site,out)}`);repo.dispose();process.exit(0);
}

const outputs={};
const write=async(rel,data)=>{const p=path.join(site,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,data);outputs[rel]={bytes:Buffer.byteLength(data),sha256:hash(data)};};
await fs.rm(path.join(site,'site/demos/slides'),{recursive:true,force:true});await fs.rm(path.join(site,'site/demos/studies'),{recursive:true,force:true});
const homeSnaps=[];for(const sel of HOMEPAGE)homeSnaps.push(await snapshot(sel));
const homePoster=poster(homeSnaps[0],HOMEPAGE[0].posterStep??homeSnaps[0].payload.deck.slides[0].beats.length-1);
await write('site/demos/slides/index.html',page({title:'Flux slides from the launch film',selections:HOMEPAGE,snaps:homeSnaps,single:false,fallback:'/assets/media/slide-poster.svg',fallbackAlt:HOMEPAGE[0].alt}));
await write('site/assets/media/slide-poster.svg',homePoster);
// Each documentation example is its own small page, loaded only when a reader asks for it.
for(const sel of STUDIES){const snap=await snapshot(sel),still=poster(snap,sel.posterStep??snap.payload.deck.slides[0].beats.length-1);await write(`site/demos/studies/${sel.id}.svg`,still);
 await write(`site/demos/studies/${sel.id}.html`,page({title:`${sel.title} — a Flux slide`,selections:[sel],snaps:[snap],single:true,fallback:`${sel.id}.svg`,fallbackAlt:sel.alt}));}
// An isolated project for the Slides workspace screenshot (capture-media.mjs --only slides): one deck
// holding the light film slides used on the site, in the film's order. Never published.
{
 const film=DECKS[0],entry=manifest.slides.find(d=>d.id===film),deck=JSON.parse(await fs.readFile(path.join(project,entry.path),'utf8'));
 // 3D thumbnails need the newer engine, so the 3D slide stays out of this release screenshot.
 const order=[...HOMEPAGE,...STUDIES].filter(s=>s.deck===film).map(s=>s.slide).filter((id,i,a)=>a.indexOf(id)===i&&!deck.slides.find(x=>x.id===id).elements.some(e=>e.type==='model3d'));
 const capture=path.join(site,'.cache/film-capture-project');await fs.rm(capture,{recursive:true,force:true});
 await fs.cp(path.join(project,path.dirname(entry.path)),path.join(capture,'slides/film'),{recursive:true});
 await fs.cp(path.join(project,'fig/assets'),path.join(capture,'fig/assets'),{recursive:true});
 const used=new Set((await fs.readdir(path.join(capture,'fig/assets'))).map(n=>n.split('.')[0]));
 await fs.writeFile(path.join(capture,'fig/index.json'),JSON.stringify({...figIndex,canvases:[{id:'canvas-1',name:'Figures'}],figures:[],families:[],assets:figIndex.assets.filter(a=>used.has(a.id))},null,2));
 await fs.writeFile(path.join(capture,'slides/film/deck.json'),JSON.stringify({...deck,id:'film',title:DECK_TITLE,slides:order.map(id=>{const s=deck.slides.find(x=>x.id===id),t=[...HOMEPAGE,...STUDIES].find(x=>x.slide===id).title;return {...s,name:t};})},null,2));
 await fs.writeFile(path.join(capture,'project.json'),JSON.stringify({...manifest,title:DECK_TITLE,figures:[],slides:[{id:'film',title:DECK_TITLE,path:'slides/film/deck.json',order:1}],documentOrder:[]},null,2));
 // Plot sources resolve, so the workspace shows no missing-source notice.
 const sources=new Set(order.flatMap(id=>[...JSON.stringify(deck.slides.find(x=>x.id===id)).matchAll(/"(?:svgPath|manifestPath)":"(plots\/[^"]+)"/g)].map(m=>m[1])));
 for(const rel of sources){const from=path.join(authored,rel);if(await exists(from)){await fs.mkdir(path.dirname(path.join(capture,rel)),{recursive:true});await fs.copyFile(from,path.join(capture,rel));}}
}
const packages=[...new Set(['three',...Object.keys(bundle.metafile.inputs).map(p=>p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean)])];
for(const pkg of packages){const base=path.join(source,'node_modules',pkg),found=(await fs.readdir(base)).find(n=>/^licen[cs]e(?:\.md|\.txt)?$/i.test(n));if(!found)throw Error(`Bundled dependency ${pkg} needs a license notice`);await write(`site/assets/licenses/${pkg.replaceAll('/','-')}-LICENSE.txt`,await fs.readFile(path.join(base,found)));}
await fs.writeFile(path.join(site,'media/slides.json'),JSON.stringify({source:{repository:pin.repository,revision:player.revision,patches:player.patches.map(({path,sha256})=>({path,sha256}))},description:'Slides from the Flux launch film, exported unchanged from the owner-authorized decks of the master demonstration project with the native Flux player. See visual credits for data sources.',project:{id:manifest.id,decks:DECKS,inputHashes:inputs},homepage:HOMEPAGE.map(s=>s.slide),studies:STUDIES.map(s=>({id:s.id,slide:s.slide})),bundledPackages:packages,outputs},null,2)+'\n');
repo.dispose();console.log(`Exported ${HOMEPAGE.length} homepage slides and ${STUDIES.length} documentation studies from the film decks.`);
