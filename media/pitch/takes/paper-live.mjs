/** Clip (Paper 2): change the figure, and the paper has already changed.
 *
 *  Paper and Figure side by side in one window (Alt+click the Figure icon in Paper's top bar
 *  opens Figure as a split pane). Paper, on the left, shows Figure 1 embedded in the manuscript
 *  ("Reading a protein across scales", _paper.mjs); Figure, on the right, shows the same figure on
 *  its canvas. Panel c (the hexagon map, in roma since the first Figure clip) gets a new colour
 *  map from the F menu's colour-scale editor, the same edit as the first published clip; the
 *  camera moves left and the figure in the manuscript has already changed with it. No export,
 *  no save, no reload.
 *
 *  Layout: a 1900 x 1100 window, Paper's sidebar and margin hidden (Alt+O, Ctrl+Shift+B), the
 *  pane divider dragged so Paper takes the left ~720 px; Figure's rails hidden (Ctrl+B,
 *  Ctrl+Shift+B) and Figure 1 placed with panel c just right of the divider, so the 780 px colour
 *  editor opens on the panel's right, inside the Figure pane, and the Paper embed stays in view.
 */
import {preparePaper,openPaper,scrollTo} from './_paper.mjs';
import {PANELS,sel} from './_figure1.mjs';

const PLOT=sel(PANELS.c.plot),MENU='.fluxFigMenu.placed',PAGE='.canvas-host rect.figure-bg';
const FROM='crameri.roma',TO='vik';
const embedImage=page=>page.evaluate(()=>{
  const i=[...document.querySelectorAll('.cm-content img')].find(i=>i.naturalWidth>0&&i.getBoundingClientRect().width>300);
  if(!i)return null;const r=i.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,src:i.src};});
const paneClose=page=>page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')==='Close pane').map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
const scaleName=page=>page.evaluate(()=>[...document.querySelectorAll('.fluxFigMenu input')].map(i=>i.value).find(v=>/^[a-z]+\.[a-z0-9_]+$/i.test(v))||null);

