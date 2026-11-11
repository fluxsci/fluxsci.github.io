/** Clip (Paper 1): figures are live, not pasted.
 *
 *  The manuscript "Reading a protein across scales" (materials: _paper.mjs) starts one draft
 *  earlier: the Introduction's last paragraph does not yet point at panels c–f, and Figure 1 is
 *  not yet placed below it. On camera: `@@` and the panel picker (keys C D E F) put a
 *  "Fig. 1c–f" chip mid-sentence; `/figure` embeds Figure 1 with its caption under the
 *  paragraph; then Figure-Meta (Alt+M, in Paper) makes the figure Figure 2, and the chips and
 *  the figure's own chip follow by themselves.
 *
 *  Layout: a 1160 x 870 window with Paper's file sidebar showing, the margin hidden
 *  (Ctrl+Shift+B; its ambient animation under a picker's blur starved the frame rate) and the
 *  text at 150% (Ctrl+=), so the column holds about 52 characters a line and a frame the width
 *  of the column (~830 px) reads on a phone. Figure-Meta is a window-wide sheet; the camera holds its
 *  Name fields.
 */
import {preparePaper,openPaper,docText,textAt,scrollTo,boxOf,FIG_KEY} from './_paper.mjs';

const CARD='Protein Structure';
/** The picker dialog around a heading text. */
const dialogOf=(page,heading)=>page.evaluate(heading=>{
  let n=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&n.textContent.trim()===heading&&n.getBoundingClientRect().width);
  while(n&&!(n.getBoundingClientRect().width>600&&n.getBoundingClientRect().height>200))n=n.parentElement;
  if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},heading);
/** A figure card of an open picker, once every card's thumbnail has loaded. */
const cardOf=(page,title)=>page.evaluate(title=>{
  const cells=[...document.querySelectorAll('.cell')].filter(c=>c.getBoundingClientRect().width);
  const imgs=cells.flatMap(c=>[...c.querySelectorAll('img')]);
  if(cells.length<3||imgs.length<cells.length||!imgs.every(i=>i.complete&&i.naturalWidth>0))return null;
  const n=cells.find(c=>c.textContent.includes(title));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},title);
