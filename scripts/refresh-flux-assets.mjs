/** Export the owner's visual demo through the pinned Flux runtime. Source is read-only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const site=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--flux-source')||!arg('--project'))throw Error('Pass --flux-source /path/to/pinned/flux and --project /path/to/authored/project.');
const source=path.resolve(arg('--flux-source')),authored=path.resolve(arg('--project')),project=path.join(site,'.cache','visual-project');
const DECK_ID='website-showcase';
const pin=JSON.parse(await fs.readFile(path.join(site,'flux-source.json'),'utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Flux checkout does not match flux-source.json');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src','flux-core','scripts','brand','electron','package.json','package-lock.json'],{encoding:'utf8'}).trim())throw Error('Product source must be clean before export');
if(!process.env.FLUX_ASSET_CHILD){
 execFileSync(process.execPath,['scripts/gen-slide-embed-assets.mjs'],{cwd:source,stdio:'inherit'});
 execFileSync(process.execPath,['scripts/gen-model3d-viewer.mjs'],{cwd:source,stdio:'inherit'});
 execFileSync(process.execPath,['--import',path.join(source,'node_modules/tsx/dist/loader.mjs'),fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,FLUX_ASSET_CHILD:'1'}});process.exit(0);
}
const load=rel=>import(pathToFileURL(path.join(source,rel)).href);
const [{validateDeckFile,validateProjectManifest},{ensureDom,renderFigureSvg},{createSlideRepository},{prepareSlideDocument},{renderSlidePosterSvg},{build}]=await Promise.all([
 load('src/lib/project/validate.ts'),load('flux-core/render.ts'),load('src/lib/slide/embedRepository.ts'),load('src/lib/slide/embedDocument.ts'),load('src/lib/slide/embedRender.ts'),load('node_modules/esbuild/lib/main.js')]);
const exists=p=>fs.access(p).then(()=>true,()=>false);
const write=async(rel,value)=>{const out=path.join(project,rel);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,value);};
const atomicWrite=(p,t)=>fs.writeFile(p,t);
const validate=(label,errors)=>{if(errors.length)throw Error(`${label}: ${errors.join('; ')}`);};
const {prepareShowcase}=await import('../media/showcase.mjs');
const {inputs:plotInputHashes}=await prepareShowcase(source,authored,project);
const manifest=JSON.parse(await fs.readFile(path.join(project,'project.json'),'utf8'));validate('Project manifest',validateProjectManifest(manifest));
const figureIndex=JSON.parse(await fs.readFile(path.join(project,'fig/index.json'),'utf8'));
manifest.figures=figureIndex.figures;
const deckEntry=manifest.slides.find(d=>d.id===DECK_ID);if(!deckEntry)throw Error(`Project must contain the ${DECK_ID} deck.`);
const deck=JSON.parse(await fs.readFile(path.join(project,deckEntry.path),'utf8'));validate('Deck',validateDeckFile(deck));
await ensureDom();
const io={readText:p=>fs.readFile(p,'utf8'),readFile:p=>fs.readFile(p),exists,writeText:async(p,t)=>{await fs.mkdir(path.dirname(p),{recursive:true});await atomicWrite(p,t);},mkdir:async p=>{await fs.mkdir(p,{recursive:true});}};
for(const fig of manifest.figures??[]){const warnings=[];await renderFigureSvg(project,fig.id,{model3dPolicy:'project',warnings});const svg=await renderFigureSvg(project,fig.id,{model3dPolicy:'project',posterSurface:{kind:'raster',dpi:240},warnings});if(warnings.length)throw Error(warnings.join('\n'));await write(`fig/renders/${fig.id}.svg`,svg);}
const {resolveModelPosters}=await load('flux-core/model3dPosterCache.ts');
const {partStatesFromOpacity}=await load('src/lib/model3d/appearance.ts');
io.modelPoster=async(request,relative)=>{
 const figure={id:'poster',name:'Slide',canvasId:'slide',x:0,y:0,width:request.element.width,height:request.element.height,background:'transparent',elements:[request.element]};
 const rendered=await resolveModelPosters(project,[figure],[{...request.asset,path:relative}],{policy:'project',surface:'slide',assetPrefix:'',manifests:{[request.asset.id]:request.manifest},partStates:()=>partStatesFromOpacity(request.partOpacity)});
 if(rendered.warnings.length)throw Error(rendered.warnings.join('\n'));const url=rendered.urls[request.ref];if(!url)throw Error('Missing native 3D poster');return url;
};
const repo=createSlideRepository(project,io),snapshots=[];
for(const slide of deck.slides){const snap=await repo.materialize({deck:DECK_ID,slide:slide.id});if(snap.warnings.length)throw Error(snap.warnings.join('\n'));snapshots.push(snap);}
const first=snapshots[0],firstId=deck.slides[0].id;
const runtimeAssets=JSON.parse(await fs.readFile(path.join(source,'.generated/slide-embed-assets.json'),'utf8'));
const completedPoster=renderSlidePosterSvg(first.payload,Math.max(0,deck.slides[0].beats.length-1)).replace('</svg>',`<style>${runtimeAssets.fonts}</style></svg>`);
const prepared=await prepareSlideDocument(`![](slides/${DECK_ID}/renders/${firstId}-step-0.svg){#slide-neural-demo .flux-slide deck="${DECK_ID}" slide="${firstId}" width=100%}`,repo,{interactive:true,strict:true});
const payload={...first.payload,deck:{...first.payload.deck,slides:snapshots.flatMap(s=>s.payload.deck.slides)},assets:Object.assign({},...snapshots.map(s=>s.payload.assets)),plots:Object.assign({},...snapshots.map(s=>s.payload.plots)),assetSizes:Object.assign({},...snapshots.map(s=>s.payload.assetSizes??{}))};
for(const field of ['models','modelManifests','modelPosters','glyphs','videos'])payload[field]=Object.assign({},...snapshots.map(s=>s.payload[field]??{}));
payload.deck.assets=[...new Map(snapshots.flatMap(s=>s.payload.deck.assets).map(a=>[a.id,a])).values()];
const {loadEmbedModelRuntime}=await load('src/lib/slide/embedAssets.ts');
const modelRuntime=await loadEmbedModelRuntime();
const hostSource=`import {payloadModelHost} from ${JSON.stringify(path.join(source,'src/lib/slide/export/model3dPayloadHost.ts'))};
import {mountSlideEmbed} from ${JSON.stringify(path.join(source,'src/lib/slide/embedPlayer.ts'))};
const payload=JSON.parse(document.getElementById('payload').textContent),host=document.getElementById('native-player'),selector=document.getElementById('slide-select');
const states=new Map();let controller,selected=0,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function mount(index){controller?.destroy();selected=index;const slide=payload.deck.slides[index];controller=mountSlideEmbed(host,{...payload,deck:{...payload.deck,slides:[slide]}},{model3d:payloadModelHost(payload),state:states.get(slide.id)||{beatId:slide.beats[0].id,reduced},onState:state=>{states.set(slide.id,state);reduced=state.reduced}});selector.value=String(index);document.getElementById('selected-slide-status').textContent='Slide '+(index+1)+' of '+payload.deck.slides.length;}
selector.addEventListener('change',()=>mount(Number(selector.value)));mount(0);document.documentElement.classList.add('enhanced');
window.fluxWebsiteDemo={pause:()=>controller.pauseOffscreen(),state:()=>controller.player.state(),selectedSlide:()=>payload.deck.slides[selected].id};
if(parent!==window){let previous=0;new ResizeObserver(()=>{const height=Math.ceil(document.body.getBoundingClientRect().height);if(height>0&&height!==previous){previous=height;parent.postMessage({type:'flux-demo-resize',height},location.origin)}}).observe(document.body);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.pauseOffscreen()});
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;if(event.data?.type==='flux-demo-pause')controller.pauseOffscreen();if(event.data?.type==='motion-preference'&&typeof event.data.reducedMotion==='boolean'){reduced=event.data.reducedMotion;for(const [key,state]of states)states.set(key,{...state,reduced});const button=host.querySelector('[aria-label="Toggle animation"]');if(button&&(button.getAttribute('aria-pressed')==='true')===reduced)button.click();}});
window.addEventListener('pagehide',event=>{if(event.persisted)controller.pauseOffscreen();else controller.destroy()});`;
const bundle=await build({stdin:{contents:hostSource,resolveDir:source,sourcefile:'flux-website-demo.js'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'inline',metafile:true,logLevel:'silent'});
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=JSON.stringify(payload).replace(/</g,'\\u003c');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Data in motion — interactive Flux slides</title><meta name="robots" content="noindex">${prepared.style}<style>html,body{margin:0;background:#fff;color:#22272e}body{padding:0 1px}.flux-slide-embed{margin:0!important;width:100%!important}.deck-selector{display:none;align-items:center;gap:12px;justify-content:space-between;padding:10px 14px;background:#f7f8f8;border-bottom:1px solid #e5e7e8;font:12px system-ui,sans-serif}.enhanced .deck-selector{display:flex}.deck-selector label{font-weight:600;white-space:nowrap}.deck-selector select{min-width:0;max-width:100%;min-height:44px;flex:1;font:inherit;border:1px solid #c9ced3;border-radius:5px;padding:8px 30px 8px 10px;background:#fff;color:#22272e}.source-credit{margin:0;padding:8px 12px;border-top:1px solid #e5e7e8;font:10px/1.5 system-ui,sans-serif;color:#646b72}.source-credit a{color:#266e9e}.slide-count{font-variant-numeric:tabular-nums;white-space:nowrap;color:#575e65}.flux-slide-bar{padding:5px 12px;gap:8px;min-height:44px;border-top:1px solid #e5e7e8}.flux-slide-bar button{min-width:44px;min-height:44px}.flux-slide-art:focus-visible,button:focus-visible,select:focus-visible{outline:2px solid #266e9e;outline-offset:-3px}.flux-slide-title{font-size:12px}.fallback{width:100%;height:auto;display:block}.enhanced .fallback{display:none}@media(max-width:550px){.flux-slide-title,.slide-count{display:none}.deck-selector{gap:8px;padding:8px}.deck-selector label{font-size:11px}}@media print{#native-player,.deck-selector{display:none!important}.fallback{display:block!important}}</style></head><body><div class="deck-selector"><label for="slide-select">Explore the deck</label><select id="slide-select">${deck.slides.map((s,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} — ${escape(s.name||s.id)}</option>`).join('')}</select><span id="selected-slide-status" class="slide-count" aria-live="polite"></span></div><img class="fallback" alt="Responses of 143 recorded visual neurons to eight directions of motion." src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(completedPoster)}"><div id="native-player"></div><p class="source-credit">Data: <a href="https://brain-map.org/our-research/circuits-behavior/visual-coding" target="_top">Allen Institute for Brain Science</a> · <a href="/docs/visual-credits.html" target="_top">Data and visual credits</a> · Native Flux player.</p><script type="application/json" id="payload">${json}</script><script>${modelRuntime}</script><script>${bundle.outputFiles[0].text}</script></body></html>`;
const demoRel='site/demos/data-morph/index.html';await fs.mkdir(path.dirname(path.join(site,demoRel)),{recursive:true});await fs.writeFile(path.join(site,demoRel),html);
await fs.writeFile(path.join(site,'site/assets/media/slide-poster.svg'),completedPoster);
for(const [src,dst]of[['brand/flux-mark-phyllotaxis.svg','site/assets/brand/flux-mark.svg'],['src/styles/fonts/Gelasio.woff2','site/assets/fonts/Gelasio.woff2'],['src/styles/fonts/Gelasio-italic.woff2','site/assets/fonts/Gelasio-italic.woff2']])await fs.copyFile(path.join(source,src),path.join(site,dst));
const licenseDir=path.join(site,'site/assets/licenses');await fs.mkdir(licenseDir,{recursive:true});await fs.copyFile(path.join(source,'LICENSE'),path.join(licenseDir,'Flux-MIT.txt'));
const packages=[...new Set(['three',...Object.keys(bundle.metafile.inputs).map(p=>p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean)])],licenses=['site/assets/licenses/Flux-MIT.txt'];
for(const pkg of packages){const base=path.join(source,'node_modules',pkg),names=await fs.readdir(base),found=names.find(n=>/^licen[cs]e(?:\.md|\.txt)?$/i.test(n));if(!found)throw Error(`Bundled dependency ${pkg} needs a license notice`);const rel=`site/assets/licenses/${pkg.replaceAll('/','-')}-LICENSE.txt`;await fs.copyFile(path.join(base,found),path.join(site,rel));licenses.push(rel);}
const files=[demoRel,'site/assets/media/slide-poster.svg','site/assets/brand/flux-mark.svg','site/assets/fonts/Gelasio.woff2','site/assets/fonts/Gelasio-italic.woff2',...licenses];
const outputs=Object.fromEntries(await Promise.all(files.map(async rel=>{const data=await fs.readFile(path.join(site,rel));return[rel,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}];})));
const projectInputs=['project.json',deckEntry.path,'fig/index.json',...(await fs.readdir(path.join(project,'fig/canvases'))).filter(f=>f.endsWith('.json')).map(f=>`fig/canvases/${f}`)];
const inputHashes=Object.fromEntries(await Promise.all(projectInputs.map(async rel=>[rel,createHash('sha256').update(await fs.readFile(path.join(project,rel))).digest('hex')])));
await fs.writeFile(path.join(site,'media/native-assets.json'),JSON.stringify({source:pin,description:'Two unchanged authored figures from the confirmed master project, with original website slides from its accepted plots. Public experimental data, computed examples and reference structures; see visual credits. No owner test slides or personal library are included.',project:{id:manifest.id,title:manifest.title,inputHashes,plotInputHashes},bundledPackages:packages,outputs},null,2)+'\n');
repo.dispose();console.log(`Exported ${deck.slides.length} native slides (${Math.round(Buffer.byteLength(html)/1024)} KiB) and ${manifest.figures.length} project figure renders; authored project files preserved.`);
