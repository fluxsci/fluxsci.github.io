/** Capture the Slides workspace screenshot with the launch-film slides, in the unmodified Flux GUI of
 *  the pinned release. Needs .cache/film-capture-project from refresh-slides.mjs and the pinned
 *  checkout's dev server (port 1420). Only slides.webp and its manifest entry change. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),PROJECT=path.join(root,'.cache/film-capture-project');
const at=process.argv.indexOf('--flux-source');if(at<0)throw Error('Pass --flux-source /path/to/pinned/flux; run its dev server first.');
const source=path.resolve(process.argv[at+1]),pin=JSON.parse(await fs.readFile(path.join(root,'flux-source.json'),'utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Unpinned source');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src','flux-core','scripts','brand','electron','package.json','package-lock.json'],{encoding:'utf8'}).trim())throw Error('Product source must be clean before capture');
const SLIDE='slide_muzb9z5kakd6_13448',BEAT=1; // Agreement, revealed: the scatter turns into a mean–difference plot
const files=async(dir,prefix='')=>(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name),path.posix.join(prefix,e.name)):[path.posix.join(prefix,e.name)]))).flat();
const {default:puppeteer}=await import(pathToFileURL(path.join(source,'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')));
const chrome=process.env.FLUX_CHROME||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const browser=await puppeteer.launch({executablePath:chrome,headless:true,defaultViewport:{width:1500,height:950,deviceScaleFactor:2},args:['--no-sandbox']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const stable=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
 await page.goto((process.env.FLUX_URL||'http://127.0.0.1:1420/')+'?fixture=demo',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>!!window.__flux?.get(window.__flux.shell.projectModel));
 for(const rel of await files(PROJECT)){const b64=(await fs.readFile(path.join(PROJECT,rel))).toString('base64');await page.evaluate(async({rel,b64})=>{await window.fig.writeFile('/demo/flux-film/'+rel,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));},{rel,b64});}
 await page.evaluate(async()=>{await window.__flux.shell.openProjectAt('/demo/flux-film');});
 await page.evaluate(()=>{const b=[...document.querySelectorAll('button[aria-label]')].find(e=>e.getAttribute('aria-label')==='Slide');if(!b)throw Error('No Slide mode');b.click();});
 await page.waitForFunction(()=>window.__flux.get(window.__flux.slide.deckOverlay)?.id==='film',{timeout:20000});
 await page.evaluate(({SLIDE,BEAT})=>{const f=window.__flux;f.fig.activeFigureId.set(SLIDE);[...document.querySelectorAll('.deckbar button')].find(e=>e.textContent.includes('Animate'))?.click();f.slide.activeBeat.set(BEAT);f.fig.selection.set(new Set());},{SLIDE,BEAT});
 await stable();await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>/^Edit after step/.test(e.textContent.trim()));if(!b)throw Error('No Edit after step');b.click();});
 await page.mouse.move(1490,940);await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,1500));await stable();
 await fs.mkdir(path.join(root,'media/masters'),{recursive:true});
 await page.screenshot({path:path.join(root,'media/masters/slides.png')});
 const rel='site/assets/media/slides.webp';await page.screenshot({path:path.join(root,rel),type:'webp',quality:92});
 const bytes=await fs.readFile(path.join(root,rel)),file=path.join(root,'media/screenshots.json'),manifest=JSON.parse(await fs.readFile(file,'utf8'));
 manifest.outputs[rel]={width:1500,height:950,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 manifest.slidesNote='slides.webp shows the launch-film slides (deck "The Flux film", exported unchanged from the owner-authorized master project) in the same pinned release GUI; captured by scripts/capture-slides.mjs.';
 await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');
 if(errors.length)throw Error(`Flux page errors: ${errors.join('; ')}`);
 console.log('Captured slides.webp');
}catch(error){await page.screenshot({path:path.join(root,'media/masters/capture-error.png')});throw error;}finally{await browser.close();}
