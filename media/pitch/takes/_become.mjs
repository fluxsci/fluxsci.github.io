/** Shared by the Slides takes "slide-become" and "slide-animator": one slide in a new deck of
 *  the scratch project, holding Figure 1's uptake curves (panel d, in its finished state) beside
 *  a bar chart of the six peptides' half-times (plots/protein_structure/hdx_half_times, made for
 *  this by CORE/protein_structure/pure_scripts/tour_become.py in the demo repo).
 *
 *  Built every run with the Flux CLI on the scratch copy, before the app opens it:
 *    new-deck (Flux Light) → add-slide (blank) → add-figure Figure 1 (copies its panels with their
 *    overrides) → a throwaway figure holding the bar chart → add-figure it too; then the slide is
 *    trimmed to the two plots, laid out, titled, and the throwaway figure and the deck's starter
 *    title slide are deleted. Nothing is written to the real project.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PANELS,FIGURE,carryOver} from './_figure1.mjs';

export const DECK_TITLE='HDX half-times';
export const HALF_TIMES='plots/protein_structure/hdx_half_times.svg';
const CLI=path.join(os.homedir(),'flux/dist/flux-cli.mjs');

/** Slide layout, in stage px. The deck is 4:3 (480 x 360), like the tour's clips, so the slide
 *  fills a clip frame and the exported live slide sits beside the clips at their aspect. Plots
 *  keep their own type size times `scale`, like a figure panel enlarged for the screen. The bar
 *  chart's box is nudged (measured in the exported player) so both plots' spines stand level. */
export const LAYOUT={stage:{width:480,height:360},scale:1,top:86,height:250,left:{x:12,w:232},right:{x:244,w:226,y:81.75,height:256.85},
  title:{x:24,y:22,w:440,text:'Each fitted curve becomes its half-time',size:19},
  subtitle:{x:24,y:50,w:440,text:'Deuterium uptake of six peptides, from an exposed loop to the buried core',size:10.5}};

function flux(project,args,flux=CLI){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'become-cli-'));
  try{
    const r=spawnSync(process.execPath,[flux,...args,'--root',project],{encoding:'utf8',env:{...process.env,HOME:home,XDG_CONFIG_HOME:path.join(home,'xdg'),FLUX_PROJECT:project}});
    const out=(r.stdout||'')+(r.stderr||'');
    if(r.status!==0)throw Error(`flux ${args[0]} failed: ${out}`);
    return out;
  }finally{fs.rmSync(home,{recursive:true,force:true});}
}

/** Build the deck in the scratch project. Returns {deckId, slideId, uptake, bars} (element ids). */
export function buildBecomeSlide(project,{source}={}){
  const cli=source?path.join(source,'dist/flux-cli.mjs'):CLI;
  const run=args=>flux(project,args,cli);
  carryOver(project,['c','d','e','f','b']);
  const deckId=run(['new-deck','--title',DECK_TITLE,'--theme','flux-light']).match(/deck_[a-z0-9_]+/)[0];
  const starter=JSON.parse(fs.readFileSync(path.join(project,'slides',deckId,'deck.json'),'utf8')).slides.map(s=>s.id);
  const slideId=run(['add-slide',deckId,'--layout','blank']).match(/slide_[a-z0-9_]+/)[0];
  run(['create-figure','--id','tourbecometmp','--name','tourbecometmp']);
  run(['import-plots','tourbecometmp',path.join(project,HALF_TIMES)]);
  run(['add-figure',deckId,slideId,FIGURE]);
  run(['add-figure',deckId,slideId,'tourbecometmp']);
  run(['delete-figure','tourbecometmp']);
  for(const id of starter)run(['delete-slide','--force',deckId,id]);

  const file=path.join(project,'slides',deckId,'deck.json'),deck=JSON.parse(fs.readFileSync(file,'utf8'));
  const slide=deck.slides.find(s=>s.id===slideId);
  const uptake=slide.elements.find(e=>e.type==='plot'&&e.source?.svgPath?.endsWith('/hdx_uptake_ramp.svg'));
  const bars=slide.elements.find(e=>e.type==='plot'&&e.source?.svgPath?.endsWith('/hdx_half_times.svg'));
  if(!uptake||!bars)throw Error('The Become slide is missing a plot');
  if(uptake.overrides?.['peptide-1-fit.line']?.strokeWidth!==1)throw Error('Panel d did not arrive in its finished state');
  const L=LAYOUT;
  for(const [el,box] of [[uptake,L.left],[bars,L.right]])Object.assign(el,{x:box.x,y:box.y??L.top,width:box.w,height:box.height??L.height,contentScale:L.scale});
  slide.elements=[uptake,bars];
  deck.stage={...L.stage};
  slide.name='Curves become half-times';
  fs.writeFileSync(file,JSON.stringify(deck,null,2));
  run(['set-slide',deckId,slideId,'--background','#ffffff']);
  // Title and subtitle in Figure 1's typeface (Arial); add-text sizes are canvas px (pt x 4/3).
  const titles=[[L.title,700,'#100f0f'],[L.subtitle,400,'#6f6e69']].map(([t,weight,color])=>run(['add-text',deckId,slideId,t.text,'--x',String(t.x),'--y',String(t.y),'--width',String(t.w),'--font-size',String(t.size),'--weight',String(weight),'--color',color,'--sizing','auto-h']).match(/text_[a-z0-9_]+/)[0]);
  const again=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const el of again.slides.find(s=>s.id===slideId).elements)if(titles.includes(el.id))el.fontFamily='Arial';
  fs.writeFileSync(file,JSON.stringify(again,null,2));
  const check=run(['validate-deck',deckId]);
  if(!/valid|✓/i.test(check))throw Error('Deck does not validate: '+check);
  return {deckId,slideId,uptake:uptake.id,bars:bars.id};
}

/** The Become that "slide-become" makes on camera, written into the deck exactly as the app
 *  writes it there (one step, one hand-off track: the six curve lines to the six bars, pair auto,
 *  Smooth), with the timing that take gives it on the timeline (2.4 s, starting at 0.6 s).
 *  "slide-animator" starts from it. */
export function addBecomeStep(project,{deckId,slideId,uptake,bars},{start=600,duration=2400}={}){
  const file=path.join(project,'slides',deckId,'deck.json'),deck=JSON.parse(fs.readFileSync(file,'utf8'));
  const slide=deck.slides.find(s=>s.id===slideId);
  slide.beats=[slide.beats[0],{id:'beat_tourbecome_1',label:'Beat 1',advance:'click',tracks:[{
    id:'track_tourbecome_1',target:uptake,preset:'transform',duration,
    to:{become:{ref:{element:bars,parts:[1,2,3,4,5,6].map(i=>`peptide-${i}-half-time.bar.0`)},mode:'handoff',pair:'auto',reveal:'flip'},state:{}},
    parts:[1,2,3,4,5,6].map(i=>`peptide-${i}-fit.line`),start,easing:'smooth'}]}];
  fs.writeFileSync(file,JSON.stringify(deck,null,2));
}
