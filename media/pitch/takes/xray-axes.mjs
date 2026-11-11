/** Clip 2b: the X-ray on two plots at once. Group-select the top two plots of panel e, open the
 *  X-ray, and hide their x-axis tick labels and titles from the "Common parts" list, one click
 *  each for both plots; the two plots below already carry the same axis.
 *
 *  Layout: the side rails are hidden and the figure stands at the left, so the X-ray (460 px)
 *  opens to the right of panel e. The X-ray is taller than the space below the pointer and is
 *  clamped to the window's bottom edge, so its position is fixed; the figure stands high enough
 *  that the common x-axis rows land level with the two plots' x axes, and one narrow frame holds
 *  the rows and the axes they change.
 */
import {PANELS,sel,openFigure1,placeFigure1,carryOver} from './_figure1.mjs';
const NONE=sel(PANELS.e.none),COMPETITIVE=sel(PANELS.e.competitive),UNCOMPETITIVE=sel(PANELS.e.uncompetitive),NONCOMPETITIVE=sel(PANELS.e.noncompetitive);
const XRAY='.xray.placed';
const common=part=>`.xray .row[data-rid="common:${part}"]`;

export default {
  prepare(project){carryOver(project,['c','d']);},

  async setup(ctx){
    const {boxes,rect,lib,HEIGHT}=ctx;
    await openFigure1(ctx,{figureWidth:1003,rails:false,left:180,bottomGap:235});
    boxes.none=await rect(NONE);boxes.competitive=await rect(COMPETITIVE);
    boxes.noncompetitive=await rect(NONCOMPETITIVE);boxes.uncompetitive=await rect(UNCOMPETITIVE);
    boxes.panel=lib.union(boxes.none,boxes.competitive,boxes.noncompetitive,boxes.uncompetitive);
    boxes.label=await rect(sel('text_mwb0owgdp9qz_190'));   // the panel letter "e"
    await ctx.place({x:Math.round(boxes.whole.x+boxes.whole.w*0.3),y:HEIGHT-58});
    await ctx.sleep(3500);
    // The opening frame plus the X-ray's place to its right, down to the window's edge.
    boxes.cover={x:boxes.whole.x,y:boxes.whole.y,w:Math.min(ctx.WIDTH-2,boxes.panel.x+boxes.panel.w+12+460+20)-boxes.whole.x,h:HEIGHT-2-boxes.whole.y};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,key,hold,release,mark,lib}=ctx,rest=ctx.at;
    const hidden=part=>page.evaluate(s=>document.querySelector(s)?.classList.contains('off'),common(part)+' .eye');
    mark('start');
    await sleep(500);
    // The top-left plot, then Shift and the top-right one: both selected.
    await glide({x:boxes.none.x+boxes.none.w*0.6,y:boxes.none.y+boxes.none.h*0.52},{bow:0.10});
    await sleep(220);await click();mark('select');
    await sleep(420);
    await hold('Shift',{where:[0.2,0.9]});
    await sleep(180);
    await glide({x:boxes.competitive.x+boxes.competitive.w*0.6,y:boxes.competitive.y+boxes.competitive.h*0.52},{bow:-0.18});
    await sleep(170);await click();
    await sleep(160);await release('Shift');mark('group');
    await need('two plots selected',async()=>{const b=await rect('.canvas-host .sel-box');return b&&b.w>boxes.none.w*1.5?b:null;});
    await sleep(520);
    await key('r',{label:'R',where:[0.2,0.9]});mark('xray');
    boxes.xray=await need('X-ray',()=>rect(XRAY));
    if(boxes.xray.x<boxes.competitive.x+boxes.competitive.w)throw Error('The X-ray did not open on the right of the plots');
    boxes.ticks=await need('common tick labels row',()=>rect(common('axis.x.tick-labels')));
    boxes.title=await need('common axis title row',()=>rect(common('axis.x.title')));
    boxes.commonHead=await need('common parts heading',()=>page.evaluate(()=>{const n=[...document.querySelectorAll('.xray .section')].find(n=>/Common parts/.test(n.textContent));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    if(await hidden('axis.x.tick-labels')||await hidden('axis.x.title'))throw Error('The x-axis parts are already hidden');
    await sleep(1150);

    // One click hides the tick labels of both plots; another their titles.
    for(const [part,bow] of [['axis.x.tick-labels',-0.12],['axis.x.title',0.35]]){
      const eye=lib.centre(await need(part+' eye',()=>rect(common(part)+' .eye')));
      await glide(eye,{bow});
      await sleep(260);await click();mark('hide:'+part);
      await need(part+' hidden',()=>hidden(part));
      await sleep(part==='axis.x.title'?900:700);
    }
    // The pointer returns to where it began, so the loop restarts from the same place.
    await glide(rest,{bow:-0.12});
    await sleep(100);
    // Escape closes the X-ray, Escape again lets go of the plots.
    const open=async()=>await rect('.xray')||await page.evaluate(()=>document.querySelectorAll('.canvas-host .sel-box').length);
    for(let i=0;i<3&&await open();i++){await key('Escape',{label:'esc'});await sleep(330);}
    if(await open())throw Error('Escape did not close the X-ray');
    mark('close');
    await sleep(1600);
    mark('reveal');
    await sleep(2000);
    mark('end');
  },

  /** The whole figure; in to panel e for the selection; out for the whole X-ray beside it; close
   *  on the common x-axis rows and the four plots; tight on panel e; back out to the figure. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT,ASPECT}=ctx,within=b.cover,panel=b.panel;
    const whole=frame(b.whole.x,b.whole.x+b.whole.w,{top:b.whole.y});
    const pick=around(panel,{pad:34,within});
    const xrayRight=b.xray.x+b.xray.w+16;
    // the whole X-ray, top to bottom, with panel e beside it
    const full=frame(xrayRight-(HEIGHT-2-(b.xray.y-8))*ASPECT,xrayRight,{bottom:HEIGHT-2,within});
    // the four plots and the common rows (eye and name, cut before the value column)
    const rowsTop=Math.min(b.commonHead.y-10,panel.y-24),rowsBottom=panel.y+panel.h+20;
    // left edge just left of the panel letter, so panel d's labels are not cut in half
    const rows=frame(b.label.x-10,b.xray.x+236,{cy:(rowsTop+rowsBottom)/2,within});
    const end=around(panel,{pad:34,within});
    return [
      [m.start,whole],[m.start+450,whole],[m.start+1550,pick],
      [m.xray+60,pick],[m.xray+900,full],
      [m.xray+1150,full],[m.xray+1950,rows],
      [m.close+60,rows],[m.close+960,end],
      [m.reveal,end],[m.reveal+1250,whole],[m.end,whole],
    ];
  },
};
