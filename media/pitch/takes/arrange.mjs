/** Clip: resize and arrange. A blank Figure 3 is filled from the Plots rail and laid out:
 *  four Planck curves dropped as a stack, reflowed into a grid from Align & Arrange, shrunk
 *  together by one corner, spaced with the pink gap guides; three galaxy profiles dropped
 *  beneath, overlapped with a gap guide, lined up on the grid's y spine, and widened together
 *  by their right edge so the axes reflow.
 *
 *  Layout: the Plots rail is the window's left 320 px; the figure stands just right of it at a
 *  zoom that leaves its whole (portrait) page in a 4:3 frame with the rail. Align & Arrange
 *  opens beside the selection, level with the pointer, and does not move when the selection
 *  grows: so Alt+T is pressed with the pointer low on the dropped stack, and the panel sits
 *  below where the grid will form. Two things are set up before filming, both ordinary session
 *  state: the "Keep fixed" anchors (top for a column, top left for a grid, so a dragged guide
 *  and the plots it moves go the same way), by rehearsing the arrangement once and undoing it;
 *  and "Peek on hover" off, so tiles do not pop a preview over the figure. The rehearsal also
 *  measures where a dropped tile lands under the pointer.
 */
import fs from 'node:fs';
import path from 'node:path';

const CANVAS_FILE='fig/canvases/canvas_mw9xvia1yeq4_19.json',FIGURE='fig_mwb28ak4p9qz_351';
const PAGE='.canvas-host rect.figure-bg.active',RAIL='[data-plots-rail]',PANEL='.align-arrange-panel';
const UNITS_W=453.69432821244254;                       // Figure 3's width in figure units
// The finished figure (the owner's Figure 3), in figure units.
const GOAL={planck:{x:[9.96,228.96],y:[10.39,150.97],w:214.77,h:137.81,native:[240,153.6]},galaxy:{y:288.78,pitch:92.74,h:115.2,right:445.3}};

