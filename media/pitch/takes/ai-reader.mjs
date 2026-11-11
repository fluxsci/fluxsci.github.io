/** Clip (AI 4): in Reader, ask the paper.
 *
 *  The AlphaFold paper (Jumper et al. 2021, Nature 596:583, CC BY 4.0) open in Reader at the
 *  passage that defines pLDDT (page 2: "our confidence measure, the predicted local-distance
 *  difference test (pLDDT), reliably predicts the Cα local-distance difference test (lDDT-Cα)
 *  accuracy of the corresponding prediction"). On camera the reader selects it, clicks
 *  "✦ Annotate this passage" and asks heron, a Claude Code session connected to the project
 *  (agent.mjs), what a score below 50 means for the low-confidence stretches of Figure 1a. heron
 *  claims the note, marks the passage with a yellow highlight carrying its short answer (a real Reader
 *  highlight, written with add_highlight and shown live in the Highlights pane), answers in the
 *  note's thread in the Inbox (Alt+Q) and resolves it. The clip ends on the marked passage.
 *
 *  The agent's work is Claude's own, done for this exact request: it read the open paper's text
 *  (get_paper_text): Jumper et al. define pLDDT as a per-residue predictor of lDDT-Cα accuracy
 *  (fit lDDT-Cα = 0.997 x pLDDT - 1.17, Fig. 2c) and set no threshold at 50; they refer to "the
 *  companion paper" (ref. 39, Tunyasuvunakool et al. 2021, Nature 596:590), whose text it read
 *  next: "long regions with pLDDT < 50 adopt a readily identifiable ribbon-like appearance, and
 *  should not be interpreted as structures but rather as a prediction of disorder". Figure 1a
 *  is the AlphaFold DB model of human p53 (P04637, model v6): the residues below 50 lie in
 *  1-11, 29-70 (the N-terminal transactivation and proline-rich region), 295-321 (the linker
 *  after the DNA-binding domain) and 358-383 (the C-terminal tail). The script below replays
 *  exactly those calls, that highlight and that reply.
 *
 *  Layout: an 840 x 700 window; Reader's left sidebar hidden, the Highlights pane on the right;
 *  the PDF at a zoom where the page's right column reads in a ~500 px frame. Attach view is off
 *  (_aitext.mjs): the thread holds just the request and the reply.
 */
import {preparePaper} from './_paper.mjs';
import {connectAgent,toastTexts} from './_ai.mjs';
import {addressAgent,lastMessage,requestBox,threadHas,rowBox,SURFACE,COMPOSER,INBOX} from './_aitext.mjs';

const KEY='jumperHighlyAccurateProtein2021',COMPANION='tunyasuvunakoolHighlyAccurateProtein2021';
const PASSAGE='the predicted local-distance difference test (pLDDT), reliably predicts the Cα local-distance difference test (lDDT-Cα) accuracy of the corresponding prediction';
const REQUEST='What does a score below 50 mean for the low-confidence parts of my Fig. 1a?';
const REPLY='This paper defines pLDDT only as an estimate of local accuracy (lDDT-Cα). The reading of scores below 50 comes from its companion paper, **Tunyasuvunakool et al. 2021**: long regions below 50 "should not be interpreted as structures but rather as a prediction of disorder".\n\n'+
  'So the p53 tails and linker that fall below 50 in your **Fig. 1a** are most likely disordered, not mispredicted.';
const NOTE='Below 50: a prediction of disorder, not a structure (Tunyasuvunakool et al. 2021). In Fig. 1a: the p53 tails and linker.';
const ZOOM=+(process.env.READER_ZOOM||150);

/** Screen box of `sub` inside the PDF text layer (it may span lines: one box per line). */
const textBoxes=(page,sub)=>page.evaluate(sub=>{
  const spans=[...document.querySelectorAll('.textLayer span')].filter(s=>s.firstChild?.nodeType===3);
  let all='';const map=[];for(const s of spans){map.push([s,all.length]);all+=s.textContent+' ';}
  const i=all.indexOf(sub);if(i<0)return null;const j=i+sub.length;
  const out=[];for(const [s,at] of map){const a=Math.max(i,at),b=Math.min(j,at+s.textContent.length);if(a>=b)continue;
    const r=document.createRange();r.setStart(s.firstChild,a-at);r.setEnd(s.firstChild,b-at);const q=r.getBoundingClientRect();out.push({x:q.x,y:q.y,w:q.width,h:q.height});}
  return out;},sub);
const zoomText=page=>page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.title==='Fit width (0)')?.textContent.trim());
/** The Highlights pane's entry whose text includes `text`. */
const highlightEntry=(page,text)=>page.evaluate(t=>{const n=[...document.querySelectorAll('*')].filter(n=>n.children.length>0&&n.children.length<8&&n.textContent.includes(t)&&n.getBoundingClientRect().x>400).sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},text);

