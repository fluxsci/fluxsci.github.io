/** Clip (Paper 4): the journal style is a menu choice.
 *
 *  The manuscript ("Reading a protein across scales", from _paper.mjs) is open in Paper at 150%
 *  text on its Abstract. Alt+E → Tab to Style → N (Nature; the dialog remembered Nature
 *  Communications) → its one-line description → Enter: Quarto + LaTeX render a submission PDF
 *  (about 5 s, held close on the progress box) and the export summary lists what Flux did for
 *  Nature. Again, briskly, for B (bioRxiv preprint). Back to the Abstract, unchanged. Keyboard
 *  only; every key has a badge.
 *
 *  What is NOT shown, and why: Flux has no viewer for its own exports. Reader opens only library
 *  papers (by citekey), the export summary's only file action is "Reveal file" (the system file
 *  manager), and Paper's Preview renders the house style, not the journal's. So the two PDFs
 *  cannot be shown inside the Flux window; the summaries are the app's own account of the
 *  difference. (The PDFs are real and are written to exports/ on every take.)
 *
 *  Stage environment: NO_COLOR=1, so Quarto's log lines in the progress box are plain text (with
 *  colour on, Flux shows Quarto's raw ANSI escapes there: a bug, reported). The TeX font cache is
 *  built in prepare, so the first export does not spend 5 s on "luaotfload | db".
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {preparePaper} from './_paper.mjs';

const DIALOG='.export-dialog',STYLE=DIALOG+' select[aria-label="Journal style"]',SUMMARY='[data-export-summary]';
const PROGRESS='.export-progress',EXPORT_BTN='.statusbar .mainrow button.seg:not(.corrections):not(.count)';
/** The paragraph the clip opens and closes on. */
const PARAGRAPH='A protein can be described at many scales';

/** Warm what a first journal export would otherwise build on camera (TeX's font database and
 *  Quarto's own first-run caches), inside the stage's isolated HOME. */