export default {
  window:{width:1840,height:1100},

  /** Start from a blank Figure 3 (its plots stay in the project, so they are in the rail). */
  prepare(project){
    const file=path.join(project,CANVAS_FILE),canvas=JSON.parse(fs.readFileSync(file,'utf8'));
    canvas.figures.find(f=>f.id===FIGURE).elements=[];
    fs.writeFileSync(file,JSON.stringify(canvas,null,2));
  },

  async setup(ctx){
    const {page,rect,need,sleep,lib,boxes,cdp}=ctx,t=tools(ctx);
    // Figure mode (a 4x window loads slowly: click until the canvas is there), then canvas_4.
    await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Figure]')),60000);
    await need('figure mode',async()=>{await page.evaluate(()=>document.querySelector('button[aria-label=Figure]')?.click());await sleep(1500);return rect('.canvas-host');},60000);
    await sleep(1500);
    await page.getByText('canvas_4',{exact:true}).click();await sleep(3000);
    // Make Figure 3 the active figure (its row in the sidebar's list), then show the Plots rail.
    const row=await page.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&n.textContent.trim()==='Figure 3'&&n.getBoundingClientRect().right<330&&n.getBoundingClientRect().width>0);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    if(!row)throw Error('Figure 3 is not in the sidebar');
    await page.mouse.click(row.x,row.y);await sleep(1200);
    await page.keyboard.press('Alt+g');
    await need('Plots rail',()=>rect(RAIL));await sleep(1200);
    // The page about 576 px wide (zoom 1.27), standing just right of the rail.
    await lib.zoomCanvas(ctx,PAGE,576);
    await lib.panCanvas(ctx,PAGE,{x:360,y:146});
    boxes.figure=await rect(PAGE);
    if(Math.abs(boxes.figure.w-576)>40)throw Error('Unexpected zoom: page is '+boxes.figure.w.toFixed(0)+' px wide');
    // Peek on hover off (the rail's options menu).
    if(JSON.parse(await page.evaluate(()=>localStorage.getItem('flux.plotsRail'))||'{}').peek!==false){
      const dots=await need('rail options',()=>rect(RAIL+' button[aria-label="Plots view options"]').then(r=>r||page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Plots view options');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})));
      await page.mouse.click(dots.x+dots.w/2,dots.y+dots.h/2);await sleep(500);
      const item=await need('Peek on hover',()=>page.evaluate(()=>{const n=[...document.querySelectorAll('[role=menuitemcheckbox]')].find(n=>n.textContent.includes('Peek on hover'));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));
      await page.mouse.click(item.x,item.y);await sleep(300);await page.keyboard.press('Escape');await sleep(300);
      if(JSON.parse(await page.evaluate(()=>localStorage.getItem('flux.plotsRail'))).peek!==false)throw Error('Peek on hover did not turn off');
    }
    const raw=(type,p,extra={})=>cdp.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,...extra});
    const drag=async(from,to)=>{await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x,y:from.y});await sleep(150);await raw('mousePressed',from);await sleep(100);for(let i=1;i<=20;i++){await raw('mouseMoved',{x:from.x+(to.x-from.x)*i/20,y:from.y+(to.y-from.y)*i/20});await sleep(25);}await sleep(250);await raw('mouseReleased',to);};
    const emptyAgain=async()=>{
      for(let i=0;i<4&&await rect(PANEL);i++){await page.keyboard.press('Escape');await sleep(350);}
      await page.mouse.click(boxes.figure.x+boxes.figure.w+90,boxes.figure.y+boxes.figure.h-40);await sleep(300);
      for(let i=0;i<30&&await t.count()>0;i++){await page.keyboard.press('Control+z');await sleep(400);}
      if(await t.count())throw Error('The rehearsal could not be undone');
    };
    const pick=async tiles=>{
      await page.mouse.click(tiles[0].x+tiles[0].w/2,tiles[0].y+tiles[0].h/2);await sleep(250);
      await page.keyboard.down('Shift');await page.mouse.click(tiles.at(-1).x+tiles.at(-1).w/2,tiles.at(-1).y+tiles.at(-1).h/2);await page.keyboard.up('Shift');await sleep(300);
    };
    // Rehearsal 1: drop the four Planck tiles, learn where a tile lands under the pointer, and
    // choose the anchors Arrange will keep fixed: Top for a column, Top left for a grid.
    await t.search('planck',4);
    let tiles=await t.tiles();await pick(tiles);
    let from=lib.centre(t.tile(tiles,'planck_t6000')),to={x:boxes.figure.x+boxes.figure.w*0.3,y:boxes.figure.y+130};
    await drag(from,to);await need('four plots',async()=>await t.count()===4);await sleep(900);
    let landed=(await t.frames())[0];
    boxes.dropPlanck={dx:landed.x-to.x,dy:landed.y-to.y};
    await page.keyboard.press('Alt+t');await need('Arrange',()=>rect(PANEL));await sleep(500);
    await t.press('Top');await t.press('Reflow as grid (G)');await sleep(400);await t.press('Top left');
    if(!await page.evaluate(()=>[...document.querySelectorAll('.align-arrange-panel button')].some(b=>(b.getAttribute('aria-label')||b.title)==='Top left'&&/chosen/.test(b.className))))throw Error('The grid anchor did not take');
    await emptyAgain();
    // Rehearsal 2: the galaxy profiles' landing offset.
    await t.search('galaxy_p',3);
    tiles=await t.tiles();await pick(tiles);
    from=lib.centre(tiles[0]);to={x:boxes.figure.x+boxes.figure.w*0.3,y:boxes.figure.y+boxes.figure.h*0.6};
    await drag(from,to);await need('three plots',async()=>await t.count()===3);await sleep(900);
    landed=(await t.frames())[0];
    boxes.dropGalaxy={dx:landed.x-to.x,dy:landed.y-to.y};
    await emptyAgain();
    // Back to the opening state: the rail on the Planck tiles, nothing selected, focus out of the search box.
    await t.search('planck',4);
    boxes.tiles=await t.tiles();
    boxes.rail=await rect(RAIL);
    const rest={x:boxes.figure.x+boxes.figure.w+78,y:boxes.figure.y+boxes.figure.h-48};
    await page.mouse.click(rest.x,rest.y);
    await ctx.place(rest);
    await sleep(6000);                                   // the rehearsals' toasts are gone
    const top=boxes.figure.y-54;
    return {cover:{x:0,y:top,w:boxes.figure.x+boxes.figure.w+12+476+34,h:ctx.HEIGHT-2-top}};
  },

  async run(ctx){
    const {page,rect,need,sleep,glide,click,down,up,key,hold,release,type,mark,lib,boxes,marks,log,pageTime}=ctx,t=tools(ctx);
    const fig=boxes.figure,z=fig.w/UNITS_W,rest=ctx.at;
    const X=u=>fig.x+u*z,Y=u=>fig.y+u*z;
    const until=async time=>{const wait=time-pageTime();if(wait>0)await sleep(wait);};
    const chord=async(combo,label)=>{const entry={down:pageTime(),label};await page.keyboard.press(combo,{delay:90});entry.up=pageTime();log.keys.push(entry);};
    const side=[0.925,0.9];                               // badge over the canvas right of the page
    const button=async label=>lib.centre(await need(label,()=>t.button(label)));

    mark('start');
    await sleep(500);
    // ---- four Planck tiles: click the first, Shift+click the last, drag them in as one ----
    let tiles=boxes.tiles;
    await glide(lib.centre(tiles[0]),{bow:0.08});await sleep(130);await click();
    await hold('Shift',{where:side});
    await glide(lib.centre(tiles[3]),{bow:-0.12});await sleep(110);await click();
    await release('Shift');mark('picked');
    await sleep(260);
    await glide(lib.centre(t.tile(tiles,'planck_t6000')),{bow:0.2});await sleep(140);
    await down();await sleep(130);
    // Land the stack's first plot where the finished grid's top-left plot goes.
    const dropA={x:X(GOAL.planck.x[0])-boxes.dropPlanck.dx,y:Y(GOAL.planck.y[0])-boxes.dropPlanck.dy};
    await glide(dropA,{bow:-0.07,ms:1050});await sleep(230);await up();
    await need('four plots placed',async()=>await t.count()===4);mark('dropA');
    await sleep(380);
    // ---- Align & Arrange: reflow the stack as a grid ----
    // Down the stack first: the panel opens level with the pointer, and it should land just
    // below where the grid will form (two native rows and Arrange's default 9-unit gap) and
    // clear of the "Placed 4 plots" toast at the bottom of the window.
    await glide({x:X(GOAL.planck.x[0]+150),y:Y(GOAL.planck.y[0]+2*GOAL.planck.native[1]+9.07)+40},{bow:0.12,ms:520});
    await sleep(160);
    await chord('Alt+t','Alt+T');mark('panelA');
    boxes.panelA=await need('Arrange',()=>rect(PANEL));
    if(boxes.panelA.y+boxes.panelA.h>ctx.HEIGHT-60)throw Error('The Arrange panel opened low enough to meet the toast: '+JSON.stringify(boxes.panelA));
    await sleep(520);
    await glide(await button('Reflow as grid (G)'),{bow:0.1});await sleep(170);await click();mark('grid');
    await sleep(700);
    await glide(await button('↵Apply'),{bow:-0.08});await sleep(170);await click();mark('applyA');
    await need('panel closed',async()=>!(await rect(PANEL)));
    boxes.gridBig=await need('grid selected',()=>rect('.canvas-host .overlay-svg .sel-box'));
    // ---- one corner, all four: Shift keeps the proportions ----
    const g=boxes.gridBig,s=GOAL.planck.w/GOAL.planck.native[0];
    const corner={x:g.x+g.w,y:g.y+g.h},shrunk={x:g.x+g.w*s,y:g.y+g.h*s};
    await glide(corner,{bow:0.14});
    await until(marks.applyA+1000);
    await hold('Shift');await sleep(160);
    await down();mark('resize0');await sleep(150);
    await glide(shrunk,{bow:0,ms:1250});await sleep(320);await up();mark('resize1');
    await release('Shift');
    await sleep(650);
    // ---- the pink gap guides: column gap, then row gap ----
    let frames=await t.units();
    const colGap=frames[1].x-(frames[0].x+frames[0].w),rowGap=frames[2].y-(frames[0].y+frames[0].h);
    // gaps that put the second column and the second row where the finished figure has them
    const goalCol=GOAL.planck.x[1]-frames[0].x-frames[0].w,goalRow=GOAL.planck.y[1]-frames[0].y-frames[0].h;
    let guide=await need('column guide',async()=>(await t.guides()).find(q=>q.axis==='x'));
    let grab={x:guide.x,y:guide.y+guide.h*0.22};
    await glide(grab,{bow:0.1});await sleep(170);await down();mark('gapx0');await sleep(140);
    // the top left stays fixed: drag the guide left and the right column follows it
    await glide({x:grab.x-(colGap-goalCol)*z,y:grab.y},{bow:0,ms:700});await sleep(220);await up();mark('gapx1');
    await sleep(420);
    guide=await need('row guide',async()=>(await t.guides()).find(q=>q.axis==='y'));
    grab={x:guide.x+guide.w*0.2,y:guide.y};
    await glide(grab,{bow:-0.1});await sleep(170);await down();mark('gapy0');await sleep(140);
    await glide({x:grab.x,y:grab.y-(rowGap-goalRow)*z},{bow:0,ms:650});await sleep(220);await up();mark('gapy1');
    await sleep(520);
    boxes.grid=await rect('.canvas-host .overlay-svg .sel-box');
    // ---- three galaxy profiles from the rail ----
    const clear=await need('clear search',()=>page.evaluate(()=>{const b=[...document.querySelectorAll('[data-plots-rail] button')].find(b=>b.getAttribute('aria-label')==='Clear search');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}));
    await glide(clear,{bow:0.1});await sleep(150);await click();mark('search');
    await sleep(160);
    await type('galaxy_p',{per:62});
    tiles=await need('galaxy tiles',async()=>{const found=await t.tiles();return found.length===3&&found.every(q=>/galaxy_profile/.test(q.name))?found:null;});
    boxes.tilesB=tiles;
    await sleep(380);
    await glide(lib.centre(tiles[0]),{bow:0.1});await sleep(120);await click();
    await hold('Shift',{where:side});
    await glide(lib.centre(tiles[2]),{bow:-0.1});await sleep(110);await click();
    await release('Shift');
    await sleep(230);
    await glide(lib.centre(tiles[0]),{bow:0.2});await sleep(140);          // the same grab point as the rehearsal
    await down();await sleep(130);
    const dropB={x:X(GOAL.planck.x[0])-boxes.dropGalaxy.dx,y:Y(GOAL.galaxy.y)-boxes.dropGalaxy.dy};
    await glide(dropB,{bow:-0.06,ms:1000});await sleep(230);await up();
    await need('three more placed',async()=>await t.count()===7);mark('dropB');
    await sleep(520);
    // ---- a gap guide again: overlap the three so they read as one stacked panel ----
    frames=await t.units();
    const pitch=frames[5].y-frames[4].y;
    guide=await need('stack guides',async()=>(await t.guides()).filter(q=>q.axis==='y')[0]);
    grab={x:guide.x+guide.w*0.12,y:guide.y};
    await glide(grab,{bow:0.12});
    await until(marks.dropB+1150);
    await sleep(120);await down();mark('gapB0');await sleep(140);
    await glide({x:grab.x,y:grab.y-(pitch-GOAL.galaxy.pitch)*z},{bow:0,ms:950});await sleep(250);await up();mark('gapB1');
    await sleep(520);
    // ---- line their y spines up with the grid's left column ----
    frames=await t.frames();
    const reference={x:frames[2].x+frames[2].w*0.62,y:frames[2].y+frames[2].h*0.42};   // planck_t12000, bottom left of the grid
    await hold('Shift');
    await glide(reference,{bow:0.12});await sleep(130);await click();mark('addRef');
    await release('Shift');
    await sleep(320);
    await key('a',{label:'A'});mark('panelB');
    boxes.panelB=await need('Align',()=>rect(PANEL));
    const ref=await page.evaluate(()=>{const s=document.querySelector('.align-arrange-panel select[aria-label="Plot alignment reference"]');return s?s.selectedIndex:-1;});
    if(ref!==0)throw Error('The spine reference is not the Planck plot');
    await sleep(620);
    const before=(await t.units())[4].x;
    await glide(await button('Align vertical Y spines (Y)'),{bow:0.1});await sleep(180);await click();mark('spines');
    await need('spines aligned',async()=>Math.abs((await t.units())[4].x-before)>2);
    await sleep(850);
    await key('Escape',{label:'esc'});mark('closeB');
    await need('panel closed',async()=>!(await rect(PANEL)));
    await sleep(260);
    await hold('Shift');
    await glide({x:reference.x+6,y:reference.y+4},{bow:0.3});await sleep(130);await click();mark('dropRef');
    await release('Shift');
    await sleep(250);
    // ---- widen all three by their right edge: the axes reflow, the type stays put ----
    const box=await need('three selected',async()=>{const b=await rect('.canvas-host .overlay-svg .sel-box');return b&&b.y>Y(GOAL.galaxy.y)-12?b:null;});
    const edge={x:box.x+box.w,y:box.y+box.h*0.36};
    await glide(edge,{bow:0.1});
    await until(marks.dropRef+950);
    await sleep(120);await down();mark('edge0');await sleep(150);
    await glide({x:X(GOAL.galaxy.right),y:edge.y+4},{bow:0,ms:1350});await sleep(320);await up();mark('edge1');
    await sleep(720);
    // ---- done: click empty canvas (nothing selected) where the pointer began ----
    await glide(rest,{bow:-0.1});await sleep(140);await click();mark('done');
    boxes.final=await t.units();
    await until(marks.edge1+1750+1500);
    mark('end');
  },

  /** The rail and the blank page; out a little for the stack and the Arrange panel under it; in
   *  on the grid for the corner drag and the gap guides; back to the rail for the galaxy
   *  profiles; in on the stack for its gap guide; the stack beside the Align panel; in on the
   *  right-edge drag; out. */
  camera(ctx){
    const {boxes:b,marks:m,frame,HEIGHT}=ctx,fig=b.figure,z=fig.w/UNITS_W;
    const X=u=>fig.x+u*z,Y=u=>fig.y+u*z;
    const top=fig.y-54,within={x:0,y:top,w:fig.x+fig.w+12+476+34,h:HEIGHT-2-top};
    const tall=fig.h+54+20;                               // the whole page with its title strip
    const rail=frame(0,tall*ctx.ASPECT,{top,within});
    // from the page's top edge to the foot of the Arrange panel
    const deep=b.panelA.y+b.panelA.h+4-(fig.y-20);                    // the toast sits just below
    const panel=frame(0,deep*ctx.ASPECT,{top:fig.y-20,within});
    const grid=frame(fig.x-30,b.gridBig.x+b.gridBig.w+42,{cy:b.gridBig.y+b.gridBig.h/2+18,within});
    // From just under the Planck grid's bottom tick marks (its tick labels and axis title stay
    // whole) down past the dropped stack, which runs to y 657 before its gap is closed.
    const stack=frame(fig.x-30,fig.x+681,{top:Y(259.5),within});
    const align=frame(fig.x-24,b.panelB.x+b.panelB.w+26,{cy:(Y(GOAL.planck.y[1])+fig.y+fig.h)/2+8,within});
    const widen=stack;
    return [
      [m.start,rail],[m.dropA+200,rail],[m.dropA+1050,panel],
      [m.applyA+200,panel],[m.applyA+1000,grid],
      [m.gapy1+420,grid],[m.gapy1+1250,rail],
      [m.dropB+300,rail],[m.dropB+1100,stack],
      [m.gapB1+420,stack],[m.gapB1+1250,align],
      [m.dropRef+100,align],[m.dropRef+900,widen],
      [m.edge1+750,widen],[m.edge1+1750,rail],
      [m.end,rail],
    ];
  },
};

