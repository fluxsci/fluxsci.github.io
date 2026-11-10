/** Record one pitch-article take: the real Flux app, driven by real input events, grabbed
 *  losslessly from a private X display.
 *
 *    node media/pitch/record.mjs --flux-source <checkout> --project <FluxProj> --take colormap --out <dir>
 *
 *  Writes <out>/capture.mkv (lossless RGB, 60 fps, the stage region at device pixels) and
 *  <out>/take.json (the pointer's glides, clicks, keys, named moments and the on-screen boxes the
 *  camera is framed on, all on the page's clock). compose.py turns the pair into the clip.
 *
 *  Nothing is drawn into the app. The pointer is composited afterwards from the logged path, so
 *  it is smooth at any frame rate, and it is the app's own: the take records which of Flux's
 *  cursor images was showing at every moment (cursors.mjs renders them for the compositor). The only addition to the page is one 8 px square outside
 *  every camera frame whose colour is the page clock in milliseconds; it tells the compositor
 *  exactly which moment each grabbed frame shows.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {attach} from './lib.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const opt=(name,fallback)=>{const at=process.argv.indexOf('--'+name);return at<0?fallback:process.argv[at+1];};
const source=path.resolve(opt('flux-source','')),project=path.resolve(opt('project','')),out=path.resolve(opt('out','')),takeName=opt('take','colormap');
if(!opt('flux-source')||!opt('project')||!opt('out'))throw Error('Pass --flux-source, --project and --out');
fs.mkdirSync(out,{recursive:true});
const WIDTH=1840,HEIGHT=1100,SCALE=+opt('scale',4),DISPLAY=opt('display','97'),PORT=+opt('port',9333);

// ---- stage -----------------------------------------------------------------------------
const stage=spawn(process.execPath,[path.join(here,'stage.mjs'),'--flux-source',source,'--project',project,'--width',WIDTH,'--height',HEIGHT,'--scale',SCALE,'--display',DISPLAY,'--port',PORT],{stdio:['ignore','pipe','inherit']});
let grab=null;
const shutdown=()=>{try{grab?.kill('SIGKILL');}catch{}try{stage.kill('SIGTERM');}catch{}};
process.on('exit',shutdown);process.on('SIGINT',()=>process.exit(1));
await new Promise((resolve,reject)=>{let buffer='';stage.stdout.on('data',b=>{buffer+=b;if(buffer.includes('"ready"'))resolve();});stage.on('exit',c=>reject(Error('stage exited '+c)));setTimeout(()=>reject(Error('stage timeout')),90000);});

const {browser,page,cdp,sleep,rect,shot}=await attach(PORT);
const now=()=>performance.now();
// Page clock = driver clock + offset (best of several round trips).
let offset=0;{let best=1e9;for(let i=0;i<25;i++){const a=now(),p=await page.evaluate(()=>performance.now()),b=now();if(b-a<best){best=b-a;offset=p-(a+b)/2;}}}
const pageTime=()=>now()+offset;

// ---- input, logged on the page clock ---------------------------------------------------
const log={glides:[],clicks:[],keys:[],marks:{}};
let at={x:0,y:0};
// A hand reaching for a target: quick off the mark, fastest about a third of the way, then a
// long soft landing. (Minimum-jerk position over a time warp that front-loads the travel.)
const ease=s=>{const g=1-Math.pow(1-s,1.6);return g*g*g*(10+g*(-15+6*g));};
/** How long a reach of `d` px takes: a little for any move, more for a longer one (Fitts). */
const reach=d=>150+135*Math.log2(1+d/30);
/** Glide along an arc to `to`. `bow` is the sideways bulge as a fraction of the distance. The
 *  path is logged as a formula (start, duration, the arc's three points), not as samples, so the
 *  compositor can place the pointer exactly at any instant. */