const embedImage=page=>page.evaluate(()=>{
  const i=[...document.querySelectorAll('.cm-content img')].find(i=>i.naturalWidth>0&&i.getBoundingClientRect().width>300);
  if(!i)return null;const r=i.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const chipBox=(page,name)=>page.evaluate(name=>{const n=[...document.querySelectorAll('.cm-content .flux-embedchip')].find(n=>n.textContent.includes(name));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},name);
const captionBox=(page,name)=>page.evaluate(name=>{const b=[...document.querySelectorAll('.cm-content b')].find(n=>n.textContent.trim().startsWith(name+' |')||n.textContent.trim()===name+' |');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},name);
const metaOpen=page=>page.evaluate(()=>!![...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close Figure-Meta'));
const inputBox=(page,label)=>page.evaluate(label=>{const n=document.querySelector(`input[aria-label="${label}"]`);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,value:n.value};},label);
/** Put the caret at the empty line after `snippet`'s paragraph (setup only). */
const caretAfter=(page,snippet)=>page.evaluate(snippet=>{const v=document.querySelector('.cm-content').cmTile.view,d=v.state.doc.toString(),i=d.indexOf(snippet)+snippet.length+2;v.dispatch({selection:{anchor:i}});v.focus();return i;},snippet);
const LAST='as exercises, not as findings.';

export default {
  window:{width:1160,height:870,scale:3},
  prepare(project){preparePaper(project,{strip:['figure','fig-cf']});},

  async setup(ctx){
    const {page,rect,need,sleep,boxes}=ctx;
    await openPaper(ctx,{sidebar:true,margin:false});
    // Draw Figure 1's embed once off camera (its 3D panels arrive a few seconds after the first
    // render), then take it out again: the draft starts without it.
    await scrollTo(ctx,'Here we use one six-panel',190);
    await caretAfter(page,LAST);await sleep(300);
    await page.keyboard.type('/figure',{delay:40});await sleep(700);await page.keyboard.press('Enter');
    const card=await need('figure picker',()=>cardOf(page,CARD),30000);await sleep(500);
    await page.mouse.click(card.x+card.w/2,card.y+card.h/2);
    await need('embed',()=>embedImage(page),15000);await sleep(8000);
    if(!(await docText(page)).includes(`{#${FIG_KEY}}`))throw Error('The figure picker did not insert Figure 1');
    await page.evaluate(()=>{const v=document.querySelector('.cm-content').cmTile.view,d=v.state.doc.toString(),i=d.indexOf('![](../fig/renders/fig_mw9xvia2yeq4_20.svg)'),j=d.indexOf('\n',i);v.dispatch({changes:{from:i,to:j,insert:''},selection:{anchor:i}});});
    await sleep(800);
    const text=await docText(page);
    if(text.includes('![](')||!text.includes(LAST+'\n\n\n\n# Results'))throw Error('The draft did not return to its start');
    await caretAfter(page,LAST);await sleep(300);     // the caret waits on the empty line where the figure goes
    // Figure-Meta's preview narrowed to its minimum (its splitter, with the arrow keys), so the
    // Name fields have room; the preview draws 3D panels as grey placeholders (an app bug).
    await page.keyboard.press('Alt+m');await need('Figure-Meta',()=>metaOpen(page));await sleep(1200);
    const splitter=await need('splitter',()=>rect('.splitter'));
    await page.mouse.click(splitter.x+splitter.w/2,splitter.y+splitter.h/2);
    for(let i=0;i<20;i++){await page.keyboard.press('ArrowLeft');await sleep(30);}
    await sleep(400);
    if(Number(await page.evaluate(()=>localStorage.getItem('flux.figureMeta.split')))>0.26)throw Error('Figure-Meta split did not narrow');
    await page.keyboard.press('Escape');await need('Figure-Meta closed',async()=>!(await metaOpen(page)));await sleep(500);
    await caretAfter(page,LAST);await sleep(300);
    // The opening: the end of the Introduction, the empty line where the figure goes, Results.
    await scrollTo(ctx,'Here we use one six-panel',190);
    boxes.column=await rect('.editor-col');
    const first=await textAt(page,'Here we use one six-panel'),last=await textAt(page,LAST,{end:true});
    boxes.paragraph={x:boxes.column.x,y:first.top,w:boxes.column.w,h:last.bottom-first.top};
    await ctx.place({x:ctx.WIDTH-60,y:ctx.HEIGHT-160});
    await sleep(1500);
    return {cover:{x:12,y:12,w:ctx.WIDTH-24,h:ctx.HEIGHT-24}};
  },

  async run(ctx){
    const {page,rect,need,sleep,glide,click,doubleClick,key,type,wheel,mark,boxes}=ctx,rest=ctx.at;
    mark('start');
    await sleep(500);
    // ---- @@: a reference to panels c to f, mid-sentence ----
    const spot=await textAt(page,'The remaining panels',{end:true});
    await glide({x:spot.x+1,y:spot.y},{bow:0.12});await sleep(220);await click();mark('caret');
    await sleep(300);
    await type(' (@@',{per:95});mark('refPicker');
    const card=await need('reference picker',()=>cardOf(page,CARD),20000);
    boxes.refPicker=await need('reference dialog',()=>dialogOf(page,'Reference a figure'));
    await sleep(700);
    await glide({x:card.x+card.w*0.5,y:card.y+card.h*0.4},{bow:-0.1});await sleep(200);await click();mark('panels');
    await need('panel pills',()=>page.evaluate(()=>document.querySelectorAll('button.pill').length>=6));
    boxes.panels=await need('panel dialog',()=>page.evaluate(()=>{let n=document.querySelector('button.pill');while(n&&!(n.getBoundingClientRect().height>300&&n.querySelector('img')))n=n.parentElement;if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    await sleep(650);
    for(const k of ['c','d','e','f']){await key(k,{label:k.toUpperCase(),where:[0.2,0.9]});await sleep(230);}
    await need('Insert Fig. 1c–f',()=>page.evaluate(()=>/Fig\.\s*1c[–-]f/.test(document.body.innerText)));
    await sleep(700);
    await key('Enter',{label:'enter',where:[0.2,0.9]});mark('chip');
    await need('panel reference in the text',async()=>(await docText(page)).includes(`(@${FIG_KEY}-c`));
    await sleep(200);
    await type(')',{per:90});
    const text=await docText(page);
    boxes.cf=text.match(new RegExp(`The remaining panels \\(@${FIG_KEY}-[^)]+\\)`))?.[0];
    if(!boxes.cf)throw Error('The panel reference did not land mid-sentence');
    await sleep(800);
    // ---- /figure: Figure 1 under the paragraph, with its caption ----
    const last=await textAt(page,LAST+'\n\n',{end:true});      // the empty line the figure goes on
    await glide({x:last.x+260,y:last.y},{bow:0.12});await sleep(200);await click();mark('slot');
    await sleep(300);
    await type('/figure',{per:95});
    await need('block palette',()=>boxOf(page,'Embed a figure'));
    await sleep(450);
    await key('Enter',{label:'enter',where:[0.2,0.9]});mark('picker');
    const card2=await need('figure picker',()=>cardOf(page,CARD),20000);
    boxes.picker=await need('picker dialog',()=>dialogOf(page,'Insert figure'));
    await sleep(700);
    await glide({x:card2.x+card2.w*0.5,y:card2.y+card2.h*0.4},{bow:0.1});await sleep(200);await click();mark('embed');
    boxes.embed=await need('embedded figure',()=>embedImage(page),8000);
    if(!(await docText(page)).includes(`${LAST}\n\n![](../fig/renders/fig_mw9xvia2yeq4_20.svg){#${FIG_KEY}}\n\n# Results`))throw Error('Figure 1 was not embedded as its own block');
    // Off the figure (its hover controls); the caret back up into the paragraph, so the embed's
    // source line folds into its chip; down a little to the whole figure and its caption.
    await glide({x:ctx.WIDTH-60,y:boxes.paragraph.y+80},{bow:-0.1});
    await key('ArrowUp',{label:'↑',where:[0.2,0.9]});await sleep(160);
    await key('ArrowUp',{label:'↑',where:[0.2,0.9]});
    await need('figure chip',()=>chipBox(page,'Figure 1'));
    await sleep(500);
    const cap0=await need('caption',()=>captionBox(page,'Figure 1'));
    const line0=await textAt(page,'The remaining panels');
    const steps=Math.max(1,Math.min(Math.ceil((cap0.y+60-ctx.HEIGHT+40)/100),Math.floor((line0.top-95)/100)));
    mark('wheel');
    await wheel(100,{steps,gap:90,where:[0.93,0.42]});
    await need('scrolled',async()=>{const c=await captionBox(page,'Figure 1');return c&&c.y<cap0.y-steps*100+20?c:null;});
    await sleep(500);
    boxes.embed=await embedImage(page);
    boxes.figChip=await chipBox(page,'Figure 1');
    boxes.caption=await captionBox(page,'Figure 1');
    boxes.cfLine=await textAt(page,'The remaining panels');
    mark('figure');
    await sleep(1600);
    // ---- Figure-Meta: Figure 1 becomes Figure 2 ----
    await key('Alt+m',{label:'Alt+M',where:[0.16,0.88]});mark('meta');
    await need('Figure-Meta',()=>metaOpen(page));
    const tab=await need('Name tab',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^Name/.test(b.textContent.trim())&&b.getBoundingClientRect().width);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    boxes.tab=tab;boxes.splitter=await rect('.splitter');
    await sleep(600);
    await glide({x:tab.x+tab.w*0.3,y:tab.y+tab.h/2},{bow:0.12});await sleep(200);await click();mark('name');
    const number=await need('number field',()=>inputBox(page,'Figure number'));boxes.number=number;
    if(number.value!=='1'||(await inputBox(page,'Figure title'))?.value!=='Protein Structure')throw Error('Figure-Meta is not on Figure 1');
    await sleep(600);
    await glide({x:number.x+number.w*0.4,y:number.y+number.h/2},{bow:-0.1});await sleep(200);await doubleClick();mark('number');
    await sleep(250);
    await type('2',{per:90});
    await need('In text Fig. 2a',()=>page.evaluate(()=>/In text\s*Fig\.\s*2a/.test(document.body.innerText)));
    await sleep(800);
    await key('Enter',{label:'enter'});mark('saved');
    await need('saved',()=>page.evaluate(()=>/\bSaved\b/.test(document.body.innerText)));
    await sleep(600);
    await key('Escape',{label:'esc'});
    await need('Figure-Meta closed',async()=>!(await metaOpen(page)));mark('closed');
    await need('Fig. 2 in the text',async()=>await page.evaluate(()=>/Fig\.\s*2c/.test(document.querySelector('.cm-content').innerText))&&await chipBox(page,'Figure 2')&&await captionBox(page,'Figure 2'));
    await sleep(1500);
    mark('down');
    // down to the caption, which now begins "Figure 2 |"
    const capY=(await captionBox(page,'Figure 2')).y;
    await glide({x:ctx.WIDTH-60,y:ctx.HEIGHT-300},{bow:0.1});
    await wheel(100,{steps:Math.max(1,Math.ceil((capY+140-ctx.HEIGHT)/100)),gap:90,where:[0.93,0.42]});
    boxes.caption2=await need('caption in view',async()=>{const c=await captionBox(page,'Figure 2');return c&&c.y+100<ctx.HEIGHT-60?c:null;});
    await sleep(1700);
    mark('out');
    await glide(rest,{bow:-0.12});
    await sleep(1600);
    mark('end');
  },

  /** The whole window; in on the paragraph; the reference picker and its panels; the chip;
   *  the figure picker; the figure under the paragraph; Figure-Meta's Name fields; the
   *  paragraph and the figure's chip, renumbered; out. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT,WIDTH}=ctx;
    const within={x:12,y:12,w:WIDTH-24,h:HEIGHT-24};
    const whole=frame(12,12+(HEIGHT-24)*ctx.ASPECT,{top:12,within});
    const col=b.column,colFrame=(y,o={})=>frame(col.x-6,col.x+col.w+6,{cy:y,within,...o});
    const para=colFrame(b.paragraph.y+b.paragraph.h/2-10);
    const fit=f=>f.w<=within.w?f:whole,minW=Math.ceil(1920/ctx.SCALE);
    const refPicker=fit(around(b.refPicker,{pad:20,within}));
    const panels=fit(around(b.panels,{pad:20,within}));
    const picker=fit(around(b.picker,{pad:20,within}));
    // the figure as it lands, then the whole figure and its caption's first lines
    const landed=frame(col.x-6,col.x+col.w+6,{top:b.paragraph.y+b.paragraph.h-170,within});
    const figure=around({x:col.x+20,y:b.figChip.y,w:col.w-40,h:b.caption.y+90-b.figChip.y},{pad:10,within});
    const fields=frame(Math.min(b.splitter.x+8,b.tab.x+b.tab.w+24-minW),b.tab.x+b.tab.w+24,{top:b.tab.y-70,within});
    // renumbered: the chip in the sentence and the figure's chip; then the caption
    const top=colFrame((b.cfLine.top+b.figChip.y+b.figChip.h)/2+20);
    const caption=frame(col.x-6,col.x+col.w+6,{top:b.caption2.y-150,within});
    return [
      [m.start,whole],[m.start+400,whole],[m.start+1400,para],
      [m.refPicker+250,para],[m.refPicker+900,refPicker],
      [m.panels+100,refPicker],[m.panels+700,panels],
      [m.chip+100,panels],[m.chip+700,para],
      [m.picker+150,para],[m.picker+800,picker],
      [m.embed+150,picker],[m.embed+800,landed],
      [m.wheel,landed],[m.figure+200,figure],
      [m.meta+150,figure],[m.meta+850,fields],
      [m.closed+60,fields],[m.closed+800,top],
      [m.down,top],[m.down+900,caption],
      [m.out,caption],[m.out+1300,whole],[m.end,whole],
    ];
  },
};
