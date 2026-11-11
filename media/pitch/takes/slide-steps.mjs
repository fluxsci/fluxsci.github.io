/** Clip (Slides 3): any edit can be a step.
 *
 *  A slide of the talk holds the simulation panel (Figure 1 f, at 190–610 ns) beside the
 *  hexagon map (panel c, in rainbow). Step 1 already widens f's x view to the whole run (the edit
 *  of the axis-view clip). The clip makes step 2 with the edit of the colour-map clip: + Step,
 *  Edit after step 2, select the map, F, its colour scale, Crameri, roma. Then Slide plays the
 *  slide from its start: the axis glides out to 0–1000 while the curves extend, then the map
 *  sweeps from rainbow to roma. (Present is not filmed: its overlay covers the recorder's clock.)
 *
 *  Layout: the left rail hidden, the Animator open and set short (ordinary layout preferences).
 *
 *  Materials: the deck "Protein structure talk" with the slide "Dynamics and mobility" (panels f
 *  and c as in the Figure clips' starting state, a title and a source line) and its step 1 (a
 *  Change of f's view, written with the CLI's set-plot-view --beat), built in prepare.
 */
import {buildTalk,flux,setDockHeight,enterSlides,buttonIn,stageBox} from './_slides.mjs';

const DOCK_H=250,MENU='.fluxFigMenu.placed';
const plots=page=>page.evaluate(()=>[...document.querySelectorAll('.canvas-host [data-editor-element-id^="plot"]')].map(n=>{const r=n.getBoundingClientRect();return {id:n.getAttribute('data-editor-element-id'),x:r.x,y:r.y,w:r.width,h:r.height};}));
const steps=page=>page.evaluate(()=>[...document.querySelectorAll('button.step')].map(n=>n.textContent.replace(/\s+/g,' ').trim()));
const anyButton=(page,text)=>page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text&&b.getBoundingClientRect().width>0);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},text);