export default {
  window:{width:1900,height:1100},
  prepare(project){preparePaper(project);},

  async setup(ctx){
    const {page,rect,need,sleep,boxes,lib,WIDTH,HEIGHT}=ctx;
    await openPaper(ctx,{sidebar:false,margin:false});
    // Figure beside Paper.
    const fig=await rect('button[aria-label=Figure]');
    await page.keyboard.down('Alt');await page.mouse.click(fig.x+fig.w/2,fig.y+fig.h/2);await page.keyboard.up('Alt');
    await need('Figure pane',()=>rect('.canvas-host'),30000);await sleep(3000);
    await need('Paper and Figure side by side',async()=>!!(await rect('.cm-content'))&&!!(await rect('.canvas-host'))&&!!(await rect('[role=separator][aria-label="Pane width"]')),10000);
    await page.getByText('canvas_4',{exact:true}).click();await sleep(3000);
    // The divider: Paper takes the left ~720 px.
    const divider=await need('pane divider',()=>rect('[role=separator][aria-label="Pane width"]'));
    const from={x:divider.x+divider.w/2,y:HEIGHT/2};
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    for(let i=1;i<=15;i++){await page.mouse.move(from.x+(726-from.x)*i/15,from.y);await sleep(30);}
    await page.mouse.up();await sleep(1500);
    boxes.divider=await rect('[role=separator][aria-label="Pane width"]');
    // Figure: rails hidden, Figure 1 about 980 px wide with its left edge 40 px right of the divider.
    let host=await rect('.canvas-host');
    await page.mouse.click(host.x+host.w-30,host.y+host.h-30);await sleep(300);
    await page.keyboard.press('Control+b');await sleep(500);await page.keyboard.press('Control+Shift+B');await sleep(1200);
    host=await rect('.canvas-host');
    if(host.x>boxes.divider.x+boxes.divider.w+12)throw Error('The Figure sidebar is still showing');
    const A=sel(PANELS.a.plot);
    const page0=async()=>{const pages=await lib.figurePages(ctx);const a=await rect(A);return pages.find(p=>a&&p.x<=a.x+1&&p.x+p.w>=a.x+a.w-1&&p.y<=a.y+1);};
    let fp=await page0();
    await lib.zoomCanvas(ctx,A,(await rect(A)).w*980/fp.w);
    fp=await page0();const a=await rect(A);
    await lib.panCanvas(ctx,A,{x:a.x+(boxes.divider.x+40-fp.x),y:a.y+(HEIGHT-90-fp.h-fp.y)});
    boxes.figure=await page0();boxes.plot=await rect(PLOT);
    if(boxes.plot.x+boxes.plot.w+800>WIDTH-8)throw Error('No room right of panel c for the colour editor: '+JSON.stringify(boxes.plot));
    // Paper: the figure embed in view, its top a little below the pane's top.
    const content=await rect('.cm-content');
    await page.mouse.click(content.x+40,300);await sleep(200);
    await scrollTo(ctx,'Here we use one six-panel',150);
    boxes.embed=await need('embed',()=>embedImage(page),20000);
    await sleep(6000);                                   // the embed's 3D panels arrive
    boxes.embed=await embedImage(page);
    // Level the manuscript's panel c with panel c on the canvas.
    const dy=(boxes.embed.y+boxes.embed.h*0.57)-(boxes.plot.y+boxes.plot.h/2);
    await page.evaluate(dy=>{document.querySelector('.cm-scroller').scrollTop+=dy;},dy);await sleep(1500);
    boxes.embed=await embedImage(page);
    boxes.column=await rect('.editor-col');
    await ctx.place({x:Math.round(boxes.divider.x+40+boxes.figure.w*0.62),y:HEIGHT-45});
    await sleep(1500);
    return {cover:{x:12,y:12,w:WIDTH-24,h:HEIGHT-24}};
  },

  async run(ctx){
    const {page,rect,textRect,need,sleep,glide,click,key,mark,boxes,lib}=ctx,plot=boxes.plot,rest=ctx.at;
    mark('start');
    await sleep(700);
    await glide({x:plot.x+plot.w*0.56,y:plot.y+plot.h*0.36},{bow:0.10});
    await sleep(220);await click();mark('select');
    await sleep(450);
    await key('f',{label:'F',where:[0.84,0.9]});mark('menu');
    boxes.menu=await need('menu',()=>rect(MENU));
    if(boxes.menu.x<plot.x+plot.w*0.8)throw Error('The menu did not open right of the panel');
    const edit=await need('colour scale row',()=>rect('.fluxFigMenu .field[data-key="c"] .actbtn'));
    await sleep(650);
    await glide(lib.centre(edit),{bow:-0.10});
    await sleep(190);await click();mark('editor');
    boxes.editor=await need('editor',async()=>{const r=await rect(MENU);return r&&r.w>700?r:null;});
    if(boxes.editor.x<plot.x+plot.w*0.8)throw Error('The colour editor opened over the Paper pane');
    if(await scaleName(page)!==FROM)throw Error('Panel c is not in '+FROM+': '+await scaleName(page));
    const tab=await need('Crameri tab',()=>textRect('.fluxFigMenu','button.tab','Crameri'));
    await sleep(500);
    boxes.tab=tab;
    await glide(lib.centre(tab),{bow:0.10});await sleep(160);await click();mark('tab');
    await sleep(650);
    const row=await need(TO,()=>textRect('.fluxFigMenu','.cm',TO));boxes.row=row;
    boxes.palette=await rect('.fluxFigMenu .cmp');
    const before=(await embedImage(page)).src;
    await glide({x:row.x+62,y:row.y+row.h/2},{bow:-0.12});
    await sleep(200);await click();mark('map');
    if(await need('new scale',async()=>{const n=await scaleName(page);return n&&n!==FROM?n:null;})!=='crameri.'+TO)throw Error('The scale did not change to '+TO);
    // The manuscript's copy of the figure changes by itself.
    await need('the embed redrawn',async()=>{const e=await embedImage(page);return e&&e.src!==before;},6000);mark('paper');
    await sleep(2600);
    // Escape closes the editor, then the menu; the pointer returns to where it began.
    await glide(rest,{bow:-0.14});
    await sleep(100);
    for(let i=0;i<3&&await rect('.fluxFigMenu');i++){await key('Escape',{label:'esc',where:[0.85,0.1]});await sleep(320);}
    if(await rect('.fluxFigMenu'))throw Error('The menu did not close');
    mark('close');
    await sleep(2200);
    mark('end');
  },

  /** Paper and the canvas; in on panel c and its menu; the palettes; across to the
   *  manuscript and the plot side by side; the manuscript's figure; out. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT,WIDTH}=ctx,plot=b.plot;
    const within={x:12,y:12,w:WIDTH-24,h:HEIGHT-24};
    const whole=frame(12,12+(HEIGHT-24)*ctx.ASPECT,{top:12,within});   // Paper and the left of the canvas
    const menu=frame(plot.x-24,b.menu.x+b.menu.w+20,{cy:(Math.min(plot.y,b.menu.y)+Math.max(plot.y+plot.h,b.menu.y+b.menu.h))/2,within});
    // the plot and the palette columns right of it, down to the diverging row
    const sw=Math.max(b.palette.w+32,600),sx1=Math.min(b.palette.x+b.palette.w+16,WIDTH-12);
    const tabs=frame(sx1-sw,sx1,{top:b.tab.y-40,within});
    const swatch=frame(sx1-sw,sx1,{bottom:b.row.y+b.row.h+60,within});
    // the manuscript's figure (and caption head) beside panel c on the canvas
    const both=frame(b.embed.x-20,plot.x+plot.w+24,{cy:(b.embed.y+b.embed.h*0.55),within});
    const paper=around({x:b.column.x+20,y:b.embed.y-10,w:b.column.w-40,h:b.embed.h+80},{pad:6,within});
    return [
      [m.start,whole],[m.start+450,whole],[m.start+1500,menu],
      [m.editor+40,menu],[m.editor+850,tabs],
      [m.tab+150,tabs],[m.tab+850,swatch],
      [m.map+250,swatch],[m.map+1150,both],
      [m.map+2300,both],[m.map+3200,paper],
      [m.close+500,paper],[m.close+1700,whole],[m.end,whole],
    ];
  },
};
