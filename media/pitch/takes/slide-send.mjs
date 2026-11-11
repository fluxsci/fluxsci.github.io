/** Clip (Slides 1): any figure becomes a slide in one click.
 *
 *  Finished Figure 1 in the Figure workspace. Send to deck… in its Inspector, pick the talk;
 *  Ctrl+3 to Slides, where the talk opens on its title slide, and ↓ to the next slide: the
 *  figure, arrived whole. Then it is edited like any figure: the four kinetics plots of panel e
 *  are marqueed and deleted, and the uptake curves (d) and the simulation panel (f) are widened
 *  by their right edges into the room, their axes reflowing while their type keeps its size.
 *
 *  Layout: the left rail is hidden (in both workspaces) and the Slides Inspector is set wider
 *  (an ordinary layout preference), so the slide stage fits one 4:3 frame. In the Figure
 *  workspace Figure 1 is zoomed and panned to stand where the slide's copy of it will stand, so
 *  the clip opens and closes on the same frame: the figure, then the slide made from it.
 *
 *  Materials: the deck "Protein structure talk" with its title slide only, built in prepare
 *  (_slides.mjs); canvas_4 made the project's first canvas (Flux reopens the first canvas when
 *  the Figure workspace is entered again). WebGL for panel b's models: the GPU path from
 *  model3d.mjs.
 */
import {PANELS,sel,openFigure1} from './_figure1.mjs';
import {buildTalk,canvas4First,enterFigure,DECK_TITLE} from './_slides.mjs';

export const GPU=['--ignore-gpu-blocklist','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE','--disable-gpu-compositing'];
const INSPECTOR_W=420;
// Slide element order after Send to deck (the figure's own order): a, the two models, d, c,
// f, e's four plots, then the letters a b c e d f. Panel a on the slide (slide units).
const A=0,D=3,F=5,E=[6,7,8,9],E_LABEL=13;
const SLIDE_A={x:21.4235,y:18.2368,w:355.5511};
const button=(page,text,scope='')=>page.evaluate(([text,scope])=>{const b=[...document.querySelectorAll(scope+' button')].find(b=>b.textContent.trim()===text);if(!b)return null;const r=b.getBoundingClientRect();return r.width?{x:r.x,y:r.y,w:r.width,h:r.height}:null;},[text,scope]);
const elements=page=>page.evaluate(()=>[...document.querySelectorAll('.canvas-host [data-editor-element-id]')].map(n=>{const r=n.getBoundingClientRect();return {id:n.getAttribute('data-editor-element-id'),x:r.x,y:r.y,w:r.width,h:r.height};}));
const selected=page=>page.evaluate(()=>{const h=[...document.querySelectorAll('.inspector h4')].map(h=>h.textContent.trim()).find(t=>/selected/i.test(t));return h?+h.match(/\d+/)[0]:0;});
const stageBox=async ctx=>{const pages=await ctx.lib.figurePages(ctx);return pages.find(p=>p.active)??pages[0];};
/** Drag the Slides Inspector's inner edge until the rail is `w` px wide (a remembered layout preference). */
export async function setInspectorWidth({page,rect,need,sleep,WIDTH},w){
  const h=await need('right rail handle',()=>rect('[aria-label="Resize right rail"]'));
  const from={x:h.x+h.w/2,y:h.y+h.h/2},to={x:WIDTH-w,y:from.y};
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  for(let i=1;i<=12;i++){await page.mouse.move(from.x+(to.x-from.x)*i/12,from.y);await sleep(30);}
  await page.mouse.up();await sleep(1500);
}
const slideText=page=>page.evaluate(()=>document.querySelector('.canvas-host')?.textContent.replace(/\s+/g,' ').trim().slice(0,200));

