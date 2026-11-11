/** Clip (AI 3): in Paper, ask what the literature says.
 *
 *  The manuscript "Reading a protein across scales" (_paper.mjs), one draft earlier: the claim
 *  that very low pLDDT predicts disorder across the human proteome has no citation yet. On
 *  camera the writer selects the claim, opens Annotate (Ctrl+Shift+M) and asks heron, a Claude
 *  Code session connected to the project (agent.mjs), "What should I cite for this, and does
 *  anyone disagree?". heron claims the note; the citation appears in the sentence (a real
 *  manuscript edit through Flux's verbs, live-reloaded by the open editor); its answer arrives in
 *  the note's thread in the Inbox (Alt+Q), and it resolves the note.
 *
 *  The agent's work is Claude's own, done on an explore stage for this exact request: it searched
 *  the user's library (search_references: Tunyasuvunakool et al. 2021 and Ruff & Pappu 2021 are
 *  in it), read the Tunyasuvunakool paper's text (get_paper_text: "pLDDT to be a competitive
 *  disorder predictor ... with an area under the curve (AUC) of 0.897" on the CAID benchmark),
 *  searched OpenAlex (search_world) and read the abstracts of Zhao, Ghadermarzi & Kurgan 2023
 *  (CSBJ 21:3248, doi:10.1016/j.csbj.2023.06.001: AlphaFold2's disorder AUC 0.77 on 646
 *  proteins, statistically outperformed by several dedicated disorder predictors) and Alderson et
 *  al. 2023 (PNAS 120:e2304302120, doi:10.1073/pnas.2304302120: AlphaFold2 assigns confident
 *  structures to nearly 15% of human IDRs). It cited the supporting paper with cite_doi
 *  (10.1038/s41586-021-03828-1, which copies the library's entry into the project bibliography)
 *  and inserted [@key] after the claim with get_manuscript / set_manuscript. The script below
 *  replays exactly those calls and that reply.
 *
 *  Layout: an 840 x 700 window, Paper's side panel (Alt+O) and margin (Ctrl+Shift+B) hidden, text
 *  at 150% (Ctrl+=), so the paragraph fills a ~700 px frame; the claim sits above Annotate's
 *  composer (fixed to the window's lower right). Attach view is off (_aitext.mjs): the thread
 *  holds just the request and the reply, framed close while it is read.
 *
 *  Flux bug worked around: the app's project watcher (electron/main.cjs, watch:setRoot targets)
 *  covers manuscript/ but not paper/, so an agent's write to a document under paper/ never
 *  reaches the open editor. prepare() moves the manuscript to the legacy manuscript/ root, where
 *  agent edits live-reload as the docs say. Drop the move once the watcher covers paper/.
 */
import fs from 'node:fs';
import path from 'node:path';
import {preparePaper,openPaper,DOC,docText,textAt,scrollTo} from './_paper.mjs';
import {connectAgent,toastTexts} from './_ai.mjs';
import {addressAgent,lastMessage,requestBox,threadHas,rowBox,SURFACE,COMPOSER,INBOX} from './_aitext.mjs';

const CLAIM_CITES=' [@tunyasuvunakoolHighlyAccurateProtein2021; @ruffAlphaFoldImplicationsIntrinsically2021]';
const DROP_BIB=['tunyasuvunakoolHighlyAccurateProtein2021','ruffAlphaFoldImplicationsIntrinsically2021'];
export const LIVE_DOC='manuscript/'+path.basename(DOC);
const CLAIM='very low pLDDT predicts disorder well across the human proteome';
const KEY='tunyasuvunakoolHighlyAccurateProtein2021';
const REQUEST='What should I cite for this, and does anyone disagree?';
const REPLY='Cite **Tunyasuvunakool et al. 2021** (Nature, in your library): pLDDT predicted disorder with an AUC of 0.897 on the CAID benchmark. I\'ve added it.\n\n'+
  'Two papers push back: **Zhao et al. 2023** (CSBJ) found an AUC of 0.77 on 646 proteins, below dedicated disorder predictors, and **Alderson et al. 2023** (PNAS) found confident structures for nearly 15% of human disordered regions.';

