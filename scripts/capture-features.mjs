/** Screenshots and short clips of the 0.3 features (Plots rail, Align & Arrange, plot Reflow,
 *  sticky connectors, X-ray, Settings → Cursor, the Paper figures pane) in the unmodified Flux GUI,
 *  captured in the dev server's isolated in-memory fixture. Inputs: the isolated showcase project
 *  from refresh-flux-assets.mjs, the illustrative plots from media/docs-plots/make_docs_plots.py
 *  (--plots <dir>) and a small dissections folder (--dissections <dir>). Writes PNGs and MP4 clips
 *  under site/assets/media/docs/ and records them in media/feature-captures.json.
 *
 *    node scripts/capture-features.mjs --flux-source <checkout> --plots .cache/review/docs-plots --dissections .cache/review/dissections
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:path.resolve(process.argv[at+1]);};
const source=arg('--flux-source'),plotsDir=arg('--plots'),dissectionsDir=arg('--dissections');
if(!source||!plotsDir||!dissectionsDir)throw Error('Pass --flux-source, --plots and --dissections');
const pin=JSON.parse(await fs.readFile(path.join(root,'flux-source.json'),'utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Unpinned source');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src'],{encoding:'utf8'}).trim())throw Error('Dirty product source');
const project=path.join(root,'.cache/visual-project'),url=process.env.FLUX_URL||'http://127.0.0.1:1420/';
const OUT='site/assets/media/docs',CLIPS='site/assets/media/docs/clips',VIDEO=path.join(root,'.cache/review/video');
await fs.mkdir(path.join(root,CLIPS),{recursive:true});await fs.rm(VIDEO,{recursive:true,force:true});await fs.mkdir(VIDEO,{recursive:true});
const ROOT='/demo/features';
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:2,recordVideo:{dir:VIDEO,size:{width:1400,height:1000}}});
const page=await context.newPage();const t0=Date.now();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const outputs={},clips=[],problems=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const settle=async(ms=500)=>{await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(ms);};
const park=()=>page.mouse.move(1395,995);
const still=async(name,target)=>{await park();await settle();const rel=`${OUT}/${name}.png`,file=path.join(root,rel);if(target?.clip)await page.screenshot({path:file,clip:target.clip});else if(target?.locator)await target.locator.screenshot({path:file});else await page.screenshot({path:file});const bytes=await fs.readFile(file);outputs[rel]={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length,sha256:sha(bytes)};console.log('still',name);};
const clip=async(name,run)=>{await park();await settle(600);const start=Date.now()-t0;try{await run();}catch(e){problems.push(`${name}: ${e.message}`);console.error('clip failed',name,e.message);return;}await settle(900);clips.push({name,start,end:Date.now()-t0});console.log('clip',name,((Date.now()-t0-start)/1000).toFixed(1)+'s');};
const glide=async(x1,y1,x2,y2,steps=30,ms=1200)=>{for(let i=1;i<=steps;i++){const t=i/steps,e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;await page.mouse.move(x1+(x2-x1)*e,y1+(y2-y1)*e);await page.waitForTimeout(ms/steps);}};
const write=(rel,bytes)=>page.evaluate(async({rel,b64})=>window.fig.writeFile(rel,Uint8Array.from(atob(b64),c=>c.charCodeAt(0))),{rel,b64:Buffer.from(bytes).toString('base64')});
async function walk(dir,prefix){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const rel=prefix+'/'+e.name;if(e.isDirectory())out.push(...await walk(path.join(dir,e.name),rel));else out.push([path.join(dir,e.name),rel]);}return out;}
// Screen position of a canvas point, and the active figure's frame on screen.
// canvasBox is canvas-relative ({x:0,y:0,w,h}); the canvas element's page offset is added to map to the screen.
const toScreen=(x,y)=>page.evaluate(([x,y])=>{const f=window.__flux,v=f.get(f.fig.viewport),box=f.get(f.fig.canvasBox);const host=[...document.querySelectorAll('div,section,main')].find(e=>Math.abs(e.clientWidth-box.w)<2&&Math.abs(e.clientHeight-box.h)<2);const r=host?host.getBoundingClientRect():{x:0,y:0};return [r.x+v.panX+x*v.zoom,r.y+v.panY+y*v.zoom];},[x,y]);
const focusFigure=(id,maxZoom=1)=>page.evaluate(([id,maxZoom])=>{const f=window.__flux,fig=f.get(f.fig.project).figures.find(v=>v.id===id),box=f.get(f.fig.canvasBox);const zoom=Math.min(maxZoom,(box.w-90)/fig.width,(box.h-110)/fig.height);f.fig.viewport.set({panX:box.x+(box.w-fig.width*zoom)/2-fig.x*zoom,panY:box.y+(box.h-fig.height*zoom)/2-fig.y*zoom,zoom});f.fig.activeFigureId.set(id);f.fig.selection.set(new Set());f.fig.partSelection.set(null);return fig;},[id,maxZoom]);
const figure=id=>page.evaluate(id=>window.__flux.get(window.__flux.fig.project).figures.find(v=>v.id===id),id);
const select=(ids)=>page.evaluate(ids=>{const f=window.__flux;f.fig.selection.set(new Set(ids));f.fig.partSelection.set(null);},ids);
const selectionBox=async()=>{const boxes=await page.locator('rect.handle').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.right,r.bottom];}));if(!boxes.length)throw Error('No selection handles');return {x:Math.min(...boxes.map(b=>b[0])),y:Math.min(...boxes.map(b=>b[1])),right:Math.max(...boxes.map(b=>b[2])),bottom:Math.max(...boxes.map(b=>b[3]))};};
const mode=async name=>{await page.getByRole('button',{name,exact:true}).click();await settle(700);};
try{
 await page.goto(url+'?fixture=demo');await page.waitForFunction(()=>!!window.__flux?.get(window.__flux.shell.projectModel));
 // Mirror the isolated showcase project (figures + plots), the tutorial plot and a small dissections folder.
 for(const [file,rel] of [...await walk(path.join(project,'fig'),'fig'),...await walk(path.join(project,'plots'),'plots')]){if(rel.includes('/.'))continue;await write(`${ROOT}/${rel}`,await fs.readFile(file));}
 for(const name of ['growth.svg','growth.fluxplot.json','growth.recipe.json'])await write(`${ROOT}/plots/analysis/${name}`,await fs.readFile(path.join(plotsDir,name)));
 for(const [file,rel] of await walk(dissectionsDir,'plots/_dissections/showcase'))await write(`${ROOT}/${rel}`,await fs.readFile(file));
 const manifest=JSON.parse(await fs.readFile(path.join(project,'project.json'),'utf8'));manifest.title='Flux visual guide';manifest.slides=[];manifest.documentOrder=[manifest.manuscript.path];
 await page.evaluate(async({manifest,ROOT})=>{await window.fig.writeText(`${ROOT}/${manifest.manuscript.path}`,'# Flux visual guide\n\nAn isolated project for documentation screenshots.\n');await window.fig.writeText(`${ROOT}/project.json`,JSON.stringify(manifest));await window.__flux.shell.openProjectAt(ROOT);},{manifest,ROOT});
 await mode('Figure');await page.waitForFunction(()=>window.__flux.get(window.__flux.fig.project).figures.some(f=>f.id==='fig-1'));
 // Three empty demonstration figures below the authored ones.
 await page.evaluate(async()=>{const {createFigure}=await import('/src/lib/figureLifecycle.ts');const f=window.__flux;f.fig.project.update(p=>{createFigure(p,{canvasId:'canvas-1',id:'fig-growth',nickname:'Growth',width:680,height:440});createFigure(p,{canvasId:'canvas-1',id:'fig-align',nickname:'Alignment',width:680,height:440});createFigure(p,{canvasId:'canvas-1',id:'fig-connect',nickname:'Connectors',width:680,height:440});return p;});});
 await settle(800);

 // ---- The Plots rail: gallery above, dissections of the clicked plot below.
 await focusFigure('fig-1');await settle(500);
 await page.keyboard.press('Alt+g');await page.locator('[data-plots-rail]').waitFor();await settle(1800);
 const atlas=page.locator('[data-tile$="/atlas.svg"]').first();await atlas.click();await settle(1500);
 await still('figure-plots-rail');
 await page.locator('[data-plot-notes-toggle]').click();await settle(600);
 const note=page.locator('[data-plots-dissections]').getByText('observations',{exact:false}).first();if(await note.count())await note.click();await settle(900);
 await still('figure-dissections-notes',{locator:page.locator('[data-plots-rail]')});
 await page.locator('[data-plot-notes-toggle]').click();await settle(400);

 // ---- Clip: drag the tutorial plot from the rail into an empty figure (peek on hover, lands at true size).
 await focusFigure('fig-growth',1);await settle(600);
 const growthTile=page.locator('[data-tile$="/growth.svg"]').first();await growthTile.scrollIntoViewIfNeeded();
 const demo=await figure('fig-growth');const [cx,cy]=await toScreen(demo.x+demo.width/2,demo.y+demo.height/2);
 await clip('plots-rail-place',async()=>{const b=await growthTile.boundingBox();const [sx,sy]=[b.x+b.width/2,b.y+b.height/2];await page.mouse.move(sx-40,sy-30);await glide(sx-40,sy-30,sx,sy,12,400);await page.waitForTimeout(1300);await page.mouse.down();await glide(sx,sy,cx,cy,40,1600);await page.waitForTimeout(500);await page.mouse.up();await page.waitForTimeout(1500);});
 let growth=(await figure('fig-growth')).elements.find(e=>e.type==='plot');
 if(!growth){console.log('drag did not place; double-clicking the tile');await growthTile.dblclick();await settle(1500);growth=(await figure('fig-growth')).elements.find(e=>e.type==='plot');}
 if(!growth)throw Error('The tutorial plot was not placed');
 await page.keyboard.press('Alt+g');await settle(500); // back to Layers

 // ---- The Inspector's plot section: Reflow / Stretch, the Layout status, Axis view, Content scale.
 await select([growth.id]);await settle(900);
 {const layout=page.locator('aside.inspector').getByText('Layout',{exact:true}).first();await layout.waitFor();const aside=await page.locator('aside.inspector').boundingBox();const l=await layout.boundingBox();await still('figure-plot-layout',{clip:{x:aside.x,y:Math.max(aside.y,l.y-150),width:aside.width,height:Math.min(620,aside.y+aside.height-Math.max(aside.y,l.y-150))}});}

 // ---- Clip: drag the plot's right edge; the axes reflow and the legend wraps while text keeps its point size.
 await clip('reflow-resize',async()=>{const s=await selectionBox();const midY=(s.y+s.bottom)/2,w=s.right-s.x;await page.mouse.move(s.right+30,midY+60);await glide(s.right+30,midY+60,s.right-3,midY,14,500);await page.waitForTimeout(500);await page.mouse.down();await glide(s.right-3,midY,s.right-3-w*.38,midY,45,2200);await page.waitForTimeout(900);await page.mouse.up();await page.waitForTimeout(1400);});
 await still('figure-plot-reflowed');

 // ---- Clip: Ctrl+click one series, R opens the X-ray beside it, rows light their parts on the canvas.
 await clip('xray',async()=>{const pt=await page.evaluate(()=>{const el=[...document.querySelectorAll('[id$="control.line"]')].map(e=>e.tagName==='path'?e:e.querySelector('path')).find(Boolean);if(!el)return null;const p=el.getPointAtLength(el.getTotalLength()*.62),m=el.getScreenCTM(),q=p.matrixTransform(m);return [q.x,q.y];});if(!pt)throw Error('control.line not found');await page.mouse.move(pt[0]-80,pt[1]+70);await glide(pt[0]-80,pt[1]+70,pt[0],pt[1],14,500);await page.waitForTimeout(400);await page.keyboard.down('Control');await page.mouse.click(pt[0],pt[1]);await page.keyboard.up('Control');await page.waitForTimeout(900);await page.keyboard.press('r');const dlg=page.locator('[role="dialog"][aria-label="X-ray"]');try{await dlg.waitFor({timeout:5000});}catch{await select([growth.id]);await page.waitForTimeout(500);await page.keyboard.press('r');await dlg.waitFor({timeout:8000});}await page.waitForTimeout(900);const rows=dlg.locator('[role="treeitem"], [role="row"], .row, button');const n=Math.min(await rows.count(),6);for(let i=1;i<n;i++){const b=await rows.nth(i).boundingBox();if(!b)continue;await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(650);}await page.waitForTimeout(600);await page.keyboard.press('Escape');await page.waitForTimeout(600);});
 await page.keyboard.press('Escape');await settle(300);

 // ---- Align & Arrange on three plots placed in an empty figure.
 await focusFigure('fig-align',1);await settle(400);
 await page.evaluate(async ROOT=>{const {insertPlots}=await import('/src/lib/plotsRail/insert.ts');await insertPlots([`${ROOT}/plots/showcase/rose.svg`,`${ROOT}/plots/showcase/section-a.svg`,`${ROOT}/plots/showcase/section-gamma.svg`]);},ROOT);
 await settle(1500);
 let alignFig=await figure('fig-align');let plots=alignFig.elements.filter(e=>e.type==='plot');
 if(plots.length<3)throw Error('Three plots were not placed for the alignment demo');
 // Spread them unevenly so alignment has something to do.
 await page.evaluate(([ids,fig])=>{const f=window.__flux;f.fig.project.update(p=>{const g=p.figures.find(v=>v.id===fig);const [a,b,c]=ids.map(id=>g.elements.find(e=>e.id===id));const w=170;for(const [e,x,y] of [[a,24,46],[b,236,22],[c,470,64]]){const s=w/e.width;e.width=w;e.height=e.height*s;e.x=x;e.y=y;}return p;});},[plots.map(p=>p.id),'fig-align']);
 await settle(600);await select(plots.map(p=>p.id));await settle(600);
 await page.keyboard.press('a');const aa=page.locator('[role="dialog"][aria-label^="Flux Align"], [role="dialog"][aria-label^="Flux Arrange"]');await aa.first().waitFor();await settle(900);
 await still('figure-align-arrange');
 await clip('align-arrange',async()=>{const top=aa.first().getByRole('button',{name:'Align top',exact:true});const b=await top.boundingBox();await page.mouse.move(b.x-120,b.y+80);await glide(b.x-120,b.y+80,b.x+b.width/2,b.y+b.height/2,14,500);await page.waitForTimeout(400);await top.click();await page.waitForTimeout(1100);const dist=aa.first().getByRole('button',{name:'Distribute horizontal spacing',exact:true});const d=await dist.boundingBox();await glide(b.x+b.width/2,b.y+b.height/2,d.x+d.width/2,d.y+d.height/2,14,500);await page.waitForTimeout(300);await dist.click();await page.waitForTimeout(1300);});
 await page.keyboard.press('Escape');await settle(400);await page.keyboard.press('Escape');await settle(400);

 // ---- Clip: connectors stick. Draw two boxes, an arrow between them, then move a box: the arrow follows.
 await focusFigure('fig-connect',1);await settle(500);
 const cf=await figure('fig-connect');
 const P=async(fx,fy)=>toScreen(cf.x+cf.width*fx,cf.y+cf.height*fy);
 await clip('sticky-connector',async()=>{
  const draw=async(key,[x1,y1],[x2,y2])=>{await page.keyboard.press(key);await page.waitForTimeout(350);await page.mouse.move(x1,y1);await page.waitForTimeout(250);await page.mouse.down();await glide(x1,y1,x2,y2,22,700);await page.mouse.up();await page.waitForTimeout(500);};
  await draw('Alt+r',await P(.10,.30),await P(.36,.62));
  await draw('Alt+r',await P(.62,.18),await P(.90,.48));
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  await draw('Shift+l',await P(.23,.46),await P(.76,.33));
  await page.keyboard.press('v');await page.waitForTimeout(600);
  const [bx,by]=await P(.76,.33),[tx,ty]=await P(.74,.78);
  await page.mouse.move(bx,by);await page.waitForTimeout(300);await page.mouse.down();await glide(bx,by,tx,ty,40,1800);await page.waitForTimeout(500);await page.mouse.up();await page.waitForTimeout(1200);
 });
 await still('figure-sticky-connector');
 await page.keyboard.press('Escape');

 // ---- Settings → General → Cursor.
 await page.locator('button[aria-label="Settings"]').click();await page.locator('.bk').waitFor();await settle(700);
 {const cursor=page.locator('.bk').getByRole('heading',{name:'Cursor',exact:true});await cursor.evaluate(el=>el.scrollIntoView({block:'start'}));await settle(500);const panel=page.locator('.bk > *').first();await still('settings-cursor',{locator:panel});}
 await page.getByRole('button',{name:'Done',exact:true}).click();await settle(500);

 // ---- Paper: the Alt+F figures pane with a panel chosen; a spelling suggestion popover.
 await mode('Paper');await page.locator('.cm-editor').first().waitFor();await settle(1500);
 try{
  await page.locator('.cm-content').first().click();await page.keyboard.press('Alt+f');const fv=page.locator('.fv').first();await fv.waitFor({timeout:8000});await settle(1500);const fig2=fv.getByText('Fig. 2',{exact:true}).first();if(await fig2.count())await fig2.click();await settle(1500);
  const panelB=fv.locator('[aria-label="Panels to reference"] button').nth(1);if(await panelB.count())await panelB.click();await settle(700);
  await page.waitForFunction(()=>{const img=document.querySelector('.fv .stage img');return img&&img.complete&&img.naturalWidth>0;},null,{timeout:30000}).catch(()=>problems.push('paper-figures-pane: preview did not render'));await settle(800);
  const fb=await fv.boundingBox();await still('paper-figures-pane',{clip:{x:Math.max(0,fb.x-16),y:Math.max(0,fb.y-44),width:Math.min(1400-Math.max(0,fb.x-16),fb.width+32),height:Math.min(1000-Math.max(0,fb.y-44),fb.height+60)}});
 }catch(e){problems.push('paper-figures-pane: '+e.message);}
 try{
  await page.keyboard.press('Escape');const content=page.locator('.cm-content').first();await content.click({position:{x:40,y:40}});await page.keyboard.press('Control+End');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.type('Firing rates were aproximatly stable across the hippocampal recordings. ',{delay:45});await settle(4500);await page.screenshot({path:path.join(root,'.cache/review/spelling-debug.png')});
  const word=page.locator('.cm-content .cm-spelling-issue').first();await word.waitFor({timeout:8000});const b=await word.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await settle(1500);
  await still('paper-spelling',{clip:{x:Math.max(0,b.x-260),y:Math.max(0,b.y-70),width:620,height:330}});
 }catch(e){problems.push('paper-spelling: '+e.message);}
}catch(error){await page.screenshot({path:path.join(root,'.cache/review/features-error.png')});console.error(error);problems.push('fatal: '+error.message);}
finally{
 const videoPath=await page.video().path();await context.close();await browser.close();
 // Cut and encode the clips (H.264 MP4 with a poster frame) from the session recording.
 for(const c of clips){const name=c.name,mp4=path.join(root,CLIPS,`${name}.mp4`),poster=path.join(root,CLIPS,`${name}.png`);const ss=Math.max(0,(c.start-250)/1000),to=(c.end+200)/1000;
  execFileSync('ffmpeg',['-y','-loglevel','error','-ss',ss.toFixed(2),'-to',to.toFixed(2),'-i',videoPath,'-an','-c:v','libx264','-pix_fmt','yuv420p','-crf','24','-preset','slow','-movflags','+faststart','-vf','scale=1400:1000:flags=lanczos,fps=30',mp4]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-ss',(ss+0.05).toFixed(2),'-i',videoPath,'-frames:v','1','-vf','scale=1400:1000:flags=lanczos',poster]);
  for(const [file,extra] of [[mp4,{durationMs:Math.round(to*1000-ss*1000)}],[poster,{}]]){const bytes=await fs.readFile(file);const rel=path.relative(root,file);outputs[rel]={...(file.endsWith('.png')?{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}:{width:1400,height:1000}),bytes:bytes.length,sha256:sha(bytes),...extra};}
 }
 await fs.writeFile(path.join(root,'media/feature-captures.json'),JSON.stringify({source:{repository:pin.repository,revision:pin.revision,version:pin.version},description:'Stills and short clips of the 0.3 Figure, Paper and Settings features in the native Flux GUI (dev-server fixture, isolated in-memory project). Plots are the authorized showcase plots and the tutorial plot drawn by media/docs-plots/make_docs_plots.py; the dissections folder and notes are illustrative. Clips are cut from one Playwright recording with ffmpeg.',errors,problems,outputs},null,2)+'\n');
 console.log(JSON.stringify({errors,problems,clips:clips.map(c=>c.name),stills:Object.keys(outputs).filter(k=>!k.includes('/clips/'))},null,1));
}
