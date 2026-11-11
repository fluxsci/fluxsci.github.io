/** Shared by the Slides takes (slide-send, slide-autoanimate, slide-steps): the talk they film.
 *
 *  Every Slides clip opens a deck "Protein structure talk" (theme Flux Light) built in the
 *  scratch project by `prepare`, never in the real project. The owner's test decks are
 *  unregistered from the scratch copy so deck lists show only the talk. The deck holds:
 *
 *   1. a title slide;
 *   2. (slide-autoanimate, slide-steps) "Figure 1", the whole finished figure, made with the
 *      CLI's add-figure (the headless twin of Send to deck);
 *   3. (slide-autoanimate) "Deuterium uptake": panel d alone, large, with a title and a source
 *      line, no animation yet;
 *   4. (slide-steps) "Dynamics and mobility": panel f at 190–610 ns beside panel c in rainbow,
 *      with the two edits of the Figure clips as steps (written with the CLI's set-plot-view and
 *      set-plot-color-scale --beat).
 *
 *  Plot elements on slides 3 and 4 are copies of Figure 1's own elements (same assets, same
 *  overrides), placed at a slide size with a content scale that suits a talk (text ~1.5x).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {CANVAS_FILE,FIGURE,PANELS,carryOver} from './_figure1.mjs';

const CLI=path.join(os.homedir(),'flux/dist/flux-cli.mjs');
export const DECK_TITLE='Protein structure talk';
const SERIF='Georgia, "Gelasio", "Times New Roman", Times, serif';

/** Run the Flux CLI on the scratch project with an isolated, empty HOME. */
export function flux(project,...args){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'flux-cli-home-'));
  try{
    const r=spawnSync(process.execPath,[CLI,...args,'--root',project],{cwd:home,env:{...process.env,HOME:home,XDG_CONFIG_HOME:home},encoding:'utf8'});
    if(r.status!==0)throw Error(`flux ${args.join(' ')} failed: ${r.stderr}${r.stdout}`);
    return r.stdout+r.stderr;
  }
  finally{fs.rmSync(home,{recursive:true,force:true});}
}
const lastId=(out,prefix)=>{const m=out.match(new RegExp(prefix+'_[a-z0-9]+_[0-9]+','g'));if(!m)throw Error('No '+prefix+' id in: '+out);return m.at(-1);};

/** Unregister (and remove) the owner's test decks in the scratch copy. */
export function clearDecks(project){
  const file=path.join(project,'project.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const d of manifest.slides??[])fs.rmSync(path.join(project,'slides',d.id),{recursive:true,force:true});
  manifest.slides=[];
  fs.writeFileSync(file,JSON.stringify(manifest,null,2));
}

const deckFile=(project,id)=>path.join(project,'slides',id,'deck.json');
const readDeck=(project,id)=>JSON.parse(fs.readFileSync(deckFile(project,id),'utf8'));
const writeDeck=(project,id,deck)=>fs.writeFileSync(deckFile(project,id),JSON.stringify(deck,null,2));
const figureElements=project=>{
  const canvas=JSON.parse(fs.readFileSync(path.join(project,CANVAS_FILE),'utf8'));
  return Object.fromEntries(canvas.figures.find(f=>f.id===FIGURE).elements.map(e=>[e.id,e]));
};
let serial=0;
const fresh=kind=>`${kind}_mwtour${(++serial).toString(36).padStart(4,'0')}_${serial}`;

function text(t,{x=28,y,width=584,size,weight=400,color='#100f0f',align='left'}){
  return {type:'text',id:fresh('text'),text:t,x,y,width,height:Math.ceil(size*1.3),rotation:0,fontFamily:SERIF,fontSize:size,fontWeight:weight,fontStyle:'normal',align,color,sizing:'auto-h'};
}
/** A copy of a Figure 1 plot element at a slide position and size. */
function plot(source,{x,y,width,height,scale}){
  const e=structuredClone(source);
  Object.assign(e,{id:fresh('plot'),x,y,width,height,rotation:0,contentScale:scale});
  return e;
}
const slide=(name,elements)=>({id:fresh('slide'),name,layout:'blank',elements,beats:[{id:fresh('beat'),label:'base',tracks:[]}]});
const TITLE=t=>text(t,{y:16,size:17,weight:600});
const SOURCE=t=>text(t,{y:330,size:8,color:'#6f6e69'});

/** Make canvas_4 (Figure 1's) the project's first canvas, so the Figure workspace opens on it
 *  whenever it is entered again (it reopens the first canvas, not the last one shown). */
export function canvas4First(project){
  const file=path.join(project,'fig/index.json'),index=JSON.parse(fs.readFileSync(file,'utf8'));
  const first=index.canvases.find(c=>c.name==='canvas_4');
  const rest=index.canvases.filter(c=>c!==first).sort((a,b)=>a.order-b.order);
  [first,...rest].forEach((c,i)=>{c.order=i+1;});
  // No trailing newline: Flux rewrites the file in its own form at start-up (enterFigure waits for that).
  fs.writeFileSync(file,JSON.stringify(index,null,2));
}

/** Enter the Figure workspace, retrying while Flux reports that the figures changed during the
 *  read (it rewrites fig/index.json and project.json at start-up after canvas4First, which can
 *  race the first figure load). */
export async function enterFigure({page,rect,need,sleep}){
  await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Figure]')),60000);
  const root=await need('project root',()=>page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('flux.recents'))[0].path;}catch{return null;}}),30000);
  const index=path.join(root,'fig/index.json');
  await need('Flux has settled fig/index.json',()=>fs.readFileSync(index,'utf8').endsWith('\n'),60000);
  await sleep(1500);
  await need('figure mode',async()=>{
    if(await rect('.canvas-host'))return true;
    if(await page.evaluate(()=>/reload again/.test(document.body.innerText))){await page.keyboard.press('Control+2');await sleep(2500);}
    await page.evaluate(()=>document.querySelector('button[aria-label=Figure]').click());await sleep(3000);
    return rect('.canvas-host');
  },180000);
}

