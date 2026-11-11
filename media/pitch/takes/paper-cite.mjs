/** Clip (Paper 3): cite from your library as you write.
 *
 *  The manuscript ("Reading a protein across scales", _paper.mjs) starts one draft earlier: the
 *  pLDDT sentence does not yet cite AlphaFold, and the project's bibliography does not hold it;
 *  the paper is only in the demo library (FluxLib in the stage's HOME, with its CC BY PDF). On
 *  camera: `@jumper` and the library autocomplete put "(Jumper et al., 2021)" in the sentence;
 *  hovering it shows the card; its References pill opens the reference list in the margin with
 *  the new entry; Ctrl+Shift+B puts the margin away; hover again and Read PDF opens the paper in
 *  Reader beside the text; the Reader pane closes again for the loop.
 *
 *  Setup, off camera: Reader's side panels are folded and its zoom set to fit the width (its
 *  own toolbar buttons, on the Masson et al. PDF the manuscript already cites), then closed.
 *  Layout: 1060 x 795, Paper's sidebar and margin hidden, text at 225% (about 58 characters a
 *  line); Paper and Reader split the window in half.
 */
import {preparePaper,openPaper,scrollTo,textAt,docText} from './_paper.mjs';

const KEY='jumperHighlyAccurateProtein2021';
const box=r=>r&&{x:r.x,y:r.y,w:r.width,h:r.height};
const chipOf=(page,re)=>page.evaluate(src=>{const n=[...document.querySelectorAll('.cm-content .flux-cite')].find(n=>new RegExp(src).test(n.textContent)&&n.getBoundingClientRect().width);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},re);
const pill=(page,text,cls='hc-pill')=>page.evaluate(([text,cls])=>{const b=[...document.querySelectorAll('button.'+cls)].find(b=>b.textContent.trim()===text&&b.getBoundingClientRect().width);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},[text,cls]);
const card=page=>page.evaluate(()=>{const b=document.querySelector('button.hc-pill');let n=b;while(n&&!(n.getBoundingClientRect().height>120))n=n.parentElement;if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const button=(page,label)=>page.evaluate(l=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.title||'').startsWith(l)&&b.getBoundingClientRect().width);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},label);
const paneCount=page=>page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||b.title)==='Close pane'&&b.getBoundingClientRect().width).length);
const readerOpen=page=>page.evaluate(()=>[...document.querySelectorAll('*')].some(n=>n.children.length===0&&n.textContent.trim()==='READER'||n.textContent.trim()==='Reader'&&n.getBoundingClientRect().y<120));
const refsPane=page=>page.evaluate(()=>{const n=document.querySelector('[data-pane-id="bibliography"]');if(!n)return null;const r=n.getBoundingClientRect();return r.width?{x:r.x,y:r.y,w:r.width,h:r.height}:null;});