function warm(home){
  const env={...process.env,HOME:home,XDG_CONFIG_HOME:path.join(home,'.config'),NO_COLOR:'1'};
  execFileSync('luaotfload-tool',['--update'],{env,stdio:'ignore'});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flux-warm-'));
  try{
    fs.writeFileSync(path.join(dir,'w.qmd'),'---\ntitle: w\npdf-engine: lualatex\n---\n\nWarm.\n');
    execFileSync('quarto',['render','w.qmd','--to','pdf'],{cwd:dir,env,stdio:'ignore'});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

/** The bounding box of a run of text inside the editor (first client rect of a Range). */
const textBox=(page,text)=>page.evaluate(text=>{
  const walker=document.createTreeWalker(document.querySelector('.cm-content'),NodeFilter.SHOW_TEXT);
  for(let n;(n=walker.nextNode());){const i=n.data.indexOf(text);if(i<0)continue;
    const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+text.length);const q=r.getClientRects()[0];
    return q?{x:q.x,y:q.y,w:q.width,h:q.height}:null;}
  return null;
},text);

export default {
  window:{width:1440,height:1080},

  prepare(project){
    preparePaper(project);
    process.env.NO_COLOR='1'; // inherited by the app the stage launches next
    warm(path.join(path.dirname(project),'home'));
  },

  async setup(ctx){
    const {page,need,rect,sleep,boxes,WIDTH,HEIGHT}=ctx;
    await need('editor',()=>page.evaluate(()=>!!document.querySelector('.cm-content')),60000);
    await sleep(1500);
    // Spelling squiggles off (the status bar's "Local" toggle), text at 150%.
    const local=await need('Local toggle',()=>rect('.statusbar button.corrections'));
    await page.mouse.click(local.x+local.w/2,local.y+local.h/2);
    await need('corrections off',()=>page.evaluate(()=>document.querySelector('.statusbar button.corrections')?.dataset.correctionStatus==='off'),8000);
    await page.click('.cm-content');
    for(let i=0;i<3;i++){await page.keyboard.press('Control+Equal');await sleep(250);}
    await need('150% text',()=>page.evaluate(()=>document.querySelector('.statusbar [data-text-scale]')?.dataset.textScale==='150'));
    // The style the dialog remembers for this project starts on Nature Communications, so the
    // clip's first pass is a real change of style and "N" lands on Nature (the menu's type-ahead
    // searches onward from the current item; house style would also need two more Tab stops).
    await page.keyboard.press('Alt+e');
    await need('export dialog',()=>rect(DIALOG));
    await page.selectOption(STYLE,'nature-communications');
    await sleep(300);
    await page.keyboard.press('Escape');
    await need('dialog closed',async()=>!await rect(DIALOG));
    // The Abstract, with the caret at its start, centred in the editor: after a journal export the
    // editor reloads the .qmd (Flux rewrites it for Quarto and restores it) and scrolls the caret
    // to the centre, so a view that already has it there does not jump. (Reported as a bug.)
    await page.evaluate(()=>{document.querySelector('.cm-scroller').scrollTop=0;});
    await sleep(500);
    boxes.para=await need('abstract',()=>textBox(page,PARAGRAPH));
    await page.mouse.click(boxes.para.x+1,boxes.para.y+boxes.para.h/2);
    await sleep(400);
    const centre=await page.evaluate(()=>{const s=document.querySelector('.cm-scroller').getBoundingClientRect();return s.y+s.height/2;});
    const caret=await page.evaluate(()=>getSelection().getRangeAt(0).getBoundingClientRect().y);
    await page.evaluate(d=>{document.querySelector('.cm-scroller').scrollTop+=d;},Math.round(caret-centre+14));
    await sleep(700);
    boxes.scrollTop=await page.evaluate(()=>document.querySelector('.cm-scroller').scrollTop);
    boxes.para=await textBox(page,PARAGRAPH);
    boxes.heading=await page.evaluate(()=>{const l=[...document.querySelectorAll('.cm-line')].find(l=>/^(# )?Abstract$/.test(l.textContent.trim()));const r=l.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    boxes.col=await rect('.editor-col');
    boxes.status=await rect('.statusbar');
    await ctx.place({x:Math.round(boxes.col.x+boxes.col.w-34),y:Math.round(boxes.heading.y+boxes.heading.h/2)});
    boxes.rest=ctx.at;
    boxes.cover={x:0,y:40,w:WIDTH,h:HEIGHT-40};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {page,need,rect,sleep,key,mark,boxes}=ctx;
    const styleValue=()=>page.$eval(STYLE,s=>s.value);
    const top=()=>page.evaluate(()=>document.querySelector('.cm-scroller').scrollTop);
    const visible=()=>page.evaluate(()=>[...document.querySelectorAll('.cm-line')].filter(l=>{const r=l.getBoundingClientRect();return r.bottom>60&&r.top<1060;}).map(l=>l.textContent).join('\n'));
    const docBefore=await visible();
    const where=[0.86,0.1];

    /** One pass: Alt+E, Tab to the Style menu, a letter picks the journal, Enter exports.
     *  (The native list is not opened: on this X display it paints a black box for a third of a
     *  second before Chromium draws it, an artifact of the recording, not of Flux.) */
    const pass=async(want,letter,tag,{read,hold,blurbText})=>{
      await key('Alt+e',{label:'Alt+E',where});mark('dialog'+tag);
      await need('export dialog',()=>rect(DIALOG));
      await sleep(tag==='1'?500:350);
      for(let i=0;i<4&&!await page.evaluate(()=>document.activeElement?.matches('select[aria-label="Journal style"]'));i++){
        await key('Tab',{label:'Tab',where});await sleep(tag==='1'?210:180);
      }
      if(!await page.evaluate(()=>document.activeElement?.matches('select[aria-label="Journal style"]')))throw Error('Tab did not reach the Style menu');
      await sleep(tag==='1'?200:120);
      await key(letter,{label:letter.toUpperCase(),where});mark('chose'+tag);
      await need(want+' chosen',async()=>await styleValue()===want);
      boxes['dialog'+tag]=await rect(DIALOG);
      boxes['blurb'+tag]=await page.evaluate(s=>{const h=document.querySelector(s+' .hint');const r=h.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},DIALOG);
      if(!(await page.$eval(DIALOG,d=>d.innerText)).includes(blurbText))throw Error('No '+want+' description');
      await sleep(read);
      await key('Enter',{label:'enter',where});mark('export'+tag);
      boxes['progress'+tag]=await need('progress',()=>rect(PROGRESS),4000);
      await need('export finished',()=>page.evaluate(([p,s])=>!document.querySelector(p)&&!!document.querySelector(s),[PROGRESS,SUMMARY]),30000);
      mark('summary'+tag);
      boxes['summary'+tag]=await rect(SUMMARY);
      boxes['did'+tag]=await page.evaluate(s=>{const d=[...document.querySelectorAll(s+' details')].find(d=>/What Flux did/.test(d.querySelector('summary').textContent));const r=d.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},SUMMARY);
      if(await top()!==boxes.scrollTop)throw Error('The editor scrolled during the export: '+await top());
      await sleep(hold);
      await key('Enter',{label:'enter',where});mark('done'+tag);
      await need('summary closed',async()=>!await rect(SUMMARY));
    };

    mark('start');
    await sleep(600);
    await pass('nature','n','1',{read:1100,hold:3200,blurbText:'Superscript citations'});
    await sleep(250);
    await pass('biorxiv','b','2',{read:850,hold:2300,blurbText:'your citation style kept'});
    if(await visible()!==docBefore)throw Error('The manuscript changed');
    await need('toasts gone',()=>page.evaluate(()=>![...document.querySelectorAll('[class*=toast]')].some(n=>n.offsetParent&&/Export/.test(n.textContent))),9000);
    mark('back');
    await sleep(1000);
    mark('end');
  },

  /** The Abstract; in on the dialog and the style's description; down to the progress box while
   *  it renders; the summary, close on what Flux did; the same, brisker, for bioRxiv; the
   *  Abstract again. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,WIDTH,HEIGHT}=ctx,within=b.cover;
    const open=frame(b.col.x+20,b.col.x+b.col.w-12,{top:b.heading.y-26,within});
    const dialog=d=>frame(d.x-20,d.x+d.w+20,{top:d.y-18,within});
    const blurb=h=>frame(h.x-84,h.x+h.w+14,{top:h.y-62,within}); // the Style menu and its one-line description
    // the progress box ("Exporting PDF…", Quarto's latest line) beside the status bar's "Exporting…"
    const progress=p=>frame(WIDTH-2-520,WIDTH-2,{bottom:HEIGHT-4,within});
    const did=(s,d)=>frame(s.x-16,s.x+s.w+16,{top:s.y-12,within});
    // While a render runs (about 5 s) the picture stays alive: the whole manuscript column with
    // the progress box at lower right, then a slow push in on the box, arriving as it finishes.
    // (Orchestrator edit: the close frame alone held cropped words for 5 s, twice.)
    const waiting=frame(b.col.x+20,WIDTH-4,{bottom:HEIGHT-4,within});
    return [
      [m.start,open],[m.dialog1+40,open],[m.dialog1+750,dialog(b.dialog1)],
      [m.chose1+100,dialog(b.dialog1)],[m.chose1+700,blurb(b.blurb1)],
      [m.export1+60,blurb(b.blurb1)],[m.export1+750,waiting],
      [m.export1+1500,waiting],[m.summary1-250,progress(b.progress1)],
      [m.summary1+60,progress(b.progress1)],[m.summary1+650,did(b.summary1,b.did1)],
      // leave the summary for the prose just before it closes, so the front matter behind it is never framed
      [m.done1-420,did(b.summary1,b.did1)],[m.done1+60,open],
      [m.dialog2+40,open],[m.dialog2+600,dialog(b.dialog2)],
      [m.chose2+60,dialog(b.dialog2)],[m.chose2+600,blurb(b.blurb2)],
      [m.export2+60,blurb(b.blurb2)],[m.export2+700,waiting],
      [m.export2+1300,waiting],[m.summary2-250,progress(b.progress2)],
      [m.summary2+60,progress(b.progress2)],[m.summary2+400,did(b.summary2,b.did2)],
      [m.done2-420,did(b.summary2,b.did2)],[m.done2+60,open],[m.end,open],
    ];
  },
};