async function glide(to,bow=0.12,ms){
  const from={...at},dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1;
  ms??=reach(d);
  const mid={x:from.x+dx/2-dy*bow,y:from.y+dy/2+dx*bow};
  const t0=now();
  log.glides.push({t0:+(t0+offset).toFixed(2),ms:+ms.toFixed(1),from,mid,to:{...to}});
  for(;;){
    const s=Math.min(1,(now()-t0)/ms),e=ease(s),u=1-e;
    at={x:u*u*from.x+2*u*e*mid.x+e*e*to.x,y:u*u*from.y+2*u*e*mid.y+e*e*to.y};
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:at.x,y:at.y});
    if(s>=1)break;
    await sleep(5);
  }
  at={...to};
}
async function click(hold=85){
  const t=pageTime();
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:at.x,y:at.y,button:'left',buttons:1,clickCount:1});
  await sleep(hold);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:at.x,y:at.y,button:'left',buttons:0,clickCount:1});
  log.clicks.push({down:+t.toFixed(2),up:+pageTime().toFixed(2),x:at.x,y:at.y});
}
async function key(k,label=k.toUpperCase(),hold=90){
  const t=pageTime();
  await page.keyboard.down(k);await sleep(hold);await page.keyboard.up(k);
  log.keys.push({down:+t.toFixed(2),up:+pageTime().toFixed(2),label});
}
const mark=name=>{log.marks[name]=+pageTime().toFixed(2);};
const centre=r=>({x:r.x+r.w/2,y:r.y+r.h/2});
const need=async(what,get,ms=8000)=>{const t=now();for(;;){const v=await get();if(v)return v;if(now()-t>ms)throw Error('Timed out: '+what);await sleep(60);}};
const textRect=(scope,selector,text)=>page.evaluate(([scope,selector,text])=>{const n=[...document.querySelectorAll(scope+' '+selector)].find(n=>n.textContent.trim().split(/\s+/)[0]===text||n.textContent.trim()===text);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},[scope,selector,text]);

// ---- the take ---------------------------------------------------------------------------
const PLOT='[data-editor-element-id="plot_mw9ytjva3dsi_77"]';
const boxes={};
// Region grabbed from the display (CSS px); every camera frame lies inside it. Set by setup().
let region=null;
const ASPECT=4/3;

/** Flux opens at its own default size, and there is no window manager on the private display.
 *  Size and place the X window so the page is exactly WIDTH x HEIGHT with its corner at the
 *  display's corner (the window has invisible resize borders, found by looking for a marker). */
async function fitWindow(){
  const env={...process.env,DISPLAY:':'+DISPLAY};
  const x=(...args)=>execFileSync('xdotool',args,{env,encoding:'utf8'}).trim();
  const id=(await need('app window',async()=>x('search','--onlyvisible','--name','Flux').split('\n').filter(Boolean)[0],15000));
  const inner=()=>page.evaluate(()=>[innerWidth,innerHeight]);
  let size=[WIDTH*SCALE,HEIGHT*SCALE];
  for(let i=0;i<4;i++){
    x('windowsize',id,String(size[0]),String(size[1]));await sleep(500);
    const [w,h]=await inner();
    if(w===WIDTH&&h===HEIGHT)break;
    size=[size[0]+(WIDTH-w)*SCALE,size[1]+(HEIGHT-h)*SCALE];
  }
  await page.evaluate(()=>{const m=document.createElement('div');m.id='pitch-origin';m.style.cssText='position:fixed;left:0;top:0;width:6px;height:6px;z-index:2147483647;background:rgb(255,0,255);pointer-events:none';document.documentElement.appendChild(m);});
  const origin=()=>{
    const n=160,raw=execFileSync('ffmpeg',['-loglevel','error','-f','x11grab','-draw_mouse','0','-video_size',`${n}x${n}`,'-i',`:${DISPLAY}.0+0,0`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<26});
    for(let y=0;y<n;y++)for(let px=0;px<n;px++){const i=(y*n+px)*3;if(raw[i]===255&&raw[i+1]===0&&raw[i+2]===255)return [px,y];}
    return null;
  };
  // A window this large repaints slowly in software; wait for the marker rather than a fixed time.
  x('windowmove',id,'0','0');
  const found=await need('page corner on the display',async()=>{await sleep(300);return origin();},20000);
  x('windowmove',id,String(-found[0]),String(-found[1]));
  const check=await need('page corner at the display corner',async()=>{await sleep(300);const at=origin();return at&&!at[0]&&!at[1]?at:null;},20000);
  const [w,h]=await inner();
  await page.evaluate(()=>document.getElementById('pitch-origin').remove());
  if(!check||check[0]||check[1]||w!==WIDTH||h!==HEIGHT||await page.evaluate(()=>devicePixelRatio)!==SCALE)throw Error(`Window does not fill the display: page ${w}x${h}, corner at ${check}`);
}