export default {
  window:{width:1440,height:1080,scale:3},
  prepare(project){preparePaper(project,{strip:['cite-jumper']});},

  async setup(ctx){
    const {page,rect,need,sleep,boxes,WIDTH,HEIGHT}=ctx;
    await openPaper(ctx,{scale:2.25,sidebar:false,margin:false});
    // Reader's view of the AlphaFold paper, set once off camera with Reader's own buttons (side
    // panels folded, fit to width; Reader remembers them per paper): the paper is opened from
    // the Library (Ctrl+Shift+click its row), as a reader would before writing.
    await page.keyboard.press('Control+4');
    const libRow=await need('AlphaFold row in the Library',()=>page.evaluate(()=>{const n=[...document.querySelectorAll('*')].filter(n=>/^Highly accurate protein structure prediction with AlphaFold$/.test(n.textContent.trim())&&n.getBoundingClientRect().width).sort((a,b)=>a.getBoundingClientRect().height-b.getBoundingClientRect().height)[0];if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+Math.min(40,r.width/2),y:r.y+r.height/2};}),20000);
    await sleep(800);
    await page.keyboard.down('Control');await page.keyboard.down('Shift');await page.mouse.click(libRow.x,libRow.y);await page.keyboard.up('Shift');await page.keyboard.up('Control');
    await need('Reader',()=>button(page,'Fit width'),20000);await sleep(2500);
    for(const l of ['Toggle the left sidebar','Toggle the right sidebar','Fit width']){const b=await need(l,()=>button(page,l));await page.mouse.click(b.x+b.w/2,b.y+b.h/2);await sleep(900);}
    const tab=await need('Reader tab close',()=>button(page,'Close Highly accurate'));await page.mouse.click(tab.x+tab.w/2,tab.y+tab.h/2);await sleep(800);
    await page.keyboard.press('Control+2');
    await need('Paper',()=>rect('.cm-content'),20000);await sleep(1500);
    // The Paper|Reader split's divider, set once (Paper keeps ~800 px, no sideways scroll), on a
    // PDF the manuscript already cites (Masson et al.).
    await scrollTo(ctx,'Hydrogen–deuterium exchange reports',300);
    const masson=await need('Masson citation',()=>chipOf(page,'Masson'));
    const read=await need('Read PDF',async()=>{await page.mouse.move(ctx.WIDTH-40,ctx.HEIGHT-200,{steps:3});await sleep(400);await page.mouse.move(masson.x+masson.w/2,masson.y+masson.h/2,{steps:6});await sleep(1500);return pill(page,'Read PDF');},40000);
    await page.mouse.move(read.x+read.w/2,read.y+read.h/2,{steps:6});await sleep(200);await page.mouse.click(read.x+read.w/2,read.y+read.h/2);
    await need('Reader beside Paper',async()=>await paneCount(page)===2,20000);await sleep(2000);
    const d=await need('pane divider',()=>rect('[role=separator][aria-label="Pane width"]'));
    await page.mouse.move(d.x+d.w/2,HEIGHT/2);await page.mouse.down();for(let i=1;i<=12;i++){await page.mouse.move(d.x+d.w/2+(Math.round(ctx.WIDTH/2)-d.x)*i/12,HEIGHT/2);await sleep(30);}await page.mouse.up();await sleep(800);
    const tab2=await need('Reader tab close',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Close Recommendations')&&b.getBoundingClientRect().x>innerWidth/2-20&&b.getBoundingClientRect().width);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));await page.mouse.click(tab2.x+tab2.w/2,tab2.y+tab2.h/2);await sleep(800);
    await sleep(600);
    if(await paneCount(page)>=2){const panes=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||b.title)==='Close pane'&&b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));await page.mouse.click(panes.at(-1).x,panes.at(-1).y);}
    await need('Reader pane closed',async()=>await paneCount(page)<2);
    if(await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Cancel'&&b.getBoundingClientRect().width)))throw Error('A dialog opened during setup');
    await sleep(1500);
    // The margin with its References pane (Ctrl+K → References), scrolled to where the AlphaFold
    // entry will arrive (between Johnson & Goody and Kabsch).
    await page.keyboard.press('Control+Shift+B');await need('margin',async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('flux.paper.layout'))).dynMarginOpen);await sleep(600);
    const content=await rect('.cm-content');await page.mouse.click(content.x+60,content.y+Math.min(400,content.h-20));await sleep(200);
    await page.keyboard.press('Control+k');await sleep(700);await page.keyboard.type('References',{delay:40});await sleep(700);await page.keyboard.press('Enter');
    boxes.pane=await need('References pane',()=>refsPane(page),8000);await sleep(1000);
    await page.evaluate(()=>{const p=document.querySelector('[data-pane-id="bibliography"]');const n=[...p.querySelectorAll('*')].find(n=>/^\W*The Original Michaelis Constant/.test(n.textContent.trim())&&n.children.length===0);let sc=n;while(sc&&!(sc.scrollHeight>sc.clientHeight+20&&getComputedStyle(sc).overflowY!=='visible'))sc=sc.parentElement;if(sc)sc.scrollTop+=n.getBoundingClientRect().top-sc.getBoundingClientRect().top-220;});
    await sleep(800);
    {const c=await rect('.cm-content');await page.mouse.click(c.x+60,c.y+Math.min(400,c.h-20));await sleep(300);}   // focus back in the text
    // The opening: the pLDDT paragraph, with nothing hovered.
    await page.mouse.move(WIDTH-40,HEIGHT-200);await sleep(600);
    await scrollTo(ctx,'For every residue, AlphaFold',250);
    boxes.column=await rect('.editor-col');
    boxes.text=await page.evaluate(()=>{const c=document.querySelector('.cm-content'),r=c.getBoundingClientRect(),cs=getComputedStyle(c);const l=r.x+parseFloat(cs.paddingLeft),w=r.width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);return {x:l,w};});
    const end=await textAt(page,'between 0 and 100',{end:true});
    boxes.line=end;
    await ctx.place({x:WIDTH-40,y:HEIGHT-200});
    await sleep(1200);
    return {cover:{x:12,y:12,w:WIDTH-24,h:HEIGHT-24}};
  },

  async run(ctx){
    const {page,rect,need,sleep,glide,click,key,type,mark,boxes,lib,WIDTH,HEIGHT}=ctx,rest=ctx.at;
    const entry=()=>page.evaluate(()=>{const p=document.querySelector('[data-pane-id="bibliography"]');if(!p)return null;const n=[...p.querySelectorAll('*')].filter(n=>/^\W*Highly accurate protein structure prediction with AlphaFold/.test(n.textContent.trim())&&n.getBoundingClientRect().height).sort((a,b)=>a.getBoundingClientRect().height-b.getBoundingClientRect().height)[0];if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    if(await entry())throw Error('The reference list already holds the AlphaFold paper');
    mark('start');
    await sleep(700);
    // ---- @jumper: the library autocomplete ----
    const end=await textAt(page,'between 0 and 100',{end:true});
    await glide({x:end.x+1,y:end.y},{bow:0.12});await sleep(220);await click();mark('caret');
    await sleep(300);
    await type(' @jumper',{per:110});mark('typed');
    boxes.complete=await need('autocomplete',()=>page.evaluate(()=>{const n=document.querySelector('.cm-tooltip-autocomplete');if(!n||!/jumperHighlyAccurateProtein2021/.test(n.textContent))return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    if(boxes.complete.x+boxes.complete.w>WIDTH-4)throw Error('The autocomplete runs off the window');
    await sleep(1400);
    await key('Enter',{label:'enter',where:[0.2,0.88]});mark('cited');
    await need('citation in the text',async()=>(await docText(page)).includes(`between 0 and 100 [@${KEY}]`));
    await sleep(300);
    await key('ArrowRight',{label:null});await key('ArrowRight',{label:null});
    const chip=await need('citation chip',()=>chipOf(page,'Jumper et al'));boxes.chip=chip;
    // its entry arrives in the reference list
    boxes.row=await need('Jumper entry in the list',entry,6000);mark('listed');
    if(!/17\s*references/.test(await page.evaluate(()=>document.querySelector('[data-pane-id="bibliography"]').innerText)))throw Error('The reference list does not show 17 references');
    await sleep(2300);
    // ---- hover: the card ----
    await glide({x:chip.x+chip.w*0.5,y:chip.y+chip.h/2},{bow:-0.12});mark('hover');
    await need('card',()=>pill(page,'Read PDF'),4000);
    boxes.card=await card(page);
    await sleep(1900);
    // ---- the margin away (the text keeps its place); hover again; Read PDF ----
    // off the chip to the empty right of the text (not across the list, whose rows have cards too)
    await glide({x:boxes.text.x+boxes.text.w+45,y:chip.y+chip.h/2},{bow:0.04});
    await need('card gone',async()=>!(await pill(page,'Read PDF')));
    await key('Control+Shift+B',{label:'Ctrl+Shift+B',where:[0.2,0.88]});mark('hide');
    await need('margin hidden',async()=>!(await refsPane(page)));
    await sleep(700);
    boxes.text2=await page.evaluate(()=>{const c=document.querySelector('.cm-content'),r=c.getBoundingClientRect(),cs=getComputedStyle(c);const l=r.x+parseFloat(cs.paddingLeft),w=r.width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);return {x:l,w};});
    boxes.line2=await textAt(page,'between 0 and 100',{end:true});
    const chip3=await need('chip',()=>chipOf(page,'Jumper et al'));boxes.chip3=chip3;
    await glide({x:chip3.x+chip3.w*0.5,y:chip3.y+chip3.h/2},{bow:0.12});mark('hover2');
    const readPdf=await need('Read PDF',()=>pill(page,'Read PDF'),4000);
    boxes.card2=await card(page);
    await sleep(800);
    await glide({x:readPdf.x+readPdf.w/2,y:readPdf.y+readPdf.h/2},{bow:-0.1});await sleep(200);await click();mark('read');
    await need('Reader beside Paper',async()=>await paneCount(page)===2,15000);
    await need('the AlphaFold PDF',()=>page.evaluate(()=>/Highly accurate protein structure prediction with AlphaFold/.test(document.body.innerText)&&[...document.querySelectorAll('canvas')].some(c=>c.getBoundingClientRect().width>300&&c.getBoundingClientRect().x>innerWidth/2-20)),15000);
    mark('opened');
    boxes.reader=await page.evaluate(()=>{const c=[...document.querySelectorAll('canvas')].filter(c=>c.getBoundingClientRect().width>300&&c.getBoundingClientRect().x>innerWidth/2-20).sort((a,b)=>a.getBoundingClientRect().y-b.getBoundingClientRect().y)[0];const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    await glide({x:boxes.reader.x+boxes.reader.w*0.7,y:HEIGHT-60},{bow:0.1});
    await sleep(3200);
    // ---- Reader closes, the margin returns; the pointer goes back ----
    const panes=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||b.title)==='Close pane'&&b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    if(panes.length!==2)throw Error('Expected Paper and Reader panes');
    boxes.close=panes[1];
    await glide(lib.centre(panes[1]),{bow:-0.1});await sleep(220);await click();mark('closed');
    await need('Reader closed',async()=>await paneCount(page)<2);
    await glide(rest,{bow:0.12});
    await key('Control+Shift+B',{label:'Ctrl+Shift+B',where:[0.2,0.88]});mark('shown');
    await need('margin back',()=>refsPane(page));
    await sleep(1700);
    mark('end');
  },

  /** The paragraph and the list; the autocomplete; the new entry; the card; the text alone;
   *  the card again; Paper and Reader; the paper's first page; out. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT,WIDTH,lib}=ctx;
    const within={x:12,y:12,w:WIDTH-24,h:HEIGHT-24};
    const whole=frame(12,12+(HEIGHT-24)*ctx.ASPECT,{top:12,within});
    const para=frame(b.text.x-30,b.text.x+b.text.w+30,{cy:b.line.y+150,within});
    const complete=around(lib.union({x:b.text.x,y:b.line.top-80,w:10,h:10},b.complete),{pad:30,within});
    const lw=Math.ceil(1920/ctx.SCALE)+60;
    const list=frame(WIDTH-12-lw,WIDTH-12,{cy:b.row.y+40,within});
    const cardF=around(lib.union(b.card,b.chip),{pad:24,within});
    const para2=frame(b.text2.x-30,b.text2.x+b.text2.w+30,{cy:b.line2.y+150,within});
    const card2=around(lib.union(b.card2,b.chip3),{pad:24,within});
    const pw=Math.max(b.reader.w+20,700),px1=Math.min(b.reader.x+b.reader.w/2+pw/2,WIDTH-12);
    const page1=frame(px1-pw,px1,{top:b.reader.y-20,within});
    return [
      [m.start,whole],[m.start+400,whole],[m.start+1400,para],
      [m.caret+400,para],[m.typed+300,complete],
      [m.cited+200,complete],[m.cited+900,list],
      [m.hover-100,list],[m.hover+700,cardF],
      [m.hide-200,cardF],[m.hide+500,para2],
      [m.hover2+200,para2],[m.hover2+800,card2],
      [m.read+150,card2],[m.opened+300,whole],
      [m.opened+900,whole],[m.opened+1800,page1],
      [m.closed-400,page1],[m.closed+600,whole],[m.end,whole],
    ];
  },
};