/** Readings of the app this take needs, in CSS px unless named otherwise. */
function tools(ctx){
  const {page,rect,need,sleep}=ctx;
  const t={
    /** Number of plots in the active figure. */
    count:()=>page.evaluate(()=>document.querySelectorAll('.canvas-host [data-editor-element-id]').length),
    /** Each plot's frame (its hit area: the saved box, not the ink), in placement order. */
    frames:()=>page.evaluate(()=>[...document.querySelectorAll('.canvas-host [data-editor-element-id]')].map(n=>{const r=(n.querySelector('.plot-hit-area')||n).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})),
    /** The same in figure units. */
    async units(){const f=await rect(PAGE),z=f.w/UNITS_W;return (await t.frames()).map(e=>({x:+((e.x-f.x)/z).toFixed(2),y:+((e.y-f.y)/z).toFixed(2),w:+(e.w/z).toFixed(2),h:+(e.h/z).toFixed(2)}));},
    tiles:()=>page.evaluate(()=>[...document.querySelectorAll('[data-plots-rail] [data-tile]')].map(n=>{const r=n.getBoundingClientRect();return {name:n.getAttribute('data-tile').split('/').pop().replace(/\.svg$/,''),x:r.x,y:r.y,w:r.width,h:r.height};})),
    tile(tiles,name){const found=tiles.find(q=>q.name===name);if(!found)throw Error('No tile '+name);return found;},
    /** The pink gap guides of the selection: {axis, x, y, w, h}. */
    guides:()=>page.evaluate(()=>[...document.querySelectorAll('.canvas-host .gap-hit')].map(n=>{const r=n.getBoundingClientRect();return {axis:n.dataset.arrangeGap,x:r.x,y:r.y,w:r.width,h:r.height};})),
    /** A button of the Align & Arrange panel by its label, title or text. */
    button:label=>page.evaluate(label=>{const b=[...document.querySelectorAll('.align-arrange-panel button')].find(b=>(b.getAttribute('aria-label')||b.title)===label||b.textContent.trim()===label);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},label),
    async press(label){const b=await need(label,()=>t.button(label));await page.mouse.click(b.x+b.w/2,b.y+b.h/2);await sleep(450);},
    /** Replace the rail's search text and wait for exactly `n` tiles (setup only). */
    async search(text,n){
      const input=await need('rail search',()=>rect('[data-plots-rail] input.search'));
      await page.mouse.click(input.x+input.w/2,input.y+input.h/2);await page.keyboard.press('Control+a');await page.keyboard.type(text,{delay:30});
      await need(`${n} tiles for "${text}"`,async()=>(await t.tiles()).length===n);await sleep(700);
    },
  };
  return t;
}