async function setup(){
  await fitWindow();
  await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Figure]')),30000);
  await page.evaluate(()=>document.querySelector('button[aria-label=Figure]').click());
  await need('figure mode',()=>rect('.canvas-host'),20000);
  await sleep(1500);
  await page.getByText('canvas_4',{exact:true}).click();
  await need('panel e',()=>rect(PLOT),20000);
  await sleep(2500);
  // Zoom about the plot (ctrl+wheel) until the panel is about 297 px across: large enough to
  // read, small enough that the menu beside it stays legible in the same frame.
  let r=await rect(PLOT);
  for(let i=0;i<14;i++){
    r=await rect(PLOT);
    const notches=Math.round(Math.log(297/r.w)/0.15);
    if(!notches)break;
    await page.mouse.move(r.x+r.w/2,r.y+r.h/2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0,notches>0?-100:100);
    await page.keyboard.up('Control');
    await sleep(350);
  }
  await sleep(1800);
  // Pan the panel to where the F menu will open on its LEFT (no room on the right) and clamp to
  // the window's bottom edge, so the menu's working rows sit beside the plot.
  r=await rect(PLOT);
  const target={x:WIDTH-440-r.w,y:HEIGHT-432};
  for(let i=0;i<8;i++){
    r=await rect(PLOT);const dx=r.x-target.x,dy=r.y-target.y;
    if(Math.abs(dx)<0.6&&Math.abs(dy)<0.6)break;
    await page.mouse.move(700,500);await page.mouse.wheel(dx,dy);await sleep(700);
  }
  boxes.plot=await rect(PLOT);
  boxes.canvas=await rect('.canvas-host');
  boxes.figure=await need('figure page',()=>rect('.canvas-host rect.figure-bg.active'));
  // The opening frame: the whole figure with a little canvas around it, resting on the window's
  // bottom edge. The grabbed region is that frame plus a margin for the clock square.
  const figure=boxes.figure,w=figure.w+64,h=w/ASPECT;
  boxes.establish={x:figure.x-32,y:HEIGHT-2-h,w,h};
  if(boxes.establish.y<boxes.canvas.y||boxes.establish.x<boxes.canvas.x||boxes.establish.x+w>boxes.canvas.x+boxes.canvas.w)throw Error('The opening frame does not fit the canvas: '+JSON.stringify(boxes));
  const x0=Math.floor(boxes.establish.x)-10,y0=Math.floor(boxes.establish.y)-10;
  region={x:x0,y:y0,w:Math.ceil(boxes.establish.x+w)+2-x0,h:HEIGHT-y0};
  // Rest the pointer on empty canvas below the figure, then let the canvas finish sharpening.
  at={x:Math.round(boxes.establish.x+w*0.27),y:HEIGHT-58};
  await page.mouse.move(at.x,at.y);
  await sleep(4000);
}

async function stamp(){
  await page.evaluate(({x,y})=>{
    const s=document.createElement('div');s.id='pitch-clock';
    s.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:8px;height:8px;z-index:2147483647;pointer-events:none;background:#000`;
    document.documentElement.appendChild(s);
    // The pointer the app itself shows. Flux draws its own cursor (a pink arrow by default) as CSS
    // cursor images and animates a press by swapping them on the canvas. Each frame, note the
    // image Chromium would show: the cursor of the element holding the pointer capture, else of
    // the element under the pointer.
    const at={x:-1,y:-1},seen=window.__pitchCursor={images:[],timeline:[]};let last=-1,pressed=null;
    addEventListener('pointermove',e=>{at.x=e.clientX;at.y=e.clientY;},true);
    addEventListener('pointerdown',e=>{pressed=e.pointerId;at.x=e.clientX;at.y=e.clientY;},true);
    const canvas=document.querySelector('.canvas-host');
    const tick=()=>{
      const now=performance.now(),t=Math.round(now)&0xffffff;s.style.background=`rgb(${t>>16},${(t>>8)&255},${t&255})`;
      if(at.x>=0){
        const holder=pressed!==null&&canvas?.hasPointerCapture(pressed)?canvas:document.elementFromPoint(at.x,at.y);
        const cursor=holder?getComputedStyle(holder).cursor:'none';
        let index=seen.images.indexOf(cursor);if(index<0)index=seen.images.push(cursor)-1;
        if(index!==last){seen.timeline.push([+now.toFixed(1),index]);last=index;}
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },{x:region.x+2,y:region.y+2});
  // Tell the sampler where the pointer rests, without leaving the resting place.
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:at.x+1,y:at.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:at.x,y:at.y});
  await sleep(300);
}

