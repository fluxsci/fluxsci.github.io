/** Clip 4: turn a 3D model on the figure canvas (panel b).
 *
 *  Panel b holds the same protein twice: a ribbon (already upright) and a surface that starts
 *  tipped over. Double-click the surface to orbit it, drag until it stands like the ribbon
 *  (azimuth 0, elevation 0, roll 0), click away.
 *
 *  Two things are particular to this take:
 *
 *  - WebGL. Flux draws models with WebGL2 in a worker, and Chromium blocklists WebGL2 on the
 *    private display (orbit then refuses with "3D preview needs WebGL"). The flags below put
 *    WebGL on the machine's real GPU through ANGLE's Vulkan backend (it needs nothing from the X
 *    server) while the window itself is composited in software, which is what the screen grab
 *    reads. Measured on the stage: GPU compositing made each orbit frame take ~270 ms to reach
 *    the display; SwiftShader managed about 2 frames a second; llvmpipe ~40; this path ~60.
 *
 *  - Scale. While a model is being orbited Flux draws it at no more than 2 device pixels per CSS
 *    pixel whatever the display's density (OrbitOverlay: min(devicePixelRatio, 2)), so on the
 *    usual 4x stage a close framing would enlarge it. This take runs at 2x with the canvas zoomed
 *    in further instead: the same picture, every framing at least 960 px wide (1920 real pixels),
 *    so the live model is never enlarged.
 */
import {execFileSync} from 'node:child_process';
import {PANELS,sel,openFigure1,carryOver} from './_figure1.mjs';
const SURFACE=sel(PANELS.b.surface),RIBBON=sel(PANELS.b.ribbon),LABEL=sel('text_mwb0on1zp9qz_188');
const ORBIT=`[data-model3d-orbit="${PANELS.b.surface}"]`;
// Where the surface starts (the project's Figure 1) and how far a drag turns it (OrbitOverlay:
// azimuth -= 0.4 * dx, elevation += 0.4 * dy, per screen px of pointer travel).
const START={azimuth:41.13281250000022,elevation:-84.43593749999995},PER_PX=0.4;
// Land a hair past zero so the readout says "az 0° · el 0°", never "-0°" (0.0005° is invisible).
const LAND=0.0005;

const ready=(page)=>page.evaluate(q=>!!document.querySelector(q)?.classList.contains('ready'),ORBIT);
/** Where the pointer takes hold of the surface: clear of the ribbon's box, upper middle. */
const gripOf=surface=>({x:surface.x+surface.w*0.56,y:surface.y+surface.h*0.30});
const busy=()=>{try{return /compose\.py|master\.mkv/.test(execFileSync('ps',['-eo','args'],{encoding:'utf8'}));}catch{return false;}};
// The whole figure, plus the canvas to its right up to the window's edge: room for the close
// frame, which starts at panel b's letter, to reach past the surface's handles.
const coverOf=(boxes,WIDTH)=>({...boxes.whole,w:WIDTH-4-boxes.whole.x});

