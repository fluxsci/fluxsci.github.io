/** Shared by the Paper and AI takes: every one starts from the same project.
 *
 *  preparePaper(projectDir, {strip}) sets up the scratch project before the app opens it:
 *  - overlay `tour-paper`: the demo manuscript `paper/reading-a-protein-across-scales.qmd`
 *    ("Reading a protein across scales", a primer built around Figure 1) and its bibliography
 *    `references/library.bib` (the 17 references it cites, all real, DOIs checked on Crossref);
 *  - overlay `tour-library`, copied into the stage's isolated HOME: a demo FluxLib
 *    (`FluxConfig/FluxLib/library.bib` with the same 17 references, and the PDFs of the three
 *    that are CC BY 4.0: Jumper et al. 2021, Tunyasuvunakool et al. 2021, Masson et al. 2019);
 *  - registers the manuscript in project.json (as `flux new-doc` does) and makes it the
 *    project's default document; the owner's planning notes are unregistered in the copy;
 *  - Figure 1 in its finished state (carryOver c, d, e, f, b) with its caption (written with
 *    `flux set-caption`, the CLI's own path into Figure-Meta).
 *
 *  `strip` takes the manuscript back to an earlier draft for a clip that performs a step on
 *  camera: names from STRIP below (each removes exact text; a wrong manuscript throws).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as lib from '../lib.mjs';
import {carryOver,FIGURE,END_STATE} from './_figure1.mjs';

export const DOC='paper/reading-a-protein-across-scales.qmd',TITLE='Reading a protein across scales';
export const FIG_KEY='fig-fig-mw9xvia2yeq4-20';
const here=path.dirname(fileURLToPath(import.meta.url));
const CLI=path.join(os.homedir(),'flux/dist/flux-cli.mjs');

/** Figure 1's caption: a lead, then one sentence per panel (Figure-Meta's blocks). */
export const CAPTION='Six views of proteins, from sequence to dynamics. Panels a and b show public data; panels c–f show simulated data made to illustrate typical behaviour. '+
  '**a**, AlphaFold confidence (pLDDT) along the 393 residues of human p53, shaded by confidence band, with its domains above and secondary structure below. '+
  '**b**, The SARS-CoV-2 spike trimer (PDB 6VSB) as a ribbon and as a molecular surface; the raised receptor-binding domain is orange. Scale bar, 5 nm. '+
  '**c**, Mean B-factor of 60,000 residues binned by burial and conservation; opacity shows how many residues fall in each hexagon. '+
  '**d**, Deuterium uptake of six peptides, from an exposed loop to the buried core, with stretched-exponential fits (points, mean ± s.d.). '+
  '**e**, Michaelis–Menten kinetics without inhibitor and with competitive, non-competitive and uncompetitive inhibition (row by row from top left); dashed, the uninhibited curve. '+
  '**f**, Cα RMSD from the native structure in eight folding simulations (thin lines), with their mean ± s.d.';

/** Earlier drafts: exact text to take out of the manuscript (and, for a citation, the entry
 *  to take out of the project's bibliography so citing it copies it back from the library). */
export const STRIP={
  figure:{text:`![](../fig/renders/fig_mw9xvia2yeq4_20.svg){#${FIG_KEY}}`},     // its line stays, empty
  'fig-a':{text:` (@${FIG_KEY}-a)`},
  'fig-cf':{text:` (@${FIG_KEY}-c-f)`},
  'fig-c':{text:` in @${FIG_KEY}-c`},
  'cite-jumper':{text:' [@jumperHighlyAccurateProtein2021]',bib:'jumperHighlyAccurateProtein2021'},
};

/** The owner's working figures (canvases 1–3) and Figure 1's end-state reference copy. */
const OWNER_FIGURES=['fig-1','fig_mvnzhybbl92a_7','fig_muojkrn06sg8_20','fig_murckp3zpm2p_1171',END_STATE];

export function flux(project,...args){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'flux-cli-home-'));
  try{return execFileSync(process.execPath,[CLI,...args,'--root',project],{cwd:home,env:{...process.env,HOME:home,XDG_CONFIG_HOME:home},encoding:'utf8'});}
  finally{fs.rmSync(home,{recursive:true,force:true});}
}

