/** Capture the unmodified Flux GUI from the isolated website composition. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { TITLE, references, DECK_ID, FIGURE_ID, MATERIALS_ID, captions, bib } from '../media/showcase.mjs';
const PROJECT_ROOT=path.resolve('.cache/visual-project');
async function projectFiles(dir=PROJECT_ROOT,prefix=''){const out=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const rel=path.posix.join(prefix,entry.name);if(entry.isDirectory())out.push(...await projectFiles(path.join(dir,entry.name),rel));else out.push(rel);}return out;}

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceIndex=process.argv.indexOf('--flux-source');
if(sourceIndex<0)throw Error('Pass --flux-source /absolute/path/to/pinned/flux; run its dev server first.');
const source=path.resolve(process.argv[sourceIndex+1]);
const pin=JSON.parse(await fs.readFile(path.join(root,'flux-source.json'),'utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Unpinned source');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src','flux-core','scripts','brand','electron','package.json','package-lock.json'],{encoding:'utf8'}).trim())throw Error('Product source must be clean before capture');
const {default:puppeteer}=await import(pathToFileURL(path.join(source,'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')));
const {default:MarkdownIt}=await import(pathToFileURL(path.join(source,'node_modules/markdown-it/dist/index.cjs.js')));
const chrome=process.env.FLUX_CHROME||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const browser=await puppeteer.launch({executablePath:chrome,headless:true,defaultViewport:{width:1500,height:950,deviceScaleFactor:2},args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const stable=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settle=async()=>{await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,700));await stable();};
const outputs={};
async function record(name,width,height){const rel=`site/assets/media/${name}.webp`,bytes=await fs.readFile(path.join(root,rel));outputs[rel]={width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
const capture=async name=>{await page.mouse.move(1490,940);await settle();await page.screenshot({path:path.join(root,`media/masters/${name}.png`)});await page.screenshot({path:path.join(root,`site/assets/media/${name}.webp`),type:'webp',quality:92});await record(name,1500,950);console.log(`Captured ${name}`);};
const clickMode=async mode=>{await page.evaluate(mode=>{const button=[...document.querySelectorAll('button[aria-label]')].find(e=>e.getAttribute('aria-label')===mode);if(!button)throw Error(`No mode ${mode}`);button.click();},mode);await stable();};
const htmlEscape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
try {
 await fs.mkdir(path.join(root,'media/masters'),{recursive:true});
 await fs.mkdir(path.join(PROJECT_ROOT,'paper'),{recursive:true});
 await fs.mkdir(path.join(PROJECT_ROOT,'references'),{recursive:true});
 await fs.copyFile(path.join(root,'media/demo-manuscript.qmd'),path.join(PROJECT_ROOT,'paper/manuscript.qmd'));
 await fs.writeFile(path.join(PROJECT_ROOT,'references/library.bib'),bib);
 const manuscript=await fs.readFile(path.join(PROJECT_ROOT,'paper/manuscript.qmd'),'utf8');
 let markdown=manuscript.replace(/^---\n[\s\S]*?\n---\n/,'').replaceAll('@fermisurfer','Kawamura (2019)').replaceAll('@allen-observatory','de Vries et al. (2020)');
 markdown=markdown.replace(/!\[\]\(([^)]+)\)\{[^}]*\.flux-slide[^}]*\}/g,'*The interactive explanation is available in the editable Flux project.*');
 for(const match of [...markdown.matchAll(/!\[\]\(([^)]+)\)\{[^}]*\}/g)]){
   const filename=path.resolve(PROJECT_ROOT,'paper',match[1]);
   if(!filename.startsWith(PROJECT_ROOT+path.sep))throw Error('Figure reference escapes project');
   const svg=await fs.readFile(filename,'utf8');
   const viewBox=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
   if(!viewBox)throw Error('Native figure must have viewBox');
   const raster=await browser.newPage();await raster.setViewport({width:Math.ceil(Number(viewBox[1])),height:Math.ceil(Number(viewBox[2])),deviceScaleFactor:2});
   await raster.setContent(`<html><body style="margin:0;background:white"><img style="width:100%;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" /></body></html>`);
   await raster.evaluate(()=>document.images[0].decode());const png=await raster.screenshot({type:'png'});await raster.close();
   markdown=markdown.replace(match[0],`<figure><img src="data:image/png;base64,${Buffer.from(png).toString('base64')}" /><figcaption>${htmlEscape(captions[path.basename(filename,'.svg')])}</figcaption></figure>`);
 }
 const pdfPage=await browser.newPage();
 await pdfPage.setContent(`<!doctype html><html lang="en"><head><title>${htmlEscape(TITLE)}</title><style>@page{size:A4;margin:17mm 18mm}body{font:12px/1.58 Georgia,serif;color:#20272f}h1{font-size:30px;line-height:1.12;font-weight:normal;margin:14px 0 12px;letter-spacing:-.5px}h2{font-size:17px;line-height:1.25;font-weight:normal;margin:23px 0 10px}p{margin:10px 0}figure{margin:18px 0;break-inside:avoid}img{display:block;width:100%}figcaption{font:9px/1.45 Arial,sans-serif;color:#5d6874;margin-top:8px}.eyebrow{font:9px Arial,sans-serif;letter-spacing:1.4px;border-bottom:1px solid #adb7be;padding-bottom:10px}.byline{font-size:10px;color:#5d6874;margin-bottom:18px}</style></head><body><div class="eyebrow">FLUX / AN ORIGINAL DEMONSTRATION PROJECT</div><h1>${htmlEscape(TITLE)}</h1><p class="byline">Flux demonstration · Data, models and calculations · See visual credits</p>${new MarkdownIt({html:true}).render(markdown)}</body></html>`);
 await pdfPage.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
 await fs.mkdir(path.join(PROJECT_ROOT,'exports'),{recursive:true});
 const pdf=await pdfPage.pdf({format:'A4',printBackground:true,path:path.join(PROJECT_ROOT,'exports/manuscript.pdf')});
 await pdfPage.close();

 const bibliography=await fs.readFile(path.join(PROJECT_ROOT,'references/library.bib'),'utf8');
 await page.goto((process.env.FLUX_URL||'http://127.0.0.1:1420/')+'?fixture=demo',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>!!window.__flux?.get(window.__flux.shell.projectModel));
 for(const rel of await projectFiles()){const b64=(await fs.readFile(path.join(PROJECT_ROOT,rel))).toString('base64');await page.evaluate(async({rel,b64})=>{await window.fig.writeFile('/demo/visual-study/'+rel,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));},{rel,b64});}
 await page.evaluate(async({bibliography,references,pdfB64})=>{
   const ROOT='/demo/visual-study',f=window.__flux,fb=window.fig;

   const {ensureFluxLib}=await import('/src/lib/references/fluxlibBridge.ts');const lib=await ensureFluxLib();
   await fb.writeText(`${lib}/library.bib`,bibliography);
   await fb.writeText(`${lib}/.fluxlib/organize.json`,JSON.stringify({version:1,items:Object.fromEntries(references.map(([key,t,a,y,j,k],i)=>[key,{tags:k.split('; '),status:i<3?'read':i%2?'reading':'unread',collections:['Visual studies']}]))}));
   await fb.writeText(`${lib}/.fluxlib/enrich.json`,JSON.stringify(Object.fromEntries(references.map(([key,title,author,year,journal,keywords,url,note])=>[key,{key,abstract:note,topics:keywords.split('; '),keywords:keywords.split('; '),sources:[],fetchedAt:'2026-09-14T00:00:00.000Z'}]))));
   const {bumpFluxLib}=await import('/src/lib/references/revision.ts');bumpFluxLib();
   const {seedReaderItem}=await import('/src/lib/references/devSeed.ts');seedReaderItem('demo-manuscript',pdfB64);
   await f.shell.openProjectAt(ROOT);
 },{bibliography,references,pdfB64:Buffer.from(pdf).toString('base64')});
 await clickMode('Paper');await page.waitForFunction(()=>!!window.__fluxView);
 await page.waitForFunction(()=>document.querySelector('.cm-editor')?.textContent.includes('Structure becomes visible'));
 await page.waitForFunction(()=>[...document.querySelectorAll('.cm-editor img[data-figure-state="ready"]')].some(image=>image.complete&&image.naturalWidth>0),{timeout:25000});
 await page.evaluate(async()=>{const {paperLayout}=await import('/src/shell/modes/paper/view-mode/paperLayoutStore.ts');paperLayout.update(s=>({...s,dynMarginOpen:false,gutterL:.05,gutterR:.05}));const v=window.__fluxView;v.dispatch({selection:{anchor:v.state.doc.toString().indexOf('A figure')}});document.activeElement?.blur();});
 await stable();await page.evaluate(()=>{window.__fluxView.scrollDOM.scrollTop=195;});
 await capture('paper');
 const editor=await page.$('.cm-editor');const box=await editor.boundingBox();
 const clip={x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),height:Math.min(760,Math.round(box.height))};
 await page.screenshot({path:path.join(root,'site/assets/media/paper-detail.webp'),type:'webp',quality:94,clip});await record('paper-detail',clip.width,clip.height);
 await clickMode('Figure');
 await page.waitForFunction(id=>window.__flux.get(window.__flux.fig.project).figures.some(f=>f.id===id),{timeout:20000},FIGURE_ID);
 await page.evaluate(id=>{const f=window.__flux,fig=f.get(f.fig.project).figures.find(v=>v.id===id),box=f.get(f.fig.canvasBox);const zoom=Math.min((box.w-70)/fig.width,(box.h-85)/fig.height);f.fig.viewport.set({panX:box.x+(box.w-fig.width*zoom)/2-fig.x*zoom,panY:box.y+(box.h-fig.height*zoom)/2-fig.y*zoom,zoom});f.fig.activeFigureId.set(id);f.fig.selection.set(new Set());},FIGURE_ID);
 await capture('figure');
 await page.evaluate(id=>{const f=window.__flux,fig=f.get(f.fig.project).figures.find(v=>v.id===id),box=f.get(f.fig.canvasBox),zoom=Math.min((box.w-70)/fig.width,(box.h-85)/fig.height);f.fig.viewport.set({panX:box.x+(box.w-fig.width*zoom)/2-fig.x*zoom,panY:box.y+(box.h-fig.height*zoom)/2-fig.y*zoom,zoom});f.fig.activeFigureId.set(id);},MATERIALS_ID);
 await capture('figure-materials');
 // Show the new native property menu beside a selected plot, with room to read it.
 await page.evaluate(async id=>{
   const f=window.__flux,figure=f.get(f.fig.project).figures.find(v=>v.id===id);
   const plot=figure.elements.find(e=>e.type==='plot');
   if(!plot)throw Error('The response plot is missing');
   const {inspectorHidden}=await import('/src/lib/settings.ts');inspectorHidden.set(true);
   f.fig.viewport.set({panX:50-figure.x*.8,panY:120-figure.y*.8,zoom:.8});
   f.fig.selection.set(new Set([plot.id]));
   f.fig.partSelection.set(null);
 },MATERIALS_ID);
 await stable();await page.keyboard.press('f');
 await page.waitForSelector('[role="dialog"][aria-label="Properties"]',{visible:true});
 await capture('figure-properties');
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{const {inspectorHidden}=await import('/src/lib/settings.ts');inspectorHidden.set(false);});
 await clickMode('Slide');await page.waitForFunction(id=>window.__flux.get(window.__flux.slide.deckOverlay)?.id===id,{timeout:20000},DECK_ID);
 await page.evaluate(()=>{[...document.querySelectorAll('.deckbar button')].find(e=>e.textContent.includes('Animate'))?.click();const f=window.__flux;f.slide.activeBeat.set(1);f.fig.selection.set(new Set());});
 await page.waitForFunction(()=>!document.body.innerText.includes('animation issue'));
 await capture('slides');
 await clickMode('Library');await page.waitForSelector('.lib .grow [aria-label="Toggle details"]',{visible:true});
 await page.evaluate(()=>{[...document.querySelectorAll('.lib .grow')].find(e=>e.textContent.includes('large-scale standardized'))?.querySelector('[aria-label="Toggle details"]')?.click();});
 await capture('library');
 await clickMode('Reader');await page.waitForFunction(()=>window.__fluxOpenReader&&window.__fluxSeedReaderItem);
 await page.evaluate(b64=>{window.__fluxSeedReaderItem('demo-manuscript',b64,{version:1,annotations:[{id:'reading-note',page:1,anchor:{quote:'A figure can bring several scales of an explanation into view.',prefix:'',suffix:''},color:'yellow',note:'Keep the distinctions between measured data, calculated fields and illustrative models clear.',tags:['population'],createdAt:'2026-09-14T00:00:00.000Z'}]});window.__fluxOpenReader('demo-manuscript');},Buffer.from(pdf).toString('base64'));
 await page.waitForFunction(()=>Number(document.querySelector('[data-doc-active="true"] [data-testid="pdf-root"]')?.dataset.rendered||0)>=1,{timeout:25000});
 await page.click('[data-doc-active="true"] [aria-label="Toggle the left sidebar"]');
 await page.click('[data-doc-active="true"] [aria-label="Fit page"]');
 await capture('reader');
 for(const [id,name]of [[FIGURE_ID,'response-figure'],[MATERIALS_ID,'materials-figure']]){const svg=await fs.readFile(path.join(PROJECT_ROOT,`fig/renders/${id}.svg`),'utf8');
 const dimensions=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);if(!dimensions)throw Error('Native figure must have viewBox');
 const plateHeight=Math.ceil(1800*Number(dimensions[2])/Number(dimensions[1]));
 const plate=await browser.newPage();await plate.setViewport({width:1800,height:plateHeight,deviceScaleFactor:2});
 await plate.setContent(`<html><body style="margin:0;background:white"><img style="display:block;width:1800px;height:auto" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" /></body></html>`);
 await plate.evaluate(()=>document.images[0].decode());
 await plate.screenshot({path:path.join(root,`site/assets/media/${name}.webp`),type:'webp',quality:96});await record(name,1800,plateHeight);await plate.close();
}
 await fs.writeFile(path.join(root,'media/screenshots.json'),JSON.stringify({source:pin,browser:await browser.version(),project:'Owner-authorized source plots; isolated website presentation',note:'Real Flux GUI in an isolated FileBridge. Two reviewed master figures retain their authored layout and plot content. Captions, website slides and manuscript are new. Public data and source terms are documented in visual credits. No owner test slides, personal library or context were used.',errors,outputs},null,2)+'\n');
 const home=path.join(root,'site/index.qmd');let homeText=await fs.readFile(home,'utf8');
 for(const [rel,size] of Object.entries(outputs)){const filename=path.basename(rel);const re=new RegExp('(src="assets/media/'+filename.replaceAll('.','\\.')+'"[\\s\\S]*?width=")\\d+("\\s+height=")\\d+(")','g');homeText=homeText.replace(re,`$1${size.width}$2${size.height}$3`);}
 await fs.writeFile(home,homeText);
 if(errors.length)throw Error(`Flux page errors: ${errors.join('; ')}`);
 console.log(JSON.stringify({errors,outputs},null,2));
} catch(error){await page.screenshot({path:path.join(root,'media/masters/capture-error.png')});console.error(await page.evaluate(()=>document.body.innerText.slice(0,12000)));throw error;} finally {await browser.close();}