/** Build the talk in the scratch project. `slides`: which of 'figure', 'hdx', 'steps' to add
 *  after the title slide. Returns {deck, ids} (slide and element ids by role). Leaves Figure 1
 *  in its finished state (carryOver of every panel). */
export function buildTalk(project,{slides=[]}={}){
  const original=figureElements(project);                 // before carryOver: c in rainbow, f at 190–610 ns
  carryOver(project,['c','d','e','f','b']);
  const finished=figureElements(project);
  clearDecks(project);
  const deck=lastId(flux(project,'new-deck','--title',DECK_TITLE,'--theme','flux-light'),'deck');
  const ids={deck};
  // The title slide: the starter text, rewritten.
  let d=readDeck(project,deck);
  const [title,subtitle]=d.slides[0].elements;
  Object.assign(title,{text:'Protein structure',y:128});
  Object.assign(subtitle,{text:'Prediction, exchange and dynamics',y:186,color:'#6f6e69'});
  d.slides[0].name='Title';
  writeDeck(project,deck,d);
  if(slides.includes('figure')){
    ids.figure=lastId(flux(project,'add-slide',deck,'--name','Figure 1','--layout','blank'),'slide');
    flux(project,'add-figure',deck,ids.figure,FIGURE);
  }
  d=readDeck(project,deck);
  if(slides.includes('hdx')){
    const p=plot(finished[PANELS.d.plot],{x:96,y:50,width:448,height:268,scale:1.55});
    const s=slide('Deuterium uptake',[
      TITLE('Exposed regions exchange first'),
      p,
      SOURCE('Deuterium uptake of six peptides, from an exposed loop to the buried core. Simulated demonstration data.'),
    ]);
    d.slides.push(s);ids.hdx={slide:s.id,plot:p.id};
  }
  if(slides.includes('steps')){
    const f=plot(original[PANELS.f.plot],{x:28,y:66,width:304,height:200,scale:1.15});
    const c=plot(original[PANELS.c.plot],{x:346,y:62,width:266,height:200,scale:1.15});
    const s=slide('Dynamics and mobility',[
      TITLE('Simulations fold; the conserved core is rigid'),
      f,c,
      SOURCE('Left: Cα RMSD to the native structure, eight replicas and their mean. Right: mean B-factor over burial and conservation. Simulated demonstration data.'),
    ]);
    d.slides.push(s);ids.steps={slide:s.id,rmsd:f.id,hex:c.id};
  }
  writeDeck(project,deck,d);
  return ids;
}

/** A button by its exact text whose top is below `belowY` (the Animator's, not the rails'). */
export const buttonIn=(page,text,belowY=0)=>page.evaluate(([text,belowY])=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&b.getBoundingClientRect().y>belowY&&b.getBoundingClientRect().width>0);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},[text,belowY]);
/** The active slide's stage box. */
export const stageBox=async ctx=>{const pages=await ctx.lib.figurePages(ctx);return pages.find(p=>p.active)??pages[0];};
const canvasText=page=>page.evaluate(()=>document.querySelector('.canvas-host')?.textContent.replace(/\s+/g,' ').trim()??'');

/** From start-up into Slides on the talk, on the slide named `slide` (↓ from the title slide),
 *  with the side rails hidden (rails: false) and the Animator open. */
export async function enterSlides(ctx,{slide,rails=false,titles}){
  const {page,rect,need,sleep}=ctx;
  await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Figure]')),60000);
  await sleep(4000);
  await page.keyboard.press('Control+3');
  await need('the talk',async()=>/Prediction, exchange and dynamics/.test(await canvasText(page)),60000);
  await sleep(2000);
  // The left rail away; the Inspector stays (an effect selected in the Animator opens it, and the stage would jump).
  if(!rails){await page.keyboard.press('Control+b');await sleep(1000);}
  // ↓ until the slide's title is on the stage.
  for(let i=0;i<6&&!titles.test(await canvasText(page));i++){await page.keyboard.press('ArrowDown');await sleep(2500);}
  if(!titles.test(await canvasText(page)))throw Error('Could not reach the slide '+slide);
  const open=await rect('[aria-label="Resize animator"]');
  if(!open){
    const b=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Animate'));const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await page.mouse.click(b.x,b.y);await need('Animator',()=>rect('[aria-label="Resize animator"]'),10000);
  }
  await sleep(1500);
}
/** Drag the Animator's top edge until the dock is about `h` px tall (a remembered preference). */
export async function setDockHeight({page,rect,need,sleep,HEIGHT},h){
  const g=await need('dock handle',()=>rect('[aria-label="Resize animator"]'));
  const from={x:g.x+g.w/2,y:g.y+g.h/2},to={x:from.x,y:HEIGHT-h};
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  for(let i=1;i<=12;i++){await page.mouse.move(from.x,from.y+(to.y-from.y)*i/12);await sleep(30);}
  await page.mouse.up();await sleep(1800);
}
