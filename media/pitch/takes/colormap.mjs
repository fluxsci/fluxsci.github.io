/** Clip 1: recolour panel c (the hexagon map) from the F menu's colour-scale editor.
 *
 *  Layout: the side rails are hidden and the figure stands in the right of a wide window, so the
 *  F menu opens to the right of the panel and the 780 px colour editor, which no longer fits
 *  there, opens on its LEFT with the palette list hard against the plot. That adjacency is what
 *  lets the camera hold palette and plot in a frame narrow enough to read on a phone.
 */
import {PANELS,sel,openFigure1,placeFigure1,carryOver} from './_figure1.mjs';
const PLOT=sel(PANELS.c.plot),MENU='.fluxFigMenu.placed';
const MAPS=['navia','vik','roma'];

export default {
  window:{width:1900,height:1100},
  prepare(project){carryOver(project,[]);},

  async setup(ctx){
    const {boxes,rect,WIDTH}=ctx;
    await openFigure1(ctx,{figureWidth:1003,rails:false});
    // The wide editor must not fit right of the panel (panel right edge > W-800) while the
    // figure still fits the window; the narrow menu must fit right (panel right edge <= W-472).
    let plot=await rect(PLOT);
    const figureRight=boxes.figure.x+boxes.figure.w-plot.x;      // from the panel's left edge to the figure's right edge
    const x=Math.min(WIDTH-34-figureRight,WIDTH-490-plot.w);
    if(x+plot.w<=WIDTH-800+12||x-792<8)throw Error(`No panel position opens the editor on the left: panel ${plot.w.toFixed(0)} px, figure ${boxes.figure.w.toFixed(0)} px`);
    await placeFigure1(ctx,{left:boxes.figure.x+(x-plot.x)});
    boxes.plot=await rect(PLOT);
    // Rest on empty canvas, lower left of the opening frame.
    await ctx.place({x:Math.round(boxes.whole.x+boxes.whole.w*0.22),y:ctx.HEIGHT-56});
    await ctx.sleep(3500);
    // Everything happens between the editor's left edge and the figure's right edge.
    const left=Math.max(12,boxes.plot.x-12-780-22);
    return {cover:{x:left,y:Math.min(boxes.whole.y,200),w:boxes.whole.x+boxes.whole.w-left,h:ctx.HEIGHT-2-Math.min(boxes.whole.y,200)}};
  },

  async run(ctx){
    const {boxes,rect,textRect,need,sleep,glide,click,key,mark,lib}=ctx,plot=boxes.plot,rest=ctx.at;
    mark('start');
    await sleep(700);
    await glide({x:plot.x+plot.w*0.56,y:plot.y+plot.h*0.36},{bow:0.10});
    await sleep(240);await click();mark('select');
    await sleep(520);
    await key('f',{label:'F',where:[0.2,0.9]});mark('menu');
    boxes.menu=await need('menu',()=>rect(MENU));
    boxes.edit=await need('colour scale row',()=>rect('.fluxFigMenu .field[data-key="c"] .actbtn'));
    await sleep(750);
    await glide(lib.centre(boxes.edit),{bow:-0.10});
    await sleep(190);await click();mark('editor');
    boxes.editor=await need('editor',async()=>{const r=await rect(MENU);return r&&r.w>700?r:null;});
    if(boxes.editor.x+boxes.editor.w>plot.x)throw Error('The editor did not open on the left of the panel');
    boxes.palette=await need('palette list',()=>rect('.fluxFigMenu .cmp'));
    const tab=await need('Crameri tab',()=>textRect('.fluxFigMenu','button.tab','Crameri'));
    await sleep(520);
    await glide(lib.centre(tab),{bow:0.10});
    await sleep(160);await click();mark('tab');
    await sleep(380);
    boxes.tab=await need('Crameri tab',()=>textRect('.fluxFigMenu','button.tab','Crameri'));
    boxes.rows={};
    for(const name of MAPS)boxes.rows[name]=await need(name,()=>textRect('.fluxFigMenu','.cm',name));
    let bow=0.10;
    for(const name of MAPS){
      const row=boxes.rows[name];
      await glide({x:row.x+62,y:row.y+row.h/2},{bow});bow=-bow*1.6;
      await sleep(160);await click();mark('map:'+name);
      await sleep(name==='roma'?900:720);
    }
    // The pointer returns to where it began, over empty canvas, so nothing is hovered when the menu
    // closes and the loop restarts from the same place.
    await glide(rest,{bow:-0.14});
    await sleep(100);
    // Escape closes the menu; from some states it first steps back to the properties.
    for(let i=0;i<2&&await rect('.fluxFigMenu');i++){await key('Escape',{label:'esc'});await sleep(320);}
    if(await rect('.fluxFigMenu'))throw Error('The menu did not close');
    mark('close');
    await sleep(1850);
    mark('reveal');
    await sleep(2150);
    mark('end');
  },

  /** The whole figure; in to the panel and its menu; across to the editor's palettes; close on
   *  the swatches beside the plot; tight on the result; back out to the figure. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT}=ctx,plot=b.plot;
    const within={x:b.whole.x-(b.whole.x-Math.max(12,plot.x-12-780-22)),y:Math.min(b.whole.y,200),w:b.whole.x+b.whole.w-Math.max(12,plot.x-12-780-22),h:HEIGHT-2-Math.min(b.whole.y,200)};
    const right=plot.x+plot.w+22,mid=plot.y+plot.h/2;
    const whole=frame(b.whole.x,b.whole.x+b.whole.w,{top:b.whole.y});
    const menu=frame(plot.x-26,b.menu.x+b.menu.w+20,{bottom:HEIGHT-2,within});
    // from the collection tabs down to the foot of the plot
    const tabsTop=b.tab.y-26,tabsHeight=Math.max(plot.y+plot.h+24,b.rows.vik.y+60)-tabsTop;
    const tabs=frame(right-Math.max(tabsHeight*ctx.ASPECT,right-(b.palette.x-14)),right,{top:tabsTop,within});
    const swatch=frame(b.rows.roma.x-14,right,{cy:(Math.min(plot.y,b.rows.navia.y)+Math.max(plot.y+plot.h,b.rows.vik.y+22))/2,within});
    const panel=around(plot,{pad:30,within});
    return [
      [m.start,whole],[m.start+450,whole],[m.start+1600,menu],
      [m.editor+40,menu],[m.editor+900,tabs],
      [m.tab+200,tabs],[m.tab+950,swatch],
      [m.close+60,swatch],[m.close+960,panel],
      [m.reveal,panel],[m.reveal+1250,whole],[m.end,whole],
    ];
  },
};
