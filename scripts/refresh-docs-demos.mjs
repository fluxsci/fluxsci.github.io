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
for(const slide of deck.slides){const p={...payload,deck:{...deck,slides:[slide]}};const svg=renderSlidePosterSvg(p,1);const name=`${slide.id}.svg`;await fs.writeFile(path.join(out,name),svg);posters.push('site/demos/techniques/'+name);}
// Diagrams use the native timeline operations for their before/after geometry.
const {alignCandidates,alignTrackEdges,trackEdges}=await load('src/lib/slide/alignTracks.ts');
for(const edge of ['start','end'])for(const mode of ['move','resize']){
 const d=structuredClone(deck),s=d.slides[0],b=s.beats[1];
 b.tracks=b.tracks.map((t,i)=>({...t,start:(edge==='start'?[300,900,900]:[300,900,1300])[i],duration:(edge==='start'?[2400,700,1000]:[2400,1000,600])[i]}));
 const ids=b.tracks.slice(1).map(t=>t.id),before=b.tracks.map(t=>trackEdges(t));
 const target=alignCandidates(b.tracks,ids,edge)[0].ms;
 const result=alignTrackEdges(d,s.id,b.id,ids,edge,target,{mode});if(result.refused.length)throw Error(JSON.stringify(result));
 const after=b.tracks.map(t=>trackEdges(t)),x=t=>140+t*.18;
 const rows=(values,y)=>values.map((t,i)=>`<text x="29" y="${y+i*31+16}">${['Reference','Selected 1','Selected 2'][i]}</text><rect x="${x(t.start)}" y="${y+i*31}" width="${(t.end-t.start)*.18}" height="22" rx="4" fill="${['#737b80','#205ea6','#24837b'][i]}"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 344" role="img"><title>${mode==='resize'?'Resize':'Move'} to align ${edge}s</title><rect width="680" height="344" fill="#fffefa"/><style>text{font:13px Arial,sans-serif;fill:#62686b}.label{font-weight:bold;fill:#242a30}@media(max-width:450px){text{font-size:22px}.label{font-size:20px}}</style><text class="label" x="28" y="29">BEFORE</text><text x="${x(0)}" y="29">0 s</text><text x="${x(1000)}" y="29">1 s</text><text x="${x(2000)}" y="29">2 s</text>${[0,1000,2000].map(t=>`<path d="M${x(t)} 42V136 M${x(t)} 196V296" stroke="#e6e6de"/>`).join('')}${rows(before,48)}<path d="M28 153H650" stroke="#deded6"/><text class="label" x="28" y="180">AFTER</text><text x="140" y="180">Alt + ${mode==='resize'?'Shift + ':''}${edge==='start'?'A':'D'}</text><path d="M${x(target)} 195V299" stroke="#205ea6" stroke-dasharray="4 4"/>${rows(after,207)}<text x="28" y="328">${mode==='move'?'Durations stay the same.':'The opposite edge stays fixed.'}</text><text x="430" y="328">${edge==='start'?'Starts':'Ends'} meet at ${(target/1000).toFixed(1)} s</text></svg>`;
 const rel=`site/demos/techniques/timing-${edge}-${mode}.svg`;await fs.writeFile(path.join(root,rel),svg);posters.push(rel);
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
