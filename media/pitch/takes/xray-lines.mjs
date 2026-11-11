/** Clip 2a: the X-ray on panel d. Hide and show whole axes from the plot's anatomy, then find
 *  every fitted line, pick them all and thicken them together.
 *
 *  Layout: the side rails are hidden and the figure stands in the right of the window with
 *  panel d about 540 px from the right edge. The X-ray (460 px) then opens on the panel's right;
 *  the properties menu, with no room beyond the X-ray, opens on the panel's LEFT. Plot in the
 *  middle, a panel either side: every beat can be framed with the plot beside the thing in use.
 */
import {PANELS,sel,openFigure1,placeFigure1,carryOver} from './_figure1.mjs';
const PLOT=sel(PANELS.d.plot),XRAY='.xray.placed',MENU='.fluxFigMenu.placed';
const STROKE='.fluxFigMenu .field[data-key="d"] input';
const row=part=>`.xray .row[data-rid$="__${part}"]`;

export default {
  prepare(project){carryOver(project,['c']);},

  async setup(ctx){
    const {boxes,rect,WIDTH,HEIGHT}=ctx;
    await openFigure1(ctx,{rails:false});
    const plot=await rect(PLOT);
    await placeFigure1(ctx,{left:boxes.figure.x+(WIDTH-540-(plot.x+plot.w))});
    boxes.plot=await rect(PLOT);
    if(boxes.plot.x-12-240<boxes.whole.x+8)throw Error('No room left of the panel for the properties menu');
    await ctx.place({x:Math.round(boxes.whole.x+boxes.whole.w*0.3),y:HEIGHT-58});
    await ctx.sleep(3500);
    // The opening frame, extended down to the window's edge for the tall X-ray.
    boxes.cover={x:boxes.whole.x,y:boxes.whole.y,w:boxes.whole.w,h:HEIGHT-2-boxes.whole.y};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,key,hold,release,type,wheel,mark,lib}=ctx,plot=boxes.plot,rest=ctx.at;
    const eye=async part=>{const r=await need(part+' row',()=>rect(row(part)+' .eye'));return lib.centre(r);};
    const strokeWidth=()=>page.evaluate(s=>{const i=document.querySelector(s);return i?+i.value:NaN;},STROKE);
    mark('start');
    await sleep(500);
    await glide({x:plot.x+plot.w*0.47,y:plot.y+plot.h*0.52},{bow:0.10});
    await sleep(230);await click();mark('select');
    await sleep(480);
    await key('r',{label:'R',where:[0.2,0.9]});mark('xray');
    boxes.xray=await need('X-ray',()=>rect(XRAY));
    if(boxes.xray.x<plot.x+plot.w)throw Error('The X-ray did not open on the right of the panel');
    boxes.xAxis=await need('X axis row',()=>rect(row('axis.x')));
    boxes.yAxis=await need('Y axis row',()=>rect(row('axis.y')));
    await sleep(800);

    // Whole parts of the plot, off and on again: the x axis, then the y axis.
    for(const [part,bow] of [['axis.x',-0.10],['axis.y',0.3]]){
      await glide(await eye(part),{bow});
      await sleep(190);await click();mark('hide:'+part);
      await need(part+' hidden',()=>page.evaluate(s=>document.querySelector(s)?.classList.contains('off'),row(part)+' .eye'));
      await sleep(620);await click();mark('show:'+part);
      await need(part+' shown',()=>page.evaluate(s=>!document.querySelector(s)?.classList.contains('off'),row(part)+' .eye'));
      await sleep(380);
    }

    // Search the anatomy, pick every result.
    mark('searchGo');
    const search=await need('search row',()=>rect('.xray .search-row'));
    boxes.search=search;
    await glide({x:search.x+300,y:search.y+search.h/2},{bow:0.12});
    await sleep(170);await click();
    await need('search focused',()=>page.evaluate(()=>document.activeElement?.classList.contains('search-in')));
    await sleep(220);
    await type('line',{per:95});mark('search');
    await need('six results',()=>page.evaluate(()=>document.querySelectorAll('.xray .row').length===6));
    boxes.results=await rect(XRAY);
    await sleep(600);
    await hold('Alt',{label:null});await key('a',{label:'Alt+A'});await release('Alt');mark('picked');
    await need('six picked',()=>page.evaluate(()=>document.querySelectorAll('.xray .row.sel').length===6));
    await sleep(620);

    // Their shared properties; thicken all six at once, in fine steps (Alt + wheel).
    await key('f',{label:'F'});mark('menu');
    boxes.menu=await need('properties menu',()=>rect(MENU));
    if(boxes.menu.x+boxes.menu.w>plot.x)throw Error('The properties menu did not open on the left of the panel');
    boxes.stroke=await need('stroke width field',()=>rect(STROKE));
    await sleep(560);
    await glide(lib.centre(boxes.stroke),{bow:-0.08});
    await sleep(190);await click();mark('armed');
    await sleep(260);
    if(Math.abs(await strokeWidth()-0.1)>1e-9)throw Error('Stroke width does not start at 0.1');
    await hold('Alt',{label:'Alt'});
    await sleep(160);
    await wheel(-100,{steps:36,gap:20});
    await sleep(160);
    await release('Alt');mark('thick');
    if(Math.abs(await strokeWidth()-1)>1e-9)throw Error('Stroke width ended at '+await strokeWidth()+', not 1');
    await sleep(700);
    // Enter confirms the armed field (Escape would revert it).
    await key('Enter',{label:'enter'});
    await need('field confirmed',()=>page.evaluate(()=>!document.querySelector('.fluxFigMenu .field.editing')));
    await sleep(320);
    // The pointer returns to where it began, so the loop restarts from the same place.
    await glide(rest,{bow:-0.14});
    await sleep(100);
    // Escape closes the menu, then the X-ray, then lets go of the plot.
    const open=async()=>await rect('.fluxFigMenu')||await rect('.xray')||await page.evaluate(()=>document.querySelectorAll('.canvas-host .sel-box').length);
    for(let i=0;i<4&&await open();i++){await key('Escape',{label:'esc'});await sleep(330);}
    if(await open())throw Error('Escape did not close the menu and the X-ray');
    mark('close');
    await sleep(1600);
    mark('reveal');
    await sleep(2000);
    mark('end');
  },

  /** The whole figure; in to the panel and the whole X-ray; close on the rows and the plot; out
   *  a little for the search; across to the properties menu and the plot; tight on the result;
   *  back out to the figure. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT,ASPECT}=ctx,plot=b.plot,within=b.cover;
    const whole=frame(b.whole.x,b.whole.x+b.whole.w,{top:b.whole.y});
    const xrayRight=b.xray.x+b.xray.w+16;
    // the whole X-ray, top to bottom, with the panel beside it
    const full=frame(xrayRight-(HEIGHT-2-(b.xray.y-8))*ASPECT,xrayRight,{bottom:HEIGHT-2,within});
    // the axis rows (eye and name) hard against the plot
    const eyesTop=b.xAxis.y-102;
    const eyes=frame(plot.x-20,b.xray.x+236,{top:eyesTop,within});
    // the search field, its results and the plot
    const search=frame(plot.x-20,xrayRight,{top:b.search.y-24,within});
    // the properties menu and the plot
    // right edge just past the selection handles, before the next panel's rotated axis title
    const stroke=frame(b.menu.x-18,plot.x+plot.w+12,{cy:(Math.min(b.menu.y,plot.y)+Math.max(b.menu.y+b.menu.h,plot.y+plot.h))/2,within});
    const panel=around(plot,{pad:30,within});
    return [
      [m.start,whole],[m.start+450,whole],[m.start+1650,full],
      [m.xray+900,full],[m.xray+1650,eyes],
      [m.searchGo+40,eyes],[m.searchGo+800,search],
      [m.menu+80,search],[m.menu+950,stroke],
      [m.close+60,stroke],[m.close+960,panel],
      [m.reveal,panel],[m.reveal+1250,whole],[m.end,whole],
    ];
  },
};
