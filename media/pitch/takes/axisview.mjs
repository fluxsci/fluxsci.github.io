/** Clip 3: zoom panel f's x axis out to the whole simulation from the F menu's x view.
 *
 *  Layout: panel f is wide and short, at the foot of the figure. The side rails are hidden and
 *  the window is narrow and tall, with the figure placed so the F menu fits neither right nor
 *  left of the panel and opens BELOW it; the menu's axis rows then sit just under the plot, and
 *  one ~590 px frame holds the whole width of the plot and the limits being scrolled.
 *
 *  The wheel: with the x view open, each notch moves the focused limit one step (10 ns here)
 *  wherever the pointer is, and the plot re-projects and re-ticks at once. Notches are sent at
 *  a steady pace, slower than the app's "flick" threshold (45 ms) so none is doubled, and the
 *  loop reads the field back so the limits land exactly on 0 and 1000 (the plot's own range, at
 *  which the app drops the saved view: the same state as the owner's end-state figure).
 */
import fs from 'node:fs';
import path from 'node:path';
import {PANELS,sel,openFigure1,placeFigure1,carryOver,CANVAS_FILE} from './_figure1.mjs';
const MENU='.fluxFigMenu.placed',LIMITS='.fluxFigMenu [data-axis-view] input';
// Panel f in figure units (the figure is 680 wide). Its element box cannot be measured on screen
// while the axis is zoomed in: the clipped data outside the frame inflates it.
const F={x:0,y:317.6151,w:376.1411,h:95.2330},FIGURE_WIDTH=680;
const GAP=560;      // figure's bottom edge above the window's: leaves room for the menu below panel f