export default {
  // Scale 3: the slide stage re-rasterises on every drag frame, and at 4x it managed ~10 a second.
  window:{width:1840,height:1100,scale:3},
  electronArgs:GPU,
  prepare(project){buildTalk(project,{slides:[]});canvas4First(project);},

  async setup(ctx){
    const {boxes,page,rect,need,sleep,lib,WIDTH,HEIGHT}=ctx;
    const renderer=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');const info=gl?.getExtension('WEBGL_debug_renderer_info');return gl?String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)):null;});
    if(!renderer||/swiftshader|llvmpipe/i.test(renderer))throw Error('The stage has no hardware WebGL2 ('+renderer+'); panel b would not draw');
    // canvas_4 opens first now, and it is heavy (Figure 2's planet): give the first visit time.
    await enterFigure(ctx);
    await openFigure1(ctx,{rails:true});
    await page.keyboard.press('Control+b');await sleep(800);           // the left rail away (both workspaces)
    // Slides once: the talk opens on its title slide; measure its stage.
    await page.keyboard.press('Control+3');
    await need('Slides',async()=>/Prediction, exchange and dynamics/.test(await slideText(page)??''),60000);
    await sleep(1500);
    await setInspectorWidth(ctx,INSPECTOR_W);
    boxes.stage=await stageBox(ctx);
    if(boxes.stage.x<8||boxes.stage.x+boxes.stage.w>2+(HEIGHT-42)*4/3-8)throw Error('Unexpected stage '+JSON.stringify(boxes.stage));
    await page.keyboard.press('Control+1');
    await need('Figure 1 again',()=>rect(sel(PANELS.a.plot)),30000);
    await sleep(2500);
    // Figure 1 where the slide's copy will stand: panel a on panel a.
    const st=boxes.stage,u=st.w/640,goal={x:st.x+SLIDE_A.x*u,y:st.y+SLIDE_A.y*u,w:SLIDE_A.w*u};
    await lib.zoomCanvas(ctx,sel(PANELS.a.plot),goal.w);
    const a=await rect(sel(PANELS.a.plot));
    await lib.panCanvas(ctx,sel(PANELS.a.plot),{x:goal.x+(goal.w-a.w)/2,y:goal.y});
    boxes.figA=await rect(sel(PANELS.a.plot));
    const pages=await lib.figurePages(ctx);boxes.figure=pages[0];
    boxes.send=await need('Send to deck',()=>button(page,'Send to deck…'));
    // Rest on empty canvas below the stage.
    await ctx.place({x:Math.round(st.x+st.w*0.3),y:Math.round((st.y+st.h+HEIGHT)/2)+6});
    await sleep(3000);
    // The window below its title bar (the clock square sits in the title bar).
    return {cover:{x:2,y:42,w:WIDTH-4,h:HEIGHT-44}};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,down,up,key,mark,lib}=ctx,rest=ctx.at;
    const st=boxes.stage,u=st.w/640;
    mark('start');
    await sleep(650);
    // ---- Send to deck… → the talk ----
    await glide(lib.centre(boxes.send),{bow:0.12});
    await sleep(220);await click();mark('menu');
    const row=await need('deck row',()=>button(page,DECK_TITLE,'.style-pop'));
    boxes.pop=await rect('.style-pop');
    await sleep(560);
    await glide({x:row.x+row.w*0.8,y:row.y+row.h/2},{bow:-0.2});
    await sleep(200);await click();mark('sent');
    boxes.toast=await need('toast',async()=>{const r=await rect('.toasts .toast');return r&&await page.evaluate(()=>/Sent "Figure 1" to deck/.test(document.querySelector('.toasts')?.textContent))?r:null;});
    await sleep(750);
    await glide(rest,{bow:0.1});
    await sleep(180);await click();                                  // focus back on the canvas
    await sleep(400);
    // ---- to Slides: the talk, then its next slide ----
    await key('Control+3',{label:'Ctrl+3',where:[0.5,0.965]});mark('slides');
    await need('the talk',async()=>/Prediction, exchange and dynamics/.test(await slideText(page)??''),30000);
    await sleep(1100);
    await key('ArrowDown',{label:'↓',where:[0.5,0.965]});mark('slide2');
    let els=await need('the figure on the stage',async()=>{const e=await elements(page);return e.length===16?e:null;},20000);
    const s2=await stageBox(ctx);
    if(Math.abs(s2.x-st.x)>2||Math.abs(s2.w-st.w)>2)throw Error('The stage moved');
    boxes.slide={a:els[A],d:els[D],f:els[F],e:lib.union(...E.map(i=>els[i]),els[E_LABEL])};
    for(const i of E)if(els[i].x+els[i].w/2<els[D].x+els[D].w)throw Error('Panel e is not right of panel d');
    await sleep(1150);
    // ---- marquee panel e (touching only it) and delete it ----
    const d=els[D],eLabel=els[E_LABEL];
    const m0={x:st.x+st.w+10,y:st.y+st.h+26},m1={x:d.x+d.w+10,y:eLabel.y+eLabel.h*0.6};
    await glide(m0,{bow:0.12});
    await sleep(180);await down();await sleep(120);
    await glide(m1,{bow:0,ms:900});await sleep(220);await up();mark('picked');
    await need('panel e picked',async()=>await selected(page)===5);
    await sleep(520);
    await key('Delete',{label:'del',where:[0.88,0.9]});mark('deleted');
    await need('panel e deleted',async()=>(await elements(page)).length===11);
    await sleep(450);
    // ---- widen d to the slide's right column ----
    const right=st.x+602.8*u;
    await glide({x:d.x+d.w*0.55,y:d.y+d.h*0.45},{bow:0.1});
    await sleep(200);await click();mark('dSel');
    let box=await need('d selected',()=>rect('.canvas-host .overlay-svg .sel-box'));
    await sleep(350);
    await glide({x:box.x+box.w,y:box.y+box.h/2},{bow:0.08});
    await sleep(200);await down();mark('d0');await sleep(140);
    await glide({x:right,y:box.y+box.h/2+3},{bow:0,ms:1300});await sleep(300);await up();mark('d1');
    await sleep(520);
    // ---- widen f the same way ----
    els=await elements(page);
    const f=els.find(q=>Math.abs(q.y-boxes.slide.f.y)<2&&Math.abs(q.x-boxes.slide.f.x)<2);
    if(!f)throw Error('Panel f moved');
    await glide({x:f.x+f.w*0.5,y:f.y+f.h*0.42},{bow:-0.1});
    await sleep(200);await click();mark('fSel');
    box=await need('f selected',async()=>{const b=await rect('.canvas-host .overlay-svg .sel-box');return b&&Math.abs(b.y-f.y)<20?b:null;});
    await sleep(350);
    await glide({x:box.x+box.w,y:box.y+box.h/2},{bow:0.08});
    await sleep(200);await down();mark('f0');await sleep(140);
    await glide({x:right,y:box.y+box.h/2+3},{bow:0,ms:1300});await sleep(300);await up();mark('f1');
    await sleep(600);
    // ---- click away where the pointer rested: nothing selected; the slide as made ----
    await glide(rest,{bow:-0.12});
    await sleep(160);await click();mark('done');
    await need('nothing selected',async()=>!(await rect('.canvas-host .overlay-svg .sel-box')));
    boxes.result=await elements(page);
    await sleep(2300);
    mark('end');
  },

  /** The figure; across to Send to deck and its deck list; back for the toast and Slides (the
   *  same frame: title slide, then the figure as a slide); in on the right of the stage for the
   *  delete and the widening of d; down for f; out to the whole slide. */
  camera(ctx){
    const {boxes:b,marks:m,frame,HEIGHT,WIDTH}=ctx;
    const within={x:2,y:42,w:WIDTH-4,h:HEIGHT-44};
    const st=b.stage;
    const whole=frame(2,2+Math.floor((HEIGHT-44)*ctx.ASPECT),{top:42,within});
    const pop=b.pop??b.send;
    const send=frame(WIDTH-4-760,WIDTH-4,{cy:(b.send.y+pop.y+pop.h)/2+30,within});
    const eBox=b.slide.e,d=b.slide.d;
    const right=frame(d.x-4,st.x+st.w+40,{cy:(Math.min(d.y,eBox.y)+st.y+st.h)/2+12,within});
    const lower=frame(st.x-12,Math.min(st.x+st.w+30,st.x-12+(HEIGHT-44)*ctx.ASPECT),{cy:(d.y+st.y+st.h)/2+40,within});
    return [
      [m.start,whole],[m.start+600,whole],[m.start+1700,send],
      [m.sent+400,send],[m.sent+1500,whole],
      [m.slide2+1200,whole],[m.slide2+2000,right],
      [m.d1+300,right],[m.d1+1000,lower],
      [m.done,lower],[m.done+900,whole],
      [m.end,whole],
    ];
  },
};