export default {
  window:{width:1840,height:1100,scale:3},
  prepare(project){
    const ids=buildTalk(project,{slides:['figure','hdx','steps']});
    const {deck}=ids,{slide,rmsd}=ids.steps;
    const beat=flux(project,'add-beat',deck,slide).match(/beat_[a-z0-9]+_\d+/)[0];
    flux(project,'set-plot-view',`${deck}/${slide}`,rmsd,'--beat',beat,'--reset');
  },

  async setup(ctx){
    const {boxes,page,rect,need,sleep,WIDTH,HEIGHT}=ctx;
    await enterSlides(ctx,{slide:'Dynamics and mobility',titles:/Simulations fold; the conserved core is rigid/,rails:false});
    await setDockHeight(ctx,DOCK_H);
    boxes.stage=await stageBox(ctx);
    const p=await need('two plots',async()=>{const e=await plots(page);return e.length===2?e:null;});
    [boxes.rmsd,boxes.hex]=p[0].x<p[1].x?p:[p[1],p[0]];
    const s=await need('the step strip',async()=>{const s=await steps(page);return s.some(x=>/Start/.test(x))&&s.some(x=>/Step 1/.test(x))?s:null;},15000);
    if(!s.some(x=>/Step 1/.test(x))||s.some(x=>/Step 2/.test(x)))throw Error('Expected Start and Step 1, found '+JSON.stringify(s));
    boxes.plus=await need('+ Step',()=>buttonIn(page,'+ Step',boxes.stage.y+boxes.stage.h));
    await ctx.place({x:Math.round(boxes.stage.x+boxes.stage.w*0.42),y:Math.round(boxes.stage.y+boxes.stage.h+16)});
    await sleep(2500);
    return {cover:{x:2,y:42,w:WIDTH-4,h:HEIGHT-44}};
  },

  async run(ctx){
    const {boxes,page,rect,textRect,need,sleep,glide,click,key,hold,release,mark,lib}=ctx,rest=ctx.at,hex=boxes.hex;
    mark('start');
    await sleep(800);
    // ---- a new step, and edits that land after it ----
    await glide(lib.centre(boxes.plus),{bow:0.12});
    await sleep(200);await click();mark('plus');
    await need('step 2',async()=>(await steps(page)).some(x=>/Step 2/.test(x)));
    const edit=await need('Edit after step 2',()=>anyButton(page,'Edit after step 2'));
    boxes.edit=edit;
    await sleep(600);
    await glide({x:edit.x+edit.w*0.18,y:edit.y+edit.h*0.6},{bow:-0.1});         // the pointer clear of the label
    await sleep(200);await click();mark('after');
    await need('editing after step 2',()=>page.evaluate(()=>/Editing after 2/.test(document.body.innerText)));
    await sleep(900);
    // ---- the colour map, exactly as in Figure ----
    await glide({x:hex.x+hex.w*0.55,y:hex.y+hex.h*0.4},{bow:0.1});
    await sleep(200);await click();mark('select');
    await sleep(450);
    await key('f',{label:'F',where:[0.12,0.9]});mark('menu');
    boxes.menu=await need('menu',()=>rect(MENU));
    const row=await need('colour scale row',()=>rect('.fluxFigMenu .field[data-key="c"] .actbtn'));
    await sleep(650);
    await glide(lib.centre(row),{bow:-0.1});
    await sleep(190);await click();mark('editor');
    boxes.editor=await need('editor',async()=>{const r=await rect(MENU);return r&&r.w>700?r:null;});
    if(boxes.editor.x+boxes.editor.w>hex.x+8)throw Error('The colour editor did not open left of the map');
    const tab=await need('Crameri tab',()=>textRect('.fluxFigMenu','button.tab','Crameri'));
    await sleep(450);
    await glide(lib.centre(tab),{bow:0.1});
    await sleep(170);await click();mark('tab');
    await sleep(500);                                                // the Crameri list settles
    let roma=await need('roma',()=>textRect('.fluxFigMenu','.cm','roma'));
    boxes.tab=tab;
    await glide({x:roma.x+62,y:roma.y+roma.h/2},{bow:-0.12});
    roma=await textRect('.fluxFigMenu','.cm','roma');boxes.roma=roma;
    if(Math.abs(ctx.at.y-(roma.y+roma.h/2))>roma.h/3)throw Error('The roma row moved under the pointer');
    await sleep(170);await click();mark('roma');
    await need('roma applied',()=>page.evaluate(()=>/crameri\.roma/.test(document.querySelector('.fluxFigMenu')?.textContent??'')),3000);
    await sleep(1100);
    for(let i=0;i<3&&await rect('.fluxFigMenu');i++){await key('Escape',{label:'esc',where:[0.12,0.9]});await sleep(300);}
    if(await rect('.fluxFigMenu'))throw Error('The menu did not close');
    const lanes=await page.evaluate(()=>document.body.innerText.includes('burial_conservation_hexmatrix'));
    if(!lanes)throw Error('No Change of the map at step 2');
    // ---- click away, and play the slide from its start ----
    await glide(rest,{bow:-0.12});
    await sleep(160);await click();mark('away');
    await sleep(400);
    const play=await need('Slide button',()=>buttonIn(page,'Slide',boxes.stage.y+boxes.stage.h));
    boxes.slideBtn=play;
    await sleep(700);
    await glide(lib.centre(play),{bow:0.1});
    await sleep(200);await click();mark('play');
    await sleep(120);
    await glide(rest,{bow:0.1});
    // Note when the second step starts, and when the playhead comes to rest.
    const head=()=>page.evaluate(()=>Math.round(document.querySelector('[class*=playhead]')?.getBoundingClientRect().x??-1));
    const active=()=>page.evaluate(()=>document.querySelector('button.step.active')?.textContent??'');
    let last=await head(),still=0;
    for(let t=0;still<5;t++){
      if(t>150)throw Error('The slide did not finish playing');
      await sleep(100);
      if(!ctx.marks.s2&&/Step 2/.test(await active()))mark('s2');
      const x=await head();still=x===last?still+1:0;last=x;
    }
    if(!ctx.marks.s2)throw Error('Step 2 never played');
    mark('played');
    await sleep(1800);
    mark('end');
  },

  /** The stage and the step strip; in on the bar above the stage; the map and its menu; the
   *  colour editor beside the map; out; in Present, the simulation panel for step 1, the map
   *  for step 2; out to the editor. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,WIDTH,HEIGHT}=ctx;
    const within={x:2,y:42,w:WIDTH-4,h:HEIGHT-44};
    const st=b.stage,hex=b.hex,menu=b.menu,ed=b.editor;
    // From the window's left edge (the Animator's toolbar starts there) to just past the stage.
    const editor=frame(2,Math.min(st.x+st.w+30,2+(HEIGHT-44)*ctx.ASPECT),{top:42,within});
    const bar=frame(2,st.x+460*st.w/640,{top:42,within});
    const withMenu=frame(hex.x-30,menu.x+menu.w+16,{cy:(Math.min(hex.y,menu.y)+Math.max(hex.y+hex.h,menu.y+menu.h))/2,within});
    const swatch=frame(b.roma.x-24,hex.x+hex.w+24,{cy:(ed.y+Math.max(hex.y+hex.h,b.roma.y+60))/2,within});
    // The map, from just under the slide's title (its type is never cut at the frame's edge).
    const u=st.w/640,hx=b.hex.x+b.hex.w/2,half=Math.max(320,b.hex.w/2+22);
    const mapRight=Math.min(hx+half,st.x+st.w-2);
    const map=frame(mapRight-2*half,mapRight,{top:st.y+41*u,within});
    // The simulation panel with the Slide button below it, so the click and the glide share a frame.
    const btn=b.slideBtn,need=(btn.y+btn.h+12)-(b.rmsd.y-12);
    const rmsd=frame(2,Math.max(b.rmsd.x+b.rmsd.w+24,2+need*ctx.ASPECT),{bottom:btn.y+btn.h+12,within});
    return [
      [m.start,editor],[m.start+600,editor],[m.plus+300,editor],[m.plus+1000,bar],
      [m.after+500,bar],[m.after+1300,editor],
      [m.menu+100,editor],[m.menu+900,withMenu],
      [m.editor+100,withMenu],[m.editor+900,swatch],
      [m.roma+1000,swatch],[m.away-500,editor],
      [m.away+100,editor],[m.away+1000,rmsd],
      [m.s2-150,rmsd],[m.s2+450,map],
      [m.played+700,map],[m.played+1600,editor],[m.end,editor],
    ];
  },
};