export default {
  window:{width:1400,height:1240},
  prepare(project){
    carryOver(project,['c','d','e']);
    // Figure 2 stands just below Figure 1 on this canvas; move it out of the menu's way.
    const file=path.join(project,CANVAS_FILE),canvas=JSON.parse(fs.readFileSync(file,'utf8'));
    canvas.figures.find(f=>f.id==='fig_mw9yp6ty3dsi_4').y+=1200;
    fs.writeFileSync(file,JSON.stringify(canvas,null,2));
  },

  async setup(ctx){
    const {boxes,WIDTH,HEIGHT}=ctx;
    await openFigure1(ctx,{figureWidth:864,rails:false,bottomGap:GAP});
    const z=boxes.figure.w/FIGURE_WIDTH,w=F.w*z;
    // Menu fits neither right (panel right > W-472) nor left (panel left < 472); figure fits the window.
    const lo=WIDTH-472-w+6,hi=Math.min(472,WIDTH-40-boxes.figure.w)-6;
    if(lo>hi)throw Error(`No panel position opens the menu below: panel ${w.toFixed(0)} px, figure ${boxes.figure.w.toFixed(0)} px`);
    await placeFigure1(ctx,{left:(lo+hi)/2,bottomGap:GAP});
    const fig=boxes.figure;
    boxes.plot={x:fig.x+F.x*z,y:fig.y+F.y*z,w,h:F.h*z};
    if(boxes.plot.y+boxes.plot.h+12+540>HEIGHT-8)throw Error('The menu will not fit below the panel');
    // Rest on empty canvas under the figure, left of where the menu will open.
    await ctx.place({x:Math.round(boxes.plot.x+40),y:Math.round(fig.y+fig.h+76)});
    await ctx.sleep(3500);
    boxes.cover={x:Math.min(boxes.whole.x,200),y:boxes.whole.y,w:boxes.whole.x+boxes.whole.w-Math.min(boxes.whole.x,200),h:HEIGHT-2-boxes.whole.y};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,key,mark,lib,log,now,pageTime}=ctx,plot=boxes.plot,rest=ctx.at;
    const limits=()=>page.evaluate(sel=>[...document.querySelectorAll(sel)].map(n=>{const r=n.getBoundingClientRect();return {value:n.value===''?+n.placeholder:+n.value,x:r.x,y:r.y,w:r.width,h:r.height,focused:document.activeElement===n};}),LIMITS);
    /** Wheel the focused limit to `target`, one notch every `period` ms, under a scroll badge. */
    async function scroll(index,target,period){
      const up=target>(await limits())[index].value?1:-1;
      // The scroll badge is logged as a held key so it can sit clear of the menu (bottom left).
      const badge={down:pageTime(),label:'scroll',held:true,up:null,where:[0.095,0.885]};log.keys.push(badge);
      for(let n=0;;n++){
        const t=now(),value=(await limits())[index].value;
        if(value===target)break;
        if(n>150)throw Error(`The limit stopped at ${value}, not ${target}`);
        const back=(target-value)*up<0;                       // overshot: one slow notch back
        await ctx.cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:ctx.at.x,y:ctx.at.y,deltaX:0,deltaY:(back?up:-up)*100});
        const left=(back?140:period)-(now()-t);if(left>0)await sleep(left);
      }
      badge.up=pageTime();
    }

    mark('start');
    await sleep(700);
    await glide({x:plot.x+112,y:plot.y+plot.h*0.42},{bow:0.14});
    await sleep(260);await click();mark('select');
    boxes.selected=await need('selection',()=>rect('.canvas-host .sel-box'));
    await sleep(520);
    await key('f',{label:'F',where:[0.12,0.9]});mark('menu');
    boxes.menu=await need('menu',()=>rect(MENU));
    if(boxes.menu.y<plot.y+plot.h)throw Error('The menu did not open below the panel');
    boxes.edit=await need('x view row',()=>rect('.fluxFigMenu .field[data-key="v"] .actbtn'));
    boxes.close=await need('close button',()=>rect('.fluxFigMenu .xbtn'));
    await sleep(780);
    await glide(lib.centre(boxes.edit),{bow:-0.12});
    await sleep(190);await click();mark('xview');
    let [min,max]=await need('x limits',async()=>{const l=await limits();return l.length===2&&l[0].focused?l:null;});
    boxes.min=min;boxes.max=max;
    boxes.reset=await rect('.fluxFigMenu [data-axis-view] .reset');
    // Hover each limit at its lower right, so the arrow never covers the digits that change.
    const hover=field=>({x:field.x+field.w-9,y:field.y+field.h-5});
    await sleep(380);
    await glide(hover(min),{bow:0.2});
    await sleep(520);
    mark('min0');await scroll(0,0,62);mark('min1');
    await sleep(480);
    await glide(hover(max),{bow:-0.2});
    await sleep(170);await click();
    await need('max focused',async()=>(await limits())[1].focused);
    await sleep(330);
    mark('max0');await scroll(1,1000,52);mark('max1');
    await sleep(760);
    await glide(lib.centre(boxes.close),{bow:0.12});
    await sleep(190);await click();mark('close');
    await need('menu closed',async()=>!(await rect('.fluxFigMenu')));
    // The x axis must now show the whole run.
    const ticks=await page.evaluate(sel=>[...document.querySelectorAll(sel+' text')].map(t=>t.textContent.trim()),sel(PANELS.f.plot));
    if(!ticks.includes('1000')||!ticks.includes('0'))throw Error('The x axis does not span 0 to 1000: '+ticks.join(' '));
    // Back to rest, over empty canvas, so the loop restarts from the same place.
    await sleep(120);
    await glide(rest,{bow:-0.12});
    await sleep(1500-(pageTime()-ctx.marks.close)>0?1500-(pageTime()-ctx.marks.close):0);
    mark('reveal');
    await sleep(2150);
    mark('end');
  },

  /** The whole figure; in to the panel; out for the whole menu as it opens below; close on the
   *  plot and its x limits while they scroll; back on the zoomed-out panel; out to the figure. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,ASPECT}=ctx,plot=b.plot,within=b.cover;
    const whole=frame(b.whole.x,b.whole.x+b.whole.w,{top:b.whole.y});
    // panel and whole menu
    const top=plot.y-34,height=b.menu.y+b.menu.h+12-top;
    const span=Math.max(height*ASPECT,Math.max(plot.x+plot.w,b.menu.x+b.menu.w)-Math.min(plot.x,b.menu.x)+48);
    const mid=(Math.min(plot.x,b.menu.x)+Math.max(plot.x+plot.w,b.menu.x+b.menu.w))/2;
    const menu=frame(mid-span/2,mid+span/2,{top,within});
    // the plot's whole width, the limits under it and the menu's close button
    const close=frame(plot.x-28,Math.max(plot.x+plot.w,b.close.x+b.close.w)+30,{top:plot.y-26,within});
    // the panel across the frame, standing on the figure's bottom edge with panels c and d above it
    const panel=frame(plot.x-34,plot.x+plot.w+34,{bottom:b.figure.y+b.figure.h+30,within});
    return [
      [m.start,whole],[m.start+450,whole],[m.start+1500,panel],
      [m.menu-40,panel],[m.menu+760,menu],
      [m.xview+60,menu],[m.xview+900,close],
      [m.close+80,close],[m.close+980,panel],
      [m.reveal,panel],[m.reveal+1250,whole],[m.end,whole],
    ];
  },
};