export function preparePaper(projectDir,{strip=[]}={}){
  carryOver(projectDir,['c','d','e','f','b']);
  lib.applyOverlay(projectDir,'tour-paper');
  // The library lives outside the project, in the stage's isolated HOME.
  fs.cpSync(path.join(here,'../materials/tour-library'),path.join(path.dirname(projectDir),'home'),{recursive:true});
  // The manuscript is the project's one document: the owner's notes and planning documents
  // leave this scratch copy (Paper lists every .qmd under paper/), and the manuscript becomes
  // the default document.
  const file=path.join(projectDir,'project.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const entry of fs.readdirSync(path.join(projectDir,'paper'),{withFileTypes:true})){
    const rel='paper/'+entry.name;
    if(rel===DOC||entry.name==='_quarto.yml')continue;
    if(entry.isDirectory()||/\.(qmd|md)$|\.comments\.json$/.test(entry.name))fs.rmSync(path.join(projectDir,rel),{recursive:true,force:true});
  }
  manifest.supplementary=[];
  // The owner's Context files (ProjectContext, NOTEBOOK, RULES) leave the scratch copy too, so
  // Paper's Documents rail lists only the manuscript.
  fs.rmSync(path.join(projectDir,'Context'),{recursive:true,force:true});
  manifest.manuscript.path=DOC;
  fs.writeFileSync(file,JSON.stringify(manifest,null,2));
  flux(projectDir,'set-caption',FIGURE,CAPTION);
  // Only the tour's figures: the owner's working figures on other canvases and the
  // "EndStateFig 1" reference copy (read by carryOver above) leave the pickers and Figure-Meta.
  for(const id of OWNER_FIGURES)flux(projectDir,'delete-figure',id);
  // Earlier drafts for clips that perform a step on camera.
  const doc=path.join(projectDir,DOC);
  let text=fs.readFileSync(doc,'utf8');
  for(const name of strip){
    const s=STRIP[name];if(!s)throw Error('preparePaper: no strip '+name);
    if(!text.includes(s.text))throw Error('preparePaper: the manuscript has no '+JSON.stringify(s.text));
    text=text.replace(s.text,'');
    if(s.bib){
      const bib=path.join(projectDir,'references/library.bib'),src=fs.readFileSync(bib,'utf8');
      const out=src.split(/\n(?=@)/).filter(e=>!e.startsWith(`@article{${s.bib},`)).join('\n');
      if(out===src)throw Error('preparePaper: no bibliography entry '+s.bib);
      fs.writeFileSync(bib,out);
    }
  }
  fs.writeFileSync(doc,text);
}

// ---- driving Paper ----------------------------------------------------------------------
/** Paper's CodeMirror view, for READING the document and measuring positions (never for
 *  editing on camera). */
const VIEW="document.querySelector('.cm-content').cmTile.view";

/** Switch to Paper and wait for the manuscript; switch the on-device corrections off (their
 *  squiggles under British spellings would read as errors on camera) and set the manuscript's
 *  text size with Ctrl+= (the status-bar slider's own chord), as a writer would. */
export async function openPaper(ctx,{scale=1.5,sidebar,margin}={}){
  const {page,rect,need,sleep}=ctx;
  await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Paper]')),60000);
  await need('Paper',async()=>{if(await rect('.cm-content'))return true;await page.evaluate(()=>document.querySelector('button[aria-label=Paper]').click());await sleep(1500);return rect('.cm-content');},60000);
  await need('the manuscript',()=>page.evaluate(t=>document.querySelector('.cm-content')?.textContent.includes(t),'A protein can be described'),30000);
  await sleep(1500);
  const local=await need('Local toggle',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Local');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,on:/corrections on|warming/i.test(b.title)};}));
  if(local.on){await page.mouse.click(local.x,local.y);await sleep(600);}
  if(await page.evaluate(()=>/corrections on/i.test([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Local')?.title||'')))throw Error('Local corrections did not switch off');
  await collapseContext(ctx);
  const content=await rect('.cm-content');
  await page.mouse.click(content.x+content.w/2,Math.min(700,content.y+content.h-20));await sleep(300);
  const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('flux.paper.textScale')||'{"scale":{"editor":1}}').scale.editor);
  for(let i=0;i<8&&await current()<scale-1e-6;i++){await page.keyboard.press('Control+Equal');await sleep(400);}
  if(Math.abs(await current()-scale)>1e-6)throw Error('Text size is '+await current()+', not '+scale);
  // The file sidebar (Alt+O) and the margin (Ctrl+Shift+B), shown or hidden as asked. The margin's
  // ambient background animates without pause; under a picker's blurred backdrop that costs
  // half a second a frame at 4x, so takes that open pickers hide it.
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('flux.paper.layout')||'{}'));
  if(sidebar!==undefined&&((await layout()).outlinerOpen!==false)!==sidebar){await page.keyboard.press('Alt+o');await sleep(600);}
  if(margin!==undefined&&!!(await layout()).dynMarginOpen!==margin){await page.keyboard.press('Control+Shift+B');await sleep(600);}
  const l=await layout();
  if((sidebar!==undefined&&(l.outlinerOpen!==false)!==sidebar)||(margin!==undefined&&!!l.dynMarginOpen!==margin))throw Error('Paper layout is not as asked: '+JSON.stringify(l));
  await sleep(800);
}