export default {
  // Wide enough that a frame starting at panel b's label reaches past the surface's handles.
  window:{width:2340,height:1760,scale:2},
  electronArgs:['--ignore-gpu-blocklist','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE','--disable-gpu-compositing'],
  prepare(project){carryOver(project,['c','d','e','f']);},

  async setup(ctx){
    const {boxes,rect,page,need,sleep}=ctx;
    const renderer=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');const info=gl?.getExtension('WEBGL_debug_renderer_info');return gl?String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)):null;});
    if(!renderer||/swiftshader|llvmpipe/i.test(renderer))throw Error('The stage has no hardware WebGL2 ('+renderer+'); the model would not orbit smoothly');
    await openFigure1(ctx,{figureWidth:1990,rails:false});
    boxes.surface=await rect(SURFACE);boxes.ribbon=await rect(RIBBON);boxes.label=await rect(LABEL);
    // Flux's own capture switch: live orbit frames keep their full size even if an early frame is slow.
    await page.evaluate(()=>{globalThis.__fluxModel3dFullRes=true;});
    // Warm the renderer with a cancelled orbit visit (Escape restores the view, a second Escape
    // drops the selection), so the filmed visit opens at once.
    const grip=gripOf(boxes.surface);
    await page.mouse.move(grip.x,grip.y);await page.mouse.dblclick(grip.x,grip.y);
    await need('live model (warm-up)',()=>ready(page),20000);
    await page.mouse.down();await page.mouse.move(grip.x+30,grip.y+40,{steps:8});await page.mouse.move(grip.x,grip.y,{steps:8});await page.mouse.up();
    await sleep(300);
    await page.keyboard.press('Escape');await sleep(400);await page.keyboard.press('Escape');await sleep(600);
    if(await rect(ORBIT)||await rect('.canvas-host .sel-box'))throw Error('The warm-up orbit did not close cleanly');
    const az=await page.evaluate(id=>{const s=document.querySelector(`.canvas-host [data-editor-element-id="${id}"]`);return s?1:0;},PANELS.b.surface);
    if(!az)throw Error('Surface model missing after warm-up');
    // Rest on empty canvas below the figure.
    await ctx.place({x:Math.round(boxes.whole.x+boxes.whole.w*0.3),y:ctx.HEIGHT-58});
    await sleep(3500);
    // The live model is drawn on demand, so CPU contention shows up as dropped frames mid-drag:
    // wait until no other clip is being composed or encoded on this machine.
    for(let waited=0;busy();waited+=2000){if(waited>900000)throw Error('The machine stayed busy encoding other clips');await sleep(2000);}
    return {cover:coverOf(boxes,ctx.WIDTH)};
  },

  async run(ctx){
    const {boxes,rect,need,sleep,glide,click,doubleClick,down,up,mark,page}=ctx,rest=ctx.at;
    const grip=gripOf(boxes.surface);
    mark('start');
    await sleep(700);
    await glide(grip,{bow:0.10});
    await sleep(240);await doubleClick();mark('orbit');
    await need('live model',()=>ready(page));
    boxes.hud=await need('orbit readout',()=>rect('.model3d-hud'));
    await sleep(850);
    // One deliberate drag to upright: right to undo the azimuth, down to stand it up.
    const to={x:grip.x+(START.azimuth-LAND)/PER_PX,y:grip.y+(LAND-START.elevation)/PER_PX};
    await down();mark('drag');
    await sleep(120);
    await glide(to,{bow:-0.22,ms:2500});
    await sleep(260);await up();mark('turned');
    await sleep(300);
    const readout=await page.evaluate(()=>document.querySelector('.model3d-hud')?.textContent??'');
    if(!/az 0° · el 0°/.test(readout))throw Error('The model did not land upright: '+readout.trim().slice(0,40));
    await sleep(850);
    // Click on empty canvas: the orbit visit ends and nothing is left selected.
    await glide(rest,{bow:-0.12});
    await sleep(200);await click();mark('done');
    await need('orbit closed',async()=>!(await rect(ORBIT)));
    if(await rect('.canvas-host .sel-box'))throw Error('Something is still selected');
    await sleep(2100);
    mark('end');
  },

  /** The whole figure; in on panel b, both models and the orbit readout; back out as the
   *  pointer leaves. */
  camera(ctx){
    const {boxes:b,marks:m,frame,lib}=ctx;
    const cover=coverOf(b,ctx.WIDTH);
    const whole=frame(b.whole.x,b.whole.x+b.whole.w,{top:b.whole.y});
    // Panel b alone. Panels a and b abut (a's "SS" ends a pixel short of b's letter), so the frame's
    // left edge is the boundary itself, just left of the letter: any margin would show a sliver of a.
    // Centred vertically on the models and the orbit readout.
    const content=lib.union(b.ribbon,b.surface,b.hud),left=b.label.x-0.75;
    const panel=frame(left,Math.max(left+Math.ceil(1920/ctx.SCALE),b.surface.x+b.surface.w+24),{cy:content.y+content.h/2,within:cover});
    return [
      [m.start,whole],[m.start+450,whole],[m.start+1700,panel],
      [m.turned+1150,panel],[m.turned+2400,whole],
      [m.end,whole],
    ];
  },
};
