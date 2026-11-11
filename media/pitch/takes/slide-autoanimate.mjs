/** Clip (Slides 2): plots know how to build themselves.
 *
 *  The uptake curves (Figure 1, panel d) alone on a slide of the talk. Select the plot, click
 *  ✨ Auto-animate: Flux reads the plot's anatomy and writes its build as three steps (Axes,
 *  Data, Legend & annotations). Click Slide to play the whole slide in the editor: the axes tick
 *  in, the six curves draw on along x with their points growing in as each line reaches them,
 *  the labels arrive last. The camera moves in on the plot while it builds.
 *
 *  Layout: the left rail hidden, the Animator open and set short (an ordinary layout
 *  preference), so the stage is large and the step strip sits right under it.
 *
 *  Materials: the deck "Protein structure talk" (title slide, Figure 1, and "Deuterium uptake":
 *  panel d at a talk size with a title and a source line, no animation), built in prepare
 *  (_slides.mjs).
 */
import {buildTalk,setDockHeight,enterSlides,buttonIn,stageBox} from './_slides.mjs';

const DOCK_H=250;
const steps=page=>page.evaluate(()=>[...document.querySelectorAll('button.step')].map(n=>n.textContent.replace(/\s+/g,' ').trim()));

export default {
  window:{width:1840,height:1100,scale:3},
  prepare(project){buildTalk(project,{slides:['figure','hdx']});},

  async setup(ctx){
    const {boxes,page,rect,need,sleep,lib,WIDTH,HEIGHT}=ctx;
    await enterSlides(ctx,{slide:'Deuterium uptake',titles:/Exposed regions exchange first/,rails:false});
    await setDockHeight(ctx,DOCK_H);
    boxes.stage=await stageBox(ctx);
    boxes.plot=await need('the plot',async()=>{const e=await page.evaluate(()=>[...document.querySelectorAll('.canvas-host [data-editor-element-id^="plot"]')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));return e.length===1?e[0]:null;});
    // Rest on empty canvas, left of the stage.
    await ctx.place({x:Math.round(boxes.stage.x-60),y:Math.round(boxes.stage.y+boxes.stage.h*0.8)});
    await sleep(2500);
    return {cover:{x:2,y:42,w:WIDTH-4,h:HEIGHT-44}};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,mark,lib}=ctx,rest=ctx.at,plot=boxes.plot;
    mark('start');
    await sleep(700);
    await glide({x:plot.x+plot.w*0.55,y:plot.y+plot.h*0.5},{bow:0.1});
    await sleep(200);await click();mark('select');
    const auto=await need('Auto-animate',()=>buttonIn(ctx.page,'✨ Auto-animate',boxes.stage.y+boxes.stage.h));
    boxes.auto=auto;
    await sleep(500);
    await glide(lib.centre(auto),{bow:-0.12});
    await sleep(200);await click();mark('auto');
    boxes.strip=await need('three steps',async()=>{const s=await steps(page);return s.some(x=>/Axes/.test(x))&&s.some(x=>/Data/.test(x))&&s.some(x=>/Legend/.test(x))?s:null;});
    await sleep(1300);
    // Let go of the plot (a click on empty canvas), then play the whole slide.
    await glide(rest,{bow:0.12});
    await sleep(160);await click();mark('clear');
    await sleep(350);
    // (the toolbar loses Auto-animate with the selection, so find Slide now)
    boxes.slideBtn=await need('Slide button',()=>buttonIn(page,'Slide',boxes.stage.y+boxes.stage.h));
    boxes.plotPlay=await need('the plot',async()=>{const e=await page.evaluate(()=>[...document.querySelectorAll('.canvas-host [data-editor-element-id^="plot"]')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));return e.length===1?e[0]:null;});
    if(Math.abs(boxes.plotPlay.x-plot.x)>2||Math.abs(boxes.plotPlay.w-plot.w)>2)throw Error('The stage moved');
    await glide(lib.centre(boxes.slideBtn),{bow:-0.1});
    await sleep(220);await click();mark('play');
    await sleep(150);
    await glide(rest,{bow:0.1});
    // The Animator's playhead runs through each step in turn and rests when the slide is done.
    const head=()=>page.evaluate(()=>Math.round(document.querySelector('[class*=playhead]')?.getBoundingClientRect().x??-1));
    await sleep(300);
    let last=await head(),still=0;
    for(let t=0;still<4;t++){if(t>100)throw Error('The slide did not finish playing');await sleep(150);const x=await head();still=x===last?still+1:0;last=x;}
    mark('played');
    await sleep(2600);
    mark('end');
  },

  /** The stage and the step strip; in on the plot while the slide plays; out again. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,WIDTH,HEIGHT}=ctx;
    const within={x:2,y:42,w:WIDTH-4,h:HEIGHT-44};
    const st=b.stage;
    // From the window's left edge (the Animator's toolbar starts there) to just past the stage.
    const editor=frame(2,Math.min(st.x+st.w+30,2+(HEIGHT-44)*ctx.ASPECT),{top:42,within});
    // In on the slide's content: the title's first letter to the curves' labels (no text cut at an edge).
    const u=st.w/640,plot=frame(st.x+20*u,st.x+556*u,{cy:st.y+st.h/2,within});
    return [
      [m.start,editor],[m.play,editor],[m.play+1100,plot],
      [m.played+700,plot],[m.played+1700,editor],[m.end,editor],
    ];
  },
};