export default {
  window:{width:840,height:700},
  prepare(project){preparePaper(project);},

  async setup(ctx){
    const {page,rect,need,sleep,boxes,WIDTH,HEIGHT}=ctx;
    await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Library]')),60000);
    await sleep(1500);
    // Library → the AlphaFold paper's Read PDF.
    await page.evaluate(()=>document.querySelector('button[aria-label=Library]').click());
    const read=await need('the AlphaFold row',()=>page.evaluate(()=>{const t=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&/^Jumper, Evans/.test(n.textContent.trim()));let row=t;while(row&&!row.querySelector('button[aria-label="Read PDF"]'))row=row.parentElement;const b=row?.querySelector('button[aria-label="Read PDF"]');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}),20000);
    await page.mouse.click(read.x,read.y);
    await need('the PDF text',()=>textBoxes(page,'our confidence'),30000);
    await sleep(1500);
    // Left sidebar off, Highlights on the right; zoom in.
    if(await page.evaluate(()=>/REFERENCES/i.test(document.body.innerText)&&[...document.querySelectorAll('*')].some(n=>n.children.length===0&&/^REFERENCES$/i.test(n.textContent.trim())&&n.getBoundingClientRect().width))){await page.keyboard.press('Control+b');await sleep(700);}
    for(let i=0;i<20&&parseInt(await zoomText(page))<ZOOM;i++){await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Zoom in').click());await sleep(800);}
    await sleep(1500);
    boxes.zoom=await zoomText(page);
    if(parseInt(boxes.zoom)!==ZOOM)throw Error('Reader zoom is '+boxes.zoom);
    // The passage: scroll it into place, the page's right column flush with the pane's left.
    await page.evaluate(()=>{const n=[...document.querySelectorAll('.textLayer span')].find(n=>/measure, the predicted local-distance/.test(n.textContent));n.scrollIntoView({block:'center',inline:'nearest'});});
    await sleep(1200);
    boxes.pane=await need('Highlights pane',()=>page.evaluate(()=>{const t=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&/^HIGHLIGHTS$/i.test(n.textContent.trim())&&n.getBoundingClientRect().width);if(!t)return null;let p=t;while(p&&p.getBoundingClientRect().height<400)p=p.parentElement;const r=p.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    const scroller=await page.evaluate(()=>{const s=[...document.querySelectorAll('*')].find(n=>n.querySelector?.('.textLayer')&&n.scrollHeight>n.clientHeight+50&&getComputedStyle(n).overflowY!=='visible');s.id||(s.id='pitch-reader-scroll');return s.id;});
    const place=async()=>{
      const col=await textBoxes(page,'bone prediction is accurate (Fig. 2b) and we show that our confidence');
      const line=col[0];
      await page.evaluate(([id,dx,dy])=>{const s=document.getElementById(id);s.scrollLeft+=dx;s.scrollTop+=dy;},[scroller,line.x+line.w-(boxes.pane.x-14),line.y-300]);
      await sleep(900);
    };
    await place();await place();
    boxes.passage=await need('the passage',()=>textBoxes(page,PASSAGE));
    boxes.column=await page.evaluate(()=>{const ls=[...document.querySelectorAll('.textLayer span')].filter(s=>/bone prediction is accurate|to an uncurated collection|structures; in this dataset/.test(s.textContent)).map(s=>s.getBoundingClientRect());if(!ls.length)return null;const x=Math.min(...ls.map(r=>r.x)),r=Math.max(...ls.map(r=>r.x+r.width));return {x,w:r-x};});
    if(!boxes.column||boxes.column.x<4)throw Error('The right column does not fit: '+JSON.stringify(boxes.column));

    // The agent.
    const agent=await connectAgent(ctx);
    const script=[
      {pause:600},
      {claim:true,mark:'claimed'},
      {verb:'get_paper_text',args:{key:KEY}},
      {verb:'get_paper_text',args:{key:COMPANION}},
      {verb:'add_highlight',args:{key:KEY,page:2,quote:PASSAGE,prefix:'our confidence measure, ',suffix:' (Fig. 2c)',color:'yellow',note:NOTE},mark:'highlight'},
      {until:()=>ctx.inboxOpen},
      {pause:400},
      {reply:REPLY,mark:'reply'},
      {pause:2500},
      {resolve:true,mark:'resolved'},
    ];
    agent.play({expect:/^What does a score below 50/,timeoutMs:3600000,onStep:(i,s)=>{if(s.mark)ctx.mark(s.mark);},script});
    boxes.composer=await addressAgent(ctx,'heron');
    // Annotate (opened from the selection) closes on the passage again; it must stand clear of
    // the composer.
    const last=boxes.passage.at(-1);
    if(last.y+last.h>boxes.composer.y-6)throw Error('The passage runs under the composer');
    // Rest in the gap between the paragraph and the next heading (a click there drops a selection).
    const end=await need('the paragraph end',()=>textBoxes(page,'for confirmation that this high accuracy extends to new folds'));
    const head=await need('the next heading',()=>textBoxes(page,'The AlphaFold network'));
    await ctx.place({x:Math.round(boxes.column.x+boxes.column.w*0.42),y:Math.round((end.at(-1).y+end.at(-1).h+head[0].y)/2)});
    await sleep(1500);
    boxes.cover={x:12,y:44,w:WIDTH-24,h:HEIGHT-46};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,down,up,key,type,mark,agent,lib}=ctx,rest=ctx.at;
    mark('start');
    await sleep(700);
    const p=await textBoxes(page,PASSAGE),first=p[0],last=p.at(-1);
    await glide({x:first.x+1,y:first.y+first.h/2},{bow:0.12});
    await sleep(220);
    await down();await glide({x:last.x+last.w-1,y:last.y+last.h/2},{ms:1000,bow:0.03});await sleep(120);await up();mark('selected');
    const sel=await page.evaluate(()=>getSelection().toString().replace(/\s+/g,' ').trim());
    if(!sel.startsWith('the predicted local-distance')||!sel.endsWith('corresponding prediction'))throw Error('Selected '+JSON.stringify(sel));
    const ask=await need('✦ Annotate this passage',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.title==='Annotate this passage'&&b.getBoundingClientRect().width);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    boxes.ask=ask;
    await sleep(600);
    await glide({x:ask.x+ask.w*0.5,y:ask.y+ask.h/2},{bow:-0.1});
    await sleep(220);await click();mark('annotate');
    boxes.composer=await need('Annotate',()=>rect(COMPOSER));
    const chip=await need('the passage as the target',()=>page.evaluate(()=>[...document.querySelectorAll('.annotation-composer .target-chip')].map(n=>n.textContent).join('|')));
    if(!/predicted local-distance/.test(chip))throw Error('Annotate targets '+chip);
    await sleep(500);
    // The pointer stays still on the frozen view (a move over it would label the target under it).
    mark('type');
    await type(REQUEST,{per:46});
    const to=await page.evaluate(()=>document.querySelector('.annotation-composer .to-pill')?.textContent??'');
    if(!/heron/.test(to))throw Error('The note is not addressed to heron: '+to);
    await sleep(800);
    await key('Enter',{label:'enter',where:[0.16,0.12]});mark('sent');
    await need('Annotate closed',async()=>!(await rect(SURFACE)));
    // Back to reading: a click between paragraphs drops the selection.
    await sleep(300);
    await glide(rest,{bow:-0.1});
    await sleep(200);await click();mark('deselect');
    if(await page.evaluate(()=>getSelection().toString().trim()))throw Error('The selection did not clear');
    await need('claimed',async()=>(await toastTexts(ctx)).some(t=>t.startsWith('heron claimed')),15000);
    mark('claimedSeen');
    boxes.entry=await need('the highlight and its note',()=>highlightEntry(page,'Below 50: a prediction of disorder'),30000);
    mark('marked');
    await sleep(2000);
    // The Inbox: heron's answer.
    await key('Alt+q',{label:'Alt+Q',where:[0.8,0.9]});mark('inbox');
    boxes.inbox=await need('Inbox',()=>rect(INBOX));
    const row=await need('the note in the list',()=>rowBox(ctx,'What does a score'));
    await sleep(450);
    await glide({x:row.x+row.w*0.5,y:row.y+row.h*0.42},{bow:0.1});
    await sleep(200);await click();
    await need('the note selected',()=>page.evaluate(()=>/Claimed by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')));
    boxes.detail=await rect('.detail');
    ctx.inboxOpen=true;
    await sleep(250);
    await glide({x:boxes.detail.x-60,y:boxes.detail.y+boxes.detail.h-50},{bow:-0.1});
    await need('the reply in the thread',()=>threadHas(ctx,'defines pLDDT only'),30000);
    mark('replySeen');
    boxes.request=await requestBox(ctx);boxes.reply=await lastMessage(ctx);
    await need('resolved',()=>page.evaluate(()=>/Resolved by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')),20000);
    await agent.done;
    const read=Math.max(0,ctx.marks.replySeen+9000-ctx.pageTime());await sleep(read);
    await key('Alt+q',{label:'Alt+Q',where:[0.8,0.9]});mark('close');
    await need('Inbox closed',async()=>!(await rect(INBOX)));
    await sleep(400);
    await glide(rest,{bow:-0.12});
    await need('toasts gone',async()=>!(await toastTexts(ctx)).length,10000);
    boxes.entry=await highlightEntry(page,'Below 50: a prediction of disorder');
    mark('reveal');
    await sleep(2200);
    mark('end');
    await agent.close();
  },

  /** The passage; close on the note while it is typed; the passage and its new highlight with
   *  the note beside it; the thread while the answer is read; back to the marked passage. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,lib}=ctx,within=b.cover;
    const P=lib.union(...b.passage);
    const passage=frame(b.column.x-8,b.column.x+b.column.w+10,{cy:P.y+P.h/2+20,within});
    const note=around(b.composer,{pad:14,within});
    const marked=frame(b.pane.x-240,b.pane.x+b.pane.w-14,{top:b.entry.y-16,within});
    const thread=around(lib.union(b.request,b.reply),{pad:18,within});
    return [
      [m.start,passage],[m.annotate+100,passage],[m.type-200,note],
      [m.sent+60,note],[m.sent+800,passage],
      [m.marked+100,passage],[m.marked+900,marked],
      [m.inbox+100,marked],[m.inbox+800,thread],
      [m.close,thread],[m.close+1000,passage],[m.end,passage],
    ];
  },
};
