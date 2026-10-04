/** Export small, original teaching decks using the pinned native Flux runtime. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createTechniques} from '../media/techniques.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const at=process.argv.indexOf('--flux-source');
if(at<0)throw Error('Pass --flux-source /path/to/pinned/flux');
const source=path.resolve(process.argv[at+1]),pin=JSON.parse(await fs.readFile(path.join(root,'flux-source.json'),'utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Unpinned Flux source');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src','flux-core'],{encoding:'utf8'}).trim())throw Error('Flux source must be clean');
if(!process.env.FLUX_DOCS_CHILD){execFileSync(process.execPath,['--import',path.join(source,'node_modules/tsx/dist/loader.mjs'),fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,FLUX_DOCS_CHILD:'1'}});process.exit(0);}
const load=p=>import(pathToFileURL(path.join(source,p)).href);
const [ops,{ensureDom},{validateDeckFile},{renderSlidePosterSvg},{SLIDE_EMBED_CSS},{build}]=await Promise.all([load('src/lib/slide/ops.ts'),load('flux-core/render.ts'),load('src/lib/project/validate.ts'),load('src/lib/slide/embedRender.ts'),load('src/lib/slide/embedPlayer.ts'),load('node_modules/esbuild/lib/main.js')]);
await ensureDom();const deck=createTechniques(ops),errors=validateDeckFile(deck);if(errors.length)throw Error(errors.join('\n'));
const payload={deck,assets:{},plots:{},assetSizes:{}};
const out=path.join(root,'site/demos/techniques');await fs.mkdir(out,{recursive:true});
const posters=[];
const timingOnly=process.argv.includes('--timing-only');
if(!timingOnly)for(const slide of deck.slides){const p={...payload,deck:{...deck,slides:[slide]}};const svg=renderSlidePosterSvg(p,1);const name=`${slide.id}.svg`;await fs.writeFile(path.join(out,name),svg);posters.push('site/demos/techniques/'+name);}
// Diagrams use the native timeline operations for their before/after geometry.
const {alignCandidates,alignTrackEdges,trackEdges}=await load('src/lib/slide/alignTracks.ts');
const {presetDef}=await load('src/lib/slide/presetCatalog.ts');
const {resolveCurve}=await load('src/lib/slide/curves.ts');
for(const edge of ['start','end'])for(const mode of ['move','resize']){
 const d=structuredClone(deck),s=d.slides[0],b=s.beats[1];
 b.tracks=b.tracks.map((t,i)=>({...t,start:(edge==='start'?[300,900,900]:[300,900,1300])[i],duration:(edge==='start'?[2400,700,1000]:[2400,1000,600])[i]}));
 const ids=b.tracks.slice(1).map(t=>t.id),before=b.tracks.map(t=>trackEdges(t));
 const target=alignCandidates(b.tracks,ids,edge)[0].ms;
 const result=alignTrackEdges(d,s.id,b.id,ids,edge,target,{mode});if(result.refused.length)throw Error(JSON.stringify(result));
 const after=b.tracks.map(t=>trackEdges(t)),x=t=>164+t*.174;
 // Schematic, not a screenshot: match BeatRail's dark lanes, preset colours,
 // square bars, duration text and selection rails. Flux still supplies the
 // alignment geometry and easing curves.
 const grid=(values,top,aligned=false)=>{
  const lanes=top+25,bottom=lanes+102;
  const rows=values.map((t,i)=>{
   const y=lanes+i*34,bx=x(t.start),by=y+7,w=(t.end-t.start)*.174;
   const preset=presetDef(b.tracks[i].preset),curve=resolveCurve(b.tracks[i]);
   const spark=Array.from({length:24},(_,j)=>{const u=j/23;return `${j?'L':'M'}${(bx+u*w).toFixed(2)},${(by+20*(1-curve.fn(u))).toFixed(2)}`;}).join(' ');
   return `<g>${i?`<rect x="164" y="${y}" width="496" height="34" fill="#4385be" fill-opacity=".16"/>`:''}<rect x="20" y="${y}" width="144" height="34" fill="${i?'#222a31':'#1c1b1a'}"/>${i?`<path d="M21 ${y}v34" stroke="#4385be" stroke-width="2"/>`:''}<text class="track-name" x="30" y="${y+15}">${['Reference','Selected 1','Selected 2'][i]}</text><text class="effect" x="30" y="${y+28}">${preset.label}</text><path d="M20 ${y+34}H660" stroke="#2a2827"/>${i?`<rect x="${bx-1}" y="${by-1}" width="${w+2}" height="22" fill="none" stroke="#fffcf0"/>`:''}<rect x="${bx}" y="${by}" width="${w}" height="20" fill="#100f0f"/><rect x="${bx}" y="${by}" width="${w}" height="20" fill="${preset.colour}" fill-opacity=".22" stroke="${preset.colour}"/><path d="${spark}" fill="none" stroke="${preset.colour}" stroke-opacity=".55"/><text class="duration" x="${bx+5}" y="${by+14}">${((t.end-t.start)/1000).toFixed(2)}s</text></g>`;
  }).join('');
  const ticks=Array.from({length:29},(_,i)=>{const t=i*100,major=i%5===0;return `<path d="M${x(t)} ${major?top+5:lanes}V${bottom}" stroke="${major?'#343331':'#242322'}"/>${major?`<text class="ruler ${i%10?'half':''}" x="${x(t)+5}" y="${top+16}">${t/1000}s</text>`:''}`;}).join('');
  return `<rect x="20" y="${top}" width="640" height="127" fill="#100f0f" stroke="#403e3c"/><rect x="20" y="${top}" width="640" height="25" fill="#1c1b1a"/><text class="column" x="30" y="${top+16}"><tspan class="wide-label">OBJECT / EFFECT</tspan><tspan class="compact-label">TRACK</tspan></text>${ticks}${rows}<path d="M164 ${top}V${bottom}" stroke="#403e3c"/>${aligned?`<path d="M${x(target)} ${top}V${bottom}" stroke="#66a0c8" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M${x(target)-4} ${top}h8l-4 6z" fill="#66a0c8"/>`:''}`;
 };
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 392" role="img"><title>${mode==='resize'?'Resize':'Move'} to align ${edge}s on the Animator timeline</title><desc>Schematic timing lanes before and after alignment. The two selected lanes have blue selection rails and outlined timing bars.</desc><rect width="680" height="392" fill="#100f0f"/><style>text{font:12px Arial,sans-serif;fill:#cecdc3}.label{font-weight:bold;fill:#fffcf0}.hint,.ruler,.column,.duration{font-family:ui-monospace,Menlo,Consolas,monospace}.hint,.ruler,.column,.effect{fill:#9f9d96}.hint,.column{font-size:10px;letter-spacing:.04em}.effect{font-size:10px}.compact-label{display:none}.duration{font-size:11px}.track-name{font-size:13px}@media(max-width:450px){text,.ruler,.track-name{font-size:20px}.label{font-size:20px}.hint{font-size:15px}.column{font-size:15px}.duration{font-size:18px}.effect,.half,.wide-label{display:none}.compact-label{display:inline}.track-name{transform:translateY(6px)}}</style><text class="label" x="20" y="25">BEFORE</text><text class="hint" x="452" y="25">ANIMATOR TIMELINE</text>${grid(before,39)}<text class="label" x="20" y="201">AFTER</text><text x="164" y="201">Alt + ${mode==='resize'?'Shift + ':''}${edge==='start'?'A':'D'}</text>${grid(after,215,true)}<text x="20" y="377">${mode==='move'?'Durations stay the same.':'The opposite edge stays fixed.'}</text><text x="413" y="377">${edge==='start'?'Starts':'Ends'} meet at ${(target/1000).toFixed(1)} s</text></svg>`;
 const rel=`site/demos/techniques/timing-${edge}-${mode}.svg`;await fs.writeFile(path.join(root,rel),svg);posters.push(rel);
}
if(timingOnly){
 const file=path.join(root,'media/docs-demos.json'),manifest=JSON.parse(await fs.readFile(file,'utf8'));
 if(JSON.stringify(manifest.source)!==JSON.stringify(pin))throw Error('Refresh the full documentation export for a changed Flux pin');
 for(const rel of posters){const bytes=await fs.readFile(path.join(root,rel));manifest.outputs[rel]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
 await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');console.log('Refreshed four Animator timeline diagrams.');process.exit(0);
}
const host=`import {mountSlideEmbed} from ${JSON.stringify(path.join(source,'src/lib/slide/embedPlayer.ts'))};
const payload=JSON.parse(document.getElementById('payload').textContent),poster=document.getElementById('poster');let controller;
function mount(){const id=location.hash.slice(1),slide=payload.deck.slides.find(s=>s.id===id)||payload.deck.slides[0];controller?.destroy();poster.src=slide.id+'.svg';poster.alt=slide.name;
controller=mountSlideEmbed(document.getElementById('player'),{...payload,deck:{...payload.deck,slides:[slide]}});poster.hidden=true;
window.fluxDocsDemo={id:slide.id,state:()=>controller.player.state()};}
mount();window.addEventListener('hashchange',mount);
let last=0;new ResizeObserver(()=>{const height=Math.ceil(document.body.getBoundingClientRect().height);if(height!==last){last=height;parent.postMessage({type:'flux-docs-resize',height},location.origin)}}).observe(document.body);
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='flux-demo-pause')controller.pauseOffscreen()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.pauseOffscreen()});window.addEventListener('pagehide',()=>controller.destroy());`;
const built=await build({stdin:{contents:host,resolveDir:source},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'inline',metafile:true});
// The existing showcase ships these native-runtime notices. Fail if a refresh adds
// a dependency whose license has not been reviewed and checked into the site.
const packages=[...new Set(Object.keys(built.metafile.inputs).map(p=>p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean))];
for(const pkg of packages){const base=path.join(source,'node_modules',pkg),names=await fs.readdir(base),name=names.find(n=>/^licen[cs]e(?:\.md|\.txt)?$/i.test(n));if(!name)throw Error(`Missing license for ${pkg}`);const expected=await fs.readFile(path.join(base,name)),published=await fs.readFile(path.join(root,'site/assets/licenses',pkg.replaceAll('/','-')+'-LICENSE.txt'));if(!expected.equals(published))throw Error(`Review the license notice for ${pkg}`);}
await fs.writeFile(path.join(out,'player.js'),built.outputFiles[0].text);
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Flux animation studies</title><style>${SLIDE_EMBED_CSS}html,body{margin:0;background:#fffefa;color:#242a30}body{padding:0 1px}#poster{width:100%;height:auto;display:block}#poster[hidden]{display:none}.flux-slide-art:focus-visible,button:focus-visible{outline:2px solid #205ea6;outline-offset:-3px}.flux-slide-bar{padding:7px 12px;border-top:1px solid #deded6;min-height:44px;gap:8px}.flux-slide-bar button{min-height:40px;min-width:40px}.flux-slide-title{font-size:11px}.flux-slide-status{padding:0 12px;font-size:11px}.flux-slide-embed{margin:0}@media(max-width:500px){.flux-slide-title{display:none}}@media print{#poster[hidden]{display:block}#player{display:none}}</style></head><body><img id="poster" src="appear.svg" alt="Three native Flux entrance effects"><div id="player"></div><script type="application/json" id="payload">${JSON.stringify(payload).replace(/</g,'\\u003c')}</script><script src="player.js"></script></body></html>`);
await fs.mkdir(path.join(root,'.cache/docs-techniques'),{recursive:true});await fs.writeFile(path.join(root,'.cache/docs-techniques/deck.json'),JSON.stringify(deck,null,2));
const outputs={};for(const rel of [...posters,'site/demos/techniques/player.js','site/demos/techniques/index.html']){const bytes=await fs.readFile(path.join(root,rel));outputs[rel]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
await fs.writeFile(path.join(root,'media/docs-demos.json'),JSON.stringify({source:pin,description:'Original geometric teaching slides, exported with the native Flux player. No research data or owner slides.',scenes:deck.slides.map(s=>({id:s.id,title:s.name,steps:s.beats.length-1})),outputs},null,2)+'\n');
console.log(`Exported ${deck.slides.length} native documentation studies.`);
