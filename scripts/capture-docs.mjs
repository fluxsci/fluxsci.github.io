/** Focused screenshots of the unmodified, pinned Flux GUI in its isolated fixture. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const root=process.cwd(),source=path.resolve(process.argv[process.argv.indexOf('--flux-source')+1]||'');
if(!process.argv.includes('--flux-source'))throw Error('Pass --flux-source /path/to/pinned/flux');
const pin=JSON.parse(await fs.readFile('flux-source.json','utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Unpinned source');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src'],{encoding:'utf8'}).trim())throw Error('Dirty product source');
const project=path.join(root,'.cache/visual-project'),url=process.env.FLUX_URL||'http://127.0.0.1:1420/';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const outputs={};await fs.mkdir('site/assets/media/docs',{recursive:true});
const settle=async()=>{await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(450);};
const capture=async(name,locator)=>{await page.mouse.move(1395,995);await settle();const rel=`site/assets/media/docs/${name}.png`;if(locator)await page.locator(locator).screenshot({path:rel});else await page.screenshot({path:rel});const bytes=await fs.readFile(rel);outputs[rel]={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};console.log('Captured '+name);};
try{
 await page.goto(url+'?fixture=demo');await page.waitForFunction(()=>!!window.__flux?.get(window.__flux.shell.projectModel));
 // Mirror only accepted project assets. This fixture has an in-memory FileBridge;
 // it cannot touch the user's context, library, project or test slides.
 const files=[];async function walk(dir,prefix){for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=prefix+'/'+e.name;if(e.isDirectory())await walk(path.join(dir,e.name),rel);else files.push(rel);}}
 await walk(path.join(project,'fig'),'fig');
 for(const rel of files){if(rel.startsWith('fig/renders/')||rel.includes('/.'))continue;const bytes=await fs.readFile(path.join(project,rel)),b64=bytes.toString('base64');await page.evaluate(async({rel,b64})=>window.fig.writeFile('/demo/docs-visuals/'+rel,Uint8Array.from(atob(b64),c=>c.charCodeAt(0))),{rel,b64});}
 const manifest=JSON.parse(await fs.readFile(path.join(project,'project.json'),'utf8'));manifest.title='Flux visual guide';manifest.slides=[{id:'docs-techniques',title:'Animation studies',path:'slides/docs-techniques/deck.json',order:1}];manifest.documentOrder=[manifest.manuscript.path];
 const deck=await fs.readFile('.cache/docs-techniques/deck.json','utf8');
 await page.evaluate(async({manifest,deck})=>{await window.fig.writeText('/demo/docs-visuals/'+manifest.manuscript.path,'# Flux visual guide\n\nAn isolated project for documentation screenshots.');await window.fig.writeText('/demo/docs-visuals/project.json',JSON.stringify(manifest));await window.fig.writeText('/demo/docs-visuals/slides/docs-techniques/deck.json',deck);await window.__flux.shell.openProjectAt('/demo/docs-visuals');},{manifest,deck});
 const mode=async name=>{await page.getByRole('button',{name,exact:true}).click();await settle();};
 await mode('Figure');await page.waitForFunction(()=>window.__flux.get(window.__flux.fig.project).figures.some(f=>f.id==='fig-1'));
 await page.evaluate(async()=>{const f=window.__flux,fig=f.get(f.fig.project).figures.find(v=>v.id==='fig-1'),plot=fig.elements.find(e=>e.id==='plot_muslftfswsx2_40');f.fig.project.update(p=>{plot.name='Stiffness and density';return p;});const {inspectorHidden}=await import('/src/lib/settings.ts');inspectorHidden.set(true);f.fig.activeFigureId.set(fig.id);f.fig.viewport.set({panX:70-fig.x*1.1,panY:150-fig.y*1.1,zoom:1.1});f.fig.selection.set(new Set([plot.id]));f.fig.partSelection.set(null);});
 await page.keyboard.press('Alt+r');await page.getByRole('dialog',{name:'X-ray',exact:true}).getByRole('button',{name:'Stiffness and density',exact:true}).waitFor();await capture('figure-xray','[role="dialog"][aria-label="X-ray"]');
 await page.keyboard.press('Escape');await page.keyboard.press('f');await page.getByRole('dialog',{name:'Properties',exact:true}).waitFor();await capture('figure-property-menu','[role="dialog"][aria-label="Properties"]');await page.keyboard.press('Escape');
 await page.evaluate(async()=>{const {inspectorHidden}=await import('/src/lib/settings.ts');inspectorHidden.set(false);});
 await mode('Slide');await page.waitForFunction(()=>window.__flux.get(window.__flux.slide.deckOverlay)?.id==='docs-techniques');
 await page.evaluate(async()=>{const f=window.__flux;f.fig.activeFigureId.set('easing');f.slide.activeBeat.set(1);[...document.querySelectorAll('.deckbar button')].find(e=>e.textContent.includes('Animate'))?.click();});await settle();
 await page.evaluate(()=>{const f=window.__flux,s=f.get(f.slide.deckOverlay).slides.find(s=>s.id==='easing');f.slide.selTrackIds.set([s.beats[1].tracks[4].id]);});
 await capture('slides-easing-workspace');await capture('slides-timeline','[aria-label="Animation timeline"]');
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile('media/docs-screenshots.json',JSON.stringify({source:pin,description:'Focused captures of the native Flux GUI in an isolated in-memory fixture. Master-project plot bytes are copied without edits; the teaching deck is original.',errors,outputs},null,2)+'\n');
}finally{await browser.close();}
