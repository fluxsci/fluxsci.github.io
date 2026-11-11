/** Clip (Paper 5): Flux checks the submission for you.
 *
 *  The manuscript is open in Paper at 150% text, the Outline on the left with each section's
 *  word count (Abstract 205). Alt+J opens Journal Check for Nature in the margin: 7 items, among
 *  them "Summary paragraph is ~205 words; Nature asks for 200 (hard limit 230)". The Outline takes
 *  you to the Abstract; one redundant sentence goes ("Each scale has its own measurement, and each
 *  measurement has its own way of being misread."), the Outline count drops to 189 and Journal
 *  Check drops the finding (6 items).
 *
 *  Why the Outline and not a click on the finding: the abstract-length finding's jump selects the
 *  YAML front matter, not the abstract (compliance.ts uses the "preamble" range, which for a
 *  manuscript with an "# Abstract" heading is the front matter). Reported as a bug.
 */
import fs from 'node:fs';
import path from 'node:path';
import {preparePaper} from './_paper.mjs';

const JC='.jc',OUTLINE='.outline';
const CUT_FROM='Each scale has its own',CUT_TO='This primer walks';

const textBox=(page,text)=>page.evaluate(text=>{
  const walker=document.createTreeWalker(document.querySelector('.cm-content'),NodeFilter.SHOW_TEXT);
  for(let n;(n=walker.nextNode());){const i=n.data.indexOf(text);if(i<0)continue;
    const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const q=r.getClientRects()[0];
    return q?{x:q.x,y:q.y,w:q.width,h:q.height}:null;}
  return null;
},text);
const outlineRow=(page,name)=>page.evaluate(([o,name])=>{
  const b=[...document.querySelectorAll(o+' .oitem')].find(b=>b.textContent.trim().startsWith(name));
  if(!b)return null;const row=b.closest('.orow').getBoundingClientRect(),r=b.getBoundingClientRect();
  return {x:r.x,y:r.y,w:r.width,h:r.height,row:{x:row.x,y:row.y,w:row.width,h:row.height},count:+(b.closest('.orow').querySelector('.ocount')?.dataset.words??NaN)};
},[OUTLINE,name]);
const findings=page=>page.evaluate(jc=>({summary:document.querySelector(jc+' .jc-summary')?.textContent.trim()??'',items:[...document.querySelectorAll(jc+' .jc-msg')].map(b=>b.textContent.trim())}),JC);