async function startGrab(){
  const size=`${region.w*SCALE}x${region.h*SCALE}`,input=`:${DISPLAY}.0+${region.x*SCALE},${region.y*SCALE}`;
  grab=spawn('ffmpeg',['-y','-loglevel','warning','-stats','-f','x11grab','-draw_mouse','0','-framerate','60','-video_size',size,'-i',input,'-c:v','libx264rgb','-preset','ultrafast','-qp','0','-threads','32',path.join(out,'capture.mkv')],{stdio:['pipe','ignore','pipe']});
  let err='';grab.stderr.on('data',b=>{err+=b;});
  grab.report=()=>err.split(/[\r\n]+/).filter(Boolean).slice(-3).join(' | ');
  await sleep(900);
  if(grab.exitCode!==null)throw Error('ffmpeg did not start: '+err);
}
async function stopGrab(){
  grab.stdin.write('q');
  await new Promise(r=>grab.once('exit',r));
  console.log('grab:',grab.report());grab=null;
}

const takes={
  /** The whole figure; in to panel e; select it; F; the colour-scale editor; three Crameri maps;
   *  back out to the figure. The camera (compose.py, CAMERAS.colormap) is timed on these marks. */
  async colormap(){
    const plot=boxes.plot;
    const rest={...at};log.rest=rest;
    mark('start');
    await sleep(700);
    await glide({x:plot.x+plot.w*0.60,y:plot.y+plot.h*0.44},0.10);
    await sleep(260);await click();mark('select');
    await sleep(560);
    await key('f','F');mark('menu');
    boxes.menu=await need('menu',()=>rect('.fluxFigMenu.placed'));
    const edit=await need('colour scale row',()=>rect('.fluxFigMenu .field[data-key="c"] .actbtn'));
    boxes.edit=edit;
    await sleep(700);
    await glide(centre(edit),-0.10);
    await sleep(180);await click();mark('editor');
    await sleep(350);
    boxes.editor=await need('editor',async()=>{const r=await rect('.fluxFigMenu.placed');return r&&r.w>700?r:null;});
    boxes.palette=await need('palette list',()=>rect('.fluxFigMenu .cmp'));
    const tab=await need('Crameri tab',()=>textRect('.fluxFigMenu','button.tab','Crameri'));
    await sleep(650);
    await glide(centre(tab),0.12);
    await sleep(150);await click();mark('tab');
    await sleep(380);
    boxes.editorTall=await rect('.fluxFigMenu.placed');
    boxes.tab=await need('Crameri tab',()=>textRect('.fluxFigMenu','button.tab','Crameri'));
    boxes.rows={};
    let bow=0.10;
    for(const name of ['vik','managua','roma']){
      const row=await need(name,()=>textRect('.fluxFigMenu','.cm',name));
      boxes.rows[name]=row;
      await glide({x:row.x+62,y:row.y+row.h/2},bow);bow=name==='vik'?0.35:-0.35;
      await sleep(150);await click();mark('map:'+name);
      await sleep(name==='roma'?850:700);
    }
    // The pointer returns to where it began, over empty canvas, so nothing is hovered when the menu
    // closes and the loop restarts from the same place.
    await glide(rest,-0.14);
    await sleep(100);
    // Escape closes the menu; from some states it first steps back to the properties.
    for(let i=0;i<2&&await rect('.fluxFigMenu');i++){await key('Escape','esc');await sleep(320);}
    if(await rect('.fluxFigMenu'))throw Error('The menu did not close');
    mark('close');
    await sleep(1850);
    mark('reveal');
    await sleep(2150);
    mark('end');
  },
};

try{
  await setup();
  await stamp();
  await startGrab();
  await takes[takeName]();
  await sleep(400);
  await stopGrab();
  await shot(path.join(out,'after.png'));
  const pointer=await page.evaluate(()=>window.__pitchCursor);
  const revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const dirty=execFileSync('git',['-C',source,'status','--porcelain','--','src','electron','dist'],{encoding:'utf8'}).trim()!=='';
  fs.writeFileSync(path.join(out,'take.json'),JSON.stringify({take:takeName,recorded:new Date().toISOString(),flux:{revision,dirty},window:{width:WIDTH,height:HEIGHT,scale:SCALE},region,clock:{x:2,y:2,size:8},boxes,pointer,...log},null,1));
  console.log('take written to',out,'| span',((log.marks.end-log.marks.start)/1000).toFixed(2),'s | glides',log.glides.length,'| region',JSON.stringify(region));
}finally{
  await browser.close().catch(()=>{});
  shutdown();
}
process.exit(0);