/** The draft: the claim without its citations, their entries not yet in the project's
 *  bibliography; the manuscript under manuscript/ (see the header). */
export function prepareDraft(project){
  preparePaper(project);
  const doc=path.join(project,DOC);
  let text=fs.readFileSync(doc,'utf8');
  if(!text.includes(CLAIM_CITES))throw Error('The manuscript has no '+CLAIM_CITES);
  text=text.replace(CLAIM_CITES,'');
  const bib=path.join(project,'references/library.bib'),src=fs.readFileSync(bib,'utf8'),entries=src.split(/\n(?=@)/);
  const kept=entries.filter(e=>!DROP_BIB.some(k=>e.startsWith(`@article{${k},`)));
  if(entries.length-kept.length!==DROP_BIB.length)throw Error('The bibliography lacks an entry to drop');
  fs.writeFileSync(bib,kept.join('\n'));
  fs.mkdirSync(path.join(project,'manuscript'),{recursive:true});
  fs.writeFileSync(path.join(project,LIVE_DOC),text);fs.rmSync(doc);
  if(fs.existsSync(path.join(project,'paper/_quarto.yml')))fs.renameSync(path.join(project,'paper/_quarto.yml'),path.join(project,'manuscript/_quarto.yml'));
  if(!fs.readdirSync(path.join(project,'paper')).length)fs.rmdirSync(path.join(project,'paper'));
  const file=path.join(project,'project.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
  m.manuscript={...m.manuscript,path:LIVE_DOC,config:'manuscript/_quarto.yml'};m.documentRoot='manuscript';
  fs.writeFileSync(file,JSON.stringify(m,null,2));
}

/** The screen boxes of the lines of the paragraph holding `snippet`. */
const paragraphBox=(page,snippet)=>page.evaluate(s=>{
  const lines=[...document.querySelectorAll('.cm-content .cm-line')];const n=lines.find(l=>l.textContent.includes(s));if(!n)return null;
  const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},snippet);
/** The rendered chip of a citation whose text includes `text`. */
const chipBox=(page,text)=>page.evaluate(t=>{const n=[...document.querySelectorAll('.cm-content .flux-cite')].find(n=>n.textContent.includes(t));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},text);

export default {
  window:{width:840,height:700},
  prepare(project){prepareDraft(project);},

  async setup(ctx){
    const {page,rect,need,sleep,boxes,WIDTH,HEIGHT}=ctx;
    await openPaper(ctx);
    // The paragraph alone: side panel and margin hidden.
    await page.keyboard.press('Alt+o');await sleep(600);
    await page.keyboard.press('Control+Shift+B');await sleep(900);
    boxes.column=await rect('.editor-col');
    if(boxes.column.w<WIDTH-60)throw Error('The side panels did not hide: column '+JSON.stringify(boxes.column));
    if(await page.evaluate(()=>{const s=document.querySelector('.cm-scroller');return s.scrollWidth>s.clientWidth+1;}))throw Error('The text overflows the column');
    // Scroll the claim's paragraph to the top of the window, clear of the composer below.
    await page.evaluate(()=>{const v=document.querySelector('.cm-content').cmTile.view;const i=v.state.doc.toString().indexOf('Low confidence here');v.dispatch({effects:v.constructor.scrollIntoView(i,{y:'start'})});});
    await sleep(700);
    await scrollTo(ctx,'Low confidence here',112);await sleep(600);
    if((await docText(page)).includes(KEY))throw Error('The draft already cites '+KEY);
    boxes.para=await paragraphBox(page,'Low confidence here');
    boxes.a=await textAt(page,CLAIM);boxes.b=await textAt(page,CLAIM,{end:true});
    boxes.text={x:boxes.para.x,w:boxes.para.w};

    // The agent: connect, watch for the note, and let Annotate address it by name.
    const agent=await connectAgent(ctx);
    const script=[
      {pause:600},
      {claim:true,mark:'claimed'},
      {verb:'search_references',args:{query:'disordered'}},
      {verb:'search_references',args:{query:'human proteome'}},
      {verb:'get_paper_text',args:{key:KEY}},
      {verb:'search_world',args:{query:'AlphaFold2 pLDDT intrinsically disordered regions',perPage:10}},
      {tool:'cite_doi',args:{doi:'10.1038/s41586-021-03828-1'}},
      {tool:'get_manuscript',args:{}},
    ];
    const read=script.length-1;
    script.push(
      {tool:'set_manuscript',args:()=>{
        const text=script[read].result.text,at='across the human proteome.';
        if(text.split(at).length!==2)throw Error('The claim is not unique in the manuscript');
        return {text:text.replace(at,`across the human proteome [@${KEY}].`)};},mark:'edit'},
      {until:()=>ctx.inboxOpen},
      {pause:400},
      {reply:REPLY,mark:'reply'},
      {pause:2500},
      {resolve:true,mark:'resolved'});
    agent.play({expect:/^What should I cite/,timeoutMs:3600000,onStep:(i,s)=>{if(s.mark)ctx.mark(s.mark);},script});
    boxes.composer=await addressAgent(ctx,'heron');
    if(!boxes.composer.field)throw Error('No note field in the composer');
    // The claim's lines must stand clear of the composer.
    if(boxes.b.bottom>boxes.composer.y-8)throw Error('The claim runs under the composer: '+JSON.stringify({claim:boxes.b,composer:boxes.composer}));

    // Rest right of the text (nothing to hover there however the paragraph reflows).
    await ctx.place({x:Math.round(boxes.para.x+boxes.para.w+14),y:Math.round(boxes.para.y+boxes.para.h*0.55)});
    await sleep(2000);
    boxes.cover={x:12,y:44,w:WIDTH-24,h:HEIGHT-46};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,down,up,key,type,mark,agent}=ctx,rest=ctx.at;
    mark('start');
    await sleep(700);
    // Select the claim, from its end back to its start.
    const a=await textAt(page,CLAIM),b=await textAt(page,CLAIM,{end:true});
    await glide({x:b.x+1,y:b.y},{bow:0.12});
    await sleep(220);
    await down();await glide({x:a.x+2,y:a.y},{ms:900,bow:-0.04});await sleep(120);await up();mark('selected');
    const selected=await page.evaluate(()=>{const v=document.querySelector('.cm-content').cmTile.view,m=v.state.selection.main;return v.state.sliceDoc(m.from,m.to);});
    if(selected!==CLAIM)throw Error('Selected '+JSON.stringify(selected));
    // To where the note will be typed (right of the text, so nothing is hovered when Annotate
    // opens under the pointer or closes again), then Annotate.
    const field=boxes.composer.field,spot={x:Math.max(field.x+field.w-26,boxes.para.x+boxes.para.w+20),y:field.y+field.h-14};
    await glide(spot,{bow:0.1});
    await sleep(300);
    await key('Control+Shift+M',{label:'Ctrl+Shift+M',where:[0.2,0.9]});mark('annotate');
    boxes.composer=await need('Annotate',()=>rect(COMPOSER));
    const chip=await need('the claim as the target',()=>page.evaluate(()=>[...document.querySelectorAll('.annotation-composer .target-chip')].map(n=>n.textContent).join('|')));
    if(!chip.includes('very low pLDDT predicts disorder'))throw Error('Annotate targets '+chip);
    await sleep(500);
    mark('type');
    await type(REQUEST,{per:55});
    const to=await page.evaluate(()=>document.querySelector('.annotation-composer .to-pill')?.textContent??'');
    if(!/heron/.test(to))throw Error('The note is not addressed to heron: '+to);
    await sleep(800);
    await key('Enter',{label:'enter',where:[0.16,0.12]});mark('sent');
    await need('Annotate closed',async()=>!(await rect(SURFACE)));
    // Back to writing: a click below the paragraph drops the selection.
    await sleep(500);
    await glide({x:boxes.para.x+boxes.para.w*0.55,y:boxes.para.y+boxes.para.h+30},{bow:-0.1});
    await sleep(200);await click();mark('deselect');
    await need('claimed',async()=>(await toastTexts(ctx)).some(t=>t.startsWith('heron claimed')),15000);
    mark('claimedSeen');
    boxes.toasts=await page.evaluate(()=>{const r=[...document.querySelectorAll('.toast')].map(n=>n.getBoundingClientRect());if(!r.length)return null;const x=Math.min(...r.map(q=>q.x)),y=Math.min(...r.map(q=>q.y));return {x,y,w:Math.max(...r.map(q=>q.right))-x,h:Math.max(...r.map(q=>q.bottom))-y};});
    await need('the citation in the sentence',async()=>(await docText(page)).includes(`proteome [@${KEY}].`),30000);
    boxes.cite=await need('the citation chip',()=>chipBox(page,'Tunyasuvunakool'),10000);
    mark('cited');
    await sleep(1900);
    // The Inbox: the note, and heron's answer arriving in its thread.
    await key('Alt+q',{label:'Alt+Q',where:[0.8,0.9]});mark('inbox');
    boxes.inbox=await need('Inbox',()=>rect(INBOX));
    const row=await need('the note in the list',()=>rowBox(ctx,'What should I cite'));
    await sleep(450);
    await glide({x:row.x+row.w*0.5,y:row.y+row.h*0.42},{bow:0.1});
    await sleep(200);await click();
    await need('the note selected',()=>page.evaluate(()=>/Claimed by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')));
    boxes.detail=await rect('.detail');
    ctx.inboxOpen=true;
    await sleep(250);
    // Park the pointer in the list, clear of the thread.
    await glide({x:boxes.detail.x-60,y:boxes.detail.y+boxes.detail.h-50},{bow:-0.1});
    await need('the reply in the thread',()=>threadHas(ctx,'pLDDT predicted disorder'),30000);
    mark('replySeen');
    boxes.request=await requestBox(ctx);boxes.reply=await lastMessage(ctx);
    await need('resolved',()=>page.evaluate(()=>/Resolved by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')),20000);
    await agent.done;
    // Time to read the answer (four sentences).
    const read=Math.max(0,ctx.marks.replySeen+10500-ctx.pageTime());await sleep(read);
    await key('Alt+q',{label:'Alt+Q',where:[0.8,0.9]});mark('close');
    await need('Inbox closed',async()=>!(await rect(INBOX)));
    await sleep(400);
    await glide(rest,{bow:-0.12});
    await need('toasts gone',async()=>!(await toastTexts(ctx)).length,10000);
    if(!(await docText(page)).includes(`proteome [@${KEY}].`))throw Error('The citation did not hold');
    mark('reveal');
    await sleep(2200);
    mark('end');
    await agent.close();
  },

  /** The paragraph; close on the note while it is typed; the paragraph while the citation lands;
   *  the thread while the answer is read; the paragraph again. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,lib}=ctx,within=b.cover;
    const para=frame(b.para.x-24,b.para.x+b.para.w+46,{cy:b.para.y+b.para.h/2+30,within});
    const note=around(b.composer,{pad:14,within});
    // The paragraph with the toasts below it (heron's claim) while the citation lands.
    const work=around(lib.union(b.para,b.toasts??b.para),{pad:14,within});
    const thread=around(lib.union(b.request,b.reply),{pad:18,within});
    return [
      [m.start,para],[m.annotate+150,para],[m.type-200,note],
      [m.sent+60,note],[m.sent+800,work],
      [m.cited+900,work],[m.inbox+100,work],[m.inbox+800,thread],
      [m.close,thread],[m.close+1000,para],[m.end,para],
    ];
  },
};