export default {
  window:{width:1440,height:1080},
  prepare(project){
    preparePaper(project);
    // The owner's own context notes (Context/: project context, NOTEBOOK, RULES) leave the copy.
    fs.rmSync(path.join(project,'Context'),{recursive:true,force:true});
  },

  async setup(ctx){
    const {page,need,rect,sleep,boxes,WIDTH,HEIGHT}=ctx;
    await need('editor',()=>page.evaluate(()=>!!document.querySelector('.cm-content')),60000);
    await sleep(1500);
    const local=await need('Local toggle',()=>rect('.statusbar button.corrections'));
    await page.mouse.click(local.x+local.w/2,local.y+local.h/2);
    await need('corrections off',()=>page.evaluate(()=>document.querySelector('.statusbar button.corrections')?.dataset.correctionStatus==='off'),8000);
    await page.click('.cm-content');
    for(let i=0;i<3;i++){await page.keyboard.press('Control+Equal');await sleep(250);}
    await need('150% text',()=>page.evaluate(()=>document.querySelector('.statusbar [data-text-scale]')?.dataset.textScale==='150'));
    // Start in the Introduction, so the Outline has somewhere to take us.
    for(let i=0;i<60;i++){
      const y=await page.evaluate(()=>{const l=[...document.querySelectorAll('.cm-line')].find(l=>/^(# )?Introduction$/.test(l.textContent.trim()));return l?l.getBoundingClientRect().y:null;});
      if(y!==null&&Math.abs(y-300)<3)break;
      await page.evaluate(d=>{document.querySelector('.cm-scroller').scrollTop+=d;},y===null?400:y-300);
      await sleep(200);
    }
    await sleep(800);
    boxes.abstractRow=await need('Abstract in the Outline',()=>outlineRow(page,'Abstract'));
    if(boxes.abstractRow.count!==205)throw Error('The Outline does not count 205 words in the Abstract: '+boxes.abstractRow.count);
    boxes.outline=await rect(OUTLINE);
    const rail=await page.evaluate(()=>document.querySelector('.leftrail')?.innerText??'');
    if(/NOTEBOOK|RULES|Project context/.test(rail))throw Error('The owner\'s Context files are in the rail');
    boxes.col=await rect('.editor-col');
    await ctx.place({x:Math.round(boxes.col.x+boxes.col.w*0.55),y:Math.round(HEIGHT*0.55)});
    boxes.rest=ctx.at;
    boxes.cover={x:0,y:40,w:WIDTH,h:HEIGHT-40};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {page,need,rect,sleep,glide,click,key,hold,release,mark,boxes,lib}=ctx;
    mark('start');
    await sleep(1200);
    await key('Alt+j',{label:'Alt+J',where:[0.5,0.9]});mark('check');
    boxes.jc=await need('Journal Check',()=>rect(JC));
    const before=await need('findings',async()=>{const f=await findings(page);return f.items.length?f:null;});
    if(!/^7 items/.test(before.summary)||!before.items.some(t=>/^Summary paragraph is ~205 words; Nature asks for 200/.test(t)))throw Error('Unexpected Journal Check:\n'+JSON.stringify(before,null,1));
    boxes.list=await rect(JC+' .jc-list');
    await sleep(2600);

    // To the Abstract, by the Outline.
    mark('outlineGo');
    await glide(lib.centre(boxes.abstractRow),{bow:0.1});
    await sleep(220);await click();mark('jump');
    await need('abstract on top',async()=>{const b=await textBox(page,CUT_FROM);return b&&b.y>100&&b.y<700;});
    await sleep(900);
    const a=await textBox(page,CUT_FROM),b=await textBox(page,CUT_TO);
    boxes.cutFrom=a;boxes.cutTo=b;
    boxes.para=await page.evaluate(()=>{const l=[...document.querySelectorAll('.cm-line')].find(l=>l.textContent.startsWith('A protein can be described'));const r=l.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    // The cut, from the caret before "Each" to the caret before "This".
    await glide({x:a.x+1,y:a.y+a.h/2},{bow:-0.12});
    await sleep(220);await click();mark('cutStart');
    await sleep(380);
    await hold('Shift',{where:[0.84,0.88]});
    await sleep(200);
    await glide({x:b.x+1,y:b.y+b.h/2},{bow:0.1});
    await sleep(200);await click();mark('selected');
    await release('Shift');
    const selected=await page.evaluate(()=>getSelection().toString());
    if(selected!=='Each scale has its own measurement, and each measurement has its own way of being misread. ')throw Error('Selected '+JSON.stringify(selected));
    await sleep(900);
    await key('Backspace',{label:'Backspace',where:[0.84,0.88]});mark('cut');
    await need('sentence gone',async()=>!await textBox(page,CUT_FROM));
    await need('Journal Check updated',async()=>{const f=await findings(page);return /^6 items/.test(f.summary)&&!f.items.some(t=>/Summary paragraph/.test(t));},5000);
    const row=await need('Outline recount',async()=>{const r=await outlineRow(page,'Abstract');return r&&r.count<200?r:null;});
    boxes.count=row.count;
    await sleep(500);
    await glide({x:boxes.col.x+boxes.col.w-28,y:ctx.at.y+40},{bow:0.1}); // off the text
    await sleep(600);
    mark('result');
    await sleep(2400);
    mark('jcAfter');
    await sleep(1800);
    await glide(boxes.rest,{bow:-0.12});
    mark('wide');
    await sleep(1900);
    mark('end');
  },

  /** The whole window; in on Journal Check; across to the Outline and the Abstract; close on the
   *  sentence while it is cut; out to the Outline's new count; back to Journal Check, one item
   *  fewer; the whole window. */
  camera(ctx){
    const {boxes:b,marks:m,frame,WIDTH,HEIGHT}=ctx,within=b.cover;
    const whole=frame((WIDTH-1384)/2,(WIDTH+1384)/2,{top:40,within});
    const jc=frame(b.jc.x+b.jc.w+12-490,b.jc.x+b.jc.w+12,{top:b.jc.y-30,within}); // close: the findings read on a phone
    const outline=frame(b.outline.x-8,b.outline.x+660,{cy:b.abstractRow.y+60,within});
    const cy=(b.cutFrom.y+b.cutTo.y)/2+b.cutFrom.h/2;
    const text=frame(b.para.x-34,b.para.x+b.para.w+34,{cy,within});
    const count=frame(b.outline.x-8,b.outline.x+660,{cy:(cy+b.abstractRow.y)/2,within});
    return [
      [m.start,whole],[m.start+500,whole],[m.check+1100,jc],
      [m.outlineGo,jc],[m.outlineGo+1000,outline],
      [m.jump+250,outline],[m.jump+1200,text],
      [m.result,text],[m.result+900,count],
      [m.jcAfter-200,count],[m.jcAfter+700,jc],
      [m.wide,jc],[m.wide+1100,whole],[m.end,whole],
    ];
  },
};