/** The manuscript's text as the editor holds it. */
export const docText=page=>page.evaluate(`${VIEW}.state.doc.toString()`);
/** Screen box of the character before (end) or at (start) the first occurrence of `snippet`,
 *  `nth` occurrences in. */
export const textAt=(page,snippet,{end=false,nth=0}={})=>page.evaluate(([v,snippet,end,nth])=>{
  const view=eval(v),d=view.state.doc.toString();let i=-1;for(let k=0;k<=nth;k++)i=d.indexOf(snippet,i+1);
  if(i<0)return null;const pos=end?i+snippet.length:i,c=view.coordsAtPos(pos,end?-1:1);
  return c&&{x:c.left,y:(c.top+c.bottom)/2,top:c.top,bottom:c.bottom,pos};},[VIEW,snippet,end,nth]);
/** Scroll the manuscript (setup only) so that `snippet` sits at `y`. */
export async function scrollTo(ctx,snippet,y){
  const {page,sleep}=ctx;
  // A first jump from the line's place in the whole document (works for lines not yet drawn).
  await page.evaluate(([v,snippet,y])=>{const view=eval(v),i=view.state.doc.toString().indexOf(snippet);if(i<0)return;
    const s=view.scrollDOM,top=view.lineBlockAt(i).top+view.documentTop-s.getBoundingClientRect().top+s.scrollTop;
    s.scrollTop=top-(y-s.getBoundingClientRect().top);},[VIEW,snippet,y]);
  await sleep(600);
  for(let i=0;i<6;i++){
    const at=await textAt(page,snippet);
    if(at&&Math.abs(at.top-y)<1)return at;
    await page.evaluate(([dy])=>{document.querySelector('.cm-scroller').scrollTop+=dy;},[at?at.top-y:800]);
    await sleep(500);
  }
  const at=await textAt(page,snippet);if(!at||Math.abs(at.top-y)>2)throw Error('Could not scroll to '+snippet);return at;
}
/** The box of the smallest element whose own text is `text` (optionally inside `scope`). */
export const boxOf=(page,text,scope='body')=>page.evaluate(([text,scope])=>{
  const n=[...document.querySelectorAll(scope+' *')].find(n=>n.children.length===0&&n.textContent.trim()===text&&n.getBoundingClientRect().width);
  if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},[text,scope]);

/** Fold the Documents rail's Context group (Flux scaffolds ProjectContext, NOTEBOOK and RULES on
 *  open, so they cannot simply be deleted): no Context file is ever listed in a clip. Needs the
 *  Paper sidebar showing (openPaper calls it before applying `sidebar`). */
export async function collapseContext(ctx){
  const {page,sleep,need}=ctx;
  const listed=()=>page.evaluate(()=>[...document.querySelectorAll('*')].some(n=>n.children.length===0&&/^(Project context|NOTEBOOK|RULES)\b/.test(n.textContent.trim())&&n.getBoundingClientRect().width>0));
  const label=()=>page.evaluate(()=>{const n=[...document.querySelectorAll('button.folder-label')].find(b=>b.title==='Context'&&b.getBoundingClientRect().width);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,open:n.getAttribute('aria-expanded')==='true'};});
  let l=null;try{l=await need('Context group',label,3000);}catch{}
  if(!l){if(await listed())throw Error('Context files are listed but their group was not found');return;}   // the sidebar is hidden
  if(l.open){await page.mouse.click(l.x+l.w/2,l.y+l.h/2);await sleep(600);}
  if((await label()).open||await listed())throw Error('The Context group is still open');
}
